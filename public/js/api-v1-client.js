(function () {
  const nativeFetch = window.fetch.bind(window);
  const mode = window.RIZENIC_API_MODE || 'v1';
  const tokenKey = 'rizenic.session.token';

  function toUrl(input) {
    const raw = input instanceof Request ? input.url : String(input);
    if (mode !== 'v1') return raw;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        let path = url.pathname;
        if (!path.startsWith('/api/v1/')) {
          path = '/api/v1' + path.substring('/api'.length);
        }
        url.pathname = path;
        const targetBackend = window.RIZENIC_BACKEND_URL || (window.location.port === '3000' ? 'http://localhost:8080' : '');
        if (targetBackend) {
          const backend = new URL(targetBackend, window.location.origin);
          url.protocol = backend.protocol;
          url.hostname = backend.hostname;
          url.port = backend.port;
        }
      }
      return url.toString();
    } catch (_) { return raw; }
  }

  window.rizenicApi = {
    getToken: () => sessionStorage.getItem(tokenKey),
    clearToken: () => sessionStorage.removeItem(tokenKey),
    setToken: (token) => token ? sessionStorage.setItem(tokenKey, token) : sessionStorage.removeItem(tokenKey)
  };

  window.fetch = async function (input, init) {
    const options = Object.assign({}, init || {});
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(options.headers || {}).forEach((value, key) => headers.set(key, value));
    headers.set('X-Request-Id', crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const token = sessionStorage.getItem(tokenKey);
    if (token) headers.set('Authorization', 'Bearer ' + token);
    options.headers = headers;
    if (input instanceof Request && !options.body && input.body) {
      options.body = input.body;
    }
    const response = await nativeFetch(toUrl(input), options);
    if (new URL(toUrl(input), window.location.origin).pathname.endsWith('/login') && response.ok) {
      try { const body = await response.clone().json(); if (body.token) window.rizenicApi.setToken(body.token); } catch (_) { /* preserve response */ }
    }
    if (response.status === 401) window.dispatchEvent(new CustomEvent('rizenic:auth-expired'));
    return response;
  };
})();
