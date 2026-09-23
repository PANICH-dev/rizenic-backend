const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = p => fs.readFileSync(p, 'utf8');

test('dashboard uses a viewport-fixed topbar with a measured spacer', () => {
  const html = read('public/dashboard.html');
  const css = read('public/dashboard_topbar_lock.css');
  const js = read('public/dashboard_topbar_lock.js');
  assert.match(html, /id="dashboard-topbar"/);
  assert.match(html, /dashboard_topbar_lock\.css\?v=1\.0/);
  assert.match(html, /dashboard_topbar_lock\.js\?v=1\.0/);
  assert.match(css, /position:\s*fixed\s*!important/);
  assert.match(css, /--rz-dashboard-topbar-height/);
  assert.match(js, /ResizeObserver/);
  assert.match(js, /dashboard-topbar-spacer/);
});

test('parts and jobs table scroll surfaces are wrapped by a non-scrolling clip shell', () => {
  const parts = read('public/parts.html');
  const jobs = read('public/jobs.html');
  const css = read('public/table_scroll_fix.css');
  assert.ok((parts.match(/rz-table-clip-shell/g) || []).length >= 2);
  assert.ok((parts.match(/rz-table-scroll-surface/g) || []).length >= 2);
  assert.ok((jobs.match(/rz-table-clip-shell/g) || []).length >= 2);
  assert.ok((jobs.match(/rz-table-scroll-surface/g) || []).length >= 2);
  assert.match(css, /\.rz-table-clip-shell\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.rz-table-scroll-surface\s*\{[^}]*overflow:\s*auto/s);
});

test('parts and jobs keep the established shared table stylesheet contract', () => {
  for (const file of ['public/parts.html', 'public/jobs.html']) {
    assert.match(read(file), /table_scroll_fix\.css\?v=1\.6/);
  }
});
