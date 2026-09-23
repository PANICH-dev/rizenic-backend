const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadPagination() {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8'), context);
  return context.RizenicPagination;
}

test('pagination slices 123 rows into 50-row pages and keeps global indexes', () => {
  const pager = loadPagination();
  const state = pager.createState(50);
  const rows = Array.from({ length: 123 }, (_, i) => ({ id: i + 1 }));

  let page = pager.paginate(rows, state);
  assert.equal(page.items.length, 50);
  assert.equal(page.items[0].id, 1);
  assert.equal(page.items[49].id, 50);
  assert.equal(page.totalPages, 3);
  assert.equal(page.startNumber, 1);
  assert.equal(page.endNumber, 50);

  state.page = 3;
  page = pager.paginate(rows, state);
  assert.equal(page.items.length, 23);
  assert.equal(page.items[0].id, 101);
  assert.equal(page.items[22].id, 123);
  assert.equal(page.startNumber, 101);
  assert.equal(page.endNumber, 123);
});

test('pagination clamps invalid pages and reset returns to page 1', () => {
  const pager = loadPagination();
  const state = pager.createState(50);
  state.page = 99;
  const rows = Array.from({ length: 75 }, (_, i) => i);
  const page = pager.paginate(rows, state);
  assert.equal(state.page, 2);
  assert.equal(page.page, 2);
  pager.reset(state);
  assert.equal(state.page, 1);
});

test('all agreed long-table pages load the shared pagination helper', () => {
  const pages = [
    'repair_date_update.html', 'repair_export.html', 'jobs_table.html', 'repair.html',
    'history.html', 'jobs.html', 'finance.html', 'parts.html', 'admin.html'
  ];
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_pagination\.js\?v=1\.1/, `${file} must load shared pagination helper`);
  }
});

test('jobs table and finance sorting operate on full filtered data instead of only rendered DOM rows', () => {
  const jobs = fs.readFileSync(path.join(root, 'public/jobs_table_ui.js'), 'utf8');
  const finance = fs.readFileSync(path.join(root, 'public/finance.html'), 'utf8');
  assert.match(jobs, /currentFilteredData\.sort\(/);
  assert.match(finance, /currentFilteredData\.sort\(/);
});

test('export pages keep exporting full filtered datasets, not just current page', () => {
  const repairExport = fs.readFileSync(path.join(root, 'public/repair_export.html'), 'utf8');
  const jobs = fs.readFileSync(path.join(root, 'public/jobs_table_ui.js'), 'utf8');
  assert.match(repairExport, /filteredJobs\.map\(/);
  assert.match(jobs, /currentFilteredData\.(?:forEach|map)\(/);
});

test('inline edits preserve the current page while explicit filters reset to page 1', () => {
  const jobsUi = fs.readFileSync(path.join(root, 'public/jobs_table_ui.js'), 'utf8');
  const jobsCore = fs.readFileSync(path.join(root, 'public/jobs_table_core.js'), 'utf8');
  const repair = fs.readFileSync(path.join(root, 'public/repair.js'), 'utf8');

  assert.match(jobsUi, /function applyFilters\(resetPage\s*=\s*true\)/);
  assert.match(jobsCore, /applyFilters\(false\)/, 'jobs inline save/delete refreshes should keep the current page');
  assert.match(repair, /function runTableFilters\(resetPage\s*=\s*true\)/);
  assert.match(repair, /runTableFilters\(false\)/, 'repair inline saves should keep the current page');
});

test('finance inline edits and admin reloads preserve the current page', () => {
  const finance = fs.readFileSync(path.join(root, 'public/finance.html'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
  assert.match(finance, /function applyFilters\(resetPage\s*=\s*true\)/);
  assert.match(finance, /applyFilters\(false\)/, 'finance inline updates should keep the current page');

  const adminRenderStart = admin.indexOf('function renderAdminTable(');
  const adminRenderEnd = admin.indexOf('function filterTableDebounced', adminRenderStart);
  assert.ok(adminRenderStart >= 0 && adminRenderEnd > adminRenderStart);
  assert.doesNotMatch(admin.slice(adminRenderStart, adminRenderEnd), /RizenicPagination\.reset\(/, 'admin data refresh should not force the user back to page 1');
});
