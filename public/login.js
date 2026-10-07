(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DASHBOARD = 'dashboard.html';
  const API_BASE = (window.API_BASE || '').replace(/\/$/, '');

  async function api(path, body) {
    const res = await fetch(API_BASE + '/api' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error inesperado. Inténtalo de nuevo.');
    return data;
  }

  const flash = (text, type = 'error') => { $('auth-msg').textContent = text; $('auth-msg').className = 'msg ' + type; };
  const clearFlash = () => { $('auth-msg').className = 'msg hidden'; $('auth-msg').textContent = ''; };

  function showTab(login) {
    $('tab-login').classList.toggle('active', login);
    $('tab-register').classList.toggle('active', !login);
    $('form-login').classList.toggle('hidden', !login);
    $('form-register').classList.toggle('hidden', login);
    clearFlash();
  }
  $('tab-login').onclick = () => showTab(true);
  $('tab-register').onclick = () => showTab(false);
  if (new URLSearchParams(location.search).get('tab') === 'register') showTab(false);

  document.querySelectorAll('[data-toggle]').forEach((b) => {
    b.onclick = () => {
      const input = $(b.dataset.toggle);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Ocultar' : 'Mostrar';
    };
  });

  async function submit(form, request) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    clearFlash();
    try {
      await request();
      form.reset();
      location.replace(DASHBOARD);
    } catch (err) {
      flash(err.message);
      btn.disabled = false;
    }
  }

  $('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    submit(e.target, () => api('/auth/login', { email: $('l-email').value, password: $('l-pass').value }));
  });

  $('form-register').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('r-pass').value !== $('r-pass2').value) return flash('Las contraseñas no coinciden.');
    submit(e.target, () => api('/auth/register', {
      name: $('r-name').value,
      email: $('r-email').value,
      password: $('r-pass').value,
      adult: $('r-age').checked,
    }));
  });

  // Si ya hay sesión válida, salta directamente al panel.
  api('/me').then(() => location.replace(DASHBOARD)).catch(() => {});
})();
