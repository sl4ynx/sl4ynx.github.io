# Seguridad

- **No pongas API keys en frontend** (`dashboard.html`, `config.js`, etc.).
- Usa un backend/proxy para llamar a Replicate y ElevenLabs.
- Guarda las llaves en variables de entorno del backend.

## Frontend

Edita `config.js` y reemplaza:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://TU-BACKEND.com"
};
```

## Endpoints esperados por `dashboard.html`

- `POST /api/generate-video`
  - Body JSON: `{ "prompt": "..." }`
- `POST /api/tts`
  - Body JSON: `{ "text": "...", "voiceId": "...", "format": "..." }`

Ambos deben responder JSON.
