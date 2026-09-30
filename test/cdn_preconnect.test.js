const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const hostMap = [
  ['cdn.tailwindcss.com', 'https://cdn.tailwindcss.com'],
  ['cdnjs.cloudflare.com', 'https://cdnjs.cloudflare.com'],
  ['cdn.jsdelivr.net', 'https://cdn.jsdelivr.net'],
  ['cdn.sheetjs.com', 'https://cdn.sheetjs.com'],
  ['fonts.googleapis.com', 'https://fonts.googleapis.com'],
  ['fonts.gstatic.com', 'https://fonts.gstatic.com'],
];

test('pages that use remote UI assets preconnect to their hosts', () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
    for (const [needle, origin] of hostMap) {
      const needsHost = needle === 'fonts.gstatic.com'
        ? html.includes('fonts.googleapis.com')
        : html.includes(needle);
      if (!needsHost) continue;
      assert.match(html, new RegExp(`<link\\s+rel=["']preconnect["']\\s+href=["']${origin.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`), `${file} missing preconnect for ${origin}`);
    }
  }
});
