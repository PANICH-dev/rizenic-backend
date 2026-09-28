const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('repair table uses flex fill instead of a fixed viewport height', () => {
  const html = read('public/repair.html');
  assert.doesNotMatch(html, /\.table-container\s*\{[^}]*height:\s*calc\(100vh\s*-\s*230px\)/s);
  assert.match(html, /\.table-container\s*\{[^}]*height:\s*auto[^}]*min-height:\s*0[^}]*flex:\s*1\s+1\s+auto/s);
});

test('repair and jobs table bypass JS viewport sizing and use their native flex layouts', () => {
  const js = read('public/table_viewport_lock.js');
  assert.match(js, /function\s+shouldBypassViewportLock/);
  assert.match(js, /repair\|jobs_table/);
  assert.match(js, /if\s*\(shouldBypassViewportLock\(documentRef\)\)\s*\{\s*unlock\(documentRef\);\s*return false;/s);
});

test('shared pagination remains outside the table scroller', () => {
  const js = read('public/table_pagination.js');
  assert.match(js, /Pagination must live outside the scroll host/);
  assert.doesNotMatch(js, /rz-pager-table-scroll|rz-pager-footer|rz-pager-card/);
});
