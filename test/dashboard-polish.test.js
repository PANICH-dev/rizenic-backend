const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');

test('dashboard loads polish layer and keeps existing functional element ids', () => {
  const html = fs.readFileSync(path.join(pub, 'dashboard.html'), 'utf8');
  assert.match(html, /dashboard_polish\.css\?v=1\.2/);
  for (const id of ['branchFilter', 'stat_contacted', 'stat_parked', 'stat_delivered', 'stat_billed', 'report_start_date', 'report_end_date']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('dashboard polish provides a restrained shell, KPI grid and report toolbar styling', () => {
  const css = fs.readFileSync(path.join(pub, 'dashboard_polish.css'), 'utf8');
  assert.match(css, /\.dashboard-shell/);
  assert.match(css, /\.dashboard-kpi-grid/);
  assert.match(css, /\.dashboard-report-card/);
  assert.match(css, /\.dashboard-filter-bar/);
});
