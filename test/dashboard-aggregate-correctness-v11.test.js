const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function routeBlock(src, route) {
  const start = src.indexOf(`app.get('/api/server/${route}'`);
  assert.ok(start >= 0, `${route} route missing`);
  const next = src.indexOf("app.get('/api/server/", start + 20);
  return src.slice(start, next < 0 ? src.length : next);
}

test('dashboard analytics are aggregated from the full scoped database dataset, not the current 20 rows', () => {
  const views = read('server_side_views.js');
  const block = routeBlock(views, 'dashboard-analytics');
  for (const key of ['dailyReport','statusChartCounts','insuranceCounts','dailySeries','paymentCounts','financeCounts','damageCounts','partsStatusCounts','mechanicCounts','calendarDays']) {
    assert.match(block, new RegExp(key), `analytics response must include ${key}`);
  }
  assert.doesNotMatch(block, /LIMIT\s+20/i, 'aggregate analytics must not be calculated from a 20-row page');
  assert.match(block, /GROUP BY|COUNT\(\*\).*FILTER/is);
});

test('dashboard PO history has its own server-paged endpoint grouped by car instead of using current-page parts', () => {
  const views = read('server_side_views.js');
  const block = routeBlock(views, 'dashboard-po');
  assert.match(block, /rizenic_part_orders/);
  assert.match(block, /pageCountProjection\(knownTotal\)/, 'first load counts rows, later same-filter pages may reuse the known total');
  assert.match(block, /LIMIT/);
  assert.match(block, /OFFSET/);
  assert.match(block, /order_status.*ยกเลิก|ยกเลิก.*order_status/s);
  assert.match(block, /entries/);
  assert.match(block, /ORDER BY plate ASC/, 'PO history keeps the legacy plate ordering while paging on the server');
  assert.match(block, /COALESCE\(NULLIF\(BTRIM\(car_plate\),''\),'ไม่ระบุ'\) = ANY/, 'blank-plate PO groups must still return their detail rows');
});

test('dashboard browser uses server aggregates for charts/report/calendar and server pagination for PO history', () => {
  const serverJs = read('public/dashboard_server.js');
  const charts = read('public/dashboard_charts.js');
  const tables = read('public/dashboard_tables.js');
  assert.match(serverJs, /dashboard-analytics/);
  assert.match(serverJs, /dashboard-po/);
  assert.match(serverJs, /dashboardServerAnalytics/);
  assert.match(serverJs, /dashboardPOServerPageInfo/);
  assert.match(charts, /dashboardServerAnalytics/);
  assert.match(charts, /dailyReport/);
  assert.match(charts, /partsStatusCounts/);
  assert.match(tables, /dashboardServerAnalytics/);
  assert.match(tables, /calendarDays/);
});

test('dashboard no longer treats parts belonging to the current 20 report rows as the complete PO history', () => {
  const serverJs = read('public/dashboard_server.js');
  assert.doesNotMatch(serverJs, /allPartOrders\s*=\s*pageParts/);
  assert.match(serverJs, /fetchDashboardPOPage/);
});

test('dashboard calendar aggregate preserves legacy done/quota semantics instead of deriving them from the current page', () => {
  const views = read('server_side_views.js');
  const tables = read('public/dashboard_tables.js');
  const serverJs = read('public/dashboard_server.js');
  const block = routeBlock(views, 'dashboard-analytics');
  assert.match(block, /LEFT\(COALESCE\(job_status,''\),2\).*ANY\(ARRAY\['11','12','13','14','15','16','17','19','20','21'\]\)/s,
    'calendar completed target count must keep the legacy isJobDone status-prefix rule');
  assert.match(block, /rizenic_quotas/, 'dashboard analytics must provide quota master data for calendar capacity');
  assert.match(block, /main_part_name/);
  assert.match(block, /sub_part_name/);
  assert.match(serverJs, /dashboardServerBranches/);
  assert.match(tables, /dashboardServerBranches/);
  assert.match(tables, /dashboardServerAnalytics\?\.quotas/);
});

test('dashboard aggregate failure falls back to the full legacy datasets instead of showing first-page totals as truth', () => {
  const serverJs = read('public/dashboard_server.js');
  assert.match(serverJs, /fetchDashboardLegacyFullDataset/);
  assert.match(serverJs, /\/api\/reports\?\$\{reportParams\.toString\(\)\}/);
  assert.match(serverJs, /\/api\/part-orders\?\$\{partParams\.toString\(\)\}/);
  assert.match(serverJs, /legacyFallback/);
  assert.match(serverJs, /legacyFallback\?\.partOrders/);
});
