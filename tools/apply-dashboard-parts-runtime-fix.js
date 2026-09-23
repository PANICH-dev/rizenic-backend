const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pub = path.join(root, 'public');

function read(name) { return fs.readFileSync(path.join(pub, name), 'utf8'); }
function write(name, text) { fs.writeFileSync(path.join(pub, name), text); }
function backup(name) {
  const src = path.join(pub, name);
  const bak = `${src}.before-runtime-ui-final.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
}
function assertIncludes(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`ไม่พบจุดแก้ ${label}; หยุดเพื่อไม่ให้กระทบโค้ดเดิม`);
}

function insertAfterFirst(text, marker, insert, label) {
  if (text.includes(insert.trim())) return text;
  const i = text.indexOf(marker);
  if (i < 0) throw new Error(`ไม่พบจุดแทรก ${label}`);
  return text.slice(0, i + marker.length) + insert + text.slice(i + marker.length);
}

function wrapTableScroll(text, tableId, opener, outerIndent, innerIndent) {
  if (text.includes(`rz-table-clip-shell`) && text.includes(`id="${tableId}"`)) {
    // A page can contain multiple target tables; only skip when this table already has a nearby shell.
    const ti = text.indexOf(`id="${tableId}"`);
    const before = text.slice(Math.max(0, ti - 500), ti);
    if (before.includes('rz-table-clip-shell')) return text;
  }

  const tableNeedle = `id="${tableId}"`;
  const tablePos = text.indexOf(tableNeedle);
  if (tablePos < 0) throw new Error(`ไม่พบตาราง ${tableId}`);
  const openerPos = text.lastIndexOf(opener, tablePos);
  if (openerPos < 0 || tablePos - openerPos > 600) throw new Error(`ไม่พบ scroll host ของ ${tableId}`);

  const openReplacement = `${outerIndent}<div class="flex-1 min-h-0 overflow-hidden rz-table-clip-shell">\n${innerIndent}<div class="h-full overflow-auto custom-scrollbar${opener.includes('p-1.5') ? ' p-1.5 bg-slate-100' : ''} rz-table-scroll-surface">`;
  text = text.slice(0, openerPos) + openReplacement + text.slice(openerPos + opener.length);

  const newTablePos = text.indexOf(tableNeedle, openerPos);
  const tableClose = text.indexOf('</table>', newTablePos);
  if (tableClose < 0) throw new Error(`ไม่พบ </table> ของ ${tableId}`);
  const firstDivClose = text.indexOf('</div>', tableClose);
  if (firstDivClose < 0) throw new Error(`ไม่พบตัวปิด scroll host ของ ${tableId}`);
  const insertPos = firstDivClose + '</div>'.length;
  text = text.slice(0, insertPos) + `\n${outerIndent}</div>` + text.slice(insertPos);
  return text;
}

// 1) Dashboard: fixed viewport header + measured spacer.
backup('dashboard.html');
let dashboard = read('dashboard.html');
if (!dashboard.includes('dashboard_topbar_lock.css?v=1.0')) {
  const cssAnchor = '<link rel="stylesheet" href="dashboard_edge_spacing.css?v=1.0">';
  assertIncludes(dashboard, cssAnchor, 'Dashboard CSS');
  dashboard = dashboard.replace(cssAnchor, `${cssAnchor}\n    <link rel="stylesheet" href="dashboard_topbar_lock.css?v=1.0">`);
}
if (!dashboard.includes('id="dashboard-topbar"')) {
  const oldHeader = '<header class="bg-rizenic-green text-white shadow-lg z-50 shrink-0 border-b-4 border-amber-500 sticky top-0">';
  assertIncludes(dashboard, oldHeader, 'Dashboard header');
  dashboard = dashboard.replace(oldHeader, '<header id="dashboard-topbar" class="bg-rizenic-green text-white shadow-lg z-50 shrink-0 border-b-4 border-amber-500">');
} else {
  dashboard = dashboard.replace(/(<header[^>]*id="dashboard-topbar"[^>]*class=")([^"]*)(")/, (_, a, cls, c) => {
    return a + cls.replace(/\bsticky\b/g, '').replace(/\btop-0\b/g, '').replace(/\s+/g, ' ').trim() + c;
  });
}
if (!dashboard.includes('id="dashboard-topbar-spacer"')) {
  const headerPos = dashboard.indexOf('id="dashboard-topbar"');
  const headerEnd = dashboard.indexOf('</header>', headerPos);
  if (headerEnd < 0) throw new Error('ไม่พบจุดปิด Dashboard header');
  const pos = headerEnd + '</header>'.length;
  dashboard = dashboard.slice(0, pos) + '\n    <div id="dashboard-topbar-spacer" aria-hidden="true"></div>' + dashboard.slice(pos);
}
if (!dashboard.includes('dashboard_topbar_lock.js?v=1.0')) {
  const scriptAnchor = '<!-- Dashboard operation lists use the same client pagination helper as other long tables. -->';
  assertIncludes(dashboard, scriptAnchor, 'Dashboard scripts');
  dashboard = dashboard.replace(scriptAnchor, '    <script src="dashboard_topbar_lock.js?v=1.0"></script>\n    ' + scriptAnchor);
}
write('dashboard.html', dashboard);

// 2) Parts: clip paint outside each table scroll surface without putting clip/contain on sticky THEAD itself.
backup('parts.html');
let parts = read('parts.html');
parts = wrapTableScroll(parts, 'saTable', '                    <div class="flex-1 overflow-auto custom-scrollbar">', '                    ', '                        ');
parts = wrapTableScroll(parts, 'masterTable', '                    <div class="flex-1 overflow-auto custom-scrollbar">', '                    ', '                        ');
write('parts.html', parts);

// 3) Jobs: same browser-compositor protection on the two long embedded tables.
backup('jobs.html');
let jobs = read('jobs.html');
jobs = wrapTableScroll(jobs, 'parkedTable', '                <div class="flex-1 overflow-auto custom-scrollbar p-1.5 bg-slate-100">', '                ', '                    ');
jobs = wrapTableScroll(jobs, 'poTable', '                <div class="flex-1 overflow-auto custom-scrollbar p-1.5 bg-slate-100">', '                ', '                    ');
write('jobs.html', jobs);

// 4) Shared CSS: outer clip shell + separate inner scrolling surface.
backup('table_scroll_fix.css');
let css = read('table_scroll_fix.css');
if (!css.includes('RIZENIC table compositor clip shell v1.7')) {
  css += `\n\n/* RIZENIC table compositor clip shell v1.7\n * Outer shell clips Chromium paint leakage without being the scroll host.\n * Inner surface owns scrolling, keeping sticky THEAD behavior intact.\n */\n.rz-table-clip-shell {\n    position: relative;\n    min-width: 0;\n    min-height: 0;\n    overflow: hidden !important;\n}\n\n.rz-table-scroll-surface {\n    width: 100%;\n    height: 100%;\n    min-width: 0;\n    min-height: 0;\n    overflow: auto !important;\n    overscroll-behavior: none;\n}\n`;
}
write('table_scroll_fix.css', css);




