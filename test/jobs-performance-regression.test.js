const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pub = path.join(__dirname, '..', 'public');

test('jobs server mode prevents the legacy initial loader from firing', () => {
  const html = fs.readFileSync(path.join(pub, 'jobs.html'), 'utf8');
  const js = fs.readFileSync(path.join(pub, 'jobs.js'), 'utf8');
  assert.match(html, /window\.RIZENIC_JOBS_SERVER_MODE\s*=\s*true[\s\S]*jobs\.js/);
  assert.match(js, /if\s*\(!window\.RIZENIC_JOBS_SERVER_MODE\)\s*loadJobsData\(\)/);
});

test('adaptive table helper captures wheel/touch only in docked stage and releases upward at the first row', () => {
  const js = fs.readFileSync(path.join(pub, 'table_viewport_lock.js'), 'utf8');
  assert.match(js, /if \(!docked \|\| !activeHost \|\| !deltaY\) return false;/,
    'undocked stage must leave native page scrolling alone');
  assert.match(js, /decision\.action === ['"]undock['"]/,
    'upward scroll at table top must release the outer page');
  assert.match(js, /addEventListener\s*\(\s*['"]wheel['"][\s\S]{0,120}passive:\s*false/);
  assert.match(js, /addEventListener\s*\(\s*['"]touchmove['"][\s\S]{0,120}passive:\s*false/);
});

test('jobs table loading surface is opaque so stale rows cannot show through', () => {
  const html = fs.readFileSync(path.join(pub, 'jobs_table.html'), 'utf8');
  assert.match(html, /\.jobs-table-loading-layer[\s\S]*background:\s*#f8fafc/);
  assert.doesNotMatch(html, /\.jobs-table-loading-layer[\s\S]{0,500}backdrop-filter/);
});

test('jobs server mode starts the server-side initial loader after suppressing legacy bootstrap', () => {
  const js = fs.readFileSync(path.join(pub, 'jobs_server.js'), 'utf8');
  assert.match(js, /function\s+startJobsServerInitialLoad\s*\(/);
  assert.match(js, /document\.addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*startJobsServerInitialLoad\s*,\s*\{\s*once:\s*true\s*\}\s*\)/);
  assert.match(js, /window\.RIZENIC_JOBS_SERVER_MODE/);
  assert.match(js, /loadJobsData\(\)/);
});

test('jobs page cache-busts the fixed server bootstrap so browsers cannot keep the stuck loader', () => {
  const html = fs.readFileSync(path.join(pub, 'jobs.html'), 'utf8');
  assert.match(html, /jobs_server\.js\?v=1\.2/);
});
