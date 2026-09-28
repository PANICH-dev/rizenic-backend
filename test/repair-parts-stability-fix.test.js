const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('repair board declares its in-flight flag before loadData can run', () => {
  const html = read('public/repair_board.html');
  const declaration = html.indexOf('let repairBoardLoadInFlight = false;');
  const domReady = html.indexOf("document.addEventListener('DOMContentLoaded'");
  const loadData = html.indexOf('async function loadData()');
  assert.ok(declaration >= 0, 'repairBoardLoadInFlight must be declared');
  assert.ok(declaration < domReady, 'flag must exist before DOMContentLoaded can call loadData');
  assert.ok(declaration < loadData, 'flag must exist before loadData reads it');
});

test('parts table scrollers reserve bottom breathing room above the pager', () => {
  const html = read('public/parts.html');
  assert.match(html, /class="[^"]*parts-table-scroll[^"]*rz-table-scroll-surface[^"]*"/);
  assert.match(html, /\.parts-table-scroll\s*\{[^}]*padding-bottom:\s*var\(--rz-parts-pager-clearance\)/s);
  assert.match(html, /--rz-parts-pager-clearance:\s*5[0-9]px/);
});

test('repair keeps header and tab bar outside the scrollable KPI/work area', () => {
  const html = read('public/repair.html');
  const headerEnd = html.indexOf('</header>');
  const tabBar = html.indexOf('id="repair_tab_bar"');
  const workspace = html.indexOf('id="repair_workspace_scroll"');
  const kpi = html.indexOf('id="repair_kpi_bar"');
  const main = html.indexOf('<main class="repair-main');
  assert.ok(headerEnd >= 0 && tabBar > headerEnd, 'tab bar must follow the fixed top header');
  assert.ok(workspace > tabBar, 'workspace scroll must start below the tab bar');
  assert.ok(kpi > workspace && main > kpi, 'KPI and main content must be inside the workspace scroll');
  assert.match(html, /\.repair-workspace-scroll\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(html, /\.repair-workspace-scroll\s+\.repair-main\s*\{[^}]*min-height:\s*100%;/s);
  assert.match(html, /\.repair-main\s+\.table-container\s*\{[^}]*overscroll-behavior-y:\s*auto\s*!important;/s);
});
