const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('repair counted headers reserve separate non-shrinking slots for title, count, sort and filter', () => {
  const js = read('public/repair.js');
  assert.match(js, /class="rz-th-title[^\"]*"/);
  assert.match(js, /class="rz-th-tools[^\"]*"/);
  assert.match(js, /class="rz-th-count[^\"]*"/);
  assert.match(js, /sort-icon[^\"]*shrink-0/);
  assert.match(js, /filter-icon[^\"]*shrink-0/);
});

test('repair menus use body-level floating panels so sticky tables cannot cover them', () => {
  const html = read('public/repair.html');
  const floating = read('public/floating_menu.js');
  assert.match(html, /data-rz-floating-menu="columns"/);
  assert.match(html, /data-rz-floating-menu="more"/);
  assert.match(html, /data-rz-menu-panel/);
  assert.match(floating, /document\.body\.appendChild\(panel\)/);
  assert.match(floating, /spaceBelow/);
  assert.match(floating, /spaceAbove/);
});
