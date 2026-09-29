'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('production uses external browser runtime dependencies without a vendor-copy postinstall step', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts && pkg.scripts.postinstall, undefined);
  assert.equal(fs.existsSync(path.join(root, 'tools/vendor-runtime-assets.js')), false);
  const app = read('app.js');
  assert.doesNotMatch(app, /app\.use\(['\"]\/vendor/);
  const vercel = JSON.parse(read('vercel.json'));
  const nodeBuild = (vercel.builds || []).find((b) => b.src === 'app.js');
  assert.deepEqual(nodeBuild.config.includeFiles, ['public/**']);
});

test('secondary SA and dashboard part loads no longer scan all reports first', () => {
  const views = read('server_side_views.js');
  const dashboard = views.match(/app\.get\('\/api\/server\/dashboard-parts'[\s\S]*?\n  \}\);/)[0];
  const sa = views.match(/app\.get\('\/api\/server\/sa-parts'[\s\S]*?\n  \}\);/)[0];
  const helperStart = views.indexOf('async function buildScopedPartOrdersForReports');
  const helperEnd = views.indexOf('const ADMIN_RESOURCES', helperStart);
  const helper = views.slice(helperStart, helperEnd);
  assert.match(helper, /FROM rizenic_part_orders/);
  assert.doesNotMatch(helper, /FROM rizenicreport/);
  for (const block of [dashboard, sa]) {
    assert.match(block, /buildScopedPartOrdersForKeys/);
    assert.doesNotMatch(block, /FROM rizenicreport/);
  }
});
