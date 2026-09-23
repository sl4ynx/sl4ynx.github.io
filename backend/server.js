const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || '';

const VIDEOS_DIR = path.join(__dirname, '..', 'videos');
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/videos', express.static(VIDEOS_DIR));

const jobs = new Map();
let counter = 1;

function createJob(prompt, duration, kind = 'video') {
  const id = String(counter++);
  const job = {
    id,
    kind,
    prompt,
    duration,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    url: null,
    error: null
  };
  jobs.set(id, job);
  return job;
}

function updateJob(id, patch) {
  const current = jobs.get(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(id, next);
  return next;
}

function fakeVideoUrl(id) {
  return `${API_BASE_URL}/videos/generated-${id}.mp4`;
}

async function simulateGeneration(jobId) {
  updateJob(jobId, { status: 'processing' });
  await new Promise((resolve) => setTimeout(resolve, 2500));
  updateJob(jobId, {
    status: 'completed',
    url: fakeVideoUrl(jobId)
  });
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    api_configured: Boolean(REPLICATE_API_KEY)
  });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'Job not found' });
  }
  res.json({ ok: true, job });
});

app.get('/api/jobs', (_req, res) => {
  res.json({ ok: true, jobs: Array.from(jobs.values()).reverse() });
});

app.post('/api/generate', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const duration = Number(req.body?.duration || 10);

  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'prompt is required' });
  }

  const job = createJob(prompt, duration, 'video');
  simulateGeneration(job.id).catch((error) => {
    updateJob(job.id, {
      status: 'failed',
      error: error?.message || 'generation failed'
    });
  });

  res.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    url: fakeVideoUrl(job.id)
  });
});

app.post('/api/generate-video', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const duration = Number(req.body?.duration || 10);

  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'prompt is required' });
  }

  const job = createJob(prompt, duration, 'video');
  simulateGeneration(job.id).catch((error) => {
    updateJob(job.id, {
      status: 'failed',
      error: error?.message || 'generation failed'
    });
  });

  res.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    url: fakeVideoUrl(job.id)
  });
});

app.post('/api/tts', (req, res) => {
  const text = String(req.body?.text || '').trim();
  const voiceId = String(req.body?.voiceId || '').trim();
  const format = String(req.body?.format || 'mp3_44100_128').trim();

  if (!text) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }

  res.json({
    ok: true,
    text,
    voiceId: voiceId || 'default',
    format,
    url: `${API_BASE_URL}/audio/generated-${Date.now()}.mp3`
  });
});

app.post('/api/generate-image', (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();

  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'prompt is required' });
  }

  res.json({
    ok: true,
    url: `https://placehold.co/1024x1024/png?text=${encodeURIComponent(prompt.slice(0, 30))}`
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`REPLICATE_API_KEY: ${REPLICATE_API_KEY ? 'configured' : 'missing'}`);
});
