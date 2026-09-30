const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const ui = require(path.join(publicDir, 'ui_performance.js'));
const js = fs.readFileSync(path.join(publicDir, 'ui_performance.js'), 'utf8');
const css = fs.readFileSync(path.join(publicDir, 'ui_performance.css'), 'utf8');
const jobsJs = fs.readFileSync(path.join(publicDir, 'jobs_table.js'), 'utf8');

function input(attrs = {}) {
  return {
    tagName: 'INPUT',
    type: attrs.type || 'text',
    id: attrs.id || '',
    name: attrs.name || '',
    getAttribute(name) { return attrs[name] ?? null; }
  };
}

test('repair board keeps native finance-style scrolling and contains no adaptive dock toggles', () => {
  assert.doesNotMatch(css, /ui-repair-adaptive-host|ui-repair-board-adaptive-active/);
  assert.doesNotMatch(js, /setupRepairAdaptiveState|getRepairAdaptiveGeometry/);
  assert.doesNotMatch(js, /scrollHost\.style\.position\s*=/);
});

test('initial and API loading use a centered rotating spinner instead of a text loading card', () => {
  const initial = css.match(/html\.ui-initial-loading body::after\s*\{([\s\S]*?)\}/);
  assert.ok(initial, 'missing initial loading indicator');
  assert.match(initial[1], /content:\s*['"]{2}/);
  assert.match(initial[1], /border-radius:\s*999px/);
  assert.match(initial[1], /animation:\s*ui-spin/);
  assert.doesNotMatch(initial[1], /กำลังโหลดข้อมูล/);
  assert.match(js, /ui-global-loader__spinner/);
  assert.doesNotMatch(js, /ui-global-loader__spinner[^<]*<\/span><span>กำลังโหลดข้อมูล/);
});

test('jobs table keeps the shared blocking loader active through bootstrap JSON processing and render', () => {
  assert.match(js, /beginTask:\s*beginTask/);
  assert.match(js, /endTask:\s*endTask/);
  assert.match(jobsJs, /DOMContentLoaded[\s\S]*beginTask\?\.\('jobs-table-bootstrap'\)/);
  assert.match(jobsJs, /await loadJobsData\(\)/);
  assert.match(jobsJs, /async function loadJobsData\(\)\s*\{[\s\S]*RizenicUIPerformance\?\.beginTask/);
  assert.match(jobsJs, /finally\s*\{[\s\S]*RizenicUIPerformance\?\.endTask/);
});

test('shared search classification covers live search/filter inputs but not normal form inputs', () => {
  assert.equal(ui.isSearchControl(input({ id: 'search_input', onkeyup: 'applyFilters()' })), true);
  assert.equal(ui.isSearchControl(input({ onkeyup: "filterTableByText('master_table_body', this.value)" })), true);
  assert.equal(ui.isSearchControl(input({ id: 'parts_modal_search', onkeyup: 'filterPartsModalList()' })), true);
  assert.equal(ui.isSearchControl(input({ id: 'car_brand', onchange: 'updateCarModels(this.value)' })), false);
  assert.equal(ui.isSearchControl(input({ type: 'range', id: 'ins_fuel_level', oninput: 'updateFuelGauge(this.value)' })), false);
  assert.match(js, /if \(event\.key === ['"]Enter['"]\)/);
  assert.match(js, /event\.type === ['"]keyup['"]/);
  assert.match(js, /stopImmediatePropagation\(\)/);
});
