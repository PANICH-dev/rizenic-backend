const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(name => name.endsWith('.html'));

test('runtime HTML keeps Tailwind precompiled locally but loads Chart libraries from pinned CDN URLs', () => {
  const combined = htmlFiles.map(name => fs.readFileSync(path.join(publicDir, name), 'utf8')).join('\n');
  assert.doesNotMatch(combined, /cdn\.tailwindcss\.com/);
  assert.doesNotMatch(combined, /\/vendor\/tailwindcss\.js/);
  assert.match(combined, /\/compiled\/dashboard\.tailwind\.css/);
  assert.match(combined, /https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@4\.5\.1\/dist\/chart\.umd\.min\.js/);
  assert.match(combined, /https:\/\/cdn\.jsdelivr\.net\/npm\/chartjs-plugin-datalabels@2\.0\.0\/dist\/chartjs-plugin-datalabels\.min\.js/);
});

test('local browser vendor bundle is no longer required', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts && pkg.scripts.postinstall, undefined);
  assert.equal(fs.existsSync(path.join(publicDir, 'vendor')), false);
  assert.equal(fs.existsSync(path.join(root, 'tools/vendor-runtime-assets.js')), false);
});

test('app does not declare local /vendor cache or node_modules vendor mounts', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /localVendorRoutes/);
  assert.doesNotMatch(app, /app\.use\(['"]\/vendor['"]/);
});
