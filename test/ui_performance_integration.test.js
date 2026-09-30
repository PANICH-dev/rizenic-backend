const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pages = [
  'admin.html', 'dashboard.html', 'finance.html', 'history.html', 'index.html',
  'jobs.html', 'jobs_table.html', 'parts.html', 'repair.html', 'repair_board.html',
  'repair_date_update.html', 'repair_export.html'
];

test('all data-table pages load the local UI performance layer', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
    assert.match(html, /ui_performance\.css/, `${page} missing ui_performance.css`);
    assert.match(html, /ui_performance\.js/, `${page} missing ui_performance.js`);
  }
});
