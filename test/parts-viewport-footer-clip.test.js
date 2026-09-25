const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function buildDom() {
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
      classList: {
        contains(name) { return classSet.has(name); },
        add(name) { classSet.add(name); },
        remove(name) { classSet.delete(name); }
      },
      matches(selector) {
        if (selector === '.table-container') return classSet.has('table-container');
        if (selector === '.overflow-auto') return classSet.has('overflow-auto');
        if (selector === '.overflow-x-auto') return classSet.has('overflow-x-auto');
        if (selector === '.rz-table-scroll-surface') return classSet.has('rz-table-scroll-surface');
        if (selector === '.rz-table-clip-shell') return classSet.has('rz-table-clip-shell');
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
  const html = node({ tagName: 'HTML' });
  const body = node({ tagName: 'BODY' });
  const card = node({ classes: ['card-container'] });
  const shell = node({ classes: ['rz-table-clip-shell'] });
  const scroller = node({ classes: ['rz-table-scroll-surface', 'overflow-auto'] });
  const table = node({ tagName: 'TABLE', id: 'saTable' });
  body.insertBefore(card, null);
  card.insertBefore(shell, null);
  shell.insertBefore(scroller, null);
  scroller.insertBefore(table, null);
  const document = {
    body,
    documentElement: html,
    getElementById(id) { return ids.get(id) || null; },
    createElement(tag) { return node({ tagName: tag.toUpperCase() }); }
  };
  return { ids, html, body, card, shell, scroller, table, document };
}

test('pagination for a clipped table mounts after the clip shell so the footer cannot be hidden', () => {
  const dom = buildDom();
  const context = {
    console,
    document: dom.document,
    window: { getComputedStyle: () => ({ overflowX: 'auto', overflowY: 'auto' }) }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8'), context);
  context.window.RizenicPagination.renderControls({
    anchorId: 'saTable', containerId: 'sa_alerts_pagination',
    pageInfo: { page: 1, totalPages: 6, total: 298, startNumber: 1, endNumber: 50 },
    onPageChange() {}, noun: 'รายการ'
  });
  const pager = dom.ids.get('sa_alerts_pagination');
  assert.ok(pager);
  assert.equal(pager.parentNode, dom.card);
  assert.deepEqual(dom.card.children, [dom.shell, pager]);
  assert.deepEqual(dom.shell.children, [dom.scroller]);
});

test('viewport height reservation accounts for pagination outside a clip shell', () => {
  const js = fs.readFileSync(path.join(root, 'public/table_viewport_lock.js'), 'utf8');
  assert.match(js, /closestClipShell/);
  assert.match(js, /reservedSiblingHeight\(host\)[\s\S]*closestClipShell\(host\)/);
});

test('clip shell has an opaque top guard to hide Chromium row paint leakage above the sticky header', () => {
  const css = fs.readFileSync(path.join(root, 'public/table_scroll_fix.css'), 'utf8');
  assert.match(css, /\.rz-table-clip-shell::before\s*\{[\s\S]*height:\s*[3-6]px[\s\S]*background:\s*#00320D[\s\S]*z-index:\s*1\d\d/s);
});

test('parts loads cache-busted table helpers after footer and clip fix', () => {
  const html = fs.readFileSync(path.join(root, 'public/parts.html'), 'utf8');
  assert.match(html, /table_scroll_fix\.css\?v=1\.6&partsfix=1/);
  assert.match(html, /table_pagination\.js\?v=1\.1&partsfix=1/);
  assert.match(html, /table_viewport_lock\.js\?v=1\.0&partsfix=1/);
});
