'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REQUIRE_LINE = "const { registerApiValidation } = require('./backend_validation');";
const REGISTER_LINE = 'registerApiValidation(app, pool);';

function patchAppSource(source) {
  if (source.includes(REQUIRE_LINE) && source.includes(REGISTER_LINE)) return source;

  let out = source;
  if (!out.includes(REQUIRE_LINE)) {
    const pathRequire = "const path = require('path');";
    const pgRequire = "const { Pool } = require('pg');";
    if (out.includes(pathRequire)) out = out.replace(pathRequire, `${pathRequire}\n${REQUIRE_LINE}`);
    else if (out.includes(pgRequire)) out = out.replace(pgRequire, `${pgRequire}\n${REQUIRE_LINE}`);
    else throw new Error('ไม่พบตำแหน่ง require ที่รองรับใน app.js');
  }

  if (!out.includes(REGISTER_LINE)) {
    const poolStart = out.indexOf('const pool = new Pool(');
    if (poolStart < 0) throw new Error('ไม่พบ const pool = new Pool(...) ใน app.js');
    const poolEnd = out.indexOf('\n});', poolStart);
    if (poolEnd < 0) throw new Error('ไม่พบจุดจบ Pool config ใน app.js');
    const insertAt = poolEnd + '\n});'.length;
    out = `${out.slice(0, insertAt)}\n\n// Shared input validation + duplicate guard (keeps existing DB/SSL config untouched)\n${REGISTER_LINE}${out.slice(insertAt)}`;
  }
  return out;
}

function applyToFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const patched = patchAppSource(src);
  if (patched === src) return { changed: false, backup: null };
  const backup = `${filePath}.before-validation.bak`;
  if (!fs.existsSync(backup)) fs.copyFileSync(filePath, backup);
  fs.writeFileSync(filePath, patched);
  return { changed: true, backup };
}

if (require.main === module) {
  const appPath = path.resolve(process.cwd(), process.argv[2] || 'app.js');
  applyToFile(appPath);

}

module.exports = { patchAppSource, applyToFile };
