const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');

test('repair header menus use the shared body-level floating menu layer', () => {
  const html = fs.readFileSync(path.join(pub, 'repair.html'), 'utf8');
  assert.match(html, /data-rz-floating-menu="columns"/);
  assert.match(html, /data-rz-floating-menu="more"/);
  assert.match(html, /floating_menu\.js\?v=1\.0/);
});

test('floating menu layer portals panels to body and flips/clamps inside viewport', () => {
  const js = fs.readFileSync(path.join(pub, 'floating_menu.js'), 'utf8');
  assert.match(js, /document\.body\.appendChild/);
  assert.match(js, /position\s*=\s*['"]fixed['"]/);
  assert.match(js, /spaceBelow/);
  assert.match(js, /spaceAbove/);
  assert.match(js, /Math\.min\(/);
  assert.match(js, /Escape/);
});
