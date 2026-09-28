const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('jobs table builds a paged reports request with page, limit, search, filters and sort', () => {
  const core = read('public/jobs_table_server.js');
  assert.match(core, /function\s+buildJobsServerParams/);
  assert.match(core, /params\.set\(['"]paged['"],\s*['"]1['"]\)/);
  assert.match(core, /params\.set\(['"]page['"],\s*String\(jobsPager\.page\)\)/);
  assert.match(core, /params\.set\(['"]limit['"],\s*String\(jobsPager\.pageSize\)\)/);
  assert.match(core, /params\.set\(['"]search['"]/);
  assert.match(core, /params\.set\(['"]filters['"]/);
  assert.match(core, /params\.set\(['"]sort['"]/);
  assert.match(core, /fetchJobsServerPage/);
});

test('jobs page navigation and sort refetch from server instead of client slicing/sorting', () => {
  const ui = read('public/jobs_table_server.js');
  assert.match(ui, /goJobsPage\s*=\s*function\s*\(page\)[\s\S]*fetchJobsServerPage/s);
  assert.match(ui, /sortTable\s*=\s*function\s*\(colIndex\)[\s\S]*fetchJobsServerPage/s);
  assert.doesNotMatch(ui, /currentFilteredData\.sort\(/);
  assert.match(ui, /RizenicPagination\.fromServerResponse/);
});

test('jobs Excel filter gets full distinct values from report facet mode', () => {
  const ui = read('public/jobs_table_server.js');
  assert.match(ui, /openExcelFilter\s*=\s*async function/);
  assert.match(ui, /facet/);
  assert.match(ui, /fetchReportFacetValues/);
});

test('jobs export fetches the full filtered dataset separately and is not limited to current page', () => {
  const ui = read('public/jobs_table_server.js');
  assert.match(ui, /fetchAllJobsForExport/);
  assert.match(ui, /buildJobsServerParams\([^)]*false/);
  assert.doesNotMatch(ui, /currentFilteredData\.forEach\(job => \{[\s\S]*XLSX/s);
});
