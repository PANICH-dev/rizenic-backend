const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { stripIconConsoleLogs, containsIconConsoleLog, collectSourceFiles } = require('../tools/remove-icon-console-logs');

test('removes only console.log calls whose call text contains icon/emoji', () => {
  const src = [
    `console.log('✅ saved');`,
    `console.log('plain debug');`,
    `console.error('❌ keep errors');`,
    `app.listen(3000, () => console.log(\`🚀 ready\`));`,
    `console.log(flag\n  ? '✅ changed'\n  : 'ℹ️ unchanged');`,
    ''
  ].join('\n');
  const out = stripIconConsoleLogs(src);
  assert.doesNotMatch(out, /console\.log\([^)]*(?:✅|🚀|ℹ)/u);
  assert.match(out, /console\.log\('plain debug'\)/);
  assert.match(out, /console\.error\('❌ keep errors'\)/u);
  assert.match(out, /app\.listen\(3000, \(\) => undefined\)/);
});

test('plain console.log calls are left unchanged', () => {
  const src = `console.log('อะไหล่ที่แกะได้:', mainParts);\nconsole.log(e);\n`;
  assert.equal(stripIconConsoleLogs(src), src);
});

test('scanner detects icon console.log calls across multiline arguments', () => {
  const src = `console.log(result.changed\n ? \`✅ updated\`\n : 'ℹ️ unchanged');`;
  assert.equal(containsIconConsoleLog(src), true);
  assert.equal(containsIconConsoleLog(`console.log('normal')`), false);
});

test('runtime source contains no icon console.log calls', () => {
  const root = path.resolve(__dirname, '..');
  const offenders = collectSourceFiles(root)
    .filter(file => path.basename(file) !== 'remove-icon-console-logs.js')
    .filter(file => containsIconConsoleLog(fs.readFileSync(file, 'utf8')))
    .map(file => path.relative(root, file));
  assert.deepEqual(offenders, []);
});
