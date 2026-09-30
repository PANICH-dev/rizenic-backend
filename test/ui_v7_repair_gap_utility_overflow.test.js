const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const uiJs = read('public/ui_performance.js');
const uiCss = read('public/ui_performance.css');
const repairHtml = read('public/repair.html');
const dateHtml = read('public/repair_date_update.html');
const exportHtml = read('public/repair_export.html');

test('repair and finance dock inside their own main scroller without header-sized top gap', () => {
  assert.match(uiJs, /const\s+stickyTop\s*=\s*state\.dockGated\s*\?\s*0\s*:/,
    'dock-gated pages should use top 0 inside their own main scroller');
  assert.match(uiCss, /\.ui-repair-page\s+#tab-board\s*\{[\s\S]*?padding-top:\s*0\s*!important;[\s\S]*?margin-top:\s*0\s*!important;/);
  assert.match(uiCss, /\.ui-repair-page\s+#tab-board\s*>\s*div\s*\{[\s\S]*?margin-top:\s*0\s*!important;/);
  assert.match(repairHtml, /id="tab-board"/);
});

test('repair date/export clamp the entire page to the viewport and keep horizontal scroll inside the table card', () => {
  assert.match(uiCss, /html\.ui-repair-export-page,[\s\S]*?html\.ui-repair-date-page\s*\{[\s\S]*?overflow-x:\s*hidden\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
  assert.match(uiCss, /\.ui-repair-export-page\s+main\s*>\s*div,[\s\S]*?\.ui-repair-date-page\s+main\s*>\s*div\s*\{[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?overflow:\s*hidden\s*!important;/);
  assert.match(uiCss, /\.ui-repair-export-page\s+\.table-container,[\s\S]*?\.ui-repair-date-page\s+\.table-container\s*\{[\s\S]*?overflow-x:\s*auto\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
  assert.match(uiCss, /\.ui-repair-export-page\s+\.excel-table,[\s\S]*?\.ui-repair-date-page\s+\.excel-table\s*\{[\s\S]*?width:\s*max-content\s*!important;[\s\S]*?min-width:\s*100%\s*!important;/);
  assert.match(dateHtml, /bg-slate-50 border-b[^\n]*flex[^\n]*flex-wrap/,
    'repair date filter bar should wrap instead of widening the page');
  assert.match(exportHtml, /class="table-container flex-1 min-w-0 w-full"/);
  assert.match(dateHtml, /class="table-container flex-1 min-w-0 w-full"/);
});
