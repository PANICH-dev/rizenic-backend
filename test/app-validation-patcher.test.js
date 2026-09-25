const test = require('node:test');
const assert = require('node:assert/strict');
const { patchAppSource } = require('../tools/patch-app-validation');

test('patcher registers validation without replacing the existing Pool/SSL configuration', () => {
  const source = `const { Pool } = require('pg');\nconst app = express();\nconst pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n  ssl: isLocalDb ? false : { rejectUnauthorized: false }\n});\n\napp.get('/api/x', () => {});\n`;
  const patched = patchAppSource(source);
  assert.match(patched, /backend_validation/);
  assert.match(patched, /registerApiValidation\(app, pool\)/);
  assert.match(patched, /ssl: isLocalDb \? false : \{ rejectUnauthorized: false \}/);
  assert.equal((patched.match(/registerApiValidation\(app, pool\)/g) || []).length, 1);
  assert.equal(patchAppSource(patched), patched, 'patcher must be idempotent');
});
