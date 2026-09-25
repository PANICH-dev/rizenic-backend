const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
const css = fs.readFileSync(path.join(pub, 'ui_global.css'), 'utf8');
const partsHtml = fs.readFileSync(path.join(pub, 'parts.html'), 'utf8');
const partsUi = fs.readFileSync(path.join(pub, 'js/parts_ui.js'), 'utf8');

const interactiveTablePages = [
  'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
  'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html',
  'repair_date_update.html', 'repair_export.html'
];

test('all interactive table pages cache-bust the shared table polish layer', () => {
  for (const page of interactiveTablePages) {
    const html = fs.readFileSync(path.join(pub, page), 'utf8');
    assert.match(html, /ui_global\.css\?v=1\.1/, `${page} must load ui_global.css v1.1`);
  }
});

test('shared table polish keeps headers centered, body content top-aligned and pagers inset from card edges', () => {
  assert.match(css, /table\.modern-table[\s\S]*tbody[\s\S]*vertical-align:\s*top/);
  assert.match(css, /table\.excel-table[\s\S]*tbody[\s\S]*vertical-align:\s*top/);
  assert.match(css, /thead[\s\S]*vertical-align:\s*middle/);
  assert.match(css, /\.rz-pagination[\s\S]*padding:\s*10px 12px 12px\s*!important/);
});

test('SA Alerts uses compact top-aligned rows without block TDs or nested card chrome', () => {
  assert.match(partsUi, /const SA_ALERT_PREVIEW_LIMIT = 2;/);
  assert.match(partsUi, /class="sa-po-item/);
  assert.match(partsUi, /class="sa-po-cell/);
  assert.doesNotMatch(partsUi, /<td class="[^"]*\bblock\b[^"]*"[^>]*>\$\{itemsHtml\}<\/td>/);
  assert.match(partsUi, /<td class="[^"]*align-top[^"]*"/);
  assert.match(partsUi, /ดูเพิ่มอีก \$\{hiddenCount\} รายการ/);
  assert.match(partsUi, /class="sa-po-more-btn/);
  assert.doesNotMatch(partsUi, /sa-po-more-btn[^\n]*w-full/);
});

test('SA Alerts search uses one magnifier source and the manage action aligns to the row top', () => {
  assert.match(partsHtml, /placeholder="ค้นหาทะเบียน, ชื่อลูกค้า\.\.\."/);
  assert.doesNotMatch(partsHtml, /placeholder="🔍/);
  assert.match(partsUi, /<td class="[^"]*align-top[^"]*">\s*<button[^>]*openAlertModal/);
});


test('table search fields do not render a Font Awesome magnifier plus an emoji magnifier at the same time', () => {
  const jobs = fs.readFileSync(path.join(pub, 'jobs.html'), 'utf8');
  const repair = fs.readFileSync(path.join(pub, 'repair.html'), 'utf8');
  assert.match(jobs, /placeholder="ค้นหาทะเบียนในหน้านี้\.\.\."/);
  assert.doesNotMatch(jobs, /placeholder="🔍 ค้นหาทะเบียนในหน้านี้/);
  assert.match(repair, /placeholder="ค้นหา ทะเบียนรถ \/ ลูกค้า \/ SA \/ สถานะ\.\.\."/);
  assert.doesNotMatch(repair, /placeholder="🔍 ค้นหา ทะเบียนรถ/);
});
