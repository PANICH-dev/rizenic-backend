(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  let redirecting = false;

  function apiPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (!raw) return '';
      return new URL(raw, window.location.href).pathname;
    } catch (_) {
      return '';
    }
  }

  function expireSession() {
    if (redirecting) return;
    redirecting = true;
    try { sessionStorage.clear(); } catch (_) {}
    const target = window.location.pathname.endsWith('/index.html') || window.location.pathname === '/'
      ? 'index.html?session=expired'
      : 'index.html?session=expired';
    window.location.replace(target);
  }

  window.fetch = async function rizenicSafeFetch(input, init) {
    const response = await nativeFetch(input, init);
    const path = apiPath(input);
    if (response.status === 401 && path.startsWith('/api/') && !['/api/login', '/api/logout'].includes(path)) {
      setTimeout(expireSession, 0);
    }
    return response;
  };

  window.rizenicLogout = function rizenicLogout() {
    return nativeFetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(() => null)
      .finally(() => {
        try { sessionStorage.clear(); } catch (_) {}
        window.location.href = 'index.html';
      });
  };
})();
