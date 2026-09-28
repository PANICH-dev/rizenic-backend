const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadHelper() {
  const context = { console, globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8'), context);
  return context.RizenicTableViewport;
}

test('adaptive table dock grows the table as its header approaches the viewport top', () => {
  const helper = loadHelper();
  assert.equal(typeof helper.calculateDockGeometry, 'function');

  const initial = helper.calculateDockGeometry({
    viewportHeight: 900,
    hostTop: 300,
    reservedBelow: 60,
    dockTop: 0,
    gap: 8
  });
  assert.equal(initial.height, 532);
  assert.equal(initial.distanceToDock, 300);
  assert.equal(initial.shouldDock, false);

  const nearTop = helper.calculateDockGeometry({
    viewportHeight: 900,
    hostTop: 80,
    reservedBelow: 60,
    dockTop: 0,
    gap: 8
  });
  assert.equal(nearTop.height, 752);
  assert.equal(nearTop.distanceToDock, 80);
  assert.equal(nearTop.shouldDock, false);

  const docked = helper.calculateDockGeometry({
    viewportHeight: 900,
    hostTop: 0,
    reservedBelow: 60,
    dockTop: 0,
    gap: 8
  });
  assert.equal(docked.height, 832);
  assert.equal(docked.distanceToDock, 0);
  assert.equal(docked.shouldDock, true);
});

test('shared table viewport helper uses progressive page scroll first, then freezes only at the dock point', () => {
  const js = fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/table_scroll_fix.css'), 'utf8');

  assert.doesNotMatch(js, /classList\.add\(['"]rz-table-page-lock['"]\)/, 'must not freeze the page immediately');
  assert.match(js, /addEventListener\(['"]scroll['"]/, 'must resize while the page scrolls');
  assert.match(js, /addEventListener\(['"]wheel['"]/, 'stage 2 must transfer vertical wheel movement to the table');

  assert.match(css, /body\.rz-table-page-ready:not\(\.rz-table-page-docked\)[^{]*\{[^}]*overflow-y:\s*auto\s*!important/s);
  assert.match(css, /body\.rz-table-page-docked\s*\{[^}]*position:\s*fixed\s*!important/s, 'body freezes only after the table reaches the safe dock point');
  assert.match(css, /main\.rz-table-main-ready::after\s*\{[^}]*height:\s*var\(--rz-table-dock-spacer-height/s);
});

test('repair-family tables no longer hard-code a short viewport height before adaptive docking', () => {
  for (const file of ['repair.html', 'repair_date_update.html', 'repair_export.html']) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.doesNotMatch(src, /\.table-container\s*\{[^}]*height:\s*calc\(100vh\s*-\s*\d+px\)/s, `${file} must not hard-code table height`);
  }
});

test('all long-table pages keep the shared adaptive dock helper installed', () => {
  const pages = [
    'admin.html', 'finance.html', 'history.html', 'jobs.html', 'jobs_table.html',
    'parts.html', 'repair.html', 'repair_date_update.html', 'repair_export.html'
  ];
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_viewport_lock\.js\?v=/, `${file} must load adaptive table dock helper`);
    assert.match(src, /table_scroll_fix\.css\?v=/, `${file} must load shared adaptive table CSS`);
  }
});

test('adaptive dock never rewrites the main flex basis so sidebar layouts keep their width', () => {
  const css = fs.readFileSync(path.join(root, 'public/table_scroll_fix.css'), 'utf8');
  const readyMain = css.match(/body\.rz-table-page-ready:not\(\.rz-table-page-docked\) main\.rz-table-main-ready\s*\{([^}]*)\}/s);
  assert.ok(readyMain, 'ready main rule must exist');
  assert.doesNotMatch(readyMain[1], /\bflex\s*:/, 'must preserve each page\'s existing flex row/column sizing');
});

test('every non-dashboard standalone page keeps an intentional viewport strategy', () => {
  const stretchOffPages = ['admin.html', 'finance.html', 'jobs_table.html', 'parts.html'];
  const adaptiveLongTablePages = ['history.html', 'jobs.html', 'repair.html', 'repair_date_update.html', 'repair_export.html'];
  const longTablePages = [...stretchOffPages, ...adaptiveLongTablePages];
  const normalPages = ['index.html', 'repair_board.html'];
  const fragments = ['audit.html', 'inspection.html', 'sa_portal.html'];
  const classified = [...longTablePages, ...normalPages, ...fragments].sort();
  const actual = fs.readdirSync(path.join(root, 'public'))
    .filter(name => name.endsWith('.html') && name !== 'dashboard.html')
    .sort();
  assert.deepEqual(actual, classified, 'every non-dashboard HTML file must be explicitly reviewed/classified');

  for (const file of longTablePages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_viewport_lock\.js\?[^"']*adaptive=4/, `${file} must keep the audited helper revision available`);
    assert.match(src, /table_scroll_fix\.css\?[^"']*adaptive=4/, `${file} must keep the audited shared table CSS revision`);
  }
  for (const file of stretchOffPages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /data-rz-table-dock=["']off["']/, `${file} must keep its fixed non-stretch viewport strategy`);
  }
  for (const file of adaptiveLongTablePages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.doesNotMatch(src, /data-rz-table-dock=["']off["']/, `${file} must keep adaptive two-stage scrolling enabled`);
  }

  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const indexBodyTag = index.match(/<body\b[^>]*>/i)?.[0] || '';
  const indexBodyClasses = (indexBodyTag.match(/class=["']([^"']*)["']/i)?.[1] || '').split(/\s+/).filter(Boolean);
  assert.equal(indexBodyClasses.includes('h-screen'), false, 'index form page must not force one-screen height');
  assert.equal(indexBodyClasses.includes('overflow-hidden'), false, 'index form page must keep normal document scrolling');

  const board = fs.readFileSync(path.join(root, 'public/repair_board.html'), 'utf8');
  assert.match(board, /#scrollArea\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*min-height:\s*0[^}]*overflow:\s*auto/s,
    'repair board must let its internal scroller shrink to the remaining viewport');
  assert.match(board, /header\s*\{[^}]*flex:\s*0\s+0\s+auto/s,
    'repair board header must reserve only its natural height');

  const inspection = fs.readFileSync(path.join(root, 'public/inspection.html'), 'utf8');
  assert.match(inspection, /@media\s+print/, 'inspection remains the intentional A4/print fragment');

  assert.equal(fs.readFileSync(path.join(root, 'public/audit.html'), 'utf8').trim(), '', 'empty audit placeholder stays untouched');
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'public/sa_portal.html'), 'utf8'), /<!DOCTYPE/i,
    'SA portal remains a script fragment, not a standalone viewport');
});
