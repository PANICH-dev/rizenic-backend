const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDynamicSyncBatches, buildDynamicSyncSql } = require('../dynamic_sync_bulk');

test('dynamic sync batches same-shape rows into one multi-value insert', () => {
  const rows = [
    { id: 1, name: 'A', qty: 2 },
    { id: 2, name: 'B', qty: 3 },
    { id: 3, name: 'C', qty: 4 }
  ];
  const batches = buildDynamicSyncBatches(rows, 'id');
  assert.equal(batches.length, 1);
  assert.equal(batches[0].rows.length, 3);
  const { sql, values } = buildDynamicSyncSql('demo_table', 'id', batches[0]);
  assert.match(sql, /VALUES \(\$1, \$2, \$3\), \(\$4, \$5, \$6\), \(\$7, \$8, \$9\)/);
  assert.match(sql, /ON CONFLICT \("id"\) DO UPDATE SET "name" = EXCLUDED\."name", "qty" = EXCLUDED\."qty"/);
  assert.deepEqual(values, [1, 'A', 2, 2, 'B', 3, 3, 'C', 4]);
});

test('dynamic sync flushes before a duplicate key so sequential last-write behavior is preserved', () => {
  const rows = [
    { id: 1, name: 'first' },
    { id: 2, name: 'two' },
    { id: 1, name: 'last' }
  ];
  const batches = buildDynamicSyncBatches(rows, 'id');
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map(batch => batch.rows.map(row => row.id)), [[1, 2], [1]]);
});

test('dynamic sync keeps different column shapes in separate batches', () => {
  const rows = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B', qty: 2 },
    { id: 3, name: 'C', qty: 3 }
  ];
  const batches = buildDynamicSyncBatches(rows, 'id');
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0].columns, ['id', 'name']);
  assert.deepEqual(batches[1].columns, ['id', 'name', 'qty']);
  assert.equal(batches[1].rows.length, 2);
});

test('bulk SQL quotes validated identifiers so reserved or unusual database names cannot alter SQL structure', () => {
  const batch = { columns: ['id', 'order'], rows: [{ id: 1, order: 'A' }] };
  const { sql } = buildDynamicSyncSql('demo_table', 'id', batch);
  assert.match(sql, /^INSERT INTO "demo_table" \("id", "order"\)/);
  assert.match(sql, /ON CONFLICT \("id"\)/);
  assert.match(sql, /"order" = EXCLUDED\."order"/);
});
