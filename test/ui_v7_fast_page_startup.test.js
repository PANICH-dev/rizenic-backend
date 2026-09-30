const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const read = (name) => fs.readFileSync(path.join(pub, name), 'utf8');

const ui = read('ui_performance.js');
const dashboard = read('dashboard.js');
const parts = read('js/parts_core.js');
const jobs = read('jobs.js');
const repair = read('repair.js');
const finance = read('finance.html');
const history = read('history.js');

test('initial interaction gate releases from DOM readiness instead of waiting for every window asset', () => {
  assert.doesNotMatch(ui, /let\s+windowLoaded\s*=/);
  assert.doesNotMatch(ui, /win\.addEventListener\(['"]load['"]/);
  assert.match(ui, /DOMContentLoaded[\s\S]{0,500}finishInitialIfReady/);
  assert.match(ui, /activePendingCount\(\)\s*!==\s*0/);
});

test('dashboard starts first-paint and secondary reads together while only reports gate first paint', () => {
  assert.match(dashboard, /function\s+getDashboardScopeQuery\s*\(/);
  assert.match(dashboard, /\/api\/reports\$\{scopeQuery\}/);
  assert.match(dashboard, /\/api\/part-orders\$\{scopeQuery\}/);
  assert.match(dashboard, /uiBackground:\s*true/);
  assert.match(dashboard, /const\s+partsPromise\s*=/);
  assert.match(dashboard, /const\s+statusPromise\s*=/);
  assert.match(dashboard, /await\s+reportsPromise/);
});

test('parts startup loads reports, part orders and master concurrently and scopes heavy reads for normal users', () => {
  assert.match(parts, /function\s+getPartsScopeQuery\s*\(/);
  assert.match(parts, /Promise\.allSettled\s*\(\s*\[/);
  assert.match(parts, /\/api\/reports\$\{scopeQuery\}/);
  assert.match(parts, /\/api\/part-orders\$\{scopeQuery\}/);
  assert.match(parts, /\/api\/parts\?branch=/);
});

test('jobs, repair, finance and history scope heavy reads only for non privileged users', () => {
  assert.match(jobs, /function\s+getJobsScopeQuery\s*\(/);
  assert.match(jobs, /\/api\/reports\$\{scopeQuery\}/);
  assert.match(jobs, /\/api\/part-orders\$\{scopeQuery\}/);

  assert.match(repair, /function\s+getRepairScopeQuery\s*\(/);
  assert.match(repair, /\/api\/reports\$\{scopedNoCache\}/);
  assert.match(repair, /\/api\/part-orders\$\{scopedNoCache\}/);
  assert.match(repair, /loadRepairDatasets\s*\(/);

  assert.match(finance, /function\s+getAccountingScopeQuery\s*\(/);
  assert.match(finance, /\/api\/reports\$\{scopeQuery\}/);

  assert.match(history, /function\s+getHistoryScopeQuery\s*\(/);
  assert.match(history, /\/api\/reports\$\{scopeQuery\}/);
  assert.match(history, /\/api\/part-orders\$\{scopeQuery\}/);
});


test('Chart and XLSX libraries are loaded lazily so they cannot delay first page paint', () => {
  const dashboardHtml = read('dashboard.html');
  const repairHtml = read('repair.html');
  const financeHtml = read('finance.html');
  const jobsTableHtml = read('jobs_table.html');
  const jobsCore = read('jobs_table_core.js');
  const jobsUi = read('jobs_table_ui.js');
  const jobsModals = read('jobs_table_modals.js');

  for (const html of [dashboardHtml, repairHtml, financeHtml, jobsTableHtml]) {
    assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*(?:chart(?:\.min)?\.js|chartjs-plugin-datalabels|xlsx\.full\.min\.js)[^"']*["']/i);
  }

  assert.match(ui, /loadScriptOnce/);
  assert.match(dashboard, /loadScript\([^\n]*chart\.js/);
  assert.match(repair, /loadScript\([^\n]*chart\.js/);
  assert.match(finance, /loadScript\([^\n]*chart\.js/);
  assert.match(finance, /loadScript\([^\n]*xlsx\.full\.min\.js/);
  assert.match(jobsCore, /ensureJobsXlsxLibrary/);
  assert.match(jobsUi, /await\s+ensureJobsXlsxLibrary\(\)/);
  assert.match(jobsModals, /await\s+ensureJobsXlsxLibrary\(\)/);
});
