const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const stretchOffPages = ['admin.html', 'finance.html', 'jobs_table.html', 'parts.html'];
const stretchOnPages = ['history.html', 'jobs.html', 'repair.html', 'repair_date_update.html', 'repair_export.html'];
const pages = [...stretchOffPages, ...stretchOnPages];

function loadHelper() {
  const context = { console, globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8'), context);
  return context.RizenicTableViewport;
}

test('adaptive runway shrinks exactly as page scroll is converted into table height', () => {
  const helper = loadHelper();
  assert.equal(typeof helper.calculateRunway, 'function');
  assert.equal(helper.calculateRunway({ dockTargetY: 320, scrollY: 0 }), 320);
  assert.equal(helper.calculateRunway({ dockTargetY: 320, scrollY: 120 }), 200);
  assert.equal(helper.calculateRunway({ dockTargetY: 320, scrollY: 320 }), 0);
  assert.equal(helper.calculateRunway({ dockTargetY: 320, scrollY: 500 }), 0);
});

test('adaptive helper must not preserve the previous spacer height while scrolling', () => {
  const js = fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8');
  assert.doesNotMatch(js, /Math\.max\(previous,\s*remaining/,
    'keeping the largest spacer leaves a blank tail below pagination');
  assert.doesNotMatch(js, /previous\s*=\s*parseFloat\(activeMain\.style\.getPropertyValue\(['"]--rz-table-dock-spacer-height/,
    'adaptive runway must be recomputed from current scroll, not historical maximum');
});

test('all audited table pages keep revision 4 while only the approved four opt out of adaptive growth', () => {
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_viewport_lock\.js\?[^"']*adaptive=4/, `${file} must load adaptive grow JS revision 4`);
    assert.match(src, /table_scroll_fix\.css\?[^"']*adaptive=4/, `${file} must load adaptive grow CSS revision 4`);
  }
  for (const file of stretchOffPages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /data-rz-table-dock=["']off["']/, `${file} must disable adaptive table growth`);
  }
  for (const file of stretchOnPages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.doesNotMatch(src, /data-rz-table-dock=["']off["']/, `${file} must keep adaptive table growth`);
  }
});

test('adaptive CSS keeps the runway inside main flow and removes it completely at the end', () => {
  const css = fs.readFileSync(path.join(root, 'public/table_scroll_fix.css'), 'utf8');
  assert.match(css, /main\.rz-table-main-ready::after\s*\{[^}]*height:\s*var\(--rz-table-dock-spacer-height,\s*0px\)/s);
  assert.match(css, /body\.rz-table-page-docked\s*\{[^}]*position:\s*fixed\s*!important/s,
    'revision 4 freezes the outer page only after the table reaches its dock point');
});
