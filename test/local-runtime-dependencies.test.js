const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor') return [];
      return walk(full);
    }
    return /\.(?:html|css|js)$/.test(entry.name) ? [full] : [];
  });
}

test('browser runtime assets do not call external CDN or Google Fonts hosts', () => {
  const files = walk(publicDir);
  const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbiddenHosts = [
    'cdn.tailwindcss.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];

  for (const host of forbiddenHosts) {
    assert.doesNotMatch(combined, new RegExp(host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `external runtime host remains: ${host}`);
  }

  assert.match(combined, /\/vendor\/fontawesome\/css\/all\.min\.css/);
  assert.match(combined, /\/vendor\/local-fonts\.css/);
  assert.match(combined, /\/vendor\/xlsx\/xlsx\.full\.min\.js/);
});

test('app serves only the required dependency folders through local vendor routes', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /\/vendor\/fontawesome/);
  assert.match(app, /\/vendor\/xlsx/);
  assert.match(app, /\/vendor\/fonts\/kanit/);
  assert.match(app, /\/vendor\/fonts\/prompt/);
  assert.match(app, /\/vendor\/fonts\/noto-sans-thai/);
});

test('package dependencies pin the local runtime libraries used by vendor routes', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
  assert.equal(deps['@fortawesome/fontawesome-free'], '6.5.1');
  assert.equal(deps.xlsx, '0.18.5');
  assert.ok(deps['@fontsource/kanit']);
  assert.ok(deps['@fontsource/prompt']);
  assert.ok(deps['@fontsource/noto-sans-thai']);
});
