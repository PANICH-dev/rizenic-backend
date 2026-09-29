const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('finance keeps original table geometry and clips Chromium paint outside the scroll host', () => {
  const css = read('public/table_scroll_fix.css');
  const html = read('public/finance.html');
  assert.doesNotMatch(css, /#accTable\s*\{[^}]*border-collapse:\s*separate/i);
  assert.match(html, /class="[^"]*rz-table-clip-shell[^"]*"[\s\S]*id="tableContainer"/);
  assert.match(html, /class="[^"]*rz-table-scroll-surface[^"]*"[^>]*id="tableContainer"/);
  assert.match(css, /\.rz-table-clip-shell::before\s*\{[^}]*height:\s*4px;[^}]*background:\s*#00320D;/s);
});

test('finance page cache-busts clip-shell paint fix', () => {
  const html = read('public/finance.html');
  assert.match(html, /table_scroll_fix\.css\?v=1\.6&financeClip=1/);
});
