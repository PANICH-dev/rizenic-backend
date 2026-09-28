const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor') continue;
      out.push(...walk(p));
    } else if (/\.(html|js|css)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

test('browser runtime has no external http assets outside embedded SVG namespace', () => {
  const root = path.join(__dirname, '..', 'public');
  const bad = [];
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/https?:\/\/[^\s"'<>)}]+/g)) {
      const url = match[0];
      if (url === 'http://www.w3.org/2000/svg') continue;
      bad.push(`${path.relative(root, file)}: ${url}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('backend external network is limited to LINE messaging API', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const urls = [...app.matchAll(/https?:\/\/[^\s"'<>)}]+/g)].map(m => m[0]);
  assert.deepEqual([...new Set(urls)], ['https://api.line.me/v2/bot/message/push']);
});
