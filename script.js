// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (event) {
    event.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const planKey = 'motionflow_plan';
const usageKey = 'motionflow_usage';
const userKey = 'motionflow_user';
const accountsKey = 'motionflow_accounts';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(userKey) || sessionStorage.getItem(userKey) || 'null';
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem(accountsKey) || '[]');
  } catch {
    return [];
  }
}

function saveCurrentUser(username, email, plan = 'free', password = '', remember = true) {
  const user = { username, email, plan, password };
  try {
    if (remember) {
      localStorage.setItem(userKey, JSON.stringify(user));
    } else {
      sessionStorage.setItem(userKey, JSON.stringify(user));
    }
  } catch (e) {
    localStorage.setItem(userKey, JSON.stringify(user));
  }
  updateAuthUI();
  return user;
}

function syncUserToAccounts(username, email, plan = 'free', password = '') {
  const accounts = getAccounts();
  const existingIndex = accounts.findIndex((account) => {
    return account.username.toLowerCase() === username.toLowerCase() || account.email.toLowerCase() === email.toLowerCase();
  });

  const user = { username, email, plan, password };

  if (existingIndex >= 0) {
    accounts[existingIndex] = { ...accounts[existingIndex], ...user };
  } else {
    accounts.push(user);
  }

  localStorage.setItem(accountsKey, JSON.stringify(accounts));
  return user;
}

function getPlan() {
  const user = getCurrentUser();
  if (user && user.plan) return user.plan;
  return localStorage.getItem(planKey) || 'free';
}

function setPlan(plan) {
  const user = getCurrentUser();
  if (user) {
    const updatedUser = { ...user, plan };
    try {
      if (localStorage.getItem(userKey)) {
        localStorage.setItem(userKey, JSON.stringify(updatedUser));
      } else if (sessionStorage.getItem(userKey)) {
        sessionStorage.setItem(userKey, JSON.stringify(updatedUser));
      } else {
        localStorage.setItem(userKey, JSON.stringify(updatedUser));
      }
    } catch {
      localStorage.setItem(userKey, JSON.stringify(updatedUser));
    }
    syncUserToAccounts(updatedUser.username, updatedUser.email, plan);
  } else {
    localStorage.setItem(planKey, plan);
  }
  updatePlanUI();
}

function getUsageMap() {
  try {
    return JSON.parse(localStorage.getItem(usageKey) || '{}');
  } catch {
    return {};
  }
}

function getTodayUsage() {
  const map = getUsageMap();
  return Number(map[getTodayKey()] || 0);
}

function setTodayUsage(value) {
  const map = getUsageMap();
  map[getTodayKey()] = value;
  localStorage.setItem(usageKey, JSON.stringify(map));
}

function updatePlanUI() {
  const planTag = document.getElementById('planTag');
  const statusPill = document.getElementById('statusPill');
  const usageCounter = document.getElementById('usageCounter');
  const plan = getPlan();
  const user = getCurrentUser();

  if (planTag) {
    planTag.textContent = plan === 'premium' ? 'Plan: Premium' : 'Plan: Gratis';
  }

  if (usageCounter) {
    const current = getTodayUsage();
    usageCounter.textContent = `${current} / ${plan === 'premium' ? '∞' : '1'}`;
  }

  if (statusPill) {
    statusPill.textContent = user
      ? (plan === 'premium' ? 'Premium activo' : 'Límite diario disponible')
      : 'Registrate para empezar';
  }
}

function updateAuthUI() {
  const generateBtn = document.getElementById('generateBtn');
  const authSummary = document.getElementById('authSummary');
  const user = getCurrentUser();

  if (generateBtn) {
    generateBtn.disabled = !user;
  }

  if (authSummary) {
    authSummary.textContent = user
      ? `Cuenta activa: ${user.username} · ${user.email}`
      : 'Todavía no tienes cuenta.';
  }

  updatePlanUI();
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.color = isError ? '#ffb7b7' : '#f1d8a2';
}

function canGenerate(kind = 'video') {
  const user = getCurrentUser();
  const plan = getPlan();

  if (kind === 'photo-video') return true;
  if (plan === 'premium') return true;
  if (!user) return true;
  return getTodayUsage() < 1;
}

let lastPhotoPreview = '';
let lastGeneratedVideoUrl = null;
let lastGeneratedVideoName = null;

