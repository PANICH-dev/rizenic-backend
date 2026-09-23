const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('table scroller disables local rubber-band overscroll to prevent blank top gap', () => {
  const css = read('public/table_scroll_fix.css');
  assert.match(css, /body\.rz-table-page-lock\s+\.rz-table-viewport-scroll\s*\{[^}]*overscroll-behavior:\s*none\s*;/s);
});

test('repair finish date display overlay is transparent and native date text is hidden until interaction', () => {
  const html = read('public/repair.html');
  const js = read('public/repair.js');
  assert.match(html, /\.repair-date-display\s*\{[^}]*background:\s*transparent/s);
  assert.match(html, /\.repair-date-input\s*\{[^}]*color:\s*transparent\s*!important/s);
  assert.match(html, /\.group:hover\s+\.repair-date-input[^}]*color:\s*#00320D\s*!important/s);
  assert.match(js, /class="repair-date-display[^\"]*"/);
  assert.match(js, /class="inline-edit-input repair-date-input[^\"]*"/);
  assert.match(html, /repair\.js\?v=7/);
  assert.doesNotMatch(js, /repair_finish_date[\s\S]{0,500}bg-white\s+z-10/);
});

test('index starts auth-pending so the login screen cannot flash before session check', () => {
  const html = read('public/index.html');
  const core = read('public/sa_core.js');
  assert.match(html, /<html[^>]*class="auth-pending"/);
  assert.match(html, /html\.auth-pending\s+body\s*\{[^}]*visibility:\s*hidden\s*!important/s);
  assert.match(core, /function\s+releaseAuthPaintGuard\s*\(/);
  assert.match(core, /document\.documentElement\.classList\.remove\(['"]auth-pending['"]\)/);
  assert.match(core, /if\(sessionStorage\.getItem\('isLoggedIn'\) !== 'true'\)[\s\S]{0,450}releaseAuthPaintGuard\(\)/);
  assert.match(core, /enterApp\(\);\s*releaseAuthPaintGuard\(\);/);
  assert.match(html, /sa_core\.js\?v=19\.2/);
});
