const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const js = fs.readFileSync(path.join(publicDir, 'ui_performance.js'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'ui_performance.css'), 'utf8');
const repair = fs.readFileSync(path.join(publicDir, 'repair.html'), 'utf8');

test('repair board intentionally opts out of adaptive dock behavior', () => {
  assert.doesNotMatch(js, /isRepairAdaptiveTable|getRepairAdaptiveGeometry|setupRepairAdaptiveState|ui-repair-adaptive/);
  assert.doesNotMatch(css, /ui-repair-adaptive|ui-repair-board-adaptive-active/);
});

test('repair board uses a normal inner native scroller like finance', () => {
  assert.match(repair, /id="repairTableContainer"[^>]*overflow-auto[^>]*custom-scrollbar/);
  assert.match(repair, /id="repairTableContainer"[^>]*bg-white[^>]*relative/);
  assert.doesNotMatch(js, /addEventListener\(['"]wheel['"][\s\S]*preventDefault\(/);
});

test('repair page cache-busts the finance-table and exact-station patch', () => {
  assert.match(repair, /ui_performance\.css\?v=20260930-7-fast-startup-scope/);
  assert.match(repair, /ui_performance\.js\?v=20260930-7-fast-startup-scope/);
  assert.match(repair, /repair\.js\?v=20260930-repair-lazy-cache-fix/);
});