function renderPreview(kind, prompt, extraLabel = '') {
  const preview = document.getElementById('studioPreview');
  if (!preview) return;

  const label = kind === 'image'
    ? 'Imagen creada'
    : kind === 'photo-video'
      ? 'Video desde foto'
      : 'Video creado';
  const promptText = prompt ? prompt.trim() : 'Sin descripción';
  const detail = extraLabel || promptText;
  const photoBackground = lastPhotoPreview ? `background-image: url("${lastPhotoPreview}"); background-size: cover; background-position: center;` : '';

  preview.innerHTML = `
    <div class="studio-preview-label">${label}</div>
    <div class="studio-preview-media">
      <div class="studio-thumb" style="${kind === 'image'
        ? 'linear-gradient(135deg, rgba(215,175,101,0.3), rgba(255,255,255,0.08))'
        : kind === 'photo-video'
          ? photoBackground || 'linear-gradient(135deg, rgba(87, 180, 255, 0.34), rgba(255,255,255,0.08))'
          : 'linear-gradient(135deg, rgba(117, 185, 255, 0.28), rgba(255,255,255,0.08))'}"></div>
      <div class="studio-meta">
        <strong>${kind === 'image' ? 'Imagen generada' : kind === 'photo-video' ? 'Video desde foto' : 'Video generado'}</strong>
        <span>${detail.slice(0, 54)}${detail.length > 54 ? '...' : ''}</span>
      </div>
    </div>
  `;
}

// ✅ UPDATED: Better video preview with proper video element
function updatePreviewWithVideo(videoUrl, labelText = 'Video generado') {
  const preview = document.getElementById('studioPreview');
  const previewLabel = document.getElementById('previewLabel');
  
  if (previewLabel) previewLabel.textContent = labelText;
  if (!preview) return;

  console.log('[Preview] Loading video from:', videoUrl);

  // Create video element with proper styling
  preview.innerHTML = `
    <video 
      id="generatedVideo" 
      controls 
      autoplay
      muted
      playsinline
      style="width: 100%; height: 100%; border-radius: 8px; object-fit: contain; background: #000;">
      <source src="${videoUrl}" type="video/mp4">
      Tu navegador no soporta videos HTML5
    </video>
  `;

  const videoEl = document.getElementById('generatedVideo');
  if (videoEl) {
    // Try to autoplay (muted by default)
    videoEl.muted = true;
    
    const playPromise = videoEl.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        console.log('[Preview] Video playing');
      }).catch((err) => {
        console.warn('[Preview] Autoplay failed (browser policy):', err);
      });
    }

    // Enable download when metadata loads
    videoEl.addEventListener('loadedmetadata', () => {
      console.log('[Preview] Video metadata loaded');
      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) {
        downloadBtn.disabled = false;
        console.log('[Preview] Download button enabled');
      }
    });

    // Log errors
    videoEl.addEventListener('error', (e) => {
      console.error('[Preview] Video error:', e);
      showToast('Error al cargar el video', true);
    });
  }
}

const photoInput = document.getElementById('photoInput');
if (photoInput) {
  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    const photoStage = document.getElementById('photoStage');
    if (!file || !photoStage) return;

    if (!file.type.startsWith('image/')) {
      showToast('El archivo seleccionado debe ser una imagen.', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target && event.target.result ? String(event.target.result) : '';
      lastPhotoPreview = result;
      photoStage.innerHTML = `
        <div class="photo-frame">
          <img src="${result}" alt="Foto seleccionada para convertir en video" />
        </div>
        <div class="photo-caption">
          <span class="photo-pill">Listo</span>
          <strong>${file.name}</strong>
        </div>
      `;
      showToast('Imagen lista para convertir en video.');
    };
    reader.readAsDataURL(file);
  });
}

async function generateVideo() {
  const promptInput = document.getElementById('videoPrompt');
  const statusPill = document.getElementById('statusPill');
  const usageCounter = document.getElementById('usageCounter');

  if (!canGenerate('video')) {
    showToast('Ya has usado tu vídeo diario gratis. Activa Premium para generar videos ilimitados.', true);
    if (statusPill) statusPill.textContent = 'Límite alcanzado';
    return;
  }

  if (statusPill) {
    statusPill.textContent = 'Generando video con IA...';
  }

  const currentPrompt = promptInput ? promptInput.value.trim() : '';
  showToast(currentPrompt ? `Generando video para: ${currentPrompt.slice(0, 42)}...` : 'Generando video...');

  try {
    const durationInput = document.getElementById('videoDuration');
    const duration = durationInput ? Number(durationInput.value) : 10;

    const endpoint = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000/api/generate'
      : '/api/generate';

    console.log('[Generate] Sending request to:', endpoint);

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: currentPrompt, duration })
    });

    console.log('[Generate] Response status:', resp.status);

    const data = await resp.json();
    
    if (!data.ok) {
      showToast('Error al generar: ' + (data.error || 'unknown'), true);
      if (statusPill) statusPill.textContent = 'Error en generación';
      return;
    }

    const plan = getPlan();
    if (plan !== 'premium' && getCurrentUser()) {
      const nextUsage = getTodayUsage() + 1;
      setTodayUsage(nextUsage);
    }

    lastGeneratedVideoUrl = data.url;
    lastGeneratedVideoName = lastGeneratedVideoUrl.split('/').pop();

    console.log('[Generate] Video URL:', lastGeneratedVideoUrl);

    updatePreviewWithVideo(lastGeneratedVideoUrl, 'Video generado');

    if (statusPill) {
      statusPill.textContent = 'Video listo ✓';
    }

    if (usageCounter) {
      usageCounter.textContent = plan === 'premium' ? `∞ / ∞` : `${getTodayUsage()} / 1`;
    }

    showToast(plan === 'premium' || !getCurrentUser()
      ? 'Video generado. Puedes seguir creando desde esta vista.'
      : 'Video generado. Hoy ya usaste tu cuota gratuita.');
  } catch (err) {
    console.error('[Generate Error]', err);
    showToast('Error durante la generación: ' + err.message, true);
    if (statusPill) statusPill.textContent = 'Error';
  }
}

