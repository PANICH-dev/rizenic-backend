const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPagedReportsReadQuery } = require('../read_queries');

test('paged reports returns total count from same SQL scan via window count', () => {
  const q = buildPagedReportsReadQuery({ paged: '1', page: '2', limit: '50', branch: 'A' });
  assert.match(q.text, /COUNT\(\*\) OVER\(\) AS __total_count/i);
  assert.match(q.text, /LIMIT \$\d+ OFFSET \$\d+/i);
});

test('reports route uses page rows total count first and count query only as empty-page fallback', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /rowsResult\.rows\[0\]\?\.__total_count/);
  assert.match(app, /if \(rowsResult\.rows\.length === 0 && pageQuery\.page > 1\)/);
  assert.doesNotMatch(app, /Promise\.all\(\[\s*pool\.query\(pageQuery\.text, pageQuery\.values\),\s*pool\.query\(countQuery\.text, countQuery\.values\)/s);
});
