const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('blocking loader never adds artificial wait after the last API finishes and coalesces identical GETs', () => {
  const src = read('public/session_guard.js');
  assert.match(src, /const MIN_VISIBLE_MS = 0;/);
  assert.match(src, /inflightGetRequests/);
  assert.match(src, /canCoalesceApiGet/);
  assert.match(src, /response\.clone\(\)/);
});

test('paged report query can reuse a known total without a repeated COUNT window scan', () => {
  const { buildPagedReportsReadQuery } = require('../read_queries');
  const first = buildPagedReportsReadQuery({ page: '1', limit: '50' });
  assert.match(first.text, /COUNT\(\*\) OVER\(\)/);
  assert.equal(first.knownTotal, null);

  const next = buildPagedReportsReadQuery({ page: '2', limit: '50', known_total: '712' });
  assert.doesNotMatch(next.text, /COUNT\(\*\) OVER\(\)/);
  assert.equal(next.knownTotal, 712);
});

test('part-order page lookup uses job id first and plate only when the part order has no job id', () => {
  const { buildPartOrdersReadQuery } = require('../read_queries');
  const query = buildPartOrdersReadQuery({ branch: 'Navamin', job_ids: '1,2', car_plates: 'กก1,ขข2' });
  assert.match(query.text, /job_id::text = ANY/);
  assert.match(query.text, /NULLIF\(BTRIM\(COALESCE\(job_id::text, ''\)\), ''\) IS NULL AND car_plate = ANY/);
  assert.doesNotMatch(query.text, /\(job_id::text = ANY\([^\n]+ OR car_plate = ANY/);
});

test('jobs table enriches the visible page through the scoped part-order endpoint, not raw full-row part-orders', () => {
  const src = read('public/jobs_table_server.js');
  assert.match(src, /\/api\/server\/sa-parts\?/);
  assert.doesNotMatch(src, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders/);
});

test('server-side page clients reuse the existing total only for page navigation', () => {
  const files = [
    'public/jobs_table_server.js',
    'public/finance_server.js',
    'public/history_server.js',
    'public/parts_server.js',
    'public/admin_server.js',
    'public/repair_server.js',
    'public/dashboard_server.js',
    'public/jobs_server.js'
  ];
  for (const file of files) {
    assert.match(read(file), /known_total/, `${file} should reuse a known total for same-filter paging`);
  }
});

test('server-side views accept known totals so repeated pages can skip window counts without changing response shape', () => {
  const src = read('server_side_views.js');
  assert.match(src, /function parseKnownTotal/);
  assert.match(src, /knownTotal/);
  assert.match(src, /COUNT\(\*\) OVER\(\)/);
});

test('finance metadata gets branches and years in one database query', () => {
  const src = read('server_side_views.js');
  const start = src.indexOf("app.get('/api/server/finance-meta'");
  const end = src.indexOf("app.get('/api/server/finance-totals'", start);
  const route = src.slice(start, end);
  assert.match(route, /ARRAY_AGG\(DISTINCT/);
  assert.doesNotMatch(route, /Promise\.all/);
});

test('SA overview returns current-page part orders in the same request instead of a second HTTP round trip', () => {
  const src = read('public/jobs_server.js');
  assert.match(src, /includeParts:\s*'1'/);
  const calls = src.match(/fetchJobsPageParts\s*\(/g) || [];
  assert.equal(calls.length, 1, 'fetchJobsPageParts should remain only as a helper definition, not be called by page loads');
  assert.match(src, /payload\.partOrders/);
});

test('repair page returns current-page part orders in the same request and renders the page once', () => {
  const src = read('public/repair_server.js');
  assert.match(src, /includeParts:\s*'1'/);
  const calls = src.match(/fetchRepairPageParts\s*\(/g) || [];
  assert.equal(calls.length, 1, 'fetchRepairPageParts should remain only as a helper definition, not be called by page loads');
  assert.match(src, /payload\.partOrders/);
});

test('dashboard reuses existing totals when refreshing the same server-side list filters', () => {
  const src = read('public/dashboard_server.js');
  assert.match(src, /fetchDashboardList\('station', stationTablePager\.page \|\| 1, \{ reuseTotal: true \}\)/);
  assert.match(src, /fetchDashboardList\('parked', parkedCarsPager\.page \|\| 1, \{ reuseTotal: true \}\)/);
  assert.match(src, /fetchDashboardPOPage\(dashboardPOPager\.page \|\| 1, \{ reuseTotal: !resetPage \}\)/);
});