const generateBtn = document.getElementById('generateBtn');
if (generateBtn) {
  generateBtn.addEventListener('click', generateVideo);
}

// Upload helper for photo-to-video
async function uploadPhotoToServer(file, allowNSFW = false) {
  const form = new FormData();
  form.append('photo', file);
  form.append('allow_nsfw', allowNSFW ? '1' : '0');
  form.append('prompt', 'Smooth animation and elegant motion');

  const endpoint = (window.location.hostname === 'localhost')
    ? 'http://localhost:3000/api/photo-to-video'
    : '/api/photo-to-video';

  const resp = await fetch(endpoint, {
    method: 'POST',
    body: form
  });
  return resp.json();
}

// Quick-create buttons
document.querySelectorAll('.quick-create-btn').forEach((button) => {
  button.addEventListener('click', async () => {
    const kind = button.dataset.kind || 'video';
    const promptInput = document.getElementById('videoPrompt');
    const photoInputEl = document.getElementById('photoInput');
    const prompt = promptInput ? promptInput.value.trim() : '';
    const statusPill = document.getElementById('statusPill');

    if (kind === 'photo-video') {
      const file = photoInputEl && photoInputEl.files ? photoInputEl.files[0] : null;
      if (!file) {
        showToast('Sube una foto para convertirla en video.', true);
        return;
      }

      const nsfwConsentEl = document.getElementById('nsfwConsent');
      const allowNSFW = nsfwConsentEl && nsfwConsentEl.checked;

      if (statusPill) statusPill.textContent = 'Subiendo foto...';
      try {
        console.log('[PhotoVideo] Uploading photo...');
        const result = await uploadPhotoToServer(file, allowNSFW);
        
        if (!result.ok) {
          const err = result.error || 'unknown';
          showToast('Error al procesar la imagen: ' + err, true);
          if (statusPill) statusPill.textContent = 'Error';
          return;
        }

        const videoUrl = result.url;
        lastGeneratedVideoUrl = videoUrl;
        lastGeneratedVideoName = videoUrl.split('/').pop();

        console.log('[PhotoVideo] Generated video URL:', videoUrl);

        updatePreviewWithVideo(videoUrl, 'Video desde foto');

        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) downloadBtn.disabled = false;
        if (statusPill) statusPill.textContent = 'Video desde foto listo ✓';
        showToast('Foto convertida en video. Puedes descargarla.');
      } catch (e) {
        console.error('[PhotoVideo Error]', e);
        showToast('Error al convertir la foto: ' + e.message, true);
        if (statusPill) statusPill.textContent = 'Error';
      }
      return;
    }

    // Regular video/image generation
    if (statusPill) {
      statusPill.textContent = kind === 'image' ? 'Generando imagen...' : 'Generando video...';
    }

    showToast(kind === 'image' ? 'Creando imagen...' : 'Creando video...');

    setTimeout(() => {
      renderPreview(kind, prompt || 'Diseño premium para marca digital');
      if (statusPill) {
        statusPill.textContent = kind === 'image' ? 'Imagen lista' : 'Video listo';
      }
      showToast(kind === 'image'
        ? 'Imagen creada. Puedes seguir con tu siguiente idea.'
        : 'Video creado. Puedes seguir generando desde la misma vista.');
    }, 1000);
  });
});

const upgradeBtn = document.getElementById('upgradeBtn');
if (upgradeBtn) {
  upgradeBtn.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      showToast('Primero crea tu cuenta con usuario y correo.', true);
      return;
    }
    setPlan('premium');
    showToast('Premium activado. Ahora puedes generar videos sin límites.');
  });
}

