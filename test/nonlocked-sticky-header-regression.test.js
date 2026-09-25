const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('parts/jobs multi-table pages use one sticky thead layer instead of sticky th cells', () => {
  const css = read('public/table_scroll_fix.css');
  assert.match(css, /RIZENIC non-locked sticky header leak fix v1\.6/);
  assert.match(css, /table\.modern-table\s*>\s*thead[\s\S]*position:\s*sticky\s*!important/s);
  assert.match(css, /table\.excel-table-green\s*>\s*thead[\s\S]*position:\s*sticky\s*!important/s);
  assert.match(css, /table\.modern-table\s*>\s*thead\s*>\s*tr\s*>\s*th[\s\S]*position:\s*relative\s*!important/s);
  assert.match(css, /table\.excel-table-green\s*>\s*thead\s*>\s*tr\s*>\s*th[\s\S]*position:\s*relative\s*!important/s);
  assert.match(css, /table\.modern-table\s*>\s*tbody[\s\S]*z-index:\s*0/s);
});

test('table pages cache-bust sticky leak fix v1.6', () => {
  const pages = [
    'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
    'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html',
    'repair_date_update.html', 'repair_export.html'
  ];
  for (const file of pages) {
    assert.match(read(`public/${file}`), /table_scroll_fix\.css\?v=1\.6/, `${file} must load CSS v1.6`);
  }
});
