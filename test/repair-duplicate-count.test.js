const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('repair board shows total only in pagination and does not render a duplicate bottom count', () => {
  const html = fs.readFileSync(path.join(root, 'public/repair.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public/repair.js'), 'utf8');
  const pagination = fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8');

  assert.doesNotMatch(html, /id=["']table_row_count["']/, 'repair page must not render the duplicate bottom total');
  assert.doesNotMatch(html, /พบข้อมูลรถ\s*<span[^>]*table_row_count/s, 'duplicate repair total footer must be removed');
  assert.doesNotMatch(js, /getElementById\(['"]table_row_count['"]\)/, 'repair renderer must not touch a removed count element');
  assert.match(pagination, /แสดง\s*<span[^>]*>\$\{startNumber\}-\$\{endNumber\}<\/span>\s*จาก\s*<span[^>]*>\$\{total\}<\/span>/s,
    'pagination remains the single visible total count');
  assert.match(html, /repair\.js\?v=9/, 'repair page must cache-bust the renderer after removing the old count element');
});
