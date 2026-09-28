const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(name => name.endsWith('.html'));

const externalAssets = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0'
];

test('runtime HTML uses local supplied Tailwind and Chart assets instead of the three external URLs', () => {
  const combined = htmlFiles.map(name => fs.readFileSync(path.join(publicDir, name), 'utf8')).join('\n');
  for (const url of externalAssets) assert.doesNotMatch(combined, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(combined, /\/vendor\/tailwindcss\.js/);
  assert.match(combined, /\/compiled\/dashboard\.tailwind\.css/);
  assert.match(combined, /\/vendor\/chart\.umd\.min\.js/);
  assert.match(combined, /\/vendor\/chartjs-plugin-datalabels\.min\.js/);
});

test('local vendor files exist and contain the supplied library signatures', () => {
  const tailwind = fs.readFileSync(path.join(publicDir, 'vendor/tailwindcss.js'), 'utf8');
  const chart = fs.readFileSync(path.join(publicDir, 'vendor/chart.umd.min.js'), 'utf8');
  const labels = fs.readFileSync(path.join(publicDir, 'vendor/chartjs-plugin-datalabels.min.js'), 'utf8');
  assert.match(tailwind, /tailwind|preflight|content-problems/i);
  assert.match(chart, /Chart\.js v4\.5\.1/);
  assert.match(labels, /chartjs-plugin-datalabels v2\.0\.0/);
});

test('app declares long-lived cache handling for local vendor assets', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /vendor\$\{path\.sep\}/);
  assert.match(app, /immutable/i);
  assert.match(app, /max-age=31536000/i);
});
