const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(html|js|css)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

const allowedBrowserPrefixes = [
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0/dist/chartjs-plugin-datalabels.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family='
];

test('browser external assets are limited to the approved pinned CDN/font URLs', () => {
  const root = path.join(__dirname, '..', 'public');
  const bad = [];
  const found = [];
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/https?:\/\/[^\s"'<>)}]+/g)) {
      const url = match[0];
      if (url === 'http://www.w3.org/2000/svg') continue;
      found.push(url);
      if (!allowedBrowserPrefixes.some(prefix => url.startsWith(prefix))) {
        bad.push(`${path.relative(root, file)}: ${url}`);
      }
    }
  }
  assert.deepEqual(bad, []);
  for (const prefix of allowedBrowserPrefixes) {
    assert.ok(found.some(url => url.startsWith(prefix)), `approved browser asset is not referenced: ${prefix}`);
  }
});

test('backend external network is limited to LINE messaging API', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const urls = [...app.matchAll(/https?:\/\/[^\s"'<>)}]+/g)].map(m => m[0]);
  assert.deepEqual([...new Set(urls)], ['https://api.line.me/v2/bot/message/push']);
});
