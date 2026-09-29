const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function loadPagination() {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read('public/table_pagination.js'), context);
  return context.RizenicPagination;
}

test('server pagination falls back to visible row count when an older backend omits metadata', () => {
  const pager = loadPagination();
  const state = pager.createState(50);
  const response = { items: Array.from({ length: 8 }, (_, i) => ({ id: i + 1 })) };
  const normalized = pager.fromServerResponse(response, state);
  assert.equal(normalized.pageInfo.total, 8);
  assert.equal(normalized.pageInfo.startNumber, 1);
  assert.equal(normalized.pageInfo.endNumber, 8);
  assert.equal(normalized.pageInfo.totalPages, 1);
});


test('older unpaged backend responses are sliced locally instead of rendering the whole branch', () => {
  const pager = loadPagination();
  const state = pager.createState(50);
  const response = { items: Array.from({ length: 78 }, (_, i) => ({ id: i + 1 })) };
  let normalized = pager.fromServerResponse(response, state);
  assert.equal(normalized.items.length, 50);
  assert.equal(normalized.items[0].id, 1);
  assert.equal(normalized.items[49].id, 50);
  assert.equal(normalized.pageInfo.total, 78);
  assert.equal(normalized.pageInfo.totalPages, 2);

  state.page = 2;
  normalized = pager.fromServerResponse(response, state);
  assert.equal(normalized.items.length, 28);
  assert.equal(normalized.items[0].id, 51);
  assert.equal(normalized.items[27].id, 78);
});

test('dashboard server paging explicitly recovers from a 404 caused by an older in-memory backend', () => {
  const js = read('public/dashboard_server.js');
  assert.match(js, /dashboardServerListSupported/);
  assert.match(js, /res\.status\s*===\s*404/);
  assert.match(js, /dashboardLegacyGoStationPage/);
  assert.match(js, /dashboardLegacyGoParkedPage/);
});