document.querySelectorAll('.plan-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!user) {
      showToast('Primero regístrate con usuario y correo.', true);
      return;
    }

    const plan = button.dataset.plan;
    setPlan(plan || 'free');
    showToast(plan === 'premium'
      ? 'Premium activado para generar videos ilimitados.'
      : 'Has elegido el plan gratuito. Puedes generar 1 video al día.');
  });
});

// Download button
const downloadBtn = document.getElementById('downloadBtn');
if (downloadBtn) {
  downloadBtn.disabled = true;
  downloadBtn.addEventListener('click', async () => {
    if (!lastGeneratedVideoUrl) {
      alert('No hay video generado para descargar.');
      return;
    }
    
    const filename = lastGeneratedVideoName || lastGeneratedVideoUrl.split('/').pop();

    try {
      console.log('[Download] Downloading:', filename);
      const a = document.createElement('a');
      a.href = lastGeneratedVideoUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Descarga iniciada: ' + filename);
    } catch (e) {
      console.warn('[Download] Anchor download failed:', e);
      try {
        const resp = await fetch(lastGeneratedVideoUrl);
        if (!resp.ok) throw new Error('download failed');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Descarga completada: ' + filename);
      } catch (err) {
        alert('Error al descargar el archivo: ' + err.message);
        console.error('[Download Error]', err);
      }
    }
  });
}

// Login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const rememberCheckbox = document.getElementById('rememberMe');
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const remember = rememberCheckbox ? Boolean(rememberCheckbox.checked) : true;
    const toast = document.getElementById('authToast');

    if (!email || !password) {
      if (toast) {
        toast.textContent = 'Necesitas correo y contraseña para entrar.';
        toast.style.color = '#ffb7b7';
      }
      return;
    }

    const accounts = getAccounts();
    const account = accounts.find((entry) => {
      return entry.email.toLowerCase() === email.toLowerCase()
        && entry.password === password;
    });

    if (!account) {
      if (toast) {
        toast.textContent = 'Credenciales incorrectas. Comprueba correo y contraseña.';
        toast.style.color = '#ffb7b7';
      }
      return;
    }

    saveCurrentUser(account.username || '', account.email, account.plan || 'free', account.password || '', remember);
    if (toast) {
      toast.textContent = `Hola, ${account.username || account.email}. Redirigiendo...`;
      toast.style.color = '#f1d8a2';
    }

    window.location.replace('dashboard.html');
  });
}

// Register form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const usernameInput = document.getElementById('registerUsername');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const toast = document.getElementById('authToast');

    if (!username || !email || !password) {
      if (toast) {
        toast.textContent = 'Completa usuario, correo y contraseña.';
        toast.style.color = '#ffb7b7';
      }
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      if (toast) {
        toast.textContent = 'Introduce un correo válido.';
        toast.style.color = '#ffb7b7';
      }
      return;
    }

    if (password.length < 6) {
      if (toast) {
        toast.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        toast.style.color = '#ffb7b7';
      }
      return;
    }

    const accounts = getAccounts();
    const exists = accounts.some((account) => {
      return account.username.toLowerCase() === username.toLowerCase() || account.email.toLowerCase() === email.toLowerCase();
    });

    if (exists) {
      if (toast) {
        toast.textContent = 'Ese usuario o correo ya existe.';
        toast.style.color = '#ffb7b7';
      }
      return;
    }

    const user = syncUserToAccounts(username, email, 'free', password);
    saveCurrentUser(user.username, user.email, user.plan, user.password || '', true);
    if (toast) {
      toast.textContent = `Cuenta creada para ${username}. Redirigiendo...`;
      toast.style.color = '#f1d8a2';
    }

    window.location.replace('dashboard.html');
  });
}

const authTabs = document.querySelectorAll('.auth-tab');
const authPanels = document.querySelectorAll('.auth-panel');
authTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.authTab;
    authTabs.forEach((item) => item.classList.toggle('active', item === tab));
    authPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${target}Panel`);
    });
  });
});

const passwordToggles = document.querySelectorAll('.password-toggle');
passwordToggles.forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const group = toggle.closest('.auth-password-group');
    const input = group ? group.querySelector('input') : null;
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.textContent = isPassword ? 'Ocultar' : 'Mostrar';
  });
});

const currentPage = window.location.pathname.split('/').pop();
if (currentPage === 'login.html' && getCurrentUser()) {
  window.location.replace('dashboard.html');
}

const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    alert('Gracias por tu mensaje. Te responderemos pronto.');
    contactForm.reset();
  });
}

console.log('[Init] MotionFlow AI loaded');
updateAuthUI();
