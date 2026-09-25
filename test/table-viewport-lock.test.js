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

test('table viewport height reserves pagination/footer space so page itself does not need to scroll', () => {
  const helper = loadHelper();
  assert.equal(helper.calculateHeight({ viewportHeight: 900, top: 240, reservedBelow: 92, gap: 8 }), 560);
  assert.equal(helper.calculateHeight({ viewportHeight: 500, top: 420, reservedBelow: 100, gap: 8 }), 160, 'keeps a usable minimum table viewport');
});

test('long-table pages load viewport lock helper and shared CSS v1.6', () => {
  const pages = [
    'repair_date_update.html', 'repair_export.html', 'jobs_table.html', 'repair.html',
    'history.html', 'jobs.html', 'finance.html', 'parts.html', 'admin.html'
  ];
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_scroll_fix\.css\?v=1\.6/, `${file} must load viewport-lock CSS v1.6`);
    assert.match(src, /table_viewport_lock\.js\?v=1\.0/, `${file} must load viewport-lock helper`);
  }
});

test('viewport lock CSS fixes the outer page and delegates both axes to the active table scroller', () => {
  const css = fs.readFileSync(path.join(root, 'public/table_scroll_fix.css'), 'utf8');
  assert.match(css, /body\.rz-table-page-lock\s*\{[^}]*height:\s*100(?:dvh|vh)[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(css, /body\.rz-table-page-lock\s+main\s*\{[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(css, /\.rz-table-viewport-scroll\s*\{[^}]*overflow:\s*auto\s*!important/s);
});
