const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const uiJs = read('public/ui_performance.js');
const uiCss = read('public/ui_performance.css');
const jobsUi = read('public/jobs_table_ui.js');
const jobsCore = read('public/jobs_table_core.js');
const repairHtml = read('public/repair.html');
const exportHtml = read('public/repair_export.html');
const dateHtml = read('public/repair_date_update.html');

test('jobs table owns virtual pagination instead of generic DOM pagination', () => {
  const targetBlock = uiJs.match(/const TARGET_TBODIES = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(targetBlock, 'TARGET_TBODIES missing');
  assert.doesNotMatch(targetBlock[1], /jobs_table_body/);
  assert.match(jobsUi, /let\s+jobsPageSize\s*=\s*30/);
  assert.match(jobsUi, /function\s+renderJobsPage\s*\(/);
  assert.match(jobsUi, /currentFilteredData\.slice\(bounds\.start,\s*bounds\.end\)/);
  assert.match(jobsUi, /data-ui-page-size/);
});

test('jobs filters reset to page one but background hydration rerenders only the visible page', () => {
  assert.match(jobsUi, /currentFilteredData\s*=\s*filteredData;[\s\S]*?jobsCurrentPage\s*=\s*1;[\s\S]*?renderJobsPage\(\)/);
  assert.match(jobsCore, /Promise\.allSettled\(\[preferencesPromise, backgroundDataPromise\]\)\.then\(\(\)\s*=>\s*\{[\s\S]*?renderJobsPage\(\)/);
  const hydration = jobsCore.match(/Promise\.allSettled\(\[preferencesPromise, backgroundDataPromise\]\)\.then\(\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
  assert.ok(hydration, 'background hydration block missing');
  assert.doesNotMatch(hydration[1], /applyFilters\(\)/);
});

test('jobs export still uses all filtered data, not only visible rows', () => {
  assert.match(jobsUi, /function\s+exportToExcel\([\s\S]*?currentFilteredData\.forEach\(/);
});

test('repair board removes the artificial top gap before the table card', () => {
  assert.match(uiCss, /\.ui-repair-page main\s*\{[\s\S]*?padding-top:\s*0\s*!important;/);
  assert.match(repairHtml, /id="tab-board"/);
});

test('repair export and repair date keep page width bounded and horizontal overflow inside table container', () => {
  assert.match(uiCss, /\.ui-repair-export-page body,[\s\S]*?\.ui-repair-date-page body\s*\{[\s\S]*?overflow-x:\s*hidden\s*!important;/);
  assert.match(uiCss, /\.ui-repair-export-page main,[\s\S]*?\.ui-repair-date-page main\s*\{[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
  assert.match(uiCss, /\.ui-repair-export-page \.table-container,[\s\S]*?\.ui-repair-date-page \.table-container\s*\{[\s\S]*?overflow-x:\s*auto\s*!important;/);
  assert.match(exportHtml, /class="table-container flex-1(?: [^"]*)?"/);
  assert.match(dateHtml, /class="table-container flex-1(?: [^"]*)?"/);
});
