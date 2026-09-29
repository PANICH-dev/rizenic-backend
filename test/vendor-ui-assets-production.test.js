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

test('Vercel only bundles application public files and no node_modules browser vendors', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const nodeBuild = (vercel.builds || []).find((b) => b.src === 'app.js');
  assert.ok(nodeBuild, 'app.js Vercel build is required');
  const include = (nodeBuild.config && nodeBuild.config.includeFiles) || [];
  assert.deepEqual(include, ['public/**']);
});

test('every standalone page that renders Font Awesome icons loads pinned external Font Awesome CSS', () => {
  const expected = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css';
  for (const name of htmlFiles()) {
    const html = read(`public/${name}`);
    if (!/<html\b/i.test(html) || !/\bfa-(?:solid|regular|brands)\b/.test(html)) continue;
    assert.ok(html.includes(`href="${expected}"`) || html.includes(`href='${expected}'`), `${name} does not load pinned Font Awesome CDN CSS`);
  }
});

test('standalone pages keep their Thai font families through Google Fonts', () => {
  const expectedFamily = {
    'index.html': 'Prompt',
    'repair_board.html': 'Noto+Sans+Thai'
  };
  const kanitPages = [
    'admin.html','dashboard.html','finance.html','history.html','jobs.html','jobs_table.html',
    'parts.html','repair.html','repair_date_update.html','repair_export.html'
  ];
  for (const name of kanitPages) expectedFamily[name] = 'Kanit';
  for (const [name, family] of Object.entries(expectedFamily)) {
    const html = read(`public/${name}`);
    const escapedFamily = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(html, new RegExp(`https://fonts\\.googleapis\\.com/css2\\?family=${escapedFamily}`), `${name} lost its external Thai font stylesheet`);
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
