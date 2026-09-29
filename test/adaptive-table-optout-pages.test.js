const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'public', file), 'utf8');

const stretchOffPages = ['admin.html', 'finance.html', 'jobs_table.html', 'parts.html'];
const stretchOnPages = ['history.html', 'jobs.html', 'repair.html', 'repair_date_update.html', 'repair_export.html'];

test('admin finance jobs_table and parts explicitly opt out of adaptive stretch scrolling', () => {
  for (const file of stretchOffPages) {
    const src = read(file);
    const body = src.match(/<body\b[^>]*>/i)?.[0] || '';
    assert.match(body, /data-rz-table-dock=["']off["']/i, `${file} must opt out of adaptive table stretch`);
  }
});

test('remaining long-table pages keep adaptive two-stage scrolling enabled', () => {
  for (const file of stretchOnPages) {
    const src = read(file);
    const body = src.match(/<body\b[^>]*>/i)?.[0] || '';
    assert.doesNotMatch(body, /data-rz-table-dock=["']off["']/i, `${file} must keep adaptive table stretch enabled`);
    assert.match(src, /table_viewport_lock\.js\?[^"']*adaptive=4/, `${file} must keep adaptive revision 4`);
  }
});

test('parts SA vehicle registration column is centered in header and row content', () => {
  const html = read('parts.html');
  const ui = read('js/parts_ui.js');

  assert.match(
    html,
    /<th\s+class=["'][^"']*text-center[^"']*["'][^>]*>[\s\S]*?<span>ทะเบียนรถ<\/span>/,
    'parts vehicle registration header must be centered'
  );
  assert.match(
    ui,
    /<td\s+class=["'][^"']*text-center[^"']*["'][^>]*>[\s\S]*?\$\{plate\}[\s\S]*?ID:\s*\$\{jobId\}/,
    'parts vehicle registration badge and ID must be centered in the cell'
  );
});

test('admin keeps its full viewport flex shell while adaptive docking is disabled', () => {
  const src = read('admin.html');
  const body = src.match(/<body\b[^>]*>/i)?.[0] || '';
  assert.match(body, /\bh-screen\b/, 'admin body must remain viewport height');
  assert.match(body, /\boverflow-hidden\b/, 'admin body must keep document overflow locked');
  assert.match(src, /<aside\b[^>]*class=["'][^"']*\bh-full\b[^"']*["']/i, 'admin sidebar must fill the viewport shell');
});

test('repair board load guard fix remains present', () => {
  assert.match(read('repair_board.html'), /let\s+repairBoardLoadInFlight\s*=\s*false\s*;/);
});

test('admin and finance keep flex scroll chains after adaptive stretch is disabled', () => {
  const adminHtml = read('admin.html');
  const financeHtml = read('finance.html');
  const adminCss = fs.readFileSync(path.join(root, 'tools', 'tailwind_sources', 'admin.css'), 'utf8');
  const financeCss = fs.readFileSync(path.join(root, 'tools', 'tailwind_sources', 'finance.css'), 'utf8');

  assert.match(adminCss, /\.admin-panel\.active\s*\{\s*display:\s*flex\s*;/, 'active admin panel must stay a flex column so its table can scroll');
  assert.match(financeCss, /\.acc-tab-content\.active\s*\{\s*display:\s*flex\s*;/, 'active finance tab must stay a flex column so its table can scroll');

  assert.match(adminHtml, /<main\b[^>]*class=["'][^"']*\bmin-h-0\b[^"']*["']/i, 'admin main flex child must be allowed to shrink');
  assert.match(adminHtml, /id=["']admin-scroll-shell["'][^>]*class=["'][^"']*\bmin-h-0\b[^"']*\boverflow-hidden\b/i, 'admin outer shell must stay fixed while each table owns vertical scrolling');

  assert.match(financeHtml, /<main\b[^>]*class=["'][^"']*\bmin-h-0\b[^"']*\boverflow-y-auto\b[^"']*["']/i, 'finance main must remain a bounded vertical scroller');
  assert.match(financeHtml, /(?:id=["']tableContainer["'][^>]*class=["'][^"']*\bmin-h-0\b[^"']*\boverflow-auto\b|class=["'][^"']*\bmin-h-0\b[^"']*\boverflow-auto\b[^"']*["'][^>]*id=["']tableContainer["'])/i, 'finance table container must be allowed to shrink and scroll');
  assert.match(adminHtml, /\/compiled\/admin\.tailwind\.css\?v=1\.2/, 'admin must bust the cached precompiled CSS after the scroll fix');
  assert.match(financeHtml, /\/compiled\/finance\.tailwind\.css\?v=1\.2/, 'finance must bust the cached precompiled CSS after the scroll fix');
});


test('admin keeps pagination visible below the inner table scroller on every panel', () => {
  const adminHtml = read('admin.html');

  assert.match(
    adminHtml,
    /id=["']admin-scroll-shell["'][^>]*class=["'][^"']*\boverflow-hidden\b/i,
    'admin outer content shell must not scroll the pagination footer out of view'
  );
  assert.match(
    adminHtml,
    /class=["'][^"']*\bh-full\b[^"']*\bmin-h-0\b[^"']*\bflex\b[^"']*\bflex-col\b[^"']*["'][^>]*>\s*<!--[\s\S]*?id=["']emp-panel["']/i,
    'admin card must be bounded to the available viewport height'
  );

  const panelIds = ['emp-panel', 'car-panel', 'ins-panel', 'ctype-panel', 'body-parts-panel', 'main-status-panel', 'status-panel', 'quota-panel'];
  for (const panelId of panelIds) {
    const panelStart = adminHtml.indexOf(`id="${panelId}"`);
    assert.notEqual(panelStart, -1, `${panelId} must exist`);
    const startTagEnd = adminHtml.indexOf('>', panelStart);
    const nextPanel = adminHtml.indexOf('id="', startTagEnd + 1);
    const nextAdminPanel = adminHtml.indexOf('class="admin-panel', startTagEnd + 1);
    const panelEnd = nextAdminPanel === -1 ? adminHtml.length : adminHtml.lastIndexOf('<div id="', nextAdminPanel);
    const panelChunk = adminHtml.slice(panelStart, panelEnd > panelStart ? panelEnd : (nextPanel === -1 ? adminHtml.length : nextPanel));
    assert.match(panelChunk, /class=["'][^"']*\bmin-h-0\b[^"']*\bflex\b[^"']*\bflex-col\b/i, `${panelId} must be a bounded flex column`);
    assert.match(panelChunk, /class=["'][^"']*\bflex-1\b[^"']*\bmin-h-0\b[^"']*\boverflow-auto\b[^"']*custom-scrollbar[^"']*["']/i, `${panelId} table body must own scrolling`);
  }
});
