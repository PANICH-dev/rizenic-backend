'use strict';

const crypto = require('node:crypto');

const SESSION_COOKIE = 'rz_session';
const SESSION_TTL_SECONDS = Math.max(900, Math.min(Number(process.env.SESSION_TTL_SECONDS || 43200), 86400 * 7));
const rateBuckets = new Map();

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function secretKey() {
  const explicit = clean(process.env.APP_SESSION_SECRET);
  if (explicit) return crypto.createHash('sha256').update(explicit).digest();
  // Stable across serverless instances without requiring a DB/schema change.
  // DATABASE_URL is already a deployment secret; APP_SESSION_SECRET is still recommended.
  const stable = clean(process.env.DATABASE_URL) || clean(process.env.VERCEL_URL) || 'rizenic-local-development-only';
  return crypto.createHash('sha256').update(`rizenic-session:${stable}`).digest();
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(encodedPayload) {
  return crypto.createHmac('sha256', secretKey()).update(encodedPayload).digest('base64url');
}

function createSessionToken(employee = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: clean(employee.employee_id || employee.id || employee.username),
    name: clean(employee.employee_name),
    username: clean(employee.username),
    role: clean(employee.employee_role),
    branch: clean(employee.branch_name),
    pages: clean(employee.accessible_pages),
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };
  const body = encode(payload);
  return `${body}.${sign(body)}`;
}

function parseCookies(req) {
  const out = {};
  const raw = clean(req?.headers?.cookie);
  if (!raw) return out;
  for (const pair of raw.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    try { out[key] = decodeURIComponent(value); } catch (_) { out[key] = value; }
  }
  return out;
}

function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [body, suppliedSig] = token.split('.', 2);
  const expectedSig = sign(body);
  const a = Buffer.from(suppliedSig || '');
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function isSecureRequest(req) {
  const mode = clean(process.env.COOKIE_SECURE).toLowerCase();
  if (['1', 'true', 'yes', 'always'].includes(mode)) return true;
  if (['0', 'false', 'no', 'never'].includes(mode)) return false;
  if (req?.secure) return true;
  return clean(req?.headers?.['x-forwarded-proto']).split(',')[0].toLowerCase() === 'https';
}

function issueSession(res, employee, req) {
  const token = createSessionToken(employee);
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

function clearSession(res, req) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function requestIp(req) {
  const forwarded = clean(req?.headers?.['x-forwarded-for']).split(',')[0].trim();
  return forwarded || clean(req?.socket?.remoteAddress) || 'unknown';
}

function createRateLimiter({ windowMs, max, keyPrefix }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    // Opportunistic cleanup keeps the in-memory limiter bounded even under many spoofed/rotating IPs.
    if (rateBuckets.size > 5000) {
      for (const [bucketKey, bucket] of rateBuckets) {
        if (!bucket || bucket.resetAt <= now) rateBuckets.delete(bucketKey);
      }
      while (rateBuckets.size > 5000) rateBuckets.delete(rateBuckets.keys().next().value);
    }
    const key = `${keyPrefix}:${requestIp(req)}`;
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'มีคำขอมากเกินไป กรุณาลองใหม่อีกครั้ง' });
    }
    return next();
  };
}

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'login' });
const sensitiveLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 90, keyPrefix: 'sensitive' });

function configuredOrigins() {
  return new Set(clean(process.env.CORS_ORIGINS).split(',').map(v => v.trim()).filter(Boolean));
}

function sameOrigin(req, origin) {
  try {
    const url = new URL(origin);
    const host = clean(req?.headers?.['x-forwarded-host']).split(',')[0].trim() || clean(req?.headers?.host);
    if (!host) return false;
    return url.host === host;
  } catch (_) {
    return false;
  }
}

function corsHeaders(req, res, next) {
  const origin = clean(req?.headers?.origin);
  if (!origin) return next();
  const allowed = sameOrigin(req, origin) || configuredOrigins().has(origin);
  if (!allowed) return next();
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Vary', 'Origin');
  if (clean(req.method).toUpperCase() === 'OPTIONS') return res.status(204).end();
  return next();
}

