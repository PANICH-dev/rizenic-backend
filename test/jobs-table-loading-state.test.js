const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('jobs table has a persistent loading overlay over the data viewport', () => {
  const html = read('public/jobs_table.html');
  assert.match(html, /id=["']jobs_table_loading["']/);
  assert.match(html, /id=["']jobs_table_loading_text["']/);
  assert.match(html, /กำลังโหลดข้อมูล/);
});

test('server page loads show loading for filter sort and paging, and only latest request can hide it', () => {
  const js = read('public/jobs_table_server.js');
  assert.match(js, /function\s+setJobsTableLoading\s*\(/);
  assert.match(js, /setJobsTableLoading\(true/);
  assert.match(js, /seq\s*===\s*jobsServerRequestSeq[\s\S]*setJobsTableLoading\(false/s);
  assert.match(js, /applyFilters\s*=\s*async function[\s\S]*fetchJobsServerPage\(\{\s*showLoading:\s*true\s*\}\)/s);
  assert.match(js, /sortTable\s*=\s*function[\s\S]*fetchJobsServerPage\(\{\s*showLoading:\s*true\s*\}\)/s);
});

test('jobs page load error is visible in the loading layer instead of leaving a blank table', () => {
  const js = read('public/jobs_table_server.js');
  assert.match(js, /setJobsTableLoadingError\s*\(/);
  assert.match(js, /เกิดข้อผิดพลาดในการโหลดข้อมูล/);
});
