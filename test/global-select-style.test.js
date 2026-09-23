const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');

test('all application HTML pages load the shared select/dropdown polish stylesheet', () => {
  const pages = fs.readdirSync(pub).filter(f => f.endsWith('.html') && fs.readFileSync(path.join(pub, f), 'utf8').includes('</head>'));
  const missing = pages.filter(f => !fs.readFileSync(path.join(pub, f), 'utf8').includes('ui_global.css?v=1.1'));
  assert.deepEqual(missing, []);
});

test('shared select style reserves arrow space and moves the native-looking arrow away from the right edge', () => {
  const css = fs.readFileSync(path.join(pub, 'ui_global.css'), 'utf8');
  assert.match(css, /select:not\(\[multiple\]\)/);
  assert.match(css, /appearance:\s*none/);
  assert.match(css, /background-position:\s*right 14px center/);
  assert.match(css, /padding-right:\s*2\.75rem/);
});
