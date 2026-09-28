const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
test('repair board declares its in-flight flag before loadData can run', () => {
  const html = read('public/repair_board.html');
  const declaration = html.indexOf('let repairBoardLoadInFlight = false;');
  const domReady = html.indexOf("document.addEventListener('DOMContentLoaded'");
  const loadData = html.indexOf('async function loadData()');
  assert.ok(declaration >= 0); assert.ok(declaration < domReady); assert.ok(declaration < loadData);
});
test('parts table scrollers reserve bottom breathing room above the pager', () => {
  const html = read('public/parts.html');
  assert.match(html, /class="[^"]*parts-table-scroll[^"]*rz-table-scroll-surface[^"]*"/);
  assert.match(html, /\.parts-table-scroll\s*\{[^}]*padding-bottom:\s*var\(--rz-parts-pager-clearance\)/s);
  assert.match(html, /--rz-parts-pager-clearance:\s*5[0-9]px/);
});
test('repair uses the approved adaptive two-stage table layout', () => {
  const html = read('public/repair.html');
  const js = read('public/table_viewport_lock.js');
  assert.doesNotMatch(html, /<body[^>]*data-rz-table-dock="off"/);
  assert.match(html, /table_scroll_fix\.css\?v=1\.6&adaptive=4/);
  assert.match(html, /class="table-container flex-1"/);
  assert.match(js, /adaptive two-stage table viewport dock v4/);
});
