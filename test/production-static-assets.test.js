'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('production installs copy browser runtime dependencies into public/vendor', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.postinstall, 'node tools/vendor-runtime-assets.js');
  const script = read('tools/vendor-runtime-assets.js');
  assert.match(script, /fontawesome-free/);
  assert.match(script, /webfonts/);
  assert.match(script, /@fontsource/);
  assert.match(script, /xlsx\.full\.min\.js/);
  const app = read('app.js');
  assert.match(app, /app\.use\('\/vendor', express\.static\(path\.join\(__dirname, 'public', 'vendor'\)/);
});

test('secondary SA and dashboard part loads no longer scan all reports first', () => {
  const views = read('server_side_views.js');
  const dashboard = views.match(/app\.get\('\/api\/server\/dashboard-parts'[\s\S]*?\n  \}\);/)[0];
  const sa = views.match(/app\.get\('\/api\/server\/sa-parts'[\s\S]*?\n  \}\);/)[0];
  const helper = views.match(/async function buildScopedPartOrdersForReports[\s\S]*?return result\.rows;\n}/)[0];
  assert.match(helper, /FROM rizenic_part_orders/);
  assert.doesNotMatch(helper, /FROM rizenicreport/);
  for (const block of [dashboard, sa]) {
    assert.match(block, /buildScopedPartOrdersForKeys/);
    assert.doesNotMatch(block, /FROM rizenicreport/);
  }
});
