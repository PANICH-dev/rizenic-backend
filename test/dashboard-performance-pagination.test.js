const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('dashboard long operation tables use 20-row client pagination without changing API endpoints', () => {
  const html = read('public/dashboard.html');
  const po = read('public/dashboard_po.js');
  const tables = read('public/dashboard_tables.js');

  assert.match(html, /table_pagination\.js\?v=1\.1/);
  assert.match(po, /RizenicPagination\.createState\(20\)/);
  assert.match(po, /RizenicPagination\.paginate\([^,]+,\s*dashboardPOPager\)/s);
  assert.match(po, /containerId:\s*['"]dashboard_po_pagination['"]/);
  assert.match(tables, /stationTablePager\s*=\s*RizenicPagination\.createState\(20\)/);
  assert.match(tables, /parkedCarsPager\s*=\s*RizenicPagination\.createState\(20\)/);
  assert.match(tables, /containerId:\s*['"]dashboard_station_pagination['"]/);
  assert.match(tables, /containerId:\s*['"]dashboard_parked_pagination['"]/);

  // API contract stays exactly on the existing endpoints.
  const dashboard = read('public/dashboard.js');
  assert.match(dashboard, /\/api\/reports/);
  assert.match(dashboard, /\/api\/part-orders/);
  assert.match(dashboard, /\/api\/statuses/);
});

test('dashboard starts its independent API requests concurrently', () => {
  const dashboard = read('public/dashboard.js');
  assert.match(dashboard, /Promise\.allSettled\s*\(\s*\[/s);
  assert.match(dashboard, /fetch\(`\$\{API_BASE_URL\}\/api\/reports`\)/);
  assert.match(dashboard, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders`\)/);
  assert.match(dashboard, /fetch\(`\$\{API_BASE_URL\}\/api\/statuses`\)/);
});

test('parts and jobs hot paths use prebuilt part-order indexes instead of repeated full-array scans', () => {
  const partsCore = read('public/js/parts_core.js');
  const partsUi = read('public/js/parts_ui.js');
  const jobs = read('public/jobs.js');

  assert.match(partsCore, /partOrdersByJobKey\s*=\s*new Map\(\)/);
  assert.match(partsCore, /rebuildPartOrderIndexes\(\)/);
  assert.match(partsUi, /getPartOrdersForJob\(jobId\)/);
  assert.match(partsUi, /getPartOrdersForJob\(jobId\)\.length\s*>\s*0/);

  assert.match(jobs, /partOrdersByPlate\s*=\s*new Map\(\)/);
  assert.match(jobs, /rebuildPartOrdersByPlate\(\)/);
  assert.match(jobs, /getActivePartOrdersByPlate\(job\.car_plate\)/);
});

test('dashboard PO matching and calendar use indexes instead of repeated find/filter scans', () => {
  const dashboard = read('public/dashboard.js');
  const po = read('public/dashboard_po.js');
  const tables = read('public/dashboard_tables.js');

  assert.match(dashboard, /jobByPlate\s*=\s*new Map\(\)/);
  assert.match(dashboard, /rebuildDashboardIndexes\(\)/);
  assert.match(po, /getDashboardJobByPlate\(plate\)/);

  assert.match(tables, /function buildDashboardDateIndex\(jobs\)/);
  assert.match(tables, /dateIndex\.arrived\.get\(dateStr\)/);
  assert.match(tables, /dateIndex\.target\.get\(dateStr\)/);
  assert.match(tables, /dateIndex\.delivery\.get\(dateStr\)/);
});

test('dashboard removes watermark art and keeps charts/lists clipped inside padded cards', () => {
  const html = read('public/dashboard.html');
  const css = read('public/dashboard_polish.css');

  assert.doesNotMatch(html, /absolute -right-4 -bottom-4[^\n]*text-8xl/);
  assert.match(html, /dashboard-mini-chart-grid/);
  assert.match(html, /dashboard-summary-grid/);
  assert.match(css, /\.dashboard-mini-chart-grid\s*>\s*\.card-box\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.dashboard-chart-frame\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.dashboard-summary-grid\s*>\s*\.card-box\s*\{[^}]*padding:/s);
});

test('dashboard performance patch does not include or require database indexes', () => {
  assert.equal(fs.existsSync(path.join(root, 'database_performance_indexes.sql')), false);
});

test('dashboard keeps generous outer and inner spacing so charts do not touch card or viewport edges', () => {
  const css = read('public/dashboard_polish.css');
  assert.match(css, /\.dashboard-shell\s*\{[^}]*padding:\s*32px\s+28px/s);
  assert.match(css, /\.dashboard-chart-section\s*\{[^}]*padding:\s*24px/s);
  assert.match(css, /\.dashboard-chart-frame\s*\{[^}]*padding:\s*8px\s+10px\s+12px/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*\.dashboard-shell\s*\{[^}]*padding:\s*16px\s+12px/s);
});
