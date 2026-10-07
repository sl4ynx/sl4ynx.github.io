import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { isPromptAllowed } from '../moderation.js';
import { generate } from '../providers.js';

const router = Router();
router.use(requireAuth);

const STYLES = ['Realista', 'Anime', 'Fantasía', 'Cyberpunk', 'Ilustración', '3D', 'Cinematográfico'];
const RATIOS = ['16/9', '9/16', '1/1'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;

const dto = (m) => ({
  id: m.id,
  kind: m.kind,
  prompt: m.prompt,
  style: m.style,
  character: m.character,
  duration: m.duration,
  ratio: m.ratio,
  status: m.status,
  error: m.error,
  seed: m.seed,
  fileUrl: m.file ? `/api/media/${m.id}/file` : null,
  createdAt: m.created_at,
});

const parseId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

function parseSourceImage(value) {
  const match = typeof value === 'string' && value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_SOURCE_IMAGE_BYTES) return null;
  const valid = match[1] === 'image/png'
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === 'image/jpeg'
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return valid ? value : null;
}

// ---------- Procesado en segundo plano ----------
function failJob(id, reason) {
  tx(() => {
    const row = db.prepare("SELECT user_id, cost FROM media WHERE id = ? AND status = 'pending'").get(id);
    if (!row) return;
    db.prepare("UPDATE media SET status = 'failed', error = ? WHERE id = ?").run(reason, id);
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(row.cost, row.user_id);
  });
}

async function runJob(id, params) {
  try {
    const result = await generate(params);
    let file = null;
    let seed = null;
    if (result.mock) {
      seed = result.seed;
    } else {
      const userId = db.prepare('SELECT user_id FROM media WHERE id = ?').get(id)?.user_id;
      if (!userId) return;
      file = path.join(String(userId), `${crypto.randomUUID()}.${result.ext}`);
      await fs.mkdir(path.join(config.mediaDir, String(userId)), { recursive: true });
      await fs.writeFile(path.join(config.mediaDir, file), result.buffer);
    }
    const { changes } = db.prepare("UPDATE media SET status = 'done', file = ?, seed = ? WHERE id = ? AND status = 'pending'").run(file, seed, id);
    if (!changes && file) await fs.rm(path.join(config.mediaDir, file), { force: true });
  } catch (err) {
    console.error(`Trabajo ${id} fallido:`, err.message);
    failJob(id, 'La generación ha fallado. Se han devuelto tus créditos.');
  }
}

// Trabajos que quedaron a medias al reiniciar el servidor.
for (const row of db.prepare("SELECT id FROM media WHERE status = 'pending'").all()) {
  failJob(row.id, 'Interrumpido por un reinicio del servidor. Créditos devueltos.');
}

