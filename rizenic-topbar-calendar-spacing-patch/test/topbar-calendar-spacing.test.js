const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('index loads robust fixed topbar lock assets', () => {
  const html = read('public/index.html');
  assert.match(html, /topbar_lock\.css\?v=1\.0/);
  assert.match(html, /topbar_lock\.js\?v=1\.0/);
});

test('topbar lock forces viewport-fixed positioning and maintains a spacer', () => {
  const css = read('public/topbar_lock.css');
  const js = read('public/topbar_lock.js');
  assert.match(css, /position:\s*fixed\s*!important/);
  assert.match(css, /top:\s*0\s*!important/);
  assert.match(css, /z-index:\s*1000/);
  assert.match(js, /ResizeObserver/);
  assert.match(js, /main-topbar-spacer|rz-topbar-spacer/);
});

test('dashboard calendar has safe outer and inner edge spacing', () => {
  const html = read('public/dashboard.html');
  const css = read('public/dashboard_edge_spacing.css');
  assert.match(html, /dashboard_edge_spacing\.css\?v=1\.0/);
  assert.match(css, /\.dashboard-shell[\s\S]*width:\s*calc\(100%\s*-\s*48px\)/);
  assert.match(css, /:has\(>\s*#calendar_grid\)[\s\S]*padding:\s*26px\s+30px\s+32px/);
  assert.match(css, /#calendar_grid[\s\S]*padding:\s*4px\s+6px\s+10px/);
});
