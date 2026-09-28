const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('history search uses paged server search and page navigation refetches', () => {
  const s = read('public/history_server.js');
  assert.match(s, /paged/);
  assert.match(s, /limit/);
  assert.match(s, /search/);
  assert.match(s, /goHistoryPage[\s\S]*fetchHistoryServerPage/s);
  assert.match(s, /RizenicPagination\.fromServerResponse/);
});

test('repair date update uses server paging and missing-field filters', () => {
  const s = read('public/repair_date_update_server.js');
  assert.match(s, /department_routing.*ซ่อม/);
  assert.match(s, /missing_field/);
  assert.match(s, /paged/);
  assert.match(s, /goDatePage[\s\S]*fetchRepairDatePage/s);
});

test('repair export pages the visible report but fetches full matching rows only on export', () => {
  const s = read('public/repair_export_server.js');
  assert.match(s, /date_field/);
  assert.match(s, /date_from/);
  assert.match(s, /date_to/);
  assert.match(s, /paged/);
  assert.match(s, /full/);
  assert.match(s, /exportToExcel[\s\S]*fetchRepairExportRows/s);
});

test('HTML loads server paging overrides after legacy scripts', () => {
  assert.match(read('public/history.html'), /history_server\.js/);
  assert.match(read('public/repair_date_update.html'), /repair_date_update_server\.js/);
  assert.match(read('public/repair_export.html'), /repair_export_server\.js/);
});
