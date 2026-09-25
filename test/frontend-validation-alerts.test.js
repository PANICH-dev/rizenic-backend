const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function functionBody(source, name) {
  const markers = [`async function ${name}`, `function ${name}`];
  let start = -1;
  for (const marker of markers) {
    start = source.indexOf(marker);
    if (start !== -1) break;
  }
  assert.notEqual(start, -1, `missing function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

function assertUsesBackendError(source, functionName) {
  const body = functionBody(source, functionName);
  assert.match(body, /readApiErrorMessage\(/, `${functionName} must surface backend validation error text`);
  assert.match(body, /\.ok/, `${functionName} must check HTTP success before success flow`);
}

test('backend validation remains registered in runtime', () => {
  const app = read('app.js');
  assert.match(app, /require\(['"]\.\/backend_validation['"]\)/);
  assert.match(app, /registerApiValidation\(app,\s*pool\)/);
});

test('SA key desk and bulk import stop false-success and surface backend errors', () => {
  const jobs = read('public/jobs.js');
  const bulk = read('public/jobs_table_modals.js');
  assertUsesBackendError(jobs, 'saveSAKeyDesk');
  assertUsesBackendError(bulk, 'saveBulkData');
  const bulkBody = functionBody(bulk, 'saveBulkData');
  assert.match(bulkBody, /responses\.find\(/, 'bulk import must inspect all HTTP responses before success alert');
});

test('SA form and PO edit surface backend validation messages from nested writes', () => {
  const core = read('public/sa_core.js');
  const parts = read('public/sa_parts.js');
  assertUsesBackendError(core, 'submitSaForm');
  const coreBody = functionBody(core, 'submitSaForm');
  assert.match(coreBody, /partOrderResponse/);
  assert.match(coreBody, /outboundResponse/);
  assert.doesNotMatch(coreBody, /throw new Error\(await readApiErrorMessage\(partOrderResponse/,
    'a part-order validation warning must not turn an already-saved report into a failed report flow');
  assert.doesNotMatch(coreBody, /throw new Error\(await readApiErrorMessage\(outboundResponse/,
    'an outbound validation warning must not turn an already-saved report into a failed report flow');
  assertUsesBackendError(parts, 'submitEditPOModal');
});

test('admin master-data saves keep success flow behind res.ok and show backend messages', () => {
  const admin = read('public/admin.html');
  for (const fn of ['saveEmp','saveCar','saveIns','saveCtype','saveBodyPart','saveMainStatus','savePartStatus','saveQuota']) {
    assertUsesBackendError(admin, fn);
  }
});

test('repair, finance and repair-date inline writes surface backend validation messages', () => {
  const repair = read('public/repair.js');
  const finance = read('public/finance.html');
  const dates = read('public/repair_date_update.html');
  for (const fn of ['fastUpdateField','fastUpdateStationDropdown','submitRepairStation']) assertUsesBackendError(repair, fn);
  assertUsesBackendError(finance, 'fastUpdateAcc');
  assertUsesBackendError(dates, 'updateDate');
});

test('parts SA updates and master save surface backend messages without raw JSON alerts', () => {
  const parts = read('public/js/parts_ui.js');
  assertUsesBackendError(parts, 'saveSAAlertUpdate');
  assertUsesBackendError(parts, 'saveMasterPart');
  const alertBody = functionBody(parts, 'saveSAAlertUpdate');
  assert.doesNotMatch(alertBody, /alert\(`❌ ระบบปฏิเสธการบันทึก:[\s\S]*\$\{errTxt\}/,
    'user alert must show parsed backend message instead of raw JSON text');
  assert.match(alertBody, /res\.status\s*===\s*400|res\.status\s*===\s*409/,
    'validated PUT failures must not fall through to legacy field-by-field fallback');
});

test('jobs table station update also surfaces backend validation message', () => {
  const core = read('public/jobs_table_core.js');
  assertUsesBackendError(core, 'fastUpdateStationDropdown');
});

test('pages cache-bust the validation-alert JS revisions so browsers do not keep stale save logic', () => {
  const jobs = read('public/jobs.html');
  const jobsTable = read('public/jobs_table.html');
  const parts = read('public/parts.html');
  const repair = read('public/repair.html');
  const index = read('public/index.html');
  const portal = read('public/sa_portal.html');
  assert.match(jobs, /jobs\.js\?v=2\.6/);
  assert.match(jobsTable, /jobs_table_core\.js\?v=23\.5/);
  assert.match(jobsTable, /jobs_table_modals\.js\?v=23\.2/);
  assert.match(parts, /parts_ui\.js\?v=23\.5/);
  assert.match(repair, /repair\.js\?v=8/);
  assert.match(index, /sa_core\.js\?v=19\.3/);
  assert.match(index, /sa_parts\.js\?v=19\.1/);
  assert.match(portal, /sa_core\.js\?v=19\.3/);
  assert.match(portal, /sa_parts\.js\?v=19\.1/);
});
