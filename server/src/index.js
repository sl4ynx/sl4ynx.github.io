import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import './db.js';
import accountRoutes from './routes/account.js';
import characterRoutes from './routes/characters.js';
import mediaRoutes from './routes/media.js';

const app = express();
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: config.crossSite ? 'cross-origin' : 'same-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'media-src': ["'self'"],
      'connect-src': ["'self'"],
      'upgrade-insecure-requests': config.isProd ? [] : null,
    },
  },
}));
app.use(cookieParser());
app.use('/api/media/videos', express.json({ limit: '11mb' }));
app.use(express.json({ limit: '20kb' }));

// CORS solo para los orígenes del front-end configurados en CLIENT_ORIGIN.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && config.clientOrigins.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

// Defensa CSRF adicional a SameSite=Lax: las peticiones que modifican datos deben venir del mismo origen.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    try {
      const { host } = new URL(origin);
      if (host !== req.get('host') && !config.clientOrigins.includes(origin)) return res.status(403).json({ error: 'Origen no permitido.' });
    } catch {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
  }
  next();
});

app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/characters', characterRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', accountRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

app.use(express.static(publicDir, { extensions: ['html'] }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status === 400 ? 400 : 500).json({ error: err.status === 400 ? 'Petición no válida.' : 'Error interno.' });
});

app.listen(config.port, () => {
  console.log(`Servidor en http://localhost:${config.port}  (proveedor de IA: ${config.provider})`);
});
