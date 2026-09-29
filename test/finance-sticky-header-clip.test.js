const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('finance clips table paint outside the original scroller instead of changing table geometry', () => {
  const html = read('public/finance.html');
  const css = read('public/table_scroll_fix.css');
  assert.match(html, /class="[^"]*rz-table-clip-shell[^"]*"[\s\S]*id="tableContainer"/);
  assert.match(html, /class="[^"]*rz-table-scroll-surface[^"]*"[^>]*id="tableContainer"/);
  assert.match(css, /\.rz-table-clip-shell\s*\{[^}]*overflow:\s*hidden\s*!important;/s);
  assert.match(css, /\.rz-table-clip-shell::before\s*\{[^}]*height:\s*4px;[^}]*background:\s*#00320D;/s);
  assert.doesNotMatch(css, /#accTable\s*\{[^}]*border-collapse:\s*separate/i);
  assert.doesNotMatch(css, /table\.excel-table\s*>\s*thead\s*,?/);
});

test('finance cache-busts the clip-shell fix', () => {
  const html = read('public/finance.html');
  assert.match(html, /table_scroll_fix\.css\?v=1\.6&financeClip=1/);
});
