const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const js = fs.readFileSync(path.join(pub, 'ui_performance.js'), 'utf8');
const css = fs.readFileSync(path.join(pub, 'ui_performance.css'), 'utf8');
const partsCore = fs.readFileSync(path.join(pub, 'js/parts_core.js'), 'utf8');
const partsLegacy = fs.readFileSync(path.join(pub, 'js/parts.js'), 'utf8');
const tablePages = ['admin.html','dashboard.html','finance.html','history.html','index.html','jobs.html','jobs_table.html','parts.html','repair.html','repair_date_update.html','repair_export.html'];

test('search pagination refresh happens only after keyup Enter', () => {
  assert.match(js, /if \(event\.key === 'Enter'\)[\s\S]{0,260}if \(event\.type === 'keyup'\)[\s\S]{0,180}queueRefresh\(true\)/);
});

test('parts empty text search restores rows and refreshes shared pagination', () => {
  for (const source of [partsCore, partsLegacy]) {
    assert.match(source, /function\s+filterTableByText\(tbodyId, txt\)[\s\S]*?String\(txt \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(source, /if \(!text\)[\s\S]*?tr\.style\.display = ''/);
    assert.match(source, /ui:refresh-pagination/);
  }
});

test('tracked API loader waits through response body consumption and paint', () => {
  assert.match(js, /function\s+wrapTrackedResponseBody\(/);
  assert.match(js, /const bodyMethods = \['json', 'text', 'blob', 'arrayBuffer', 'formData'\]/);
  assert.match(js, /requestAnimationFrame\(function \(\) \{[\s\S]*?requestAnimationFrame\(endRead\)/);
});

test('adaptive sticky growth includes repair and finance while jobs table uses its own fixed shell', () => {
  assert.match(js, /const ADAPTIVE_TABLE_PATHS = new Set\(/);
  assert.doesNotMatch(js.match(/const ADAPTIVE_TABLE_PATHS = new Set\(\[([\s\S]*?)\]\);/)[1], /jobs_table\.html/);
  assert.match(js, /'\/parts\.html'/);
  assert.match(js, /doc\.addEventListener\('scroll', scheduleAdaptiveViewportSync, true\)/);
  assert.match(css, /\.ui-table-adaptive-host \{[\s\S]*?position: sticky !important;[\s\S]*?top: var\(--ui-table-sticky-top/);
  const adaptiveBlock = js.match(/const ADAPTIVE_TABLE_PATHS = new Set\(\[([\s\S]*?)\]\);/)[1];
  assert.match(adaptiveBlock, /repair\.html/);
  assert.match(adaptiveBlock, /finance\.html/);
});

test('pagination reserves vertical and horizontal room so controls do not overlap', () => {
  assert.match(css, /\.ui-pagination \{[\s\S]*?min-height: 56px;[\s\S]*?box-sizing: border-box;/);
  assert.match(css, /\.ui-pagination__actions \{[\s\S]*?min-height: 36px;/);
  assert.match(css, /\.ui-pagination__numbers \{[\s\S]*?padding: 2px 0;/);
});

test('table pages cache-bust the repaired shared layer', () => {
  for (const file of tablePages) {
    const html = fs.readFileSync(path.join(pub, file), 'utf8');
    assert.match(html, /ui_performance\.css\?v=20260930-7-fast-startup-scope/);
    assert.match(html, /ui_performance\.js\?v=20260930-7-fast-startup-scope/);
  }
});
