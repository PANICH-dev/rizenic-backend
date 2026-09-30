const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'public');
const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

test('Google font stylesheets are linked directly, not imported inside Tailwind runtime CSS', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    assert.doesNotMatch(html, /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/i, `${page} still uses blocking runtime @import`);
    if (html.includes('fonts.googleapis.com')) {
      assert.match(html, /<link[^>]+rel=["']stylesheet["'][^>]+href=["']https:\/\/fonts\.googleapis\.com/i, `${page} missing direct font stylesheet link`);
    }
  }
});

test('heavy Chart/XLSX scripts are not parser-blocking in head', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    const head = (html.match(/<head>[\s\S]*?<\/head>/i) || [''])[0];
    assert.doesNotMatch(head, /cdn\.jsdelivr\.net\/npm\/chart\.js/i, `${page} loads Chart.js in head`);
    assert.doesNotMatch(head, /chartjs-plugin-datalabels/i, `${page} loads chart datalabels in head`);
    assert.doesNotMatch(head, /xlsx(?:\.full)?\.min\.js|cdn\.sheetjs\.com\/xlsx-/i, `${page} loads XLSX in head`);
  }
});
