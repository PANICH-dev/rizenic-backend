const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('jobs table relies on the shared blocking loader instead of stacking a second local layer', () => {
  const html = read('public/jobs_table.html');
  const guard = read('public/session_guard.js');
  assert.doesNotMatch(html, /\.jobs-table-loading-layer/);
  assert.doesNotMatch(html, /id=["']jobs_table_loading["']/);
  assert.match(guard, /#rz-api-loading-layer/);
  assert.match(guard, /pointer-events:\s*auto/);
});

test('repair page keeps only the paginator count and removes the duplicate bottom vehicle count', () => {
  const html = read('public/repair.html');
  const js = read('public/repair.js');
  assert.doesNotMatch(html, /id=["']table_row_count["']/);
  assert.doesNotMatch(html, /พบข้อมูลรถ\s*<span[^>]*table_row_count/);
  assert.doesNotMatch(js, /table_row_count/);
});

test('rescue build does not include experimental adaptive viewport stack', () => {
  const helper = read('public/table_viewport_lock.js');
  const css = read('public/table_scroll_fix.css');
  assert.doesNotMatch(helper, /flex-chrome|fixed-frame|fake runway|collapseUpperChrome|restoreUpperChrome/i);
  assert.doesNotMatch(css, /flex-chrome table viewport|bounded flex-shell scroll host|rz-table-collapse-root|rz-table-frame-mode/i);
});
