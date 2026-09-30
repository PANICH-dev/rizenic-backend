const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const js = read('public/ui_performance.js');
const css = read('public/ui_performance.css');

test('repair and finance gate vertical table scrolling until the table reaches the sticky top', () => {
  assert.match(js, /const DOCK_GATED_TABLE_PATHS = new Set\(\[[\s\S]*?'\/repair\.html'[\s\S]*?'\/finance\.html'[\s\S]*?\]\);/);
  assert.match(js, /dockGated:\s*isDockGatedTablePage/);
  assert.match(js, /const docked = rect\.top <= stickyTop \+ 1/);
  assert.match(js, /state\.scrollHost\.classList\.toggle\('ui-table-docked', docked\)/);
  assert.match(css, /\.ui-table-dock-gated:not\(\.ui-table-docked\)\s*\{[\s\S]*?overflow-y:\s*hidden\s*!important;/);
  assert.match(css, /\.ui-table-dock-gated\.ui-table-docked\s*\{[\s\S]*?overflow-y:\s*auto\s*!important;/);
  assert.doesNotMatch(js, /addEventListener\(['"]wheel['"][\s\S]*preventDefault\(/);
});

test('parts reserves a real footer lane below the scroll host so rows and pager never overlap', () => {
  assert.match(css, /\.ui-parts-page \.card-container\s*\{[\s\S]*?min-height:\s*0\s*!important;/);
  assert.match(css, /\.ui-parts-page \.ui-table-scroll-host\s*\{[\s\S]*?flex:\s*1 1 auto\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?min-height:\s*0\s*!important;/);
  assert.match(css, /\.ui-parts-page \.ui-pagination\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?flex:\s*0 0 auto\s*!important;/);
});
