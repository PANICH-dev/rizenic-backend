const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('read queries preserve old full-data SQL and add only parameterized read filters', () => {
  const { buildReportsReadQuery, buildPartOrdersReadQuery } = require('../read_queries');

  assert.deepEqual(buildReportsReadQuery({}), {
    text: 'SELECT * FROM rizenicreport ORDER BY id DESC',
    values: []
  });
  assert.deepEqual(buildPartOrdersReadQuery({}), {
    text: 'SELECT * FROM rizenic_part_orders ORDER BY order_id DESC',
    values: []
  });

  const scoped = buildReportsReadQuery({ branch: 'สาขา A', department_routing: 'บัญชี', exclude_status: 'ปิดงาน' });
  assert.match(scoped.text, /branch_name = \$1/);
  assert.match(scoped.text, /department_routing = \$2/);
  assert.match(scoped.text, /COALESCE\(job_status, ''\) <> \$3/);
  assert.deepEqual(scoped.values, ['สาขา A', 'บัญชี', 'ปิดงาน']);

  const parts = buildPartOrdersReadQuery({ branch: 'สาขา A' });
  assert.match(parts.text, /branch_name = \$1/);
  assert.deepEqual(parts.values, ['สาขา A']);
});

test('GET reports and part-orders keep the same route paths and use safe read-query builders', () => {
  const app = read('app.js');
  assert.match(app, /buildReportsReadQuery\(req\.query/);
  assert.match(app, /buildPartOrdersReadQuery\(req\.query/);
  assert.match(app, /app\.get\('\/api\/reports'/);
  assert.match(app, /app\.get\('\/api\/part-orders'/);
});

test('pages that already restricted users to a branch now push that same restriction into SELECT reads', () => {
  const parts = read('public/js/parts_core.js');
  const jobs = read('public/jobs.js');
  const table = read('public/jobs_table_core.js');
  const repair = read('public/repair.js');
  const dashboard = read('public/dashboard.js');
  const finance = read('public/finance.html');
  const audit = read('public/audit.js');
  const calendar = read('public/sa_calendar.js');
  const repairDate = read('public/repair_date_update.html');
  const repairExport = read('public/repair_export.html');
  const repairBoard = read('public/repair_board.html');

  assert.match(parts, /reportParams\.set\('branch', userBranch\)/);
  assert.match(parts, /orderParams\.set\('branch', userBranch\)/);
  assert.match(jobs, /reportParams\.set\('branch', userBranch\)/);
  assert.match(table, /reportParams\.set\('branch', userBranch\)/);
  assert.match(repair, /reportParams\.set\('branch', currentBranch\)/);
  assert.match(dashboard, /reportParams\.set\('branch', userBranch\)/);
  assert.match(finance, /department_routing:\s*'บัญชี'/);
  assert.match(finance, /exclude_status:\s*'ปิดงาน'/);
  assert.match(audit, /URLSearchParams\(\{ branch: userBranch \}\)/);
  assert.match(calendar, /api\/reports\?branch=\$\{encodeURIComponent\(b\)\}/);
  assert.match(calendar, /api\/reports\?branch=\$\{encodeURIComponent\(branch\)\}/);
  assert.match(repairDate, /department_routing:\s*'ซ่อม'/);
  assert.match(repairExport, /department_routing:\s*'ซ่อม'/);
  assert.match(repairBoard, /URLSearchParams\(\{ branch: currentBranch \}\)/);
});

test('heavy pages paint primary content before non-critical datasets finish', () => {
  const table = read('public/jobs_table_core.js');
  const jobs = read('public/jobs.js');
  const repair = read('public/repair.js');
  const dashboard = read('public/dashboard.js');
  const parts = read('public/js/parts_core.js');

  assert.match(table, /primaryResults/);
  assert.match(table, /secondaryPromise/);
  assert.ok(table.indexOf('applyFilters();') < table.indexOf('const secondaryResults = await secondaryPromise'));

  assert.match(jobs, /primaryReport/);
  assert.match(jobs, /secondaryPromise/);
  assert.match(jobs, /employeeBranchesPromise/);
  assert.ok(jobs.indexOf('filterDataByBranch();') < jobs.indexOf('const employees = await employeeBranchesPromise'));
  assert.ok(jobs.indexOf('filterDataByBranch();') < jobs.indexOf('const secondaryResults = await secondaryPromise'));

  assert.match(repair, /primaryReports/);
  assert.match(repair, /secondaryRepairData/);
  assert.ok(repair.indexOf('runTableFilters();') < repair.indexOf('await secondaryRepairData'));

  assert.match(dashboard, /primaryReports/);
  assert.match(dashboard, /secondaryDashboardData/);
  assert.ok(dashboard.indexOf('applyFilters(false);') < dashboard.indexOf('await secondaryDashboardData'));

  assert.match(parts, /masterPromise/);
  assert.match(parts, /alertsPromise/);
});

test('employee reads can be branch-scoped without changing the legacy no-filter query', () => {
  const { buildEmployeesReadQuery } = require('../read_queries');
  assert.deepEqual(buildEmployeesReadQuery({}), {
    text: 'SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC',
    values: []
  });
  const scoped = buildEmployeesReadQuery({ branch: 'สาขา A' });
  assert.match(scoped.text, /WHERE branch_name = \$1/);
  assert.deepEqual(scoped.values, ['สาขา A']);
});

test('jobs and finance do not make first usable paint wait for employee/status metadata', () => {
  const jobs = read('public/jobs.js');
  const finance = read('public/finance.html');

  assert.match(jobs, /employeeBranchesPromise/);
  assert.ok(jobs.indexOf('filterDataByBranch();') < jobs.indexOf('await employeeBranchesPromise'));

  assert.match(finance, /financeStatusPromise/);
  assert.ok(finance.indexOf('applyGlobalFilters();') < finance.indexOf('await financeStatusPromise'));
});

test('admin loads the visible employee panel first and lazy-loads hidden panels on first switch', () => {
  const admin = read('public/admin.html');
  assert.match(admin, /const adminPanelLoaders\s*=\s*\{/);
  assert.match(admin, /ensureAdminPanelLoaded\('emp-panel'\)/);
  assert.match(admin, /function\s+switchPanel\(panelId\)[\s\S]*ensureAdminPanelLoaded\(panelId\)/);
  assert.doesNotMatch(admin, /function\s+loadAllData\s*\(\)\s*\{\s*loadEmp\(\);\s*loadCar\(\);\s*loadIns\(\);/s);
});

test('XLSX is lazy-loaded on pages where Excel is an optional action', () => {
  const index = read('public/index.html');
  const jobsTable = read('public/jobs_table.html');
  const finance = read('public/finance.html');
  const repairExport = read('public/repair_export.html');
  const saImport = read('public/sa_import_qt.js');
  const jobsCore = read('public/jobs_table_core.js');

  assert.doesNotMatch(index, /<script[^>]+src=[\"'][^\"']*xlsx\.full\.min\.js/i);
  assert.doesNotMatch(jobsTable, /<script[^>]+src=[\"'][^\"']*xlsx\.full\.min\.js/i);
  assert.doesNotMatch(finance, /<script[^>]+src=[\"'][^\"']*xlsx\.full\.min\.js/i);
  assert.doesNotMatch(repairExport, /<script[^>]+src=[\"'][^\"']*xlsx\.full\.min\.js/i);
  assert.match(repairExport, /function\s+ensureXlsxLoaded/);
  assert.match(saImport, /ensureXlsxLoaded/);
  assert.match(jobsCore, /function\s+ensureXlsxLoaded/);
  assert.match(finance, /function\s+ensureXlsxLoaded/);
});

test('CDN-heavy pages preconnect before loading blocking UI assets', () => {
  for (const rel of ['public/index.html','public/jobs.html','public/jobs_table.html','public/parts.html','public/repair.html','public/dashboard.html','public/finance.html','public/admin.html','public/history.html']) {
    const html = read(rel);
    assert.match(html, /rel="preconnect" href="https:\/\/cdn\.tailwindcss\.com"/);
    assert.match(html, /rel="preconnect" href="https:\/\/cdnjs\.cloudflare\.com"/);
  }
});

test('dashboard first paint skips part-only widgets and background refresh has no out-of-scope flag', () => {
  const dashboard = read('public/dashboard.js');
  const refresh = dashboard.match(/function\s+refreshDashboardPartViews\s*\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(refresh, 'refreshDashboardPartViews must exist');
  assert.doesNotMatch(refresh[1], /\bincludeParts\b/, 'background refresh must not reference applyFilters local parameter');
  assert.match(dashboard, /if\s*\(includeParts\s*&&\s*typeof renderPartsTracking/);
  assert.match(dashboard, /if\s*\(includeParts\s*&&\s*typeof renderPartsStatusChart/);
});

test('SA bootstrap does not duplicate car-brand datalist DOM work', () => {
  const core = read('public/sa_core.js');
  const block = core.match(/const uniqueBrands =[^;]+;([\s\S]*?)updateCarModels\('Tesla'\)/);
  assert.ok(block, 'car-brand bootstrap block must exist');
  const appends = block[1].match(/uniqueBrands\.forEach\(brand => brandList\.innerHTML \+=/g) || [];
  assert.equal(appends.length, 1);
});
