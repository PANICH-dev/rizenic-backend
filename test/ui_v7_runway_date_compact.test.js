const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const js = read('public/ui_performance.js');
const css = read('public/ui_performance.css');
const repair = read('public/repair.html');
const finance = read('public/finance.html');
const repairDate = read('public/repair_date_update.html');

const REV = '20260930-7-fast-startup-scope';

test('dock-gated repair and finance reserve their final docked height inside the same containing block', () => {
  assert.match(js, /const viewportTop = state\.dockGated\s*\?\s*stickyTop\s*:\s*top;/);
  assert.match(js, /viewportHeight - viewportTop - pagerHeight - 12/);
  assert.doesNotMatch(js, /function syncDockRunway/);
  assert.doesNotMatch(css, /main\.ui-dock-runway-host::after/);
  assert.match(css, /\.ui-table-dock-gated:not\(\.ui-table-docked\)[\s\S]*?overflow-y:\s*hidden/);
  assert.match(css, /\.ui-table-dock-gated\.ui-table-docked[\s\S]*?overflow-y:\s*auto/);
  assert.doesNotMatch(js, /addEventListener\(['"]wheel['"][\s\S]*?preventDefault\(/);
});

test('repair date update uses compact page-specific rows and date fields', () => {
  assert.match(css, /\.ui-repair-date-page main\s*\{[\s\S]*?padding:\s*12px/);
  assert.match(css, /\.ui-repair-date-page \.excel-table thead th\s*\{[\s\S]*?padding:\s*8px 10px/);
  assert.match(css, /\.ui-repair-date-page \.excel-table tbody td > div\s*\{[\s\S]*?padding:\s*5px 8px/);
  assert.match(css, /\.ui-repair-date-page \.inline-edit-input\s*\{[\s\S]*?padding:\s*6px 8px/);
  assert.match(css, /\.ui-repair-date-page \.inline-edit-input\s*\{[\s\S]*?font-size:\s*12px/);
});

test('shared runway/date patch has a fresh cache revision on affected pages', () => {
  for (const html of [repair, finance, repairDate]) {
    assert.match(html, new RegExp(`ui_performance\\.css\\?v=${REV}`));
    assert.match(html, new RegExp(`ui_performance\\.js\\?v=${REV}`));
  }
});
