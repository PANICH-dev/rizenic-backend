(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  let redirecting = false;
  let pendingBlockingRequests = 0;
  let busyStartedAt = 0;
  let hideTimer = null;
  const MIN_VISIBLE_MS = 180;

  function apiPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (!raw) return '';
      return new URL(raw, window.location.href).pathname;
    } catch (_) {
      return '';
    }
  }

  function isBlockingApiRequest(input, init) {
    if (init?.rizenicBlocking === false) return false;
    const path = apiPath(input);
    return path.startsWith('/api/') && path !== '/api/health';
  }

  function ensureBusyStyle() {
    if (document.getElementById('rz-api-loading-style')) return;
    const style = document.createElement('style');
    style.id = 'rz-api-loading-style';
    style.textContent = `
      html.rz-api-busy, html.rz-api-busy body { cursor: wait !important; }
      #rz-api-loading-layer {
        position: fixed; inset: 0; z-index: 2147483646;
        display: none; align-items: center; justify-content: center;
        background: rgba(15, 23, 42, .32); backdrop-filter: blur(1.5px);
        -webkit-backdrop-filter: blur(1.5px); pointer-events: auto;
      }
      #rz-api-loading-layer.rz-visible { display: flex; }
      #rz-api-loading-layer .rz-api-loading-card {
        min-width: 220px; max-width: calc(100vw - 32px);
        background: rgba(255,255,255,.97); color: #0f172a;
        border: 1px solid rgba(148,163,184,.45); border-radius: 16px;
        box-shadow: 0 18px 55px rgba(15,23,42,.25);
        padding: 18px 22px; text-align: center; font-family: inherit;
      }
      #rz-api-loading-layer .rz-api-spinner {
        width: 34px; height: 34px; margin: 0 auto 10px;
        border: 4px solid #dbeafe; border-top-color: #166534;
        border-radius: 50%; animation: rz-api-spin .7s linear infinite;
      }
      #rz-api-loading-layer .rz-api-title { font-weight: 800; font-size: 14px; }
      #rz-api-loading-layer .rz-api-sub { margin-top: 4px; font-size: 11px; color: #64748b; font-weight: 600; }
      @keyframes rz-api-spin { to { transform: rotate(360deg); } }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureBusyLayer() {
    let layer = document.getElementById('rz-api-loading-layer');
    if (layer || !document.body) return layer;
    ensureBusyStyle();
    layer = document.createElement('div');
    layer.id = 'rz-api-loading-layer';
    layer.setAttribute('role', 'status');
    layer.setAttribute('aria-live', 'polite');
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `<div class="rz-api-loading-card"><div class="rz-api-spinner"></div><div class="rz-api-title">กำลังโหลดข้อมูล...</div><div class="rz-api-sub">กรุณารอสักครู่ ระบบกำลังรับข้อมูลจากเซิร์ฟเวอร์</div></div>`;
    document.body.appendChild(layer);
    return layer;
  }

  function showBusyLayer() {
    clearTimeout(hideTimer);
    hideTimer = null;
    busyStartedAt = performance.now ? performance.now() : Date.now();
    document.documentElement.classList.add('rz-api-busy');
    const layer = ensureBusyLayer();
    if (layer) {
      layer.classList.add('rz-visible');
      layer.setAttribute('aria-hidden', 'false');
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (pendingBlockingRequests > 0) showBusyLayer();
      }, { once: true });
    }
  }

  function hideBusyLayerNow() {
    if (pendingBlockingRequests > 0) return;
    document.documentElement.classList.remove('rz-api-busy');
    const layer = document.getElementById('rz-api-loading-layer');
    if (layer) {
      layer.classList.remove('rz-visible');
      layer.setAttribute('aria-hidden', 'true');
    }
  }

  function beginBlockingRequest() {
    pendingBlockingRequests += 1;
    if (pendingBlockingRequests === 1) showBusyLayer();
  }

  function endBlockingRequest() {
    pendingBlockingRequests = Math.max(0, pendingBlockingRequests - 1);
    if (pendingBlockingRequests !== 0) return;
    const now = performance.now ? performance.now() : Date.now();
    const remaining = Math.max(0, MIN_VISIBLE_MS - (now - busyStartedAt));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBusyLayerNow, remaining);
  }

  function preventBusyInteraction(event) {
    if (pendingBlockingRequests <= 0) return;
    const layer = document.getElementById('rz-api-loading-layer');
    if (layer && layer.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  ['click', 'dblclick', 'pointerdown', 'mousedown', 'touchstart', 'submit', 'keydown'].forEach(type => {
    document.addEventListener(type, preventBusyInteraction, true);
  });

  function expireSession() {
    if (redirecting) return;
    redirecting = true;
    try { sessionStorage.clear(); } catch (_) {}
    window.location.replace('index.html?session=expired');
  }

  window.fetch = async function rizenicSafeFetch(input, init) {
    const blocking = isBlockingApiRequest(input, init);
    let fetchInit = init;
    if (init && Object.prototype.hasOwnProperty.call(init, 'rizenicBlocking')) {
      fetchInit = { ...init };
      delete fetchInit.rizenicBlocking;
    }
    if (blocking) beginBlockingRequest();
    try {
      const response = await nativeFetch(input, fetchInit);
      const path = apiPath(input);
      if (response.status === 401 && path.startsWith('/api/') && !['/api/login', '/api/logout'].includes(path)) {
        setTimeout(expireSession, 0);
      }
      return response;
    } finally {
      if (blocking) endBlockingRequest();
    }
  };

  window.RizenicLoading = Object.freeze({
    begin: beginBlockingRequest,
    end: endBlockingRequest,
    isBusy: () => pendingBlockingRequests > 0
  });

  window.rizenicLogout = function rizenicLogout() {
    beginBlockingRequest();
    return nativeFetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(() => null)
      .finally(() => {
        endBlockingRequest();
        try { sessionStorage.clear(); } catch (_) {}
        window.location.href = 'index.html';
      });
  };
})();
