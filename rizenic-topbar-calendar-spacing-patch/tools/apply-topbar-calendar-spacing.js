const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const indexPath = path.join(root, 'public', 'index.html');
const dashboardPath = path.join(root, 'public', 'dashboard.html');

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`ไม่พบไฟล์: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function backupOnce(file) {
  const backup = `${file}.backup-before-topbar-calendar-spacing`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

function insertAfter(source, marker, addition, label) {
  if (source.includes(addition.trim())) return source;
  if (!source.includes(marker)) throw new Error(`หา ${label} ไม่เจอ จึงหยุดเพื่อไม่แก้ผิดจุด`);
  return source.replace(marker, `${marker}\n    ${addition}`);
}

function applyIndex() {
  let html = readRequired(indexPath);
  backupOnce(indexPath);
  html = insertAfter(
    html,
    '<link rel="stylesheet" href="ui_global.css?v=1.0">',
    '<link rel="stylesheet" href="topbar_lock.css?v=1.0">',
    'ui_global.css ใน index.html'
  );

  if (!html.includes('topbar_lock.js?v=1.0')) {
    const coreMarker = '<script src="sa_core.js?v=19.1"></script>';
    if (html.includes(coreMarker)) {
      html = html.replace(coreMarker, `<script src="topbar_lock.js?v=1.0"></script>\n    ${coreMarker}`);
    } else if (html.includes('</body>')) {
      html = html.replace('</body>', '    <script src="topbar_lock.js?v=1.0"></script>\n</body>');
    } else {
      throw new Error('หา script anchor ใน index.html ไม่เจอ จึงหยุดเพื่อไม่แก้ผิดจุด');
    }
  }
  fs.writeFileSync(indexPath, html);
}

function applyDashboard() {
  let html = readRequired(dashboardPath);
  backupOnce(dashboardPath);
  if (!html.includes('dashboard_edge_spacing.css?v=1.0')) {
    const matches = html.match(/<link rel="stylesheet" href="dashboard_polish\.css\?v=[^"]+">/);
    if (!matches) throw new Error('หา dashboard_polish.css ใน dashboard.html ไม่เจอ จึงหยุดเพื่อไม่แก้ผิดจุด');
    html = html.replace(matches[0], `${matches[0]}\n    <link rel="stylesheet" href="dashboard_edge_spacing.css?v=1.0">`);
  }
  fs.writeFileSync(dashboardPath, html);
}

applyIndex();
applyDashboard();
console.log('✅ ล็อก top bar และเพิ่มระยะขอบ Dashboard/Calendar แล้ว');
console.log('ℹ️ ไม่ได้แก้ API, Database, app.js หรือ business logic');
