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

test('dashboard drill-downs use a full branch snapshot instead of the current 20-row page', () => {
  const views = read('server_side_views.js');
  const serverJs = read('public/dashboard_server.js');
  const block = routeBlock(views, 'dashboard-drilldown-snapshot');
  assert.match(block, /REPORT_DASHBOARD_FIELDS/);
  assert.match(block, /PART_ORDER_DASHBOARD_FIELDS/);
  assert.doesNotMatch(block, /LIMIT\s+20/i);
  assert.match(serverJs, /fetchDashboardDrilldownSnapshot/);
  assert.match(serverJs, /dashboardWithFullData/);
  for (const fn of ['openReportModal','openStatusModal','openDailyLineModal','openPaymentModal','openDamageModal','openPartsStatusModal','openMechanicModal','openSAModal','openStationModal','openCalendarModal']) {
    assert.match(serverJs, new RegExp(`wrapDashboardDrilldown\\('${fn}'\\)`), `${fn} must be wrapped with full-data drilldown`);
  }
});

test('dashboard keeps one canonical station mapping and no stale 08 เก็บงาน / 09 ซ่อมแม็ก mapping', () => {
  const dashboard = read('public/dashboard.js');
  const tables = read('public/dashboard_tables.js');
  assert.match(dashboard, /station_qc\)\) return "07\.QC"/);
  assert.match(dashboard, /station_mag\)\) return "08\.แม็ก"/);
  assert.doesNotMatch(tables, /function computeHighestStationIFS\s*\(/, 'tables must not redefine the canonical station mapper');
  assert.doesNotMatch(tables, /08\.เก็บงาน|09\.ซ่อมแม็ก|13\.รอส่งมอบ/);
  assert.match(tables, /07\.QC/);
  assert.match(tables, /08\.แม็ก/);
  assert.match(tables, /12\.รอส่งมอบ/);
});

test('parts-status aggregate does not attach another job parts by plate and is branch-safe', () => {
  const views = read('server_side_views.js');
  const block = routeBlock(views, 'dashboard-analytics');
  assert.match(block, /SELECT r\.id, r\.car_plate, r\.branch_name,/);
  assert.match(block, /ROW_NUMBER\(\) OVER \(PARTITION BY[\s\S]*branch_name[\s\S]*car_plate[\s\S]*ORDER BY r\.id DESC\) AS plate_rank/,
    'ambiguous no-job-id PO fallback must nominate one latest report per branch/plate');
  assert.match(block, /po\.job_id::text = j\.id::text/);
  assert.match(block, /OR \(\s*NULLIF\(BTRIM\(COALESCE\(po\.job_id::text,''\)\),''\) IS NULL\s*AND j\.plate_rank = 1\s*AND BTRIM\(COALESCE\(po\.branch_name,''\)\) = BTRIM\(COALESCE\(j\.branch_name,''\)\)\s*AND BTRIM\(COALESCE\(po\.car_plate,''\)\) = BTRIM\(COALESCE\(j\.car_plate,''\)\)/,
    'plate fallback is allowed only once for branch-matching POs that have no job_id');
});

test('calendar bar click handler exists and filters arrived/target/delivery explicitly', () => {
  const serverJs = read('public/dashboard_server.js');
  assert.match(serverJs, /openJobListModalCalendar/);
  assert.match(serverJs, /type === 'arrived'/);
  assert.match(serverJs, /type === 'target'/);
  assert.match(serverJs, /type === 'delivery'/);
  assert.match(serverJs, /cleanDate\(j\.arrived_date\)/);
  assert.match(serverJs, /cleanDate\(j\.target_finish_date\)/);
  assert.match(serverJs, /cleanDate\(j\.delivery_date\)/);
});
