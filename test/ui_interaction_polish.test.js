const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ui = require('../public/ui_performance.js');
const js = fs.readFileSync(path.join(root, 'public', 'ui_performance.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'ui_performance.css'), 'utf8');

test('pagination exposes compact numbered page tokens around the current page', () => {
  assert.deepEqual(ui.getPageTokens(20, 1), [1, 2, 3, 4, 5, 6, '…', 20]);
  assert.deepEqual(ui.getPageTokens(20, 10), [1, '…', 8, 9, 10, 11, 12, '…', 20]);
  assert.deepEqual(ui.getPageTokens(20, 20), [1, '…', 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(ui.getPageTokens(5, 3), [1, 2, 3, 4, 5]);
});

test('shared search guard waits for Enter before existing search handlers run', () => {
  const input = (attrs = {}) => ({
    tagName: 'INPUT',
    type: attrs.type || 'text',
    id: attrs.id || '',
    name: attrs.name || '',
    getAttribute(name) { return attrs[name] ?? null; }
  });
  assert.equal(ui.isSearchControl(input({ id: 'search_input' })), true);
  assert.equal(ui.isSearchControl(input({ placeholder: 'ค้นหาทะเบียน', onkeyup: 'filterTableByText()' })), true);
  assert.equal(ui.isSearchControl(input({ id: 'car_brand', placeholder: 'พิมพ์ค้นหา...', onchange: 'updateCarModels(this.value)' })), false);
  assert.match(js, /function\s+isSearchControl\s*\(/);
  assert.match(js, /if \(event\.key === ['"]Enter['"]\)/);
  assert.match(js, /event\.type === ['"]keyup['"]/);
  assert.match(js, /stopImmediatePropagation\(\)/);
  assert.match(js, /addEventListener\(['"]keyup['"]/);
});

test('initial and API loading block interaction until reads finish', () => {
  assert.match(js, /ui-initial-loading/);
  assert.match(js, /\.inert\s*=\s*true/);
  assert.match(js, /\.inert\s*=\s*false/);
  assert.match(css, /html\.ui-initial-loading\s+body::before/);
  assert.match(css, /\.ui-global-loader\s*\{[\s\S]*inset:\s*0/);
  assert.match(css, /\.ui-global-loader\.is-visible\s*\{[\s\S]*pointer-events:\s*auto/);
});

test('dashboard tables receive safe inner edge padding without changing data logic', () => {
  assert.match(js, /ui-dashboard-page/);
  assert.match(css, /\.ui-dashboard-page\s+\[id\^=["']content_["']\]\s*>\s*\.overflow-x-auto/);
  assert.match(css, /padding-inline:\s*12px/);
});

test('all native selects reserve right space and move the dropdown arrow inward', () => {
  assert.match(css, /select:not\(\[multiple\]\)/);
  assert.match(css, /padding-right:\s*2\.5rem/);
  assert.match(css, /background-position:\s*right\s+12px\s+center/);
});

test('page-size selector offers 10-row steps through 150 while preserving dashboard 15 default', () => {
  assert.deepEqual(ui.pageSizeOptionsForPath('/jobs_table.html'), [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150]);
  assert.deepEqual(ui.pageSizeOptionsForPath('/dashboard.html'), [10,15,20,30,40,50,60,70,80,90,100,110,120,130,140,150]);
  assert.match(js, /data-ui-page-size/);
  assert.match(js, /state\.pageSize\s*=\s*Math\.max\(1,\s*Number\(select\.value\)/);
});

test('shared paginated tables keep their header sticky while rows continue scrolling', () => {
  assert.match(css, /\.ui-data-table\s+thead\s*\{[\s\S]*position:\s*sticky[\s\S]*top:\s*0/);
  assert.match(css, /\.ui-data-table\s+thead\s*\{[\s\S]*z-index:\s*30/);
  assert.match(js, /table\.classList\.add\(['"]ui-data-table['"]\)/);
});
