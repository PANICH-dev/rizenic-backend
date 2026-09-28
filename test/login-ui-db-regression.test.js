const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('precompiled index CSS preserves the custom login form styling from legacy Tailwind blocks', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'compiled', 'index.tailwind.css'), 'utf8');
  for (const selector of ['.minimal-input', '.label-text', '.card-container', '.section-header', '.modern-table']) {
    assert.match(css, new RegExp(selector.replace('.', '\\.') + '[{,:]'), `missing ${selector} in compiled CSS`);
  }
  assert.match(css, /font-family:\s*['"]?Prompt/i, 'Prompt body font must survive precompile');
});

test('Tailwind precompile injects custom @apply styles before the browser runtime executes', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'build_static_tailwind.py'), 'utf8');
  const fn = src.slice(src.indexOf('def make_compile_html'), src.indexOf('def main'));
  assert.ok(fn.indexOf('<style type="text/tailwindcss">') < fn.indexOf('<script>{runtime_js}</script>'), 'custom Tailwind style must exist before runtime script');
});

test('database pool configuration does not force SSL when deployment did not request it', () => {
  const { buildPoolConfig } = require('../db_config');
  const cfg = buildPoolConfig({ DATABASE_URL: 'postgres://u:p@192.168.1.20:5432/rizenic' });
  assert.equal(Object.prototype.hasOwnProperty.call(cfg, 'ssl'), false);
});

test('database SSL can be explicitly disabled, required, or verified without changing DATABASE_URL', () => {
  const { buildPoolConfig } = require('../db_config');
  assert.equal(buildPoolConfig({ DATABASE_URL: 'postgres://x', PG_SSL_MODE: 'disable' }).ssl, false);
  assert.deepEqual(buildPoolConfig({ DATABASE_URL: 'postgres://x', PG_SSL_MODE: 'require' }).ssl, { rejectUnauthorized: false });
  assert.deepEqual(buildPoolConfig({ DATABASE_URL: 'postgres://x', PG_SSL_MODE: 'verify' }).ssl, { rejectUnauthorized: true });
});

test('pages cache-bust the corrected precompiled Tailwind CSS', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(html, /\/compiled\/index\.tailwind\.css\?v=1\.1/);
});
