import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';

const COOKIE = 'sid';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Con el front-end en otro dominio la cookie debe ser SameSite=None (y por tanto Secure).
const cookieOpts = { httpOnly: true, sameSite: config.crossSite ? 'none' : 'lax', secure: config.isProd || config.crossSite, path: '/' };

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '7d' });
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: WEEK_MS });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, cookieOpts);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.token_version !== payload.tv) throw new Error('sesión inválida');
    req.user = user;
    next();
  } catch {
    clearSession(res);
    res.status(401).json({ error: 'Sesión caducada' });
  }
}

export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  plan: u.plan,
  createdAt: u.created_at,
});