function originGuard(req, res, next) {
  const method = clean(req.method).toUpperCase();
  if (['GET', 'HEAD'].includes(method)) return next();
  const origin = clean(req.headers?.origin);
  // Server-to-server requests do not carry Origin; auth/API-key checks still apply.
  if (!origin) return next();
  if (sameOrigin(req, origin) || configuredOrigins().has(origin)) return next();
  return res.status(403).json({ error: 'Origin นี้ไม่ได้รับอนุญาต' });
}

function sanitizeApiErrors(req, res, next) {
  const originalJson = res.json.bind(res);
  const requestId = crypto.randomBytes(6).toString('hex');
  res.setHeader('X-Request-Id', requestId);
  res.json = function safeJson(body) {
    const prod = clean(process.env.NODE_ENV).toLowerCase() === 'production';
    if (prod && res.statusCode >= 500 && body && typeof body === 'object') {
      const safe = { ...body };
      if ('error' in safe) safe.error = 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง';
      delete safe.stack;
      delete safe.detail;
      safe.requestId = requestId;
      return originalJson(safe);
    }
    return originalJson(body);
  };
  next();
}

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function isPublicApi(pathname) {
  return pathname === '/api/login' || pathname === '/api/health';
}

function authGuard(req, res, next) {
  const pathname = String(req.path || req.url || '').split('?')[0];
  if (!pathname.startsWith('/api/') || isPublicApi(pathname) || pathname === '/api/sync-dynamic') return next();
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  req.rizenicSession = session;
  next();
}

function installProductionSafety(req, res, next) {
  securityHeaders(req, res, () => {
    sanitizeApiErrors(req, res, () => {
      corsHeaders(req, res, () => {
        originGuard(req, res, () => {
          const pathname = String(req.path || req.url || '').split('?')[0];
          if (pathname === '/api/login') return loginLimiter(req, res, () => authGuard(req, res, next));
          if (pathname === '/api/send-line-notify' || pathname === '/api/sync-dynamic') {
            return sensitiveLimiter(req, res, () => authGuard(req, res, next));
          }
          return authGuard(req, res, next);
        });
      });
    });
  });
}

function safeEquals(a, b) {
  const aa = Buffer.from(clean(a));
  const bb = Buffer.from(clean(b));
  return aa.length > 0 && aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function authorizeDynamicSync(req) {
  if (readSession(req)) return true;
  const configured = clean(process.env.SYNC_API_KEY);
  const requireKey = /^(?:1|true|yes)$/i.test(clean(process.env.SYNC_REQUIRE_API_KEY));
  if (!configured) return !requireKey;
  return safeEquals(req?.headers?.['x-api-key'], configured) || safeEquals(req?.headers?.authorization, `Bearer ${configured}`);
}

function allowedSyncTable(tableName) {
  const name = clean(tableName);
  const configured = clean(process.env.SYNC_ALLOWED_TABLES).split(',').map(v => v.trim()).filter(Boolean);
  if (configured.length) return configured.includes(name);
  if (!/^(?:rizenic[a-z0-9_]*|eclaim_[a-z0-9_]*|customers|inspection_reports)$/i.test(name)) return false;
  return !/(?:employee|user_account|permission|role)/i.test(name);
}

async function validateDynamicSyncTarget(pool, tableName, primaryKey, rows) {
  if (!allowedSyncTable(tableName)) return { ok: false, error: 'ตารางนี้ไม่ได้รับอนุญาตสำหรับ Dynamic Sync' };
  const columns = [...new Set((rows || []).flatMap(row => row && typeof row === 'object' ? Object.keys(row) : []))];
  if (!columns.length) return { ok: false, error: 'ไม่พบคอลัมน์สำหรับ Sync' };
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
    [tableName]
  );
  const actual = new Set(result.rows.map(row => row.column_name));
  if (!actual.size) return { ok: false, error: 'ไม่พบตารางปลายทาง' };
  const invalid = columns.filter(col => !actual.has(col));
  if (invalid.length) return { ok: false, error: `พบคอลัมน์ที่ไม่มีในตาราง: ${invalid.slice(0, 5).join(', ')}` };
  if (primaryKey && !actual.has(primaryKey)) return { ok: false, error: 'Primary Key ไม่มีในตารางปลายทาง' };
  return { ok: true };
}

module.exports = {
  installProductionSafety,
  issueSession,
  clearSession,
  readSession,
  createRateLimiter,
  originGuard,
  sanitizeApiErrors,
  authorizeDynamicSync,
  validateDynamicSyncTarget
};
