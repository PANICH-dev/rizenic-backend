const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const tailwindPages = [
  'public/index.html',
  'public/jobs.html',
  'public/jobs_table.html',
  'public/parts.html',
  'public/repair.html',
  'public/dashboard.html',
  'public/finance.html',
  'public/admin.html',
  'public/history.html',
  'public/repair_export.html',
  'public/repair_date_update.html',
  'public/repair_board.html'
];

test('server loads .env before reading DATABASE_URL and compresses responses', () => {
  const app = read('app.js');
  const pkg = JSON.parse(read('package.json'));
  assert.match(app.slice(0, 120), /require\(['"]dotenv['"]\)\.config\(\)/);
  assert.match(app, /installApiCompression/);
  assert.match(app, /require\(['"]\.\/api_compression['"]\)/);
  assert.match(app, /app\.use\(installApiCompression\)/);
});

test('pages use precompiled Tailwind CSS and never execute Tailwind runtime', () => {
  for (const rel of tailwindPages) {
    const html = read(rel);
    assert.doesNotMatch(html, /\/vendor\/tailwindcss\.js/i);
    const stem = path.basename(rel, '.html');
    assert.match(html, new RegExp(`/compiled/${stem}\\.tailwind\\.css`));
    assert.ok(fs.existsSync(path.join(root, 'public', 'compiled', `${stem}.tailwind.css`)));
  }
});

test('jobs paging never treats a legitimate zero-row result as an excuse to fetch full legacy datasets', () => {
  const src = read('public/jobs_table_server.js');
  assert.doesNotMatch(src, /payloadTotal\s*===\s*0\s*&&\s*jobsCanTryLegacyCompatibility/);
  assert.match(src, /AbortController/);
  assert.match(src, /signal:\s*jobsServerAbortController\.signal/);
});

test('repair board polling pauses in hidden tabs and prevents overlapping loads', () => {
  const src = read('public/repair_board.html');
  assert.match(src, /document\.hidden/);
  assert.match(src, /let\s+repairBoardLoadInFlight\s*=\s*false\s*;/);
  assert.match(src, /if\s*\(document\.hidden\s*\|\|\s*repairBoardLoadInFlight\)/);
  assert.match(src, /visibilitychange/);
});

test('npm test runs the node test suite', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /node\s+--test/);
});

test('API compression actually gzips large JSON responses when the browser accepts gzip', async () => {
  const zlib = require('node:zlib');
  const { installApiCompression } = require('../api_compression');
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  let resolveSent;
  const sentPromise = new Promise(resolve => { resolveSent = resolve; });
  const res = {
    headersSent: false,
    getHeader(name) { return headers[name]; },
    setHeader(name, value) { headers[name] = value; },
    removeHeader(name) { delete headers[name]; },
    vary(value) { headers.Vary = value; },
    send(body) { resolveSent(body); return this; }
  };
  const req = { path: '/api/reports', headers: { 'accept-encoding': 'gzip, deflate' } };
  let nextCalled = false;
  installApiCompression(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const source = JSON.stringify({ rows: Array.from({ length: 250 }, (_, i) => ({ id: i, name: 'ทดสอบข้อมูล'.repeat(4) })) });
  res.send(source);
  const compressed = await sentPromise;
  assert.equal(headers['Content-Encoding'], 'gzip');
  assert.match(headers.Vary, /Accept-Encoding/);
  assert.equal(zlib.gunzipSync(compressed).toString(), source);
});

test('API compression is fail-safe behind proxies and never competes with upstream compression by default', async () => {
  const { installApiCompression } = require('../api_compression');
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  let sentBody;
  const res = {
    headersSent: false,
    statusCode: 200,
    getHeader(name) { return headers[name]; },
    setHeader(name, value) { headers[name] = value; },
    removeHeader(name) { delete headers[name]; },
    vary(value) { headers.Vary = value; },
    send(body) { sentBody = body; return this; }
  };
  const req = {
    method: 'GET',
    path: '/api/reports',
    headers: {
      'accept-encoding': 'gzip, deflate',
      'x-forwarded-for': '203.0.113.10'
    }
  };

  installApiCompression(req, res, () => {});
  const source = JSON.stringify({ rows: Array.from({ length: 250 }, (_, i) => ({ id: i, name: 'proxy-safe'.repeat(8) })) });
  res.send(source);

  assert.equal(sentBody, source);
  assert.equal(headers['Content-Encoding'], undefined);
});

test('API compression skips responses that must not be transformed', async () => {
  const { installApiCompression } = require('../api_compression');
  const cases = [
    { method: 'HEAD', statusCode: 200, reqHeaders: {}, resHeaders: {} },
    { method: 'GET', statusCode: 204, reqHeaders: {}, resHeaders: {} },
    { method: 'GET', statusCode: 304, reqHeaders: {}, resHeaders: {} },
    { method: 'GET', statusCode: 200, reqHeaders: { range: 'bytes=0-99' }, resHeaders: {} },
    { method: 'GET', statusCode: 200, reqHeaders: {}, resHeaders: { 'Cache-Control': 'public, no-transform' } },
    { method: 'GET', statusCode: 200, reqHeaders: {}, resHeaders: { 'Content-Encoding': 'br' } }
  ];

  for (const c of cases) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', ...c.resHeaders };
    let sentBody;
    const res = {
      headersSent: false,
      statusCode: c.statusCode,
      getHeader(name) { return headers[name]; },
      setHeader(name, value) { headers[name] = value; },
      removeHeader(name) { delete headers[name]; },
      vary(value) { headers.Vary = value; },
      send(body) { sentBody = body; return this; }
    };
    const req = {
      method: c.method,
      path: '/api/reports',
      headers: { 'accept-encoding': 'gzip, deflate', ...c.reqHeaders }
    };

    installApiCompression(req, res, () => {});
    const source = JSON.stringify({ rows: Array.from({ length: 250 }, (_, i) => ({ id: i, name: 'safe'.repeat(8) })) });
    res.send(source);

    assert.equal(sentBody, source, `must send original body for ${JSON.stringify(c)}`);
    assert.notEqual(headers['Content-Encoding'], 'gzip', `must not gzip ${JSON.stringify(c)}`);
  }
});

test('API compression defaults to off in production unless explicitly forced', async () => {
  const { installApiCompression } = require('../api_compression');
  const oldNodeEnv = process.env.NODE_ENV;
  const oldMode = process.env.API_GZIP_MODE;
  process.env.NODE_ENV = 'production';
  delete process.env.API_GZIP_MODE;

  try {
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    let sentBody;
    const res = {
      headersSent: false,
      statusCode: 200,
      getHeader(name) { return headers[name]; },
      setHeader(name, value) { headers[name] = value; },
      removeHeader(name) { delete headers[name]; },
      vary(value) { headers.Vary = value; },
      send(body) { sentBody = body; return this; }
    };
    const req = { method: 'GET', path: '/api/reports', headers: { 'accept-encoding': 'gzip' } };
    installApiCompression(req, res, () => {});
    const source = JSON.stringify({ rows: Array.from({ length: 250 }, (_, i) => ({ id: i, name: 'production-safe'.repeat(6) })) });
    res.send(source);

    assert.equal(sentBody, source);
    assert.equal(headers['Content-Encoding'], undefined);
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldMode === undefined) delete process.env.API_GZIP_MODE; else process.env.API_GZIP_MODE = oldMode;
  }
});
