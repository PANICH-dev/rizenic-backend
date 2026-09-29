function parsePositiveNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function resolveSsl(env = {}) {
  const explicitMode = String(env.PG_SSL_MODE || env.PGSSLMODE || '').trim().toLowerCase();
  const verify = /^(1|true|yes)$/i.test(String(env.PG_SSL_VERIFY || ''));

  if (['disable', 'off', 'false', '0', 'no'].includes(explicitMode)) return false;
  if (['verify', 'verify-full', 'verify-ca'].includes(explicitMode)) return { rejectUnauthorized: true };
  if (['require', 'required', 'on', 'true', '1', 'yes', 'prefer'].includes(explicitMode)) {
    return { rejectUnauthorized: verify };
  }

  // Backward-compatible opt-in: PG_SSL_VERIFY=1 means explicitly use TLS verification.
  if (verify) return { rejectUnauthorized: true };

  // In auto/default mode do not force TLS. node-postgres will still honor
  // sslmode/ssl options present inside DATABASE_URL itself. This keeps local/LAN
  // PostgreSQL servers that do not support SSL working without weakening an
  // explicitly SSL-enabled production connection string.
  return undefined;
}

function buildPoolConfig(env = process.env) {
  const config = {
    connectionString: env.DATABASE_URL,
    max: parsePositiveNumber(env.PG_POOL_MAX, env.VERCEL ? 5 : 10, 1, 30),
    idleTimeoutMillis: parsePositiveNumber(env.PG_IDLE_TIMEOUT_MS, 30000, 5000, Number.MAX_SAFE_INTEGER),
    connectionTimeoutMillis: parsePositiveNumber(env.PG_CONNECT_TIMEOUT_MS, 7000, 2000, Number.MAX_SAFE_INTEGER),
    query_timeout: parsePositiveNumber(env.PG_QUERY_TIMEOUT_MS, 120000, 10000, Number.MAX_SAFE_INTEGER),
    statement_timeout: parsePositiveNumber(env.PG_STATEMENT_TIMEOUT_MS, 120000, 10000, Number.MAX_SAFE_INTEGER)
  };

  const ssl = resolveSsl(env);
  if (ssl !== undefined) config.ssl = ssl;
  return config;
}

module.exports = { buildPoolConfig, resolveSsl };
