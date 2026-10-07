import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { db } from '../db.js';
import { clearSession, issueSession, publicUser, requireAuth } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync('contraseña-ficticia', 12);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
});

const text = (v, min, max) => (typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : null);
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

router.post('/auth/register', authLimiter, async (req, res) => {
  const { name, email, password, adult } = req.body ?? {};
  const cleanName = text(name, 2, 30);
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!cleanName) return bad(res, 'El nombre debe tener entre 2 y 30 caracteres.');
  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) return bad(res, 'Correo electrónico no válido.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) return bad(res, 'La contraseña debe tener entre 8 y 72 caracteres.');
  if (adult !== true) return bad(res, 'Debes confirmar que eres mayor de 18 años.');

  const hash = await bcrypt.hash(password, 12);
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (email, name, password_hash, credits, credits_day, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cleanEmail, cleanName, hash, config.dailyCredits, new Date().toISOString().slice(0, 10), Date.now());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    issueSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (/UNIQUE/i.test(err.message)) return bad(res, 'Ya existe una cuenta con ese correo.', 409);
    throw err;
  }
});

router.post('/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = typeof email === 'string' ? db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) : null;
  // Se compara siempre para que el tiempo de respuesta no revele si el correo existe.
  const ok = await bcrypt.compare(typeof password === 'string' ? password.slice(0, 72) : '', user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return bad(res, 'Correo o contraseña incorrectos.', 401);
  issueSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch('/me', requireAuth, (req, res) => {
  const name = text(req.body?.name, 2, 30);
  if (!name) return bad(res, 'El nombre debe tener entre 2 y 30 caracteres.');
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ user: publicUser({ ...req.user, name }) });
});

router.post('/me/password', requireAuth, authLimiter, async (req, res) => {
  const { current, next } = req.body ?? {};
  if (typeof current !== 'string' || !(await bcrypt.compare(current.slice(0, 72), req.user.password_hash))) {
    return bad(res, 'La contraseña actual no es correcta.', 403);
  }
  if (typeof next !== 'string' || next.length < 8 || next.length > 72) return bad(res, 'La nueva contraseña debe tener entre 8 y 72 caracteres.');
  const hash = await bcrypt.hash(next, 12);
  // Subir token_version cierra el resto de sesiones abiertas.
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hash, req.user.id);
  issueSession(res, { ...req.user, token_version: req.user.token_version + 1 });
  res.json({ ok: true });
});

router.delete('/me', requireAuth, authLimiter, async (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || !(await bcrypt.compare(password.slice(0, 72), req.user.password_hash))) {
    return bad(res, 'La contraseña no es correcta.', 403);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  await fs.rm(path.join(config.mediaDir, String(req.user.id)), { recursive: true, force: true });
  clearSession(res);
  res.json({ ok: true });
});

export default router;
