const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
test('repair table avoids the old fixed viewport height and remains flex-fill for adaptive docking', () => {
  const html = read('public/repair.html');
  assert.doesNotMatch(html, /\.table-container\s*\{[^}]*height:\s*calc\(100vh\s*-\s*230px\)/s);
  assert.match(html, /class="table-container flex-1"/);
});
test('repair stays adaptive while approved opt-out pages disable adaptive growth', () => {
  const repair = read('public/repair.html');
  const jobsTable = read('public/jobs_table.html');
  const js = read('public/table_viewport_lock.js');
  assert.doesNotMatch(repair, /<body[^>]*data-rz-table-dock="off"/);
  assert.match(jobsTable, /<body[^>]*data-rz-table-dock="off"/);
  assert.match(js, /function\s+adaptiveDockDisabled/);
});
test('shared pagination remains outside the table scroller', () => {
  const js = read('public/table_pagination.js');
  assert.match(js, /Pagination must live outside the scroll host/);
  assert.doesNotMatch(js, /rz-pager-table-scroll|rz-pager-footer|rz-pager-card/);
});
