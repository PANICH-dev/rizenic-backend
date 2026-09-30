const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('starter can rebuild the known local env from .env.example when old project envs were deleted', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'START_FAST.command'), 'utf8');
  assert.match(script, /\.env\.example/);
  assert.match(script, /cp\s+"\$PROJECT_DIR\/\.env\.example"\s+"\$PROJECT_DIR\/\.env"/);
  assert.match(script, /PG_SSL_MODE=disable/);
});
