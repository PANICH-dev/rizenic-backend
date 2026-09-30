const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const repairHtml = fs.readFileSync(path.join(publicDir, 'repair.html'), 'utf8');
const repairJs = fs.readFileSync(path.join(publicDir, 'repair.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(publicDir, 'ui_performance.js'), 'utf8');
const uiCss = fs.readFileSync(path.join(publicDir, 'ui_performance.css'), 'utf8');

test('repair board uses finance-style fixed flex table scroller and no adaptive dock layer', () => {
  assert.match(
    repairHtml,
    /id="repairTableContainer"[^>]*class="[^"]*flex-1[^"]*overflow-auto[^"]*custom-scrollbar[^"]*bg-white[^"]*relative/
  );
  assert.doesNotMatch(repairHtml, /class="table-container flex-1"/);
  assert.doesNotMatch(uiJs, /ui-repair-adaptive-host|ui-repair-board-adaptive-active|getRepairAdaptiveGeometry|setupRepairAdaptiveState/);
  assert.doesNotMatch(uiCss, /ui-repair-adaptive-host|ui-repair-board-adaptive-active|ui-repair-adaptive-card|ui-repair-adaptive-pager/);
});

test('station chart drilldown resets stale calendar/kpi/column filters and applies exact calculated station scope', () => {
  assert.match(repairJs, /let\s+activeStationFilter\s*=\s*null/);
  assert.match(repairJs, /if\s*\(activeStationFilter\s*&&\s*job\.calculated_station\s*!==\s*activeStationFilter\)\s*return\s+false/);
  assert.match(repairJs, /activeFilters\s*=\s*\{\}\s*;[\s\S]{0,300}activeKpiFilter\s*=\s*null\s*;[\s\S]{0,300}isCalendarFilterActive\s*=\s*false\s*;[\s\S]{0,300}activeStationFilter\s*=\s*filterVal\s*;/);
  assert.match(repairJs, /document\.getElementById\(['"]global_search_input['"]\)\.value\s*=\s*['"]['"]\s*;/);
});

test('manual Enter search leaves station drilldown mode before applying text search', () => {
  assert.match(repairJs, /if\s*\(event\.key\s*!==\s*['"]Enter['"]\)\s*return\s*;[\s\S]{0,220}activeStationFilter\s*=\s*null\s*;[\s\S]{0,120}runTableFilters\(\)/);
});
