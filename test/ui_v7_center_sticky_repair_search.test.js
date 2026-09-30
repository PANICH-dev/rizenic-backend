const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const css = fs.readFileSync(path.join(publicDir, 'ui_performance.css'), 'utf8');
const js = fs.readFileSync(path.join(publicDir, 'ui_performance.js'), 'utf8');
const repairHtml = fs.readFileSync(path.join(publicDir, 'repair.html'), 'utf8');
const repairJs = fs.readFileSync(path.join(publicDir, 'repair.js'), 'utf8');

test('initial spinner stays geometrically centered while rotating', () => {
  const initial = css.match(/html\.ui-initial-loading body::after\s*\{([\s\S]*?)\}/);
  assert.ok(initial, 'missing initial spinner');
  assert.match(initial[1], /left:\s*50%/);
  assert.match(initial[1], /top:\s*50%/);
  assert.doesNotMatch(initial[1], /transform:\s*translate\(/, 'spinner centering must not share transform with rotation');
  assert.match(initial[1], /margin-left:\s*-22px/);
  assert.match(initial[1], /margin-top:\s*-22px/);
  assert.match(initial[1], /animation:\s*ui-spin/);
});

test('repair board no longer uses adaptive sticky host and uses finance-style native table scroller', () => {
  assert.doesNotMatch(css, /ui-repair-adaptive-host|ui-repair-board-adaptive-active/);
  assert.doesNotMatch(js, /getRepairAdaptiveGeometry|setupRepairAdaptiveState/);
  assert.match(repairHtml, /id="repairTableContainer"[^>]*overflow-auto[^>]*custom-scrollbar/);
});

test('repair main search owns Enter explicitly instead of relying on live onkeyup filtering', () => {
  assert.doesNotMatch(repairHtml, /id="global_search_input"[^>]*onkeyup="runTableFilters\(\)"/);
  assert.match(repairHtml, /id="global_search_input"/);
  assert.match(repairJs, /function\s+installRepairEnterSearch\s*\(/);
  assert.match(repairJs, /global_search_input/);
  assert.match(repairJs, /event\.key\s*!==\s*['"]Enter['"]/);
  assert.match(repairJs, /runTableFilters\(\)/);
});
