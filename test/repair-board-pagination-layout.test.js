const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'repair.html'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'public', 'table_viewport_lock.js'), 'utf8');

test('repair participates in shared two-stage adaptive table scrolling so pagination stays attached without a white tail', () => {
  assert.doesNotMatch(html, /<body[^>]*data-rz-table-dock=["']off["'][^>]*>/i,
    'repair.html must not opt out of the shared adaptive table behavior');
  assert.match(html, /table_viewport_lock\.js\?[^"']*adaptive=4/,
    'repair.html must use the shared two-stage scroll revision');
  assert.match(helper, /calculateRunway/,
    'shared helper must shrink the temporary page runway while the table grows');
});
