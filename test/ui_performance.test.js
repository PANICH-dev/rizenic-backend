const test = require('node:test');
const assert = require('node:assert/strict');

const uiPerf = require('../public/ui_performance.js');

test('dashboard tables use 15 rows per page', () => {
  assert.equal(uiPerf.pageSizeForPath('/dashboard.html'), 15);
  assert.equal(uiPerf.pageSizeForPath('/dashboard'), 15);
});

test('non-dashboard tables use 30 rows per page', () => {
  assert.equal(uiPerf.pageSizeForPath('/jobs_table.html'), 30);
  assert.equal(uiPerf.pageSizeForPath('/parts.html'), 30);
});

test('page bounds clamp page number and slice exactly', () => {
  assert.deepEqual(uiPerf.getPageBounds(95, 4, 30), {
    totalPages: 4,
    page: 4,
    start: 90,
    end: 95,
  });
  assert.deepEqual(uiPerf.getPageBounds(95, 99, 30), {
    totalPages: 4,
    page: 4,
    start: 90,
    end: 95,
  });
});

test('empty result still has a stable first page', () => {
  assert.deepEqual(uiPerf.getPageBounds(0, 3, 30), {
    totalPages: 1,
    page: 1,
    start: 0,
    end: 0,
  });
});
