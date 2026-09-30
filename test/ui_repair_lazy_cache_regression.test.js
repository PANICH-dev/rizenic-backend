const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repairHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'repair.html'), 'utf8');

test('repair page cache-busts repair.js after lazy Chart startup changed', () => {
  assert.match(repairHtml, /<script\s+src=["']repair\.js\?v=20260930-repair-lazy-cache-fix["']><\/script>/);
  assert.doesNotMatch(repairHtml, /repair\.js\?v=20260930-station-scope-fix/);
});