// Valida, cobra y encola. Devuelve la fila creada o responde con error.
function enqueue(req, res, { kind, cost, duration = null, ratio = null, sourceId = null, sourceImage = null }) {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const style = req.body?.style;
  const characterName = typeof req.body?.character === 'string' && req.body.character ? req.body.character : null;

  if (prompt.length < 3 || prompt.length > 500) return res.status(400).json({ error: 'La descripción debe tener entre 3 y 500 caracteres.' });
  if (!STYLES.includes(style)) return res.status(400).json({ error: 'Estilo no válido.' });
  if (!isPromptAllowed(prompt)) return res.status(422).json({ error: 'La descripción no cumple las normas de contenido.' });

  let fullPrompt = `${prompt}, estilo ${style}`;
  let character = null;
  if (characterName) {
    const c = db.prepare('SELECT name, description FROM characters WHERE user_id = ? AND name = ?').get(req.user.id, characterName);
    if (!c) return res.status(400).json({ error: 'Personaje no encontrado.' });
    if (!isPromptAllowed(c.description)) return res.status(422).json({ error: 'La descripción del personaje no cumple las normas de contenido.' });
    character = c.name;
    fullPrompt += `. Personaje: ${c.name}. ${c.description}`;
  }

  let image = sourceImage;
  if (sourceId) {
    const src = db.prepare("SELECT file FROM media WHERE id = ? AND user_id = ? AND kind = 'image' AND status = 'done'").get(sourceId, req.user.id);
    if (!src) return res.status(400).json({ error: 'Imagen de partida no encontrada.' });
    if (src.file) {
      // La lectura se hace en el trabajo en segundo plano para no bloquear la respuesta.
      image = src.file;
    }
  }

  let created;
  try {
    created = tx(() => {
      const pending = db.prepare("SELECT COUNT(*) AS n FROM media WHERE user_id = ? AND status = 'pending'").get(req.user.id).n;
      if (pending >= config.maxPendingPerUser) return { error: 'Ya tienes varias generaciones en curso. Espera a que terminen.', status: 429 };
      const paid = db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?').run(cost, req.user.id, cost);
      if (!paid.changes) return { error: 'No tienes créditos suficientes.', status: 402 };
      const { lastInsertRowid } = db
        .prepare(`INSERT INTO media (user_id, kind, prompt, style, character, duration, ratio, source_id, status, cost, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .run(req.user.id, kind, prompt, style, character, duration, ratio, sourceId, cost, Date.now());
      return { id: Number(lastInsertRowid) };
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno.' });
  }
  if (created.error) return res.status(created.status).json({ error: created.error });

  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(created.id);
  const credits = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id).credits;
  res.status(202).json({ media: dto(row), credits });

  (async () => {
    let imageData = typeof image === 'string' && image.startsWith('data:image/') ? image : null;
    if (image && !imageData) {
      try {
        const buf = await fs.readFile(path.join(config.mediaDir, image));
        const ext = path.extname(image).slice(1);
        if (MIME[ext] && buf.length <= 8 * 1024 * 1024) imageData = `data:${MIME[ext]};base64,${buf.toString('base64')}`;
      } catch { /* sin imagen de partida */ }
    }
    await runJob(created.id, { kind, prompt: fullPrompt, duration, ratio, image: imageData });
  })();
}

router.post('/images', (req, res) => enqueue(req, res, { kind: 'image', cost: config.imageCost }));

router.post('/videos', (req, res) => {
  const duration = Number(req.body?.duration);
  const cost = config.videoCost[duration];
  if (!cost) return res.status(400).json({ error: 'Duración no válida.' });
  const ratio = req.body?.ratio;
  if (!RATIOS.includes(ratio)) return res.status(400).json({ error: 'Formato no válido.' });
  const sourceId = req.body?.sourceId ? parseId(req.body.sourceId) : null;
  if (req.body?.sourceId && !sourceId) return res.status(400).json({ error: 'Imagen de partida no válida.' });
  const sourceImage = req.body?.sourceImage ? parseSourceImage(req.body.sourceImage) : null;
  if (req.body?.sourceImage && !sourceImage) return res.status(400).json({ error: 'La foto debe ser JPG, PNG o WebP y no superar 8 MB.' });
  if (sourceId && sourceImage) return res.status(400).json({ error: 'Elige la imagen de partida de tus creaciones o sube una foto, no ambas.' });
  enqueue(req, res, { kind: 'video', cost, duration, ratio, sourceId, sourceImage });
});

router.get('/', (req, res) => {
  const kind = ['image', 'video'].includes(req.query.kind) ? req.query.kind : null;
  const rows = kind
    ? db.prepare('SELECT * FROM media WHERE user_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 200').all(req.user.id, kind)
    : db.prepare('SELECT * FROM media WHERE user_id = ? ORDER BY created_at DESC LIMIT 400').all(req.user.id);
  const credits = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id).credits;
  res.json({ media: rows.map(dto), credits });
});

router.get('/:id/file', (req, res) => {
  const id = parseId(req.params.id);
  const row = id && db.prepare('SELECT file FROM media WHERE id = ? AND user_id = ? AND file IS NOT NULL').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Archivo no encontrado.' });
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(path.join(config.mediaDir, row.file));
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const row = id && db.prepare('SELECT id, file, status FROM media WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'No encontrado.' });
  if (row.status === 'pending') return res.status(409).json({ error: 'Espera a que termine la generación.' });
  db.prepare('DELETE FROM media WHERE id = ?').run(id);
  if (row.file) await fs.rm(path.join(config.mediaDir, row.file), { force: true });
  res.json({ ok: true });
});

export default router;
