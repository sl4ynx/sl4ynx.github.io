(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const API_BASE = (window.API_BASE || '').replace(/\/$/, '');
  const VIDEO_COST = { 5: 5, 10: 10 };

  const state = { me: null, characters: [], media: [] };
  let pollTimer = null;
  const lastGen = { image: null, video: null };

  // ---------- API ----------
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(API_BASE + '/api' + path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Error inesperado. Inténtalo de nuevo.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- Utilidades ----------
  const flash = (el, text, type = 'error') => { el.textContent = text; el.className = 'msg ' + type; };
  const clearFlash = (el) => { el.className = 'msg hidden'; el.textContent = ''; };
  const fmtDate = (t) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  function gradientFor(seed) {
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const a = h % 360, b = (a + 60 + (h >> 8) % 120) % 360, ang = (h >> 4) % 360;
    return `linear-gradient(${ang}deg, hsl(${a} 80% 55%), hsl(${b} 70% 30%))`;
  }
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style') Object.assign(node.style, v);
      else if (k.startsWith('on')) node[k] = v;
      else node.setAttribute(k, v);
    }
    node.append(...children);
    return node;
  }
  const kinds = () => ({
    images: state.media.filter((m) => m.kind === 'image'),
    videos: state.media.filter((m) => m.kind === 'video'),
  });

  // ---------- Sesión ----------
  function showAuth() {
    clearTimeout(pollTimer);
    location.replace('login.html');
  }

  async function enter(user) {
    state.me = user;
    $('app').classList.remove('hidden');
    go('overview');
    await refresh();
  }

  $('logout').onclick = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* se cierra igualmente */ }
    Object.assign(state, { me: null, characters: [], media: [] });
    showAuth();
  };

  // ---------- Navegación ----------
  const titles = {
    overview: ['Resumen', 'Tu actividad de un vistazo'],
    generate: ['Generar', 'Convierte tu idea en imagen'],
    video: ['Video IA', 'Crea clips animados a partir de texto o imagen'],
    creations: ['Mis creaciones', 'Todo lo que has generado'],
    characters: ['Personajes', 'Diseña y gestiona tus personajes'],
    settings: ['Ajustes', 'Perfil, seguridad y cuenta'],
  };
  function go(view) {
    document.querySelectorAll('[data-section]').forEach((s) => s.classList.toggle('hidden', s.dataset.section !== view));
    document.querySelectorAll('.menu button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $('view-title').textContent = titles[view][0];
    $('view-sub').textContent = titles[view][1];
    $('sidebar').classList.remove('open');
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.menu button').forEach((b) => { b.onclick = () => go(b.dataset.view); });
  document.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
  $('menu-toggle').onclick = () => $('sidebar').classList.toggle('open');

  // ---------- Datos ----------
  async function refresh() {
    try {
      const [chars, media] = await Promise.all([api('/characters'), api('/media')]);
      state.characters = chars.characters;
      state.media = media.media;
      state.me.credits = media.credits;
    } catch (err) {
      if (err.status === 401) return showAuth();
    }
    render();
    schedulePoll();
  }
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (state.me && state.media.some((m) => m.status === 'pending')) pollTimer = setTimeout(refresh, 3000);
  }

  // ---------- Render ----------
  function visual(m) {
    if (m.status === 'done' && m.fileUrl) {
      if (m.kind === 'video') return el('video', { class: 'img', src: API_BASE + m.fileUrl, controls: '', preload: 'metadata', playsinline: '' });
      return el('img', { class: 'img', src: API_BASE + m.fileUrl, alt: m.prompt, loading: 'lazy' });
    }
    const box = el('div', { class: 'img' });
    if (m.kind === 'video') box.style.aspectRatio = m.ratio;
    if (m.status === 'pending') {
      box.classList.add('pending-bg', 'anim');
      box.append(el('div', { class: 'state', text: 'Generando…' }));
    } else if (m.status === 'failed') {
      box.classList.add('failed-bg');
      box.append(el('div', { class: 'state', text: m.error || 'Falló la generación' }));
    } else {
      box.classList.add('anim');
      box.style.background = gradientFor(m.seed || m.id);
      box.style.backgroundSize = '300% 300%';
      if (m.kind === 'video') box.append(el('div', { class: 'play', text: '▶' }), el('span', { class: 'dur', text: m.duration + 's' }));
    }
    return box;
  }

  function card(m, deletable) {
    const meta = [m.style, m.character, m.kind === 'video' ? m.duration + 's' : null].filter(Boolean).join(' · ');
    const info = el('div', { class: 'info' }, el('p', { text: m.prompt }), el('small', { text: meta }));
    if (deletable && m.status !== 'pending') {
      info.append(el('div', { class: 'actions' }, el('button', {
        class: 'btn btn-danger btn-sm', text: 'Eliminar',
        onclick: async () => { try { await api('/media/' + m.id, { method: 'DELETE' }); await refresh(); } catch (err) { alert(err.message); } },
      })));
    }
    return el('div', { class: 'thumb' }, visual(m), info);
  }

  function fill(container, items, deletable, emptyText) {
    container.replaceChildren();
    if (!items.length) return container.append(el('div', { class: 'empty', text: emptyText }));
    items.forEach((m) => container.append(card(m, deletable)));
  }

  function renderPreview(kind) {
    const box = $(kind === 'image' ? 'g-preview' : 'v-preview');
    const m = state.media.find((x) => x.id === lastGen[kind]);
    if (!m) return;
    box.replaceChildren();
    if (m.status === 'done' && m.fileUrl) {
      box.style.aspectRatio = kind === 'video' ? m.ratio : '';
      box.append(visual(m));
    } else if (m.status === 'done') {
      box.style.background = gradientFor(m.seed || m.id);
      box.style.aspectRatio = kind === 'video' ? m.ratio : '';
      box.append(el('div', { class: 'state', text: 'Listo (modo de prueba, sin proveedor de IA)' }));
    } else {
      box.textContent = m.status === 'pending' ? 'Generando…' : (m.error || 'Falló la generación');
    }
  }

  function fillSelect(sel, options, firstLabel) {
    const prev = sel.value;
    sel.replaceChildren(new Option(firstLabel, ''));
    options.forEach(([label, value]) => sel.append(new Option(label, value)));
    sel.value = [...sel.options].some((o) => o.value === prev) ? prev : '';
  }

  function render() {
    const u = state.me; if (!u) return;
    const { images, videos } = kinds();

    $('u-avatar').textContent = u.name.charAt(0).toUpperCase();
    $('u-name').textContent = u.name;
    $('u-plan').textContent = 'Plan ' + u.plan;
    $('s-credits').textContent = u.credits;
    $('s-creations').textContent = images.filter((m) => m.status === 'done').length;
    $('s-videos').textContent = videos.filter((m) => m.status === 'done').length;
    $('s-chars').textContent = state.characters.length;
    $('s-since').textContent = fmtDate(u.createdAt);
    $('credit-text').textContent = `${u.credits} de ${u.dailyCredits} créditos gratis de hoy (se renuevan cada día)`;
    $('credit-bar').style.width = Math.min(100, (u.credits / u.dailyCredits) * 100) + '%';

    fill($('recent'), state.media.slice(0, 4), false, 'Aún no has creado nada.');
    fill($('all-creations'), images, true, 'Todavía no tienes imágenes. ¡Genera la primera!');
    fill($('all-videos'), videos, true, 'Todavía no tienes videos.');

    const charOpts = state.characters.map((c) => [c.name, c.name]);
    fillSelect($('g-char'), charOpts, 'Ninguno');
    fillSelect($('v-char'), charOpts, 'Ninguno');
    fillSelect($('v-src'), images.filter((m) => m.status === 'done').map((m) => [m.prompt.slice(0, 50), String(m.id)]), 'Solo texto');

    const list = $('char-list'); list.replaceChildren();
    state.characters.forEach((c) => {
      const av = el('div', { class: 'avatar', text: c.name.charAt(0).toUpperCase() });
      av.style.background = gradientFor(c.name);
      list.append(el('div', { class: 'card char' },
        av, el('b', { text: c.name }), el('small', { text: c.style }), el('p', { text: c.desc || 'Sin descripción.' }),
        el('button', {
          class: 'btn btn-danger btn-sm', text: 'Eliminar',
          onclick: async () => { try { await api('/characters/' + c.id, { method: 'DELETE' }); await refresh(); } catch (err) { alert(err.message); } },
        })));
    });

    $('p-name').value = u.name;
    $('p-email').value = u.email;
    renderPreview('image');
    renderPreview('video');
  }

  // ---------- Generación ----------
  async function submitGeneration({ path, body, kind, msg, btn }) {
    clearFlash(msg);
    btn.disabled = true;
    try {
      const { media, credits } = await api(path, { method: 'POST', body });
      state.me.credits = credits;
      state.media.unshift(media);
      lastGen[kind] = media.id;
      render();
      schedulePoll();
      flash(msg, 'Generación en curso. La verás en Mis creaciones al terminar.', 'ok');
    } catch (err) {
      flash(msg, err.message);
      if (err.status === 401) showAuth();
    } finally { btn.disabled = false; }
  }

  $('g-btn').onclick = () => submitGeneration({
    path: '/media/images', kind: 'image', msg: $('gen-msg'), btn: $('g-btn'),
    body: { prompt: $('g-prompt').value, style: $('g-style').value, character: $('g-char').value },
  });

  $('v-dur').onchange = () => { $('v-cost').textContent = VIDEO_COST[$('v-dur').value]; };
  $('v-btn').onclick = () => submitGeneration({
    path: '/media/videos', kind: 'video', msg: $('vid-msg'), btn: $('v-btn'),
    body: {
      prompt: $('v-prompt').value, style: $('v-style').value, duration: Number($('v-dur').value),
      ratio: $('v-ratio').value, character: $('v-char').value, sourceId: $('v-src').value || undefined,
    },
  });

  // ---------- Personajes ----------
  $('char-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/characters', { method: 'POST', body: { name: $('c-name').value, style: $('c-style').value, desc: $('c-desc').value } });
      e.target.reset(); clearFlash($('char-msg'));
      await refresh();
    } catch (err) { flash($('char-msg'), err.message); }
  });

  // ---------- Ajustes ----------
  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { user } = await api('/me', { method: 'PATCH', body: { name: $('p-name').value } });
      state.me = { ...state.me, ...user };
      flash($('set-msg'), 'Perfil actualizado.', 'ok'); render();
    } catch (err) { flash($('set-msg'), err.message); }
  });

  $('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/me/password', { method: 'POST', body: { current: $('pw-old').value, next: $('pw-new').value } });
      e.target.reset(); flash($('pw-msg'), 'Contraseña actualizada. Se han cerrado tus otras sesiones.', 'ok');
    } catch (err) { flash($('pw-msg'), err.message); }
  });

  $('delete-acc').onclick = async () => {
    const msg = $('del-msg');
    if (!$('del-pass').value) return flash(msg, 'Escribe tu contraseña para confirmar.');
    if (!confirm('¿Eliminar tu cuenta y todos tus datos de forma permanente?')) return;
    try {
      await api('/me', { method: 'DELETE', body: { password: $('del-pass').value } });
      $('del-pass').value = '';
      Object.assign(state, { me: null, characters: [], media: [] });
      showAuth();
    } catch (err) { flash(msg, err.message); }
  };

  // ---------- Arranque ----------
  (async () => {
    try {
      const { user } = await api('/me');
      await enter(user);
    } catch { showAuth(); }
  })();
})();
