const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function htmlFiles() {
  return fs.readdirSync(pub).filter((name) => name.endsWith('.html'));
}

test('Vercel bundles Font Awesome and all local Thai font packages used by vendor routes', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const nodeBuild = (vercel.builds || []).find((b) => b.src === 'app.js');
  assert.ok(nodeBuild, 'app.js Vercel build is required');
  const include = nodeBuild.config && nodeBuild.config.includeFiles;
  assert.ok(Array.isArray(include), 'app.js build must declare config.includeFiles');
  const joined = include.join('\n');
  assert.match(joined, /node_modules\/@fortawesome\/fontawesome-free\/\*\*/);
  assert.match(joined, /node_modules\/@fontsource\/kanit\/\*\*/);
  assert.match(joined, /node_modules\/@fontsource\/prompt\/\*\*/);
  assert.match(joined, /node_modules\/@fontsource\/noto-sans-thai\/\*\*/);
});

test('every standalone page that renders Font Awesome icons loads the local stylesheet with a cache revision', () => {
  for (const name of htmlFiles()) {
    const html = read(`public/${name}`);
    if (!/<html\b/i.test(html) || !/\bfa-(?:solid|regular|brands)\b/.test(html)) continue;
    assert.match(
      html,
      /href=["']\/vendor\/fontawesome\/css\/all\.min\.css\?v=6\.5\.1-rz2["']/,
      `${name} uses Font Awesome classes but does not load the versioned local stylesheet`
    );
  }
});

test('all local font helper styles point only at local vendor font routes', () => {
  for (const rel of [
    'public/vendor/local-fonts.css',
    'public/vendor/prompt-fonts.css',
    'public/vendor/noto-sans-thai-fonts.css'
  ]) {
    const css = read(rel);
    assert.doesNotMatch(css, /https?:\/\/|fonts\.googleapis|fonts\.gstatic/);
    assert.match(css, /@import url\('\/vendor\/fonts\//);
  }
});



test('standalone pages keep their original local Thai font families', () => {
  const expected = {
    'index.html': '/vendor/prompt-fonts.css',
    'repair_board.html': '/vendor/noto-sans-thai-fonts.css'
  };
  const kanitPages = [
    'admin.html','dashboard.html','finance.html','history.html','jobs.html','jobs_table.html',
    'parts.html','repair.html','repair_date_update.html','repair_export.html'
  ];
  for (const name of kanitPages) expected[name] = '/vendor/local-fonts.css';
  for (const [name, href] of Object.entries(expected)) {
    const html = read(`public/${name}`);
    assert.ok(html.includes(`href="${href}"`) || html.includes(`href='${href}'`) || html.includes(`href="${href}?`) || html.includes(`href='${href}?`), `${name} lost its local font helper`);
  }
});

test('adaptive table scrolling uses native page scroll before docking and contains overscroll after docking', () => {
  const css = read('public/table_scroll_fix.css');
  const adaptive = css.split('/* RIZENIC adaptive two-stage table scroll v4.0')[1] || '';
  assert.match(adaptive, /body\.rz-table-page-ready \.rz-table-viewport-scroll\s*\{[\s\S]{0,500}overscroll-behavior-y:\s*auto/,
    'stage 1 keeps the table compatible with normal page scrolling');
  assert.match(adaptive, /body\.rz-table-page-docked \.rz-table-viewport-scroll\s*\{[\s\S]{0,300}overscroll-behavior:\s*none\s*!important/,
    'stage 2 contains scrolling inside the table until JS explicitly releases upward at row one');
});
