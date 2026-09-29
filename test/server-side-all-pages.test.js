const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('server-side view module is registered and is read-only', () => {
  const app = read('app.js');
  assert.match(app, /registerServerSideViews/);
  assert.match(app, /require\(['"]\.\/server_side_views['"]\)/);
  const views = read('server_side_views.js');
  assert.doesNotMatch(views, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
  assert.match(views, /\/api\/server\/dashboard/);
  assert.match(views, /\/api\/server\/sa-overview/);
  assert.match(views, /\/api\/server\/parts-alerts/);
  assert.match(views, /\/api\/server\/calendar-capacity/);
  assert.match(views, /\/api\/server\/repair-board/);
  assert.match(views, /\/api\/server\/repair-page/);
});

test('jobs table does not fall back to downloading the whole dataset', () => {
  const server = read('public/jobs_table_server.js');
  assert.doesNotMatch(server, /fetchJobsLegacyCompatibilityRows/);
  assert.doesNotMatch(server, /fetch\(reportUrl\)/);
  assert.doesNotMatch(server, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders`\)/);
});

test('finance table is overridden by a server-paged implementation', () => {
  const html = read('public/finance.html');
  const server = read('public/finance_server.js');
  assert.match(html, /finance_server\.js/);
  assert.match(server, /paged['"],\s*['"]1/);
  assert.match(server, /RizenicPagination\.fromServerResponse/);
  assert.match(server, /facet/);
  assert.match(server, /fetchFinanceServerPage/);
});

test('dashboard, jobs and parts load page-scoped server views', () => {
  const dashboardHtml = read('public/dashboard.html');
  const jobsHtml = read('public/jobs.html');
  const partsHtml = read('public/parts.html');
  assert.match(dashboardHtml, /dashboard_server\.js/);
  assert.match(jobsHtml, /jobs_server\.js/);
  assert.match(partsHtml, /parts_server\.js/);
  assert.match(read('public/dashboard_server.js'), /\/api\/server\/dashboard/);
  assert.match(read('public/jobs_server.js'), /\/api\/server\/sa-overview/);
  assert.match(read('public/parts_server.js'), /\/api\/server\/parts-alerts/);
});

test('calendar and repair board no longer download full branch reports', () => {
  const calendar = read('public/sa_calendar.js');
  const board = read('public/repair_board.html');
  assert.match(calendar, /\/api\/server\/calendar-capacity/);
  assert.doesNotMatch(calendar, /fetch\(`\$\{API_BASE_URL\}\/api\/reports\?branch=/);
  assert.match(board, /\/api\/server\/repair-board/);
  assert.doesNotMatch(board, /fetch\(`\$\{API_BASE_URL\}\/api\/reports\?/);
});


test('repair page and SA part tracking use scoped server reads', () => {
  const repairHtml = read('public/repair.html');
  const repairServer = read('public/repair_server.js');
  const saParts = read('public/sa_parts.js');
  const history = read('public/history.js');
  assert.match(repairHtml, /repair_server\.js/);
  assert.match(repairServer, /\/api\/server\/repair-page/);
  assert.match(repairServer, /fetchRepairServerView/);
  assert.match(saParts, /job_ids/);
  assert.match(saParts, /car_plates/);
  assert.doesNotMatch(saParts, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders`\)/);
  assert.match(history, /job_ids/);
  assert.match(history, /car_plates/);
  assert.doesNotMatch(history, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders`\)/);
});


test('jobs table quota tools and repair maintenance startup stay server-scoped', () => {
  const views = read('server_side_views.js');
  const modals = read('public/jobs_table_modals.js');
  const repairDate = read('public/repair_date_update.html');
  const repairExport = read('public/repair_export.html');
  assert.match(views, /\/api\/server\/quota-context/);
  assert.match(modals, /\/api\/server\/calendar-capacity/);
  assert.match(modals, /\/api\/server\/quota-context/);
  assert.doesNotMatch(modals, /fetch\(`\$\{API_BASE_URL\}\/api\/reports`\)/);
  assert.doesNotMatch(repairDate, /DOMContentLoaded['"],\s*fetchJobs/);
  assert.doesNotMatch(repairExport, /DOMContentLoaded['"],\s*fetchJobs/);
});

test('report query builder supports server-side finance present-date filters and computed total sort', () => {
  const q = require('../read_queries');
  const built = q.buildPagedReportsReadQuery({ present_field: 'billing_date', sort: 'total_cost', dir: 'desc' });
  assert.match(built.text, /billing_date IS NOT NULL/);
  assert.match(built.text, /cost_labor[\s\S]*cost_part[\s\S]*cost_external/);
  assert.match(built.text, /DESC/);
});
