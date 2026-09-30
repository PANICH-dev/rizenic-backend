const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const js = read('public/ui_performance.js');
const css = read('public/ui_performance.css');

test('repair and finance reserve the final docked viewport height inside their own containing block', () => {
  assert.match(js, /const viewportTop = state\.dockGated\s*\?\s*stickyTop\s*:\s*top;/);
  assert.match(js, /const available = Math\.max\(220, viewportHeight - viewportTop - pagerHeight - 12\);/);
  assert.doesNotMatch(js, /main\.style\.setProperty\('--ui-dock-runway'/);
  assert.doesNotMatch(css, /main\.ui-dock-runway-host::after/);
});

test('dock gate still lets the page scroll first and then enables native table scrolling', () => {
  assert.match(css, /\.ui-table-dock-gated:not\(\.ui-table-docked\)\s*\{[\s\S]*?overflow-y:\s*hidden\s*!important;/);
  assert.match(css, /\.ui-table-dock-gated\.ui-table-docked\s*\{[\s\S]*?overflow-y:\s*auto\s*!important;/);
  assert.match(js, /const docked = rect\.top <= stickyTop \+ 1;/);
  assert.doesNotMatch(js, /addEventListener\(['"]wheel['"][\s\S]*?preventDefault\(/);
});
