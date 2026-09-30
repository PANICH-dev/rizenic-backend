const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const ui = require(path.join(publicDir, 'ui_performance.js'));
const js = fs.readFileSync(path.join(publicDir, 'ui_performance.js'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'ui_performance.css'), 'utf8');

const appPages = [
  'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
  'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html', 'repair_board.html',
  'repair_date_update.html', 'repair_export.html'
];

test('duplicate legacy result-count badges are hidden while their IDs remain available to legacy JS', () => {
  assert.match(js, /LEGACY_COUNT_IDS/);
  assert.match(js, /row_count/);
  assert.match(js, /table_row_count/);
  assert.match(js, /resultCount/);
  assert.match(js, /ui-legacy-count-hidden/);
  assert.match(css, /\.ui-legacy-count-hidden\s*\{[\s\S]*display:\s*none\s*!important/);
});

test('dashboard gets layout-only spacing and card polish without data selectors', () => {
  assert.match(css, /\.ui-dashboard-page\s+main\s*\{[\s\S]*padding:/);
  assert.match(css, /\.ui-dashboard-page\s+main\s*>\s*\.grid\s*\{[\s\S]*gap:/);
  assert.match(css, /\.ui-dashboard-page\s+\.card-box\s*\{[\s\S]*border-radius:/);
  assert.match(css, /\.ui-dashboard-page\s+\.stat-card\s*\{[\s\S]*min-height:/);
});

test('hover dropdowns keep an interaction bridge and delayed close so the menu does not disappear crossing the gap', () => {
  assert.match(js, /ui-stable-menu-group/);
  assert.match(js, /ui-stable-hover-menu/);
  assert.match(js, /pointerenter/);
  assert.match(js, /pointerleave/);
  assert.match(js, /setTimeout\([\s\S]*220/);
  assert.match(css, /\.ui-stable-hover-menu::before/);
  assert.match(css, /\.ui-stable-menu-group\.ui-menu-open\s*>\s*\.ui-stable-hover-menu/);
});

test('authenticated navigation never paints the login screen before the page bootstrap runs', () => {
  assert.match(js, /sessionStorage\.getItem\(['"]isLoggedIn['"]\)/);
  assert.match(js, /ui-authenticated-session/);
  assert.match(css, /html\.ui-authenticated-session\s+#login-screen\s*\{[\s\S]*display:\s*none\s*!important/);
});
