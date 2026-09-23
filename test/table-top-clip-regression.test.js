const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public', 'table_scroll_fix.css'), 'utf8');

test('sticky table section owns the header layer without scroller paint/clip containment', () => {
  const viewport = css.match(/body\.rz-table-page-lock\s+\.rz-table-viewport-scroll\s*\{([\s\S]*?)\}/);
  assert.ok(viewport);
  assert.doesNotMatch(viewport[1], /contain\s*:\s*paint/);
  assert.doesNotMatch(viewport[1], /clip-path\s*:/);
  assert.match(css, /body\.rz-table-page-lock\s+\.rz-table-viewport-scroll\s+thead\s*\{[^}]*position:\s*sticky\s*!important;[^}]*z-index:\s*60\s*!important;/s);
});
