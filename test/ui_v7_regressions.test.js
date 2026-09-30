const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const jsPath = path.join(publicDir, 'ui_performance.js');
const cssPath = path.join(publicDir, 'ui_performance.css');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

const appPages = [
  'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
  'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html',
  'repair_board.html', 'repair_date_update.html', 'repair_export.html'
];

test('v7 cache-busts shared UI assets on every standalone application page', () => {
  for (const page of appPages) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
    assert.match(html, /ui_performance\.css\?v=20260930-7/, `${page} CSS is not v7 cache-busted`);
    assert.match(html, /ui_performance\.js\?v=20260930-7/, `${page} JS is not v7 cache-busted`);
  }
});

test('native table scrolling is never intercepted by a document-level wheel preventDefault handler', () => {
  assert.doesNotMatch(js, /doc\.addEventListener\(['"]wheel['"][\s\S]*?preventDefault\(\)/);
  assert.doesNotMatch(js, /scrollTop\s*\+=\s*event\.deltaY/);
  assert.match(css, /\.ui-table-scroll-host\s*\{[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /\.ui-table-scroll-host\s*\{[\s\S]*overscroll-behavior-y:\s*auto/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
});

test('shared data tables are compact and keep readable breathing room inside cells', () => {
  assert.match(css, /\.ui-data-table\s*\{[\s\S]*font-size:\s*12px\s*!important/);
  assert.match(css, /\.ui-data-table\s+th,[\s\S]*\.ui-data-table\s+td\s*\{[\s\S]*padding:\s*8px\s+10px\s*!important/);
  assert.match(css, /\.ui-table-scroll-host\s*\{[\s\S]*border-radius:\s*12px/);
});

test('repair page gets a compact KPI strip and denser repair table', () => {
  assert.match(js, /ui-repair-page/);
  assert.match(css, /\.ui-repair-page\s+\.kpi-card\s*\{[\s\S]*padding:\s*10px\s+12px\s*!important/);
  assert.match(css, /\.ui-repair-page\s+\.excel-table\s*\{[\s\S]*font-size:\s*12px\s*!important/);
  assert.match(css, /\.ui-repair-page\s+\.excel-table\s+thead\s+th\s*\{[\s\S]*padding:\s*9px\s+10px\s*!important/);
});

test('dashboard layout is constrained and its KPI/chart cards are more compact without touching chart data code', () => {
  assert.match(css, /\.ui-dashboard-page\s+main\s*\{[\s\S]*max-width:\s*1480px\s*!important/);
  assert.match(css, /\.ui-dashboard-page\s+\.stat-card\s*\{[\s\S]*min-height:\s*96px/);
  assert.match(css, /\.ui-dashboard-page\s+\.card-box\s*\{[\s\S]*padding:\s*16px\s*!important/);
  assert.match(css, /#statusChart/);
  assert.match(css, /max-height:\s*560px\s*!important/);
});

