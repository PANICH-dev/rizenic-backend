const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const core = fs.readFileSync(path.join(pub, 'jobs_table_core.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(pub, 'ui_performance.js'), 'utf8');
const uiCss = fs.readFileSync(path.join(pub, 'ui_performance.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const jobsHtml = fs.readFileSync(path.join(pub, 'jobs_table.html'), 'utf8');

const tablePages = ['admin.html','dashboard.html','finance.html','history.html','index.html','jobs.html','jobs_table.html','parts.html','repair.html','repair_date_update.html','repair_export.html'];

test('jobs_table file and static route remain present', () => {
  assert.equal(fs.existsSync(path.join(pub, 'jobs_table.html')), true);
  assert.match(app, /express\.static\([^\n]*public|express\.static\(path\.join\(__dirname,\s*['"]public['"]\)\)/);
});

test('jobs table prioritizes reports for first paint and defers preferences/reference data', () => {
  assert.match(core, /const\s+preferencesPromise\s*=\s*loadUserColumnPreferences\(\)/);
  assert.match(core, /await\s+loadJobsPrimaryData\(\)/);
  assert.match(core, /requestAnimationFrame\(startBackgroundHydration\)/);
  assert.match(core, /user-preferences\/\$\{encodeURIComponent\(empName\)\}`,[\s\S]{0,80}uiBackground:\s*true/);
});

test('jobs primary reads are branch scoped for non privileged users', () => {
  assert.match(core, /function\s+getJobsScopeQuery\(/);
  assert.match(core, /fetch\(`\$\{API_BASE_URL\}\/api\/reports\$\{scopeQuery\}`\)/);
  assert.match(core, /const\s+background\s*=\s*\{\s*uiBackground:\s*true\s*\}/);
  assert.match(core, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders\$\{scopeQuery\}`,\s*background\)/);
  assert.match(app, /app\.get\('\/api\/part-orders'[\s\S]*?const\s*\{\s*branch\s*\}\s*=\s*req\.query[\s\S]*?WHERE branch_name = \$1/);
});

test('jobs secondary masters load in background after first table paint', () => {
  assert.match(core, /async function loadJobsSecondaryData\(/);
  assert.match(core, /uiBackground:\s*true/);
  assert.match(uiJs, /const\s+backgroundRead\s*=\s*Boolean\(init\s*&&\s*init\.uiBackground\)/);
  assert.match(uiJs, /trackRead\s*=\s*requestMethod\s*===\s*['"]GET['"][\s\S]*?!backgroundRead/);
});

test('shared table host fills remaining viewport so pager stays at bottom even with zero rows', () => {
  assert.match(uiJs, /function\s+syncTableViewport\(state\)/);
  assert.match(uiJs, /--ui-table-viewport-height/);
  assert.match(uiCss, /height:\s*var\(--ui-table-viewport-height/);
  assert.match(uiCss, /min-height:\s*var\(--ui-table-viewport-height/);
});

test('all shared table pages load the same pager floor layer', () => {
  for (const file of tablePages) {
    const html = fs.readFileSync(path.join(pub, file), 'utf8');
    assert.match(html, /ui_performance\.css\?v=/, `${file} missing shared css`);
    assert.match(html, /ui_performance\.js\?v=/, `${file} missing shared js`);
  }
});
