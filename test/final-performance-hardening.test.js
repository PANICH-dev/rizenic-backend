const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const tailwindPages = [
  'index.html','jobs.html','jobs_table.html','parts.html','repair.html','dashboard.html',
  'finance.html','admin.html','history.html','repair_export.html','repair_date_update.html','repair_board.html'
];

test('production pages use precompiled Tailwind CSS and never execute Tailwind runtime', () => {
  for (const page of tailwindPages) {
    const html = read(`public/${page}`);
    assert.doesNotMatch(html, /\/vendor\/tailwindcss\.js/);
    assert.doesNotMatch(html, /<style\s+type=["']text\/tailwindcss["']/i);
    assert.match(html, new RegExp(`/compiled/${page.replace('.html','')}\\.tailwind\\.css`));
    assert.ok(fs.existsSync(path.join(root, 'public', 'compiled', `${page.replace('.html','')}.tailwind.css`)));
  }
});

test('admin uses server-side search and 50-row paging instead of loading whole master tables', () => {
  const html = read('public/admin.html');
  const js = read('public/admin_server.js');
  const views = read('server_side_views.js');
  assert.match(html, /admin_server\.js/);
  assert.match(js, /PAGE_SIZE\s*=\s*50/);
  assert.match(js, /\/api\/server\/admin\//);
  assert.match(js, /search/);
  assert.match(views, /\/api\/server\/admin\/:resource/);
  assert.match(views, /COUNT\(\*\) OVER\(\)/);
  assert.match(views, /LIMIT \$/);
  assert.match(views, /OFFSET \$/);
});

test('page-scoped parts and repair views scope part orders to returned jobs instead of whole branch PO history', () => {
  const views = read('server_side_views.js');
  assert.match(views, /buildScopedPartOrdersForReports/);
  assert.match(views, /\/api\/server\/parts-alerts/);
  assert.match(views, /\/api\/server\/repair-page/);
  assert.match(views, /job_id::text = ANY/);
  assert.match(views, /car_plate = ANY/);
});

test('parts master table pages and searches on the server instead of loading the complete master list', () => {
  const views = read('server_side_views.js');
  const js = read('public/parts_server.js');
  assert.match(views, /\/api\/server\/parts-master/);
  assert.match(views, /COUNT\(\*\) OVER\(\)/);
  assert.match(js, /\/api\/server\/parts-master/);
  assert.match(js, /PARTS_MASTER_PAGE_SIZE\s*=\s*50/);
  assert.match(js, /AbortController/);
  assert.match(js, /searchMasterTable\s*=/);
});

test('large Chart.js runtime is loaded after page markup, not as a head-blocking script', () => {
  for (const page of ['dashboard.html', 'repair.html', 'finance.html']) {
    const html = read(`public/${page}`);
    const chartAt = html.indexOf('/vendor/chart.umd.min.js');
    const bodyAt = html.indexOf('<body');
    assert.ok(chartAt > bodyAt, `${page} should load Chart.js inside body after markup starts`);
  }
});
