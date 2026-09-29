const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('shared pagination uses the last known stable mount logic', () => {
  const js = read('public/table_pagination.js');
  assert.match(js, /Pagination must live outside the scroll host/);
  assert.doesNotMatch(js, /rz-pagination-card/);
  assert.doesNotMatch(js, /rz-pagination-scroll-region/);
  assert.doesNotMatch(js, /rz-pagination-inner-scroll/);
});

test('Admin active panel is a real flex column so its footer sits at the card bottom', () => {
  const html = read('public/admin.html');
  assert.match(html, /admin-panel-bottom-pager-fix/);
  assert.match(html, /\.admin-panel\.active[\s\S]*display:\s*flex\s*!important/);
  assert.match(html, /flex:\s*1 1 auto\s*!important/);
});

test('duplicate visible counters are removed while legacy counter IDs remain', () => {
  const checks = [
    ['jobs_table.html', 'row_count'],
    ['finance.html', 'row_count'],
    ['repair_date_update.html', 'table_row_count'],
    ['repair_export.html', 'table_row_count']
  ];
  for (const [f,id] of checks) {
    const html = read('public/' + f);
    assert.match(html, new RegExp(`id="${id}"`));
    assert.doesNotMatch(html, />\s*พบ:\s*<span id="row_count"/);
    assert.doesNotMatch(html, />\s*พบข้อมูล\s*<span id="table_row_count"/);
    assert.doesNotMatch(html, />\s*จำนวนข้อมูลที่พบ\s*<span id="table_row_count"/);
  }
});
