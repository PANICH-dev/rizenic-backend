'use strict';

const MAX_POSTGRES_PARAMS = 60000;
const DEFAULT_MAX_ROWS = 500;

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function signature(columns) {
  return columns.join('\u001f');
}

function buildDynamicSyncBatches(data, primaryKey, maxRows = DEFAULT_MAX_ROWS) {
  const batches = [];
  let current = null;

  function flush() {
    if (current && current.rows.length) batches.push(current);
    current = null;
  }

  for (const row of Array.isArray(data) ? data : []) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const columns = Object.keys(row);
    if (!columns.length) continue;
    const sig = signature(columns);
    const rowLimit = Math.max(1, Math.min(maxRows, Math.floor(MAX_POSTGRES_PARAMS / columns.length)));
    const keyValue = primaryKey && Object.prototype.hasOwnProperty.call(row, primaryKey) ? row[primaryKey] : undefined;
    const keyToken = keyValue === undefined || keyValue === null ? null : `${typeof keyValue}:${String(keyValue)}`;

    const mustFlush = !current || current.signature !== sig || current.rows.length >= rowLimit || (keyToken !== null && current.keys.has(keyToken));
    if (mustFlush) flush();
    if (!current) current = { signature: sig, columns, rows: [], keys: new Set() };
    current.rows.push(row);
    if (keyToken !== null) current.keys.add(keyToken);
  }
  flush();

  return batches.map(({ signature: _sig, keys: _keys, ...batch }) => batch);
}

function buildDynamicSyncSql(tableName, primaryKey, batch) {
  const columns = batch?.columns || [];
  const rows = batch?.rows || [];
  if (!columns.length || !rows.length) throw new Error('Empty dynamic sync batch');

  const values = [];
  const tuples = rows.map(row => {
    const placeholders = columns.map(col => {
      values.push(row[col]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  let sql = `INSERT INTO ${quoteIdent(tableName)} (${columns.map(quoteIdent).join(', ')}) VALUES ${tuples.join(', ')}`;
  if (primaryKey) {
    const updateCols = columns.filter(col => col !== primaryKey && col !== 'id' && col !== 'part_id');
    if (updateCols.length) {
      sql += ` ON CONFLICT (${quoteIdent(primaryKey)}) DO UPDATE SET ${updateCols.map(col => `${quoteIdent(col)} = EXCLUDED.${quoteIdent(col)}`).join(', ')}`;
    } else {
      sql += ` ON CONFLICT (${quoteIdent(primaryKey)}) DO NOTHING`;
    }
  }
  return { sql, values };
}

module.exports = { buildDynamicSyncBatches, buildDynamicSyncSql };
