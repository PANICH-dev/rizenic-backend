const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('table viewport avoids clip/paint containment around sticky table sections', () => {
  const css = read('public/table_scroll_fix.css');
  const match = css.match(/body\.rz-table-page-lock\s+\.rz-table-viewport-scroll\s*\{([\s\S]*?)\}/);
  assert.ok(match, 'viewport scroll rule must exist');
  assert.doesNotMatch(match[1], /contain\s*:\s*paint/, 'paint containment causes sticky-table compositing artifacts');
  assert.doesNotMatch(match[1], /clip-path\s*:/, 'clip-path on the scroller causes sticky header ghosting in Chromium');
});

test('active table uses one opaque high stacking sticky header section instead of independently sticky cells', () => {
  const css = read('public/table_scroll_fix.css');
  assert.match(css, /body\.rz-table-page-lock\s+\.rz-table-viewport-scroll\s+thead\s*\{[^}]*position:\s*sticky\s*!important;[^}]*top:\s*0\s*!important;[^}]*z-index:\s*60\s*!important;/s);
  assert.match(css, /body\.rz-table-page-lock\s+\.rz-table-viewport-scroll\s+thead\s+th\s*\{[^}]*position:\s*relative\s*!important;[^}]*top:\s*auto\s*!important;/s);
});

test('repair header reserves a fixed tools lane and a safe minimum width for counted columns', () => {
  const js = read('public/repair.js');
  assert.match(js, /const\s+headerWidth\s*=\s*col\.showCount\s*\?\s*Math\.max\(col\.w,\s*175\)\s*:\s*col\.w/);
  assert.match(js, /class="rz-th-content/);
  assert.match(js, /class="rz-th-title/);
  assert.match(js, /class="rz-th-tools/);
  assert.match(js, /class="rz-th-count/);

  const html = read('public/repair.html');
  assert.match(html, /\.rz-th-content\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
  assert.match(html, /\.rz-th-tools\s*\{[^}]*flex-shrink:\s*0/s);
  assert.match(html, /repair\.js\?v=7/);
});

test('all table pages cache-bust the corrected sticky-header stylesheet', () => {
  const pages = [
    'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
    'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html',
    'repair_date_update.html', 'repair_export.html'
  ];
  for (const file of pages) {
    assert.match(read(`public/${file}`), /table_scroll_fix\.css\?v=1\.6/, `${file} must load CSS v1.6`);
  }
});
