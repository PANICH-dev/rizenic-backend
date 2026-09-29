const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildReportsWhere } = require('../read_queries');

test('server active-job filters preserve legacy blank billing and status semantics', () => {
  const q = buildReportsWhere({
    exclude_billing: '1',
    exclude_statuses: JSON.stringify([
      '13.วางบิลประกัน',
      '14.ชำระเงินสด',
      '21.พักซ่อม'
    ])
  });
  const sql = q.where.join(' AND ');
  assert.match(sql, /NULLIF\(BTRIM\(COALESCE\(billing_date::text, ''\)\), ''\) IS NULL/);
  assert.match(sql, /LIKE ANY/);
  assert.ok(q.values.some(v => Array.isArray(v) && v.includes('13%') && v.includes('21%')));
  assert.ok(q.values.some(v => Array.isArray(v) && v.includes('%13.วางบิลประกัน%')));
});

test('jobs server stays server-paged and never falls back to whole-dataset recovery', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'jobs_table_server.js'), 'utf8');
  assert.match(src, /paged', '1'/);
  assert.match(src, /RizenicPagination\.fromServerResponse/);
  assert.doesNotMatch(src, /fetchJobsLegacyCompatibilityRows/);
  assert.doesNotMatch(src, /jobsServerCompatibilityRows/);
  assert.doesNotMatch(src, /fetch\(reportUrl\)/);
  assert.doesNotMatch(src, /fetch\(`\$\{API_BASE_URL\}\/api\/part-orders`\)/);
});
