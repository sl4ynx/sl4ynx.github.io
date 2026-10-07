import crypto from 'node:crypto';
import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    console.error('Falta JWT_SECRET en producción.');
    process.exit(1);
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('JWT_SECRET no definido: se usa uno temporal (las sesiones se pierden al reiniciar).');
}

const dataDir = path.resolve(process.env.DATA_DIR || './data');

// Orígenes (separados por comas) desde los que se sirve el front-end, p. ej. https://usuario.github.io
const clientOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

export const config = {
  isProd,
  clientOrigins,
  crossSite: clientOrigins.length > 0,
  port: Number(process.env.PORT) || 3000,
  trustProxy: process.env.TRUST_PROXY === '1',
  jwtSecret,
  dataDir,
  mediaDir: path.join(dataDir, 'media'),
  maxPendingPerUser: 3,
  maxDownloadBytes: 100 * 1024 * 1024,
  provider: process.env.AI_PROVIDER || 'mock',
  replicate: {
    token: process.env.REPLICATE_API_TOKEN || '',
    imageModel: process.env.REPLICATE_IMAGE_MODEL || '',
    videoModel: process.env.REPLICATE_VIDEO_MODEL || '',
    imageInput: process.env.REPLICATE_IMAGE_INPUT || '{"prompt":"{{prompt}}"}',
    videoInput: process.env.REPLICATE_VIDEO_INPUT || '{"prompt":"{{prompt}}","image":"{{image}}","duration":"{{duration}}"}',
  },
};
