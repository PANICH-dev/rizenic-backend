const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const cssPath = path.join(root, 'public', 'table_scroll_fix.css');
const marker = '/* RIZENIC non-locked sticky header leak fix v1.6 */';
const block = `

${marker}
/*
 * Multi-table pages such as Parts and Jobs do not enter rz-table-page-lock.
 * Their local styles make every TH sticky independently, which can let tbody
 * text ghost/leak above the green header in Chromium while scrolling.
 * Keep one sticky THEAD layer and force its TH cells back to normal positioning.
 */
table.modern-table > thead,
table.excel-table-green > thead {
    position: sticky !important;
    top: 0 !important;
    z-index: 70 !important;
    isolation: isolate;
    background: #00320D !important;
}

table.modern-table > thead > tr > th,
table.excel-table-green > thead > tr > th {
    position: relative !important;
    top: auto !important;
    z-index: 1 !important;
    background-clip: padding-box;
}

table.modern-table > tbody,
table.excel-table-green > tbody {
    position: relative;
    z-index: 0;
}
`;

function mustRead(file) {
  if (!fs.existsSync(file)) throw new Error(`ไม่พบไฟล์: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function backupOnce(file) {
  const backup = `${file}.backup-before-sticky-leak-v16`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

let css = mustRead(cssPath);
backupOnce(cssPath);
if (!css.includes(marker)) css += block;
css = css.replace(/RIZENIC table scroll containment v1\.\d+/, 'RIZENIC table scroll containment v1.6');
fs.writeFileSync(cssPath, css);

const pages = [
  'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
  'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html',
  'repair_date_update.html', 'repair_export.html'
];

for (const name of pages) {
  const file = path.join(root, 'public', name);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (!/table_scroll_fix\.css\?v=[^"']+/.test(html)) continue;
  backupOnce(file);
  html = html.replace(/table_scroll_fix\.css\?v=[^"']+/g, 'table_scroll_fix.css?v=1.6');
  fs.writeFileSync(file, html);
}

// Keep version-only regression assertions aligned with the cache-bust version.
const testDir = path.join(root, 'test');
if (fs.existsSync(testDir)) {
  for (const entry of fs.readdirSync(testDir)) {
    if (!entry.endsWith('.test.js')) continue;
    const file = path.join(testDir, entry);
    let t = fs.readFileSync(file, 'utf8');
    if (!t.includes('table_scroll_fix')) continue;
    t = t.replace(/table_scroll_fix\\\.css\\\?v=1\\\.5/g, 'table_scroll_fix\\.css\\?v=1\\.6');
    t = t.replace(/CSS v1\.5/g, 'CSS v1.6');
    t = t.replace(/shared CSS v1\.5/g, 'shared CSS v1.6');
    t = t.replace(/viewport-lock CSS v1\.5/g, 'viewport-lock CSS v1.6');
    t = t.replace(/containment CSS v1\.5/g, 'containment CSS v1.6');
    fs.writeFileSync(file, t);
  }
}



