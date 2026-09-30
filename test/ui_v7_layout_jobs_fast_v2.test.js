const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const uiJs = read('public/ui_performance.js');
const uiCss = read('public/ui_performance.css');
const jobsHtml = read('public/jobs_table.html');
const jobsCore = read('public/jobs_table_core.js');
const repairExport = read('public/repair_export.html');
const repairDate = read('public/repair_date_update.html');

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} missing`);
  const end = nextName ? source.indexOf(`async function ${nextName}`, start + 1) : source.length;
  return source.slice(start, end === -1 ? source.length : end);
}

test('repair and finance use the same adaptive table behavior as admin', () => {
  const block = uiJs.match(/const ADAPTIVE_TABLE_PATHS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(block);
  assert.match(block[1], /'\/admin\.html'/);
  assert.match(block[1], /'\/repair\.html'/);
  assert.match(block[1], /'\/finance\.html'/);
  assert.match(uiCss, /\.ui-table-adaptive-host\s*\{[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?align-self:\s*stretch/);
});

test('jobs table consumes the viewport with no toolbar gap and keeps horizontal native scroll', () => {
  assert.match(jobsHtml, /<main class="flex-1 overflow-hidden relative bg-slate-200 p-0 flex flex-col">/);
  assert.match(uiJs, /ui-jobs-table-page/);
  assert.match(uiCss, /\.ui-jobs-table-page #tableContainer\s*\{[\s\S]*?overflow-x:\s*auto\s*!important;/);
  assert.match(uiCss, /\.ui-jobs-table-page #jobsTable\s*\{[\s\S]*?width:\s*max-content\s*!important;[\s\S]*?min-width:\s*100%\s*!important;/);
});

test('jobs first paint waits only for reports while reference/master data loads in background', () => {
  const primary = functionBlock(jobsCore, 'loadJobsPrimaryData', 'loadJobsReferenceData');
  assert.match(primary, /\/api\/reports/);
  assert.doesNotMatch(primary, /\/api\/statuses/);
  assert.doesNotMatch(primary, /\/api\/employees/);

  const references = functionBlock(jobsCore, 'loadJobsReferenceData', 'loadJobsSecondaryData');
  assert.match(references, /\/api\/statuses/);
  assert.match(references, /\/api\/employees/);
  assert.match(jobsCore, /Promise\.allSettled\(\[loadJobsReferenceData\(\), loadJobsSecondaryData\(\)\]\)/);
});

test('parts pager has dedicated breathing room and cannot cover last row', () => {
  assert.match(uiJs, /ui-parts-page/);
  assert.match(uiCss, /\.ui-parts-page \.ui-table-scroll-host\s*\{[\s\S]*?padding-bottom:/);
  assert.match(uiCss, /\.ui-parts-page \.ui-pagination\s*\{[\s\S]*?margin-top:/);
});

test('repair export and repair date tables stretch to card width without oversized blank floor', () => {
  assert.match(uiJs, /ui-repair-export-page/);
  assert.match(uiJs, /ui-repair-date-page/);
  assert.match(uiCss, /\.ui-repair-export-page \.table-container,[\s\S]*?\.ui-repair-date-page \.table-container\s*\{[\s\S]*?width:\s*100%/);
  assert.match(uiCss, /\.ui-repair-export-page \.table-container,[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*calc\(100vh/);
  assert.match(uiCss, /\.ui-repair-export-page \.excel-table,[\s\S]*?\.ui-repair-date-page \.excel-table\s*\{[\s\S]*?width:\s*max-content/);
  assert.match(repairExport, /class="table-container flex-1(?: [^"]*)?"/);
  assert.match(repairDate, /class="table-container flex-1(?: [^"]*)?"/);
});
