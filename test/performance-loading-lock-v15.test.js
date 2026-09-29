const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('shared session guard owns a blocking API loading layer and prevents clicks while API work is pending', () => {
  const src = read('public/session_guard.js');
  assert.match(src, /rz-api-loading-layer/);
  assert.match(src, /pendingBlockingRequests/);
  assert.match(src, /กำลังโหลดข้อมูล/);
  assert.match(src, /\['click',[\s\S]*?'keydown'\]/);
  assert.match(src, /document\.addEventListener\(type, preventBusyInteraction, true\)/);
  assert.match(src, /finally\([\s\S]*?endBlockingRequest/);
});

test('finance totals are cached by filter signature so page navigation does not rerun aggregate SQL', () => {
  const src = read('public/finance_server.js');
  assert.match(src, /financeTotalsKey/);
  assert.match(src, /buildFinanceTotalsKey/);
  assert.match(src, /if \(!force && key === financeTotalsKey\) return/);
});

test('dashboard PO facets can be skipped after they are cached for the current branch', () => {
  const client = read('public/dashboard_server.js');
  const server = read('server_side_views.js');
  assert.match(client, /dashboardPOFacetsBranch/);
  assert.match(client, /includeFacets/);
  assert.match(server, /const includeFacets = clean\(req\.query\.includeFacets\) !== '0'/);
  assert.match(server, /includeFacets \? await pool\.query\(facetCte, facetValues\)/);
});

test('SA detail/search requests skip unchanged branch metadata while default API contract remains intact', () => {
  const client = read('public/jobs_server.js');
  const server = read('server_side_views.js');
  assert.match(client, /includeMeta:\s*'0'/);
  assert.match(server, /const includeMeta = clean\(req\.query\.includeMeta\) !== '0'/);
  assert.match(server, /includeMeta \? pool\.query/);
});

test('repair paging reuses branch metadata instead of requerying quotas body parts and KPI aggregates every page', () => {
  const client = read('public/repair_server.js');
  const server = read('server_side_views.js');
  assert.match(client, /repairServerMetaBranch/);
  assert.match(client, /includeMeta/);
  assert.match(server, /const includeMeta = clean\(req\.query\.includeMeta\) !== '0'/);
  assert.match(server, /includeMeta \? pool\.query/);
});

test('scoped part-order lookup uses job id first and plate only as a blank-job fallback', () => {
  const src = read('server_side_views.js');
  const start = src.indexOf('async function buildScopedPartOrdersForReports');
  const end = src.indexOf('const ADMIN_RESOURCES', start);
  const fn = src.slice(start, end);
  assert.match(fn, /Promise\.all/);
  assert.match(fn, /NULLIF\(BTRIM\(COALESCE\(job_id::text, ''\)\), ''\) IS NULL/);
  assert.doesNotMatch(fn, /job_id::text = ANY\([^\n]+ OR car_plate = ANY/);
});

test('dashboard drilldown loads reports and part orders in parallel', () => {
  const src = read('server_side_views.js');
  const start = src.indexOf("app.get('/api/server/dashboard-drilldown-snapshot'");
  const end = src.indexOf("app.get('/api/server/dashboard-po'", start);
  const route = src.slice(start, end);
  assert.match(route, /Promise\.all/);
});

test('dashboard and SA cache static status master requests instead of refetching them on every server view change', () => {
  const dashboard = read('public/dashboard_server.js');
  const jobs = read('public/jobs_server.js');
  assert.match(dashboard, /dashboardStatusesPromise/);
  assert.match(dashboard, /function fetchDashboardStatusesOnce/);
  assert.match(jobs, /jobsMasterDataPromise/);
  assert.match(jobs, /function fetchJobsMasterDataOnce/);
});

test('dashboard branch metadata is optional after the first server response while the default API still includes it', () => {
  const client = read('public/dashboard_server.js');
  const server = read('server_side_views.js');
  assert.match(client, /includeBranches/);
  assert.match(server, /const includeBranches = clean\(req\.query\.includeBranches\) !== '0'/);
  assert.match(server, /includeBranches \? pool\.query/);
});

test('finance dashboard starts its summary request in parallel with bootstrap metadata instead of waiting for masters first', () => {
  const src = read('public/finance_server.js');
  assert.match(src, /function primeFinanceFilterDefaults/);
  assert.match(src, /const summaryPromise = dashboardActive \? updateDashboard\(\) : applyFilters\(\)/);
  assert.match(src, /const metaPromise = Promise\.all/);
  assert.match(src, /await Promise\.all\(\[metaPromise, summaryPromise\]\)/);
});
