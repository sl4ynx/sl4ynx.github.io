import crypto from 'node:crypto';
import { config } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOWED_HOSTS = ['replicate.delivery', 'replicate.com', 'pollinations.ai'];
const EXT_BY_TYPE = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};

function isAllowedUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && ALLOWED_HOSTS.some((h) => x.hostname === h || x.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

// Sustituye "{{var}}" por su valor y descarta las claves sin valor.
function fillTemplate(json, vars) {
  const tpl = JSON.parse(json);
  const out = {};
  for (const [k, v] of Object.entries(tpl)) {
    const m = typeof v === 'string' && v.match(/^\{\{(\w+)\}\}$/);
    const val = m ? vars[m[1]] : v;
    if (val !== undefined && val !== null && val !== '') out[k] = val;
  }
  return out;
}

async function runReplicate(model, input) {
  if (!config.replicate.token) throw new Error('Falta REPLICATE_API_TOKEN');
  if (!/^[\w.-]+\/[\w.-]+$/.test(model)) throw new Error('Modelo de Replicate no válido');
  const headers = { Authorization: `Bearer ${config.replicate.token}`, 'Content-Type': 'application/json', Prefer: 'wait=30' };

  let res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST', headers, body: JSON.stringify({ input }),
  });
  let pred = await res.json();
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${pred.detail || 'error'}`);

  const deadline = Date.now() + 10 * 60 * 1000;
  while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    if (Date.now() > deadline) throw new Error('Tiempo de espera agotado');
    if (!isAllowedUrl(pred.urls?.get)) throw new Error('URL de consulta no permitida');
    await sleep(3000);
    res = await fetch(pred.urls.get, { headers: { Authorization: headers.Authorization } });
    pred = await res.json();
  }
  if (pred.status !== 'succeeded') throw new Error(`Replicate: ${pred.error || pred.status}`);
  return Array.isArray(pred.output) ? pred.output[0] : pred.output;
}

async function download(url) {
  let res;
  // Los redirects se siguen a mano para validar cada destino contra la lista de hosts permitidos.
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedUrl(url)) throw new Error('URL de resultado no permitida');
    res = await fetch(url, { redirect: 'manual' });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!next) break;
    url = new URL(next, url).href;
  }
  if (!res.ok) throw new Error(`Descarga fallida (${res.status})`);
  const ext = EXT_BY_TYPE[(res.headers.get('content-type') || '').split(';')[0].trim()];
  if (!ext) throw new Error('Tipo de archivo no soportado');
  const len = Number(res.headers.get('content-length') || 0);
  if (len > config.maxDownloadBytes) throw new Error('Archivo demasiado grande');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > config.maxDownloadBytes) throw new Error('Archivo demasiado grande');
  return { buffer, ext };
}

/**
 * Devuelve { mock: true, seed } o { buffer, ext }.
 * params: { kind, prompt, duration, ratio, image (data URI opcional) }
 */
export async function generate(params) {
  if (config.provider === 'pollinations') {
    // Servicio gratuito sin clave; solo genera imágenes.
    if (params.kind !== 'image') throw new Error('El proveedor gratuito no genera video');
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(params.prompt)}?width=1024&height=1024&nologo=true&seed=${crypto.randomInt(1e9)}`;
    return download(url);
  }
  if (config.provider === 'replicate') {
    const isVideo = params.kind === 'video';
    const model = isVideo ? config.replicate.videoModel : config.replicate.imageModel;
    if (!model) throw new Error(`Falta el modelo de ${params.kind} en la configuración`);
    const input = fillTemplate(isVideo ? config.replicate.videoInput : config.replicate.imageInput, {
      prompt: params.prompt,
      duration: params.duration,
      ratio: params.ratio ? params.ratio.replace('/', ':') : undefined,
      image: params.image,
    });
    return download(await runReplicate(model, input));
  }
  await sleep(params.kind === 'video' ? 4000 : 1500);
  return { mock: true, seed: crypto.randomUUID() };
}
