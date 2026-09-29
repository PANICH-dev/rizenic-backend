const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('finance uses a non-scrolling clip shell around the original scroll host', () => {
  const html = read('public/finance.html');
  assert.match(html, /class="[^"]*rz-table-clip-shell[^"]*"[\s\S]*id="tableContainer"/);
  assert.match(html, /id="tableContainer"[^>]*class="[^"]*rz-table-scroll-surface[^"]*"|class="[^"]*rz-table-scroll-surface[^"]*"[^>]*id="tableContainer"/);
});

test('finance does not change table border geometry or add a second shared sticky model', () => {
  const css = read('public/table_scroll_fix.css');
  assert.doesNotMatch(css, /#accTable\s*\{[^}]*border-collapse:\s*separate/i);
  assert.doesNotMatch(css, /table\.excel-table\s*>\s*thead\s*,?/);
});
