const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

test('index initial load defers part-orders until parts tracking is actually opened', () => {
  const core = read('public/sa_core.js');
  const parts = read('public/sa_parts.js');
  const initialLoad = functionBody(core, 'loadInitialData');
  const trackingLoad = functionBody(parts, 'loadPartsTrackingTable');

  assert.doesNotMatch(initialLoad, /\/api\/part-orders/,
    'opening the main SA screen must not download all part orders');
  assert.match(trackingLoad, /\/api\/part-orders/,
    'existing PO tracking flow must still lazy-load part orders when needed');
  assert.match(trackingLoad, /window\.allPartOrders/,
    'existing cache must remain in use');
});

test('history loads reports first and lazy-loads/indexes part orders only for detail', () => {
  const history = read('public/history.js');
  const loadData = functionBody(history, 'loadData');
  const detail = functionBody(history, 'viewHistoryDetail');

  assert.doesNotMatch(loadData, /\/api\/part-orders/,
    'history search page should not download part orders before detail is opened');
  assert.match(history, /partOrdersByPlate\s*=\s*new Map\(\)/);
  assert.match(history, /async function ensureHistoryPartOrdersLoaded\(\)/);
  assert.match(history, /function getHistoryPartOrdersForJob\(/);
  assert.match(detail, /await ensureHistoryPartOrdersLoaded\(\)/);
  assert.match(detail, /getHistoryPartOrdersForJob\(job,\s*jobId\)/);
  assert.doesNotMatch(detail, /allPartOrders\.filter\(/,
    'detail lookup should use the plate index rather than scanning every PO');
});

test('dashboard reuses render indexes for daily dates and per-job part orders', () => {
  const dashboard = read('public/dashboard.js');
  const charts = read('public/dashboard_charts.js');
  const applyFilters = functionBody(dashboard, 'applyFilters');
  const daily = functionBody(charts, 'renderDailyLineChart');
  const partsChart = functionBody(charts, 'renderPartsStatusChart');
  const partsModal = functionBody(charts, 'openPartsStatusModal');

  assert.match(dashboard, /dashboardDateCounts\s*=\s*\{/);
  assert.match(dashboard, /dashboardPartOrdersByJobId\s*=\s*new Map\(\)/);
  assert.match(dashboard, /dashboardPartOrdersByPlate\s*=\s*new Map\(\)/);
  assert.match(dashboard, /function rebuildDashboardRenderIndexes\(\)/);
  assert.match(dashboard, /function getDashboardPartOrdersForJob\(job\)/);
  assert.match(applyFilters, /rebuildDashboardRenderIndexes\(\)/);

  assert.match(daily, /dashboardDateCounts\.arrived\.get\(dateStr\)/);
  assert.match(daily, /dashboardDateCounts\.target\.get\(dateStr\)/);
  assert.match(daily, /dashboardDateCounts\.delivery\.get\(dateStr\)/);
  assert.doesNotMatch(daily, /filteredJobs\.filter\(/,
    'daily line chart should not scan all jobs three times per date');

  assert.match(partsChart, /getDashboardPartOrdersForJob\(job\)/);
  assert.match(partsModal, /getDashboardPartOrdersForJob\(job\)/);
  assert.doesNotMatch(partsChart, /filteredPartOrders\.filter\(/,
    'parts chart should use the prebuilt PO index');
  assert.doesNotMatch(partsModal, /filteredPartOrders\.filter\(/,
    'parts modal should use the same PO index');
});

test('safe logic performance patch leaves API contract and backend/database files untouched', () => {
  const dashboard = read('public/dashboard.js');
  assert.match(dashboard, /\/api\/reports/);
  assert.match(dashboard, /\/api\/part-orders/);
  assert.match(dashboard, /\/api\/statuses/);
  assert.equal(fs.existsSync(path.join(root, 'database_performance_indexes.sql')), false);
});
