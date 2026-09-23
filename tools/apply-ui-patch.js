'use strict';

const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(process.cwd(), 'public');

function writeIfChanged(file, source, next) {
  if (source === next) return false;
  const backup = `${file}.before-ui-polish.bak`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  fs.writeFileSync(file, next);
  return true;
}

function ensureHeadLink(source, href) {
  if (source.includes(href)) return source;
  return source.replace('</head>', `    <link rel="stylesheet" href="${href}">\n</head>`);
}

function patchAllHtmlSelectStyle() {
  let changed = 0;
  for (const name of fs.readdirSync(publicDir).filter(f => f.endsWith('.html'))) {
    const file = path.join(publicDir, name);
    const src = fs.readFileSync(file, 'utf8');
    const next = ensureHeadLink(src, 'ui_global.css?v=1.0');
    if (writeIfChanged(file, src, next)) changed += 1;
  }
  return changed;
}

function patchRepair() {
  const file = path.join(publicDir, 'repair.html');
  const src = fs.readFileSync(file, 'utf8');
  let out = src;

  out = out.replace(
    '<div class="group relative hidden md:block">\n                    <button class="p-2 text-slate-500 hover:text-[#00320D] hover:bg-slate-100 rounded-lg transition flex items-center gap-1.5 text-sm font-bold">',
    '<div class="relative hidden md:block" data-rz-floating-menu="columns">\n                    <button type="button" data-rz-menu-trigger aria-expanded="false" class="p-2 text-slate-500 hover:text-[#00320D] hover:bg-slate-100 rounded-lg transition flex items-center gap-1.5 text-sm font-bold">'
  );
  out = out.replace(
    '<div class="absolute right-0 top-full w-64 hidden group-hover:block group-focus-within:block z-50 pt-1">',
    '<div data-rz-menu-panel class="w-64 hidden pt-1 rz-floating-panel">'
  );
  out = out.replace(
    '<div class="group relative ml-1 md:ml-2 border-l border-slate-200 pl-2">\n                    <button class="p-2 text-slate-500 hover:text-[#00320D] hover:bg-slate-100 rounded-lg transition flex items-center gap-1 text-sm font-bold">',
    '<div class="relative ml-1 md:ml-2 border-l border-slate-200 pl-2" data-rz-floating-menu="more">\n                    <button type="button" data-rz-menu-trigger aria-expanded="false" class="p-2 text-slate-500 hover:text-[#00320D] hover:bg-slate-100 rounded-lg transition flex items-center gap-1 text-sm font-bold">'
  );
  out = out.replace(
    '<div class="absolute right-0 top-full w-56 hidden group-hover:block group-focus-within:block z-50 pt-1">',
    '<div data-rz-menu-panel class="w-56 hidden pt-1 rz-floating-panel">'
  );
  if (!out.includes('floating_menu.js?v=1.0')) {
    out = out.replace(/(\s*<script src="repair\.js\?v=[^"]+"><\/script>)/, '\n        <script src="floating_menu.js?v=1.0"></script>$1');
  }
  return writeIfChanged(file, src, out);
}

function patchDashboard() {
  const file = path.join(publicDir, 'dashboard.html');
  const src = fs.readFileSync(file, 'utf8');
  let out = ensureHeadLink(src, 'dashboard_polish.css?v=1.0');
  out = out.replace('class="bg-white border-b border-slate-200 z-40 shrink-0 shadow-sm px-6 py-4', 'class="dashboard-filter-bar bg-white border-b border-slate-200 z-40 shrink-0 shadow-sm px-6 py-4');
  out = out.replace('class="flex-1 overflow-auto custom-scrollbar p-6 space-y-2 max-w-[1600px] mx-auto w-full"', 'class="dashboard-shell flex-1 overflow-auto custom-scrollbar p-6 space-y-2 max-w-[1600px] mx-auto w-full"');
  out = out.replace('class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-4 border-[#00320D] pl-4 gap-4 mb-4"', 'class="dashboard-hero flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-4 border-[#00320D] pl-4 gap-4 mb-4"');
  out = out.replace('class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4"', 'class="dashboard-kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4"');
  out = out.replace('class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"', 'class="dashboard-finance-grid grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"');
  out = out.replace('class="card-box shadow-md !p-0 mb-8 border-t-4 border-emerald-500"', 'class="dashboard-report-card card-box shadow-md !p-0 mb-8 border-t-4 border-emerald-500"');
  return writeIfChanged(file, src, out);
}

patchAllHtmlSelectStyle();
patchRepair();
patchDashboard();

