const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('local PostgreSQL can disable SSL through PG_SSL_MODE without changing remote default', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(app, /PG_SSL_MODE/);
  assert.match(app, /===\s*['"]disable['"]\s*\?\s*false/);
  assert.match(app, /rejectUnauthorized:\s*false/);
  assert.doesNotMatch(app, /ssl:\s*\{\s*rejectUnauthorized:\s*false\s*\}\s*\n?\s*\}\);/);
});
