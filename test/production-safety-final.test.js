'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('production safety middleware provides signed httpOnly sessions, origin checks and rate limits', () => {
  const src = read('production_safety.js');
  assert.match(src, /HttpOnly/);
  assert.match(src, /SameSite=Lax/);
  assert.match(src, /timingSafeEqual/);
  assert.match(src, /createRateLimiter/);
  assert.match(src, /originGuard/);
  assert.match(src, /sanitizeApiErrors/);
});

test('app enables production safety without changing database schema', () => {
  const app = read('app.js');
  const dbConfig = read('db_config.js');
  assert.match(app, /installProductionSafety/);
  assert.match(app, /issueSession/);
  assert.match(app, /clearSession/);
  assert.match(dbConfig, /connectionTimeoutMillis/);
  assert.match(dbConfig, /idleTimeoutMillis/);
  assert.match(dbConfig, /query_timeout/);
  assert.match(app, /\/api\/health/);
  assert.doesNotMatch(app, /app\.use\(cors\(\)\)/);
});

test('login and admin employee payloads never return plaintext password', () => {
  const app = read('app.js');
  const views = read('server_side_views.js');
  const admin = read('public/admin_server.js');
  assert.match(app, /SELECT employee_id, employee_code, employee_name, employee_role, branch_name, username, accessible_pages, is_active/);
  assert.doesNotMatch(views, /employees:\s*\{[\s\S]{0,100}fields:\s*'\*'/);
  assert.doesNotMatch(admin, /e\.password/);
});

test('LINE secrets are read from environment and no bearer token literal remains in app source', () => {
  const app = read('app.js');
  assert.match(app, /LINE_RANGSIT_CHANNEL_TOKEN/);
  assert.match(app, /LINE_NAVAMIN_CHANNEL_TOKEN/);
  assert.doesNotMatch(app, /uWGDH1BPHvILvBn7/);
  assert.doesNotMatch(app, /5\+CtgK2jCINRJW0/);
});

test('dynamic sync has payload caps and production API-key/session protection hook', () => {
  const app = read('app.js');
  assert.match(app, /SYNC_MAX_ROWS/);
  assert.match(app, /authorizeDynamicSync/);
  assert.match(app, /validateDynamicSyncTarget/);
});

test('legacy inbound and outbound reads support optional server paging without breaking array compatibility', () => {
  const app = read('app.js');
  assert.match(app, /function buildLegacyPartsHistoryRead/);
  assert.match(app, /requestedPaging/);
  assert.match(app, /rizenic_part_inbound/);
  assert.match(app, /rizenic_part_outbound/);
});

test('employee read queries never select plaintext password columns', () => {
  const { buildEmployeesReadQuery } = require('../read_queries');
  const all = buildEmployeesReadQuery({});
  const scoped = buildEmployeesReadQuery({ branch: 'สาขา A' });
  assert.doesNotMatch(all.text, /SELECT\s+\*/i);
  assert.doesNotMatch(scoped.text, /SELECT\s+\*/i);
  assert.match(all.text, /employee_id/);
  assert.doesNotMatch(all.text, /\bpassword\b/i);
});

test('active SA and jobs pages use remote parts lookup instead of loading the full master list', () => {
  const saParts = read('public/sa_parts.js');
  const jobsServer = read('public/jobs_server.js');
  const indexHtml = read('public/index.html');
  const jobsHtml = read('public/jobs.html');
  assert.match(indexHtml, /remote_parts_lookup\.js/);
  assert.match(jobsHtml, /remote_parts_lookup\.js/);
  assert.match(saParts, /RizenicPartsLookup/);
  assert.match(jobsServer, /RizenicPartsLookup/);
  assert.doesNotMatch(saParts, /fetch\(`\$\{API_BASE_URL\}\/api\/parts\?/);
  assert.doesNotMatch(jobsServer, /fetch\(`\$\{API_BASE_URL\}\/api\/parts\?/);
});

test('all standalone production pages install the session guard before application scripts', () => {
  const pages = ['index.html','dashboard.html','jobs.html','jobs_table.html','parts.html','finance.html','history.html','repair.html','repair_board.html','repair_export.html','repair_date_update.html','admin.html'];
  for (const page of pages) {
    const html = read(`public/${page}`);
    assert.match(html, /session_guard\.js/, `${page} missing session guard`);
  }
});

test('session cookie secure mode follows the actual connection so production over HTTP does not self-lock', () => {
  const src = read('production_safety.js');
  assert.match(src, /COOKIE_SECURE/);
  assert.match(src, /x-forwarded-proto/);
  const secureFn = src.slice(src.indexOf('function isSecureRequest'), src.indexOf('function issueSession'));
  assert.doesNotMatch(secureFn, /NODE_ENV/);
});

test('dynamic sync security can be tightened without breaking legacy integrations by default', () => {
  const src = read('production_safety.js');
  assert.match(src, /SYNC_REQUIRE_API_KEY/);
  assert.match(src, /SYNC_API_KEY/);
  assert.match(src, /validateDynamicSyncTarget/);
});

test('rate-limit buckets have bounded cleanup so spoofed IPs cannot grow memory forever', () => {
  const src = read('production_safety.js');
  assert.match(src, /rateBuckets\.size/);
  assert.match(src, /rateBuckets\.delete/);
});

test('remote part suggestions escape database text before writing option HTML', () => {
  const src = read('public/remote_parts_lookup.js');
  assert.match(src, /function escapeHtml/);
  assert.match(src, /escapeHtml\(item\.part_name/);
  assert.match(src, /escapeHtml\(item\.part_no/);
});

test('signed session cookie round-trips and rejects tampering', () => {
  const { issueSession, readSession } = require('../production_safety');
  const headers = {};
  const res = { setHeader(name, value) { headers[name] = value; } };
  issueSession(res, { employee_id: 7, employee_name: 'Test', username: 'tester', employee_role: 'Admin', branch_name: 'HQ', accessible_pages: 'admin,dashboard' }, { headers: {}, secure: false });
  assert.match(headers['Set-Cookie'], /HttpOnly/);
  const cookie = headers['Set-Cookie'].split(';')[0];
  const session = readSession({ headers: { cookie } });
  assert.equal(session?.username, 'tester');
  assert.equal(session?.role, 'Admin');
  const tampered = cookie.replace(/.$/, cookie.endsWith('a') ? 'b' : 'a');
  assert.equal(readSession({ headers: { cookie: tampered } }), null);
});

test('configured cross-origin frontends receive explicit CORS headers while default stays closed', () => {
  const src = read('production_safety.js');
  assert.match(src, /Access-Control-Allow-Origin/);
  assert.match(src, /Access-Control-Allow-Credentials/);
  assert.match(src, /OPTIONS/);
});
