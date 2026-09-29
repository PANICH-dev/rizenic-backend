const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('jobs table uses the shared blocking API loader instead of rendering a second page loader', () => {
  const html = read('public/jobs_table.html');
  const guard = read('public/session_guard.js');
  assert.doesNotMatch(html, /id=["']jobs_table_loading["']/);
  assert.doesNotMatch(html, /\.jobs-table-loading-layer/);
  assert.match(guard, /id = ['"]rz-api-loading-layer['"]/);
  assert.match(guard, /pendingBlockingRequests/);
});

test('server page loads rely on shared fetch loading while filter sort and paging remain server-side', () => {
  const js = read('public/jobs_table_server.js');
  assert.doesNotMatch(js, /setJobsTableLoading\s*\(/);
  assert.match(js, /applyFilters\s*=\s*async function[\s\S]*fetchJobsServerPage\(\{\s*showLoading:\s*true\s*\}\)/s);
  assert.match(js, /sortTable\s*=\s*function[\s\S]*fetchJobsServerPage\(\{[\s\S]*showLoading:\s*true[\s\S]*\}\)/s);
});

test('jobs page load error is reported without leaving a second blocking layer on screen', () => {
  const js = read('public/jobs_table_server.js');
  assert.doesNotMatch(js, /setJobsTableLoadingError\s*\(/);
  assert.match(js, /showToast\([^\n]*เกิดข้อผิดพลาดในการโหลดข้อมูล[^\n]*['"]error['"]\)/);
});
