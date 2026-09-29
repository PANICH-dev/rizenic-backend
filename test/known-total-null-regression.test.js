const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFunction(file, name, endMarker, sandbox) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing end marker for ${name}`);
  const fnSource = source.slice(start, end).trim();
  const context = vm.createContext({ URLSearchParams, ...sandbox });
  return vm.runInContext(`(${fnSource})`, context);
}

test('jobs paging does not send known_total=0 when the total is still unknown', () => {
  const build = loadFunction('public/jobs_table_server.js', 'buildJobsServerParams', '\n\nasync function fetchJobsServerPage', {
    jobsPager: { page: 1, pageSize: 50 },
    jobsIsManager: () => false,
    userBranch: 'Navamin',
    document: { getElementById: () => null },
    jobsActiveFilterPayload: () => ({}),
    excludedStatuses: [],
    columnsDef: []
  });

  assert.equal(build(true, null).has('known_total'), false);
  assert.equal(build(true, undefined).has('known_total'), false);
  assert.equal(build(true, 0).get('known_total'), '0');
});

test('finance paging does not send known_total=0 when the total is still unknown', () => {
  const build = loadFunction('public/finance_server.js', 'buildFinanceServerParams', '\n\nfunction buildFinanceTotalsKey', {
    financePager: { page: 1, pageSize: 50 },
    userRole: 'Admin',
    userBranch: 'Navamin',
    document: { getElementById: () => null },
    activeFilters: {},
    columnsDef: [],
    financeServerSortField: 'id',
    financeServerSortDir: 'desc'
  });

  assert.equal(build({ paged: true, knownTotal: null }).has('known_total'), false);
  assert.equal(build({ paged: true, knownTotal: undefined }).has('known_total'), false);
  assert.equal(build({ paged: true, knownTotal: 0 }).get('known_total'), '0');
});
