const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('repair summary filters board by station instead of only global text search', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'repair.js'), 'utf8');
  assert.match(js, /function jumpToBoardWithStationFilter\(labelName\)/);
  assert.match(js, /activeFilters = \{ \[REPAIR_STATION_FILTER_COL\]: new Set\(\[filterVal\]\) \}/);
  assert.match(js, /'เคาะ': '01\.เคาะ'/);
  assert.match(js, /jumpToBoardWithStationFilter\(labelName\)/);
});

test('repair KPI spacing stylesheet is loaded from public and cache busted', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'repair.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public', 'compact_metrics_tables.css'), 'utf8');
  assert.match(html, /compact_metrics_tables\.css\?v=1\.4/);
  assert.match(html, /repair\.js\?v=12/);
  assert.match(css, /\.rz-compact-page \.rz-kpi-row \{\s*gap: 20px !important;/);
});
