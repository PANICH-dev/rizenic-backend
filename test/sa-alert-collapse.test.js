const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'public/js/parts_ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/parts.html'), 'utf8');

test('SA Alerts previews only two PO items and exposes an explicit expand/collapse control', () => {
  assert.match(ui, /const SA_ALERT_PREVIEW_LIMIT = 2;/);
  assert.match(ui, /expandedSAAlertJobs\s*=\s*new Set\(\)/);
  assert.match(ui, /relatedParts\.slice\(0, visibleCount\)/);
  assert.match(ui, /ดูเพิ่มอีก \$\{hiddenCount\} รายการ/);
  assert.match(ui, /ย่อรายการ/);
  assert.match(ui, /window\.toggleSAAlertParts/);
});

test('SA Alerts expansion changes only rendering and keeps search/modal based on the complete related parts data', () => {
  assert.match(ui, /relatedParts\.map\(p => Object\.values\(p\)\.join\(' '\)\)/);
  assert.match(ui, /openAlertModal\('\$\{jobId\}', '\$\{plate\}'\)/);
  assert.match(ui, /const relatedParts = .*getPartOrdersForJob\(jobId\)/);
});

test('parts page cache-busts the collapsed-row UI revision', () => {
  assert.match(html, /js\/parts_ui\.js\?v=23\.5/);
});
