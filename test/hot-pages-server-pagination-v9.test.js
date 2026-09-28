const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('hot server views page primary report datasets with LIMIT/OFFSET metadata', () => {
  const views = read('server_side_views.js');
  for (const route of ['dashboard','sa-overview','parts-alerts','repair-page']) {
    const start = views.indexOf(`app.get('/api/server/${route}'`);
    assert.ok(start >= 0, `${route} route missing`);
    const next = views.indexOf("app.get('/api/server/", start + 20);
    const block = views.slice(start, next < 0 ? views.length : next);
    assert.match(block, /req\.query\.page|pagedRequest\(/, `${route} must read a page`);
    assert.match(block, /LIMIT\s+\$|LIMIT \$\{/, `${route} must LIMIT rows`);
    assert.match(block, /OFFSET\s+\$|OFFSET \$\{/, `${route} must OFFSET rows`);
    assert.match(block, /totalPages|\.\.\.meta/, `${route} must return paging metadata`);
  }
});

test('secondary part-order reads are scoped to the current page instead of the whole branch', () => {
  const views = read('server_side_views.js');
  for (const route of ['dashboard-parts','sa-parts','repair-parts']) {
    const start = views.indexOf(`app.get('/api/server/${route}'`);
    assert.ok(start >= 0, `${route} route missing`);
    const next = views.indexOf("app.get('/api/server/", start + 20);
    const block = views.slice(start, next < 0 ? views.length : next);
    assert.match(block, /job_ids|car_plates|buildScopedPartOrdersForKeys/, `${route} must accept current-page keys`);
  }
});

test('parts alerts use server paging/search and do not client-slice the branch dataset', () => {
  const js = read('public/parts_server.js');
  assert.match(js, /PARTS_ALERT_PAGE_SIZE\s*=\s*50/);
  assert.match(js, /page.*saAlertsPager\.page/s);
  assert.match(js, /search.*saAlertsSearchText/s);
  assert.match(js, /RizenicPagination\.fromServerResponse/);
  assert.match(js, /fetchPartsAlertsPage/);
});

test('repair page requests only its current 50-row page and scopes parts to returned jobs', () => {
  const js = read('public/repair_server.js');
  assert.match(js, /REPAIR_SERVER_PAGE_SIZE\s*=\s*50/);
  assert.match(js, /page.*repairPager\.page/s);
  assert.match(js, /limit.*REPAIR_SERVER_PAGE_SIZE/s);
  assert.match(js, /job_ids/);
  assert.match(js, /car_plates/);
  assert.match(js, /RizenicPagination\.fromServerResponse/);
});

test('SA and dashboard primary requests are explicitly page-bounded', () => {
  const jobs = read('public/jobs_server.js');
  const dashboard = read('public/dashboard_server.js');
  assert.match(jobs, /SA_SERVER_PAGE_SIZE\s*=\s*50/);
  assert.match(jobs, /page/);
  assert.match(jobs, /limit/);
  assert.match(dashboard, /DASHBOARD_SERVER_PAGE_SIZE\s*=\s*20/);
  assert.match(dashboard, /page/);
  assert.match(dashboard, /limit/);
});
