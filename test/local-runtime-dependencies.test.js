const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:html|css|js)$/.test(entry.name) ? [full] : [];
  });
}

test('browser UI libraries use pinned external CDNs instead of local /vendor runtime assets', () => {
  const files = walk(publicDir);
  const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.match(combined, /cdn\.jsdelivr\.net\/npm\/@fortawesome\/fontawesome-free@6\.5\.1\/css\/all\.min\.css/);
  assert.match(combined, /fonts\.googleapis\.com\/css2\?family=(?:Kanit|Prompt|Noto\+Sans\+Thai)/);
  assert.match(combined, /cdn\.jsdelivr\.net\/npm\/chart\.js@4\.5\.1\/dist\/chart\.umd\.min\.js/);
  assert.match(combined, /cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js/);

  assert.doesNotMatch(combined, /["']\/vendor\//, 'browser source still references local /vendor runtime assets');
});

test('app no longer mounts local browser dependency routes from node_modules', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.doesNotMatch(app, /localVendorRoutes/);
  assert.doesNotMatch(app, /app\.use\(['"]\/vendor['"]/);
  assert.doesNotMatch(app, /@fortawesome|@fontsource|node_modules['"], ['"]xlsx/);
});

test('package no longer installs browser-only font, icon, or XLSX vendor packages', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
  assert.equal(pkg.scripts && pkg.scripts.postinstall, undefined);
  assert.equal(deps['@fortawesome/fontawesome-free'], undefined);
  assert.equal(deps['@fontsource/kanit'], undefined);
  assert.equal(deps['@fontsource/prompt'], undefined);
  assert.equal(deps['@fontsource/noto-sans-thai'], undefined);
  assert.equal(deps.xlsx, undefined);
  assert.equal(fs.existsSync(path.join(root, 'tools', 'vendor-runtime-assets.js')), false);
});
