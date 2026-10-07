import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const STYLES = ['Realista', 'Anime', 'Fantasía', 'Cyberpunk'];
const dto = (c) => ({ id: c.id, name: c.name, style: c.style, desc: c.description, createdAt: c.created_at });

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ characters: rows.map(dto) });
});

router.post('/', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const desc = typeof req.body?.desc === 'string' ? req.body.desc.trim() : '';
  const style = req.body?.style;
  if (name.length < 1 || name.length > 40) return res.status(400).json({ error: 'El nombre debe tener entre 1 y 40 caracteres.' });
  if (desc.length > 400) return res.status(400).json({ error: 'La descripción es demasiado larga.' });
  if (!STYLES.includes(style)) return res.status(400).json({ error: 'Estilo no válido.' });

  const count = db.prepare('SELECT COUNT(*) AS n FROM characters WHERE user_id = ?').get(req.user.id).n;
  if (count >= 50) return res.status(400).json({ error: 'Has alcanzado el máximo de personajes.' });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO characters (user_id, name, style, description, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, name, style, desc, Date.now());
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ character: dto(row) });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID no válido.' });
  const { changes } = db.prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(id, req.user.id);
  if (!changes) return res.status(404).json({ error: 'Personaje no encontrado.' });
  res.json({ ok: true });
});

export default router;
