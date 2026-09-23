const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadJobsUi(extra = {}) {
  const elements = {
    jobs_table_head: { innerHTML: '' },
    col_toggles_container: { innerHTML: '' },
    'dynamic-col-styles': { innerHTML: '' },
    jobs_table_body: { innerHTML: '' },
    jobsTable: { innerHTML: '', getAttribute() { return null; }, setAttribute() {}, querySelectorAll() { return []; } },
  };

  const context = {
    console,
    columnsDef: [
      { idx: 1, key: 'car_plate', title: 'ทะเบียนรถ', width: 110 },
      { idx: 2, key: 'customer_name', title: 'ชื่อลูกค้า', width: 140 },
      { idx: 3, key: 'notes', title: 'หมายเหตุ', width: 180 },
    ],
    hiddenCols: new Set([2]),
    draggedColIdx: null,
    activeFilters: {},
    currentFilterKey: -1,
    allJobsData: [],
    currentFilteredData: [],
    allPartOrders: [],
    allCustomerTypes: [],
    allInsurances: [],
    allEmployees: [],
    stationLevels: [],
    globalStatusOptionsHtml: '',
    userRowHighlights: {},
    userRole: 'Admin',
    userBranch: 'สำนักงานใหญ่',
    document: {
      getElementById(id) {
        if (!elements[id]) {
          elements[id] = {
            innerHTML: '', value: '', innerText: '', disabled: false,
            classList: { add() {}, remove() {}, toggle() {} },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            getAttribute() { return null; },
            setAttribute() {},
          };
        }
        return elements[id];
      },
      querySelectorAll() { return []; },
    },
    setTimeout(fn) { return 1; },
    clearTimeout() {},
    saveUserPreferences() {},
    getSAsForCurrentBranch() { return []; },
    getActiveJobsData() { return context.allJobsData; },
    getCellValue() { return ''; },
    formatToThaiDate(v) { return String(v || ''); },
    showToast() {},
    XLSX: {
      utils: { aoa_to_sheet() { return {}; }, book_new() { return {}; }, book_append_sheet() {} },
      writeFile() {},
    },
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/jobs_table_ui.js'), 'utf8'), context);
  return { context, elements };
}

test('jobs table header renders visible columns only but keeps all column toggles', () => {
  const { context, elements } = loadJobsUi();
  context.initColumns();
  const thCount = (elements.jobs_table_head.innerHTML.match(/<th\b/g) || []).length;
  assert.equal(thCount, 2, 'hidden columns should not create table header DOM');
  assert.match(elements.col_toggles_container.innerHTML, /ชื่อลูกค้า/, 'hidden column must remain available in column manager');
});

test('jobs table body renders visible columns only', () => {
  const { context, elements } = loadJobsUi();
  context.renderTable([{ id: 10, car_plate: 'กก1234', customer_name: 'ลูกค้า', notes: 'note' }]);
  const tdCount = (elements.jobs_table_body.innerHTML.match(/<td\b/g) || []).length;
  assert.equal(tdCount, 2, 'hidden columns should not create body cell DOM');
  assert.match(elements.jobs_table_body.innerHTML, /กก1234/);
  assert.doesNotMatch(elements.jobs_table_body.innerHTML, /value="ลูกค้า"/);
});



test('showing a hidden jobs column rebuilds header and body with that column', () => {
  const { context, elements } = loadJobsUi();
  context.allJobsData = [{ id: 10, car_plate: 'กก1234', customer_name: 'ลูกค้า', notes: 'note' }];
  context.currentFilteredData = context.allJobsData.slice();
  context.toggleColumnVisibility(2, true);
  const thCount = (elements.jobs_table_head.innerHTML.match(/<th\b/g) || []).length;
  const tdCount = (elements.jobs_table_body.innerHTML.match(/<td\b/g) || []).length;
  assert.equal(thCount, 3);
  assert.equal(tdCount, 3);
  assert.match(elements.jobs_table_body.innerHTML, /value="ลูกค้า"/);
});

test('column visibility change preserves the current rendered row order', () => {
  const { context, elements } = loadJobsUi();
  const first = { id: 1, car_plate: 'FIRST', customer_name: 'A', notes: '' };
  const second = { id: 2, car_plate: 'SECOND', customer_name: 'B', notes: '' };
  context.currentFilteredData = [first, second];
  context.document.querySelectorAll = (selector) => {
    if (selector === '#jobs_table_body tr[id^="row_"]') return [{ id: 'row_2' }, { id: 'row_1' }];
    return [];
  };
  context.toggleColumnVisibility(2, true);
  assert.ok(elements.jobs_table_body.innerHTML.indexOf('row_2') < elements.jobs_table_body.innerHTML.indexOf('row_1'));
});

test('Excel export still includes hidden columns', () => {
  let exportedRows = null;
  const xlsx = {
    utils: {
      aoa_to_sheet(rows) { exportedRows = rows; return {}; },
      book_new() { return {}; },
      book_append_sheet() {},
    },
    writeFile() {},
  };
  const { context } = loadJobsUi({ XLSX: xlsx });
  context.currentFilteredData = [{ id: 10, car_plate: 'กก1234', customer_name: 'ลูกค้า', notes: 'note' }];
  context.exportToExcel();
  assert.deepEqual(Array.from(exportedRows[0]), ['ทะเบียนรถ', 'ชื่อลูกค้า', 'หมายเหตุ']);
});

function loadPartsCore(fetchImpl) {
  const context = {
    console,
    fetch: fetchImpl,
    window: { location: { origin: 'http://localhost:3000' } },
    sessionStorage: { getItem() { return null; }, clear() {} },
    document: {
      addEventListener() {},
      getElementById() {
        return {
          classList: { add() {}, remove() {} },
          innerText: '',
          innerHTML: '',
          querySelectorAll() { return []; },
        };
      },
      querySelectorAll() { return []; },
    },
    alert() {},
    renderSAAlerts() {},
    renderMasterTable() {},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/js/parts_core.js'), 'utf8'), context);
  return context;
}

test('parts page starts all three independent API requests concurrently', async () => {
  const resolvers = [];
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    return new Promise(resolve => resolvers.push(() => resolve({ ok: true, json: async () => [] })));
  };
  const context = loadPartsCore(fetchImpl);
  const loading = context.loadAllData();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls.length, 3, 'reports, part-orders and parts should start without waiting for each other');
  resolvers.forEach(resolve => resolve());
  await loading;
});
