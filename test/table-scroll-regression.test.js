const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadPagination() {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8'), context);
  return context.RizenicPagination;
}

function fakeNode({ tagName = 'DIV', classes = [], id = '' } = {}) {
  const classSet = new Set(classes);
  return {
    tagName,
    id,
    parentElement: null,
    parentNode: null,
    nextSibling: null,
    classList: {
      contains(name) { return classSet.has(name); },
      add(name) { classSet.add(name); }
    },
    matches(selector) {
      if (selector === '.table-container') return classSet.has('table-container');
      if (selector === '.overflow-auto') return classSet.has('overflow-auto');
      if (selector === '.overflow-x-auto') return classSet.has('overflow-x-auto');
      if (selector === '#tableContainer') return id === 'tableContainer';
      return false;
    }
  };
}

function append(parent, child) {
  child.parentElement = parent;
  child.parentNode = parent;
  return child;
}

test('pagination resolves the nearest table scroll host so controls can mount outside it', () => {
  const pager = loadPagination();
  assert.equal(typeof pager.findScrollHost, 'function');
  const shell = fakeNode({ classes: ['flex-1'] });
  const scroller = append(shell, fakeNode({ classes: ['overflow-auto'] }));
  const table = append(scroller, fakeNode({ tagName: 'TABLE' }));
  const tbody = append(table, fakeNode({ tagName: 'TBODY' }));
  assert.equal(pager.findScrollHost(tbody), scroller);
});

test('all application pages with scrollable data tables load the shared scroll containment stylesheet', () => {
  const pages = [
    'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
    'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html',
    'repair_date_update.html', 'repair_export.html'
  ];
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_scroll_fix\.css\?v=1\.6/, `${file} must load table scroll containment CSS v1.6`);
  }
});

test('repair table cannot be manually resized and the outer repair viewport stays locked', () => {
  const src = fs.readFileSync(path.join(root, 'public/repair.html'), 'utf8');
  assert.doesNotMatch(src, /resize:\s*both/);
  assert.match(src, /<main class="[^"]*repair-main[^"]*overflow-hidden[^"]*"/);
  assert.match(src, /class="table-container flex-1"/);
});

test('finance keeps vertical page scrolling but prevents page-level horizontal scrolling', () => {
  const src = fs.readFileSync(path.join(root, 'public/finance.html'), 'utf8');
  assert.match(src, /<main class="[^"]*overflow-y-auto[^"]*overflow-x-hidden[^"]*"/);
});

test('paginated pages cache-bust the pagination helper after scroll mounting fix', () => {
  const pages = [
    'repair_date_update.html', 'repair_export.html', 'jobs_table.html', 'repair.html',
    'history.html', 'jobs.html', 'finance.html', 'parts.html', 'admin.html'
  ];
  for (const file of pages) {
    const src = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(src, /table_pagination\.js\?v=1\.1/, `${file} must load pagination helper v1.1`);
  }
});

test('renderControls mounts pagination after the table scroller instead of inside the horizontal scroll area', () => {
  const ids = new Map();
  function node({ tagName = 'DIV', classes = [], id = '' } = {}) {
    const classSet = new Set(classes);
    const n = {
      tagName,
      id,
      parentElement: null,
      parentNode: null,
      nextSibling: null,
      children: [],
      className: '',
      innerHTML: '',
      disabled: false,
      classList: { contains: x => classSet.has(x), add: x => classSet.add(x) },
      matches(selector) {
        if (selector === '.table-container') return classSet.has('table-container');
        if (selector === '.overflow-auto') return classSet.has('overflow-auto');
        if (selector === '.overflow-x-auto') return classSet.has('overflow-x-auto');
        if (selector === '#tableContainer') return id === 'tableContainer';
        return false;
      },
      insertBefore(child, before) {
        if (child.parentNode && child.parentNode.children) {
          child.parentNode.children = child.parentNode.children.filter(c => c !== child);
        }
        const idx = before ? this.children.indexOf(before) : -1;
        if (idx >= 0) this.children.splice(idx, 0, child);
        else this.children.push(child);
        child.parentNode = this;
        child.parentElement = this;
        this.children.forEach((c, i) => { c.nextSibling = this.children[i + 1] || null; });
        if (child.id) ids.set(child.id, child);
      },
      querySelectorAll() { return []; }
    };
    if (id) ids.set(id, n);
    return n;
  }

  const body = node({ tagName: 'BODY' });
  const html = node({ tagName: 'HTML' });
  const shell = node({ classes: ['flex-1'] });
  const scroller = node({ classes: ['overflow-auto'] });
  const table = node({ tagName: 'TABLE', id: 'demoTable' });
  shell.insertBefore(scroller, null);
  scroller.insertBefore(table, null);
  shell.parentNode = body;
  shell.parentElement = body;

  const document = {
    body,
    documentElement: html,
    getElementById(id) { return ids.get(id) || null; },
    createElement(tag) { return node({ tagName: tag.toUpperCase() }); }
  };
  const context = { console, document, window: { getComputedStyle: () => ({ overflowX: 'visible', overflowY: 'visible' }) } };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8'), context);
  context.window.RizenicPagination.renderControls({
    anchorId: 'demoTable', containerId: 'demo_pager',
    pageInfo: { page: 1, totalPages: 2, total: 78, startNumber: 1, endNumber: 50 },
    onPageChange() {}, noun: 'คัน'
  });

  const pager = ids.get('demo_pager');
  assert.ok(pager);
  assert.equal(pager.parentNode, shell);
  assert.deepEqual(shell.children, [scroller, pager]);
  assert.deepEqual(scroller.children, [table]);

  // Re-rendering the same page must keep one pager in the same fixed position.
  context.window.RizenicPagination.renderControls({
    anchorId: 'demoTable', containerId: 'demo_pager',
    pageInfo: { page: 2, totalPages: 2, total: 78, startNumber: 51, endNumber: 78 },
    onPageChange() {}, noun: 'คัน'
  });
  assert.deepEqual(shell.children, [scroller, pager]);
});
