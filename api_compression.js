const zlib = require('node:zlib');

const MIN_GZIP_BYTES = 1024;
const MAX_GZIP_BYTES = 8 * 1024 * 1024;

function header(req, name) {
  return String((req && req.headers && req.headers[name]) || '');
}

function isBehindUpstreamProxy(req) {
  const headers = (req && req.headers) || {};
  return Boolean(
    headers.forwarded ||
    headers.via ||
    headers['x-forwarded-for'] ||
    headers['x-forwarded-proto'] ||
    headers['x-forwarded-host'] ||
    headers['x-real-ip'] ||
    headers['cf-ray'] ||
    headers['cdn-loop'] ||
    headers['x-vercel-id']
  );
}

function gzipMode() {
  return String(process.env.API_GZIP_MODE || 'auto').trim().toLowerCase();
}

function shouldBypassCompression(req, res) {
  const mode = gzipMode();

  // Emergency switch: API_GZIP_MODE=off disables this middleware without code changes.
  if (['off', 'false', '0', 'disabled'].includes(mode)) return true;

  // Safe production default: compression is an optimization, never a requirement.
  // In production, leave it to Nginx / Cloudflare / the platform unless explicitly forced.
  // Set API_GZIP_MODE=force only when Node is intentionally the compression layer.
  if (mode !== 'force' && String(process.env.NODE_ENV || '').toLowerCase() === 'production') return true;
  if (mode !== 'force' && isBehindUpstreamProxy(req)) return true;

  const method = String((req && req.method) || 'GET').toUpperCase();
  const statusCode = Number(res.statusCode || 200);
  const cacheControl = String(res.getHeader('Cache-Control') || '');
  const existingEncoding = String(res.getHeader('Content-Encoding') || '');
  const contentRange = String(res.getHeader('Content-Range') || '');

  if (method === 'HEAD') return true;
  if (statusCode < 200 || statusCode === 204 || statusCode === 205 || statusCode === 304) return true;
  if (header(req, 'range') || contentRange) return true;
  if (/\bno-transform\b/i.test(cacheControl)) return true;
  if (existingEncoding) return true;
  if (res.headersSent || res.writableEnded || res.destroyed) return true;

  return false;
}

function installApiCompression(req, res, next) {
  const requestPath = String((req && (req.path || req.url)) || '');
  if (!requestPath.startsWith('/api/')) return next();

  const originalSend = res.send.bind(res);

  res.send = function compressedApiSend(body) {
    if (shouldBypassCompression(req, res)) {
      return originalSend(body);
    }

    const encoding = header(req, 'accept-encoding');
    const contentType = String(res.getHeader('Content-Type') || '');

    if (!/\bgzip\b/i.test(encoding) || !/(json|text|javascript|xml)/i.test(contentType)) {
      return originalSend(body);
    }

    if (!(typeof body === 'string' || Buffer.isBuffer(body))) {
      return originalSend(body);
    }

    const source = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (source.length < MIN_GZIP_BYTES || source.length > MAX_GZIP_BYTES) {
      return originalSend(body);
    }

    zlib.gzip(source, { level: zlib.constants.Z_BEST_SPEED }, (error, compressed) => {
      // Compression is optional. Any error or closed connection falls back safely.
      if (res.writableEnded || res.destroyed) return;
      if (error || !compressed || compressed.length >= source.length) {
        return originalSend(body);
      }
      if (res.headersSent) return;

      res.setHeader('Content-Encoding', 'gzip');
      if (typeof res.vary === 'function') {
        res.vary('Accept-Encoding');
      } else {
        const previous = String(res.getHeader('Vary') || '');
        res.setHeader('Vary', previous ? `${previous}, Accept-Encoding` : 'Accept-Encoding');
      }
      res.removeHeader('Content-Length');
      return originalSend(compressed);
    });

    return res;
  };

  next();
}

module.exports = {
  installApiCompression,
  isBehindUpstreamProxy,
  shouldBypassCompression
};
