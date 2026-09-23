const fs = require('fs');
const path = require('path');

// Icons/emoji only. Plain console.log and console.error/console.warn are intentionally untouched.
const ICON_RE = /(?:[\u2600-\u27BF]|[\u{1F300}-\u{1FAFF}]|\u2139\uFE0F?|\uFE0F)/u;

function findCallEnd(source, openParenIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let templateExprDepth = 0;

  for (let i = openParenIndex; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (quote === '`') {
        if (ch === '`' && templateExprDepth === 0) {
          quote = null;
          continue;
        }
        if (ch === '$' && next === '{') {
          templateExprDepth += 1;
          i += 1;
          continue;
        }
        if (ch === '}' && templateExprDepth > 0) {
          templateExprDepth -= 1;
          continue;
        }
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i + 2);
      if (nl === -1) return -1;
      i = nl;
      continue;
    }

    if (ch === '/' && next === '*') {
      const endComment = source.indexOf('*/', i + 2);
      if (endComment === -1) return -1;
      i = endComment + 1;
      continue;
    }

    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function getIconConsoleLogRanges(source) {
  const ranges = [];
  const needle = 'console.log';
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const start = source.indexOf(needle, searchFrom);
    if (start === -1) break;

    let p = start + needle.length;
    while (/\s/.test(source[p] || '')) p += 1;
    if (source[p] !== '(') {
      searchFrom = p;
      continue;
    }

    const end = findCallEnd(source, p);
    if (end === -1) break;
    const callText = source.slice(start, end + 1);
    if (ICON_RE.test(callText)) ranges.push({ start, end: end + 1 });
    searchFrom = end + 1;
  }

  return ranges;
}

function isStandaloneStatement(source, start, end) {
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  if (source.slice(lineStart, start).trim() !== '') return null;

  let tail = end;
  while (tail < source.length && (source[tail] === ' ' || source[tail] === '\t' || source[tail] === '\r')) tail += 1;
  if (source[tail] === ';') tail += 1;
  while (tail < source.length && (source[tail] === ' ' || source[tail] === '\t' || source[tail] === '\r')) tail += 1;
  if (source[tail] !== '\n' && tail !== source.length) return null;

  return { start: lineStart, end: tail };
}

function stripIconConsoleLogs(source) {
  const ranges = getIconConsoleLogRanges(source);
  if (!ranges.length) return source;

  let out = source;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const { start, end } = ranges[i];
    const standalone = isStandaloneStatement(out, start, end);
    if (standalone) {
      out = out.slice(0, standalone.start) + out.slice(standalone.end);
    } else {
      out = out.slice(0, start) + 'undefined' + out.slice(end);
    }
  }
  return out;
}

function containsIconConsoleLog(source) {
  return getIconConsoleLogRanges(source).length > 0;
}

function tidyKnownPatterns(relativePath, source) {
  let out = source;
  if (relativePath === 'app.js') {
    out = out.replace(/app\.listen\(port,\s*\(\)\s*=>\s*undefined\);/g, 'app.listen(port);');
  }
  if (relativePath === path.join('tools', 'patch-app-validation.js') && !/result\./.test(out)) {
    out = out.replace(/const result = applyToFile\(appPath\);/g, 'applyToFile(appPath);');
  }
  if (relativePath === path.join('tools', 'apply-ui-patch.js')) {
    out = out.replace(/const htmlChanged = patchAllHtmlSelectStyle\(\);\s*const repairChanged = patchRepair\(\);\s*const dashboardChanged = patchDashboard\(\);/m, 'patchAllHtmlSelectStyle();\npatchRepair();\npatchDashboard();');
  }
  if (relativePath === path.join('tools', 'cleanup-no-dbindex.js')) {
    out = out.replace(/if \(fs\.existsSync\(obsolete\)\) \{\s*fs\.rmSync\(obsolete\);\s*\} else \{\s*\}/m, 'if (fs.existsSync(obsolete)) {\n  fs.rmSync(obsolete);\n}');
  }
  return out;
}

function collectSourceFiles(rootDir) {
  const files = [];
  const roots = [
    path.join(rootDir, 'app.js'),
    path.join(rootDir, 'backend_validation.js'),
    path.join(rootDir, 'public'),
    path.join(rootDir, 'tools')
  ];

  function walk(target) {
    if (!fs.existsSync(target)) return;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      if (/\.(?:js|html)$/i.test(target) && !/\.(?:bak|backup)(?:-|\.|$)/i.test(target)) files.push(target);
      return;
    }
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('public.backup')) continue;
      walk(path.join(target, entry.name));
    }
  }

  for (const target of roots) walk(target);
  return [...new Set(files)];
}

function applyCleanup(rootDir) {
  const changed = [];
  let removedCalls = 0;

  for (const filePath of collectSourceFiles(rootDir)) {
    const before = fs.readFileSync(filePath, 'utf8');
    const count = getIconConsoleLogRanges(before).length;
    if (!count) continue;
    const relativePath = path.relative(rootDir, filePath);
    const after = tidyKnownPatterns(relativePath, stripIconConsoleLogs(before));
    fs.writeFileSync(filePath, after);
    changed.push(path.relative(rootDir, filePath));
    removedCalls += count;
  }

  return { changed, removedCalls };
}

if (require.main === module) {
  const rootDir = path.resolve(process.cwd(), process.argv[2] || '.');
  const result = applyCleanup(rootDir);
  console.log(`Removed ${result.removedCalls} icon console.log call(s) from ${result.changed.length} file(s).`);
  if (result.changed.length) console.log(result.changed.join('\n'));
}

module.exports = {
  ICON_RE,
  findCallEnd,
  getIconConsoleLogRanges,
  stripIconConsoleLogs,
  containsIconConsoleLog,
  collectSourceFiles,
  applyCleanup,
  tidyKnownPatterns
};
