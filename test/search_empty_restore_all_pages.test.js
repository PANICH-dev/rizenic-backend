const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pub = path.join(__dirname, '..', 'public');

const admin = fs.readFileSync(path.join(pub, 'admin.html'), 'utf8');
const jobs = fs.readFileSync(path.join(pub, 'jobs.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(pub, 'dashboard_po.js'), 'utf8');
const history = fs.readFileSync(path.join(pub, 'history.js'), 'utf8');

test('admin debounced text search refreshes pager after filtering or clearing', () => {
  assert.match(admin, /function filterTableDebounced[\s\S]*?setTimeout\([\s\S]*?ui:refresh-pagination/);
});

test('jobs and dashboard PO text search refresh pager after row visibility changes', () => {
  assert.match(jobs, /window\.filterPOTable[\s\S]*?ui:refresh-pagination/);
  assert.match(dashboard, /window\.filterPOTable[\s\S]*?ui:refresh-pagination/);
});

test('history empty Enter restores the original loaded history dataset instead of alerting', () => {
  assert.doesNotMatch(history, /if \(!keyword\) \{ alert\(/);
  assert.match(history, /const results = keyword\s*\?[\s\S]*?:\s*\[\.\.\.allJobsData\]/);
});
