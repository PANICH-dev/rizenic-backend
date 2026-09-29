const test = require('node:test');
const assert = require('node:assert/strict');
const { registerServerSideViews } = require('../server_side_views');

function captureRoutes(pool) {
  const routes = new Map();
  const app = { get(path, handler) { routes.set(path, handler); } };
  registerServerSideViews(app, pool);
  return routes;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('repair calendar SQL aggregates appointment_date for the requested month', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [{ date: '2026-09-01', appointment: 2, target: 1, done: 0, delivery: 0, main_parts: 1, sub_parts: 0, overdue: 0 }] }; } };
  const routes = captureRoutes(pool);
  const res = responseRecorder();
  await routes.get('/api/server/repair-calendar')({ query: { branch: 'Navamin', year: '2026', month: '9' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.days[0].appointment, 2);
  assert.match(calls[0].sql, /appointment_date::date AS appointment_day/);
  assert.match(calls[0].sql, /target_finish_date::date AS target_day/);
  assert.match(calls[0].sql, /delivery_date::date AS delivery_day/);
  assert.deepEqual(calls[0].values, ['Navamin', '2026-09-01', '2026-10-01']);
});

test('repair page defaults to statuses 09-11 and calculated station filter is translated to station flags', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  const routes = captureRoutes(pool);
  const res = responseRecorder();
  await routes.get('/api/server/repair-page')({ query: {
    branch: 'Navamin', page: '1', limit: '50', includeMeta: '0', includeParts: '0', known_total: '0',
    filters: JSON.stringify({ calculated_station: ['01.เคาะ'] })
  } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /09\|10\|11/);
  assert.match(calls[0].sql, /department_routing = 'ซ่อม'/);
  assert.match(calls[0].sql, /WHEN COALESCE\(station_kho::text,''\) IN \('true','TRUE','1'\) THEN '01\.เคาะ'/);
  assert.match(calls[0].sql, /= ANY\(\$2::text\[\]\)/);
});

test('calendar-driven repair page intentionally widens scope while still applying appointment date filter', async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; } };
  const routes = captureRoutes(pool);
  const res = responseRecorder();
  await routes.get('/api/server/repair-page')({ query: {
    branch: 'Navamin', page: '1', limit: '50', includeMeta: '0', includeParts: '0', known_total: '0', calendar: '1',
    filters: JSON.stringify({ appointment_date: ['2026-09-29'] })
  } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /AND department_routing = 'ซ่อม'/);
  assert.match(calls[0].sql, /COALESCE\(appointment_date::date::text, ''\) = ANY/);
});
