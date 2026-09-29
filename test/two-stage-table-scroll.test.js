const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const pages = [
  'admin.html', 'finance.html', 'history.html', 'jobs.html', 'jobs_table.html',
  'parts.html', 'repair.html', 'repair_date_update.html', 'repair_export.html'
];

function loadHelper() {
  const context = { console, globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8'), context);
  return context.RizenicTableViewport;
}

test('two-stage scroll keeps a safe top gap so the sticky table header is never clipped', () => {
  const js = fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8');
  assert.match(js, /const\s+DOCK_TOP\s*=\s*(?:8|10|12|16)\s*;/,
    'dock must leave a small safe gap above the sticky header');
});


test('dock target clamps wheel overshoot back to the safe header position', () => {
  const helper = loadHelper();
  assert.equal(typeof helper.calculateDockTargetY, 'function');
  assert.equal(helper.calculateDockTargetY({ scrollY: 0, hostTop: 300, dockTop: 8 }), 292);
  assert.equal(helper.calculateDockTargetY({ scrollY: 450, hostTop: -32, dockTop: 8 }), 410,
    'a large wheel step past the header must pull the page back to the exact dock point');
});

test('two-stage scroll transfers downward/upward wheel movement to the table and releases back to the page at table top', () => {
  const helper = loadHelper();
  assert.equal(typeof helper.resolveScrollTransfer, 'function');

  assert.deepEqual(
    { ...helper.resolveScrollTransfer({ docked: false, scrollTop: 0, scrollHeight: 1200, clientHeight: 600, deltaY: 80 }) },
    { action: 'page', nextScrollTop: 0 }
  );

  assert.deepEqual(
    { ...helper.resolveScrollTransfer({ docked: true, scrollTop: 120, scrollHeight: 1200, clientHeight: 600, deltaY: 80 }) },
    { action: 'table', nextScrollTop: 200 }
  );

  assert.deepEqual(
    { ...helper.resolveScrollTransfer({ docked: true, scrollTop: 120, scrollHeight: 1200, clientHeight: 600, deltaY: -80 }) },
    { action: 'table', nextScrollTop: 40 }
  );

  assert.deepEqual(
    { ...helper.resolveScrollTransfer({ docked: true, scrollTop: 0, scrollHeight: 1200, clientHeight: 600, deltaY: -80 }) },
    { action: 'undock', nextScrollTop: 0 }
  );
});

test('docked page is frozen while the active table remains the vertical scroll owner', () => {
  const js = fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/table_scroll_fix.css'), 'utf8');

  assert.match(js, /addEventListener\(['"]wheel['"][^\n]*\{\s*passive:\s*false\s*\}/,
    'wheel transfer must be able to prevent outer page scrolling');
  assert.match(js, /addEventListener\(['"]touchmove['"][^\n]*\{\s*passive:\s*false\s*\}/,
    'touch transfer must be able to prevent outer page scrolling');

  assert.match(css, /html\.rz-table-page-docked\s*\{[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(css, /body\.rz-table-page-docked\s*\{[^}]*position:\s*fixed\s*!important[^}]*top:\s*var\(--rz-table-lock-offset\)[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(css, /body\.rz-table-page-docked\s+\.rz-table-viewport-scroll\s*\{[^}]*overflow:\s*auto\s*!important/s);
});

test('all nine long-table pages load adaptive scroll revision 4', () => {
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_viewport_lock\.js\?[^"']*adaptive=4/, `${file} must load two-stage JS revision 4`);
    assert.match(src, /table_scroll_fix\.css\?[^"']*adaptive=4/, `${file} must load two-stage CSS revision 4`);
  }
});
