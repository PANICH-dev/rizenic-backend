const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('paged reports query uses parameterized WHERE, safe sort, LIMIT and OFFSET while legacy query stays unchanged', () => {
  const q = require('../read_queries');
  assert.deepEqual(q.buildReportsReadQuery({}), { text: 'SELECT * FROM rizenicreport ORDER BY id DESC', values: [] });
  assert.equal(typeof q.buildPagedReportsReadQuery, 'function');
  const built = q.buildPagedReportsReadQuery({
    branch: 'Rangsit', department_routing: 'ซ่อม', search: 'กก 1234',
    sa_owner: 'สมชาย', date_field: 'arrived_date', date_from: '2026-09-01', date_to: '2026-09-30',
    sort: 'car_plate', dir: 'asc', page: '3', limit: '50', filters: JSON.stringify({ job_status: ['กำลังซ่อม'] })
  });
  assert.match(built.text, /WHERE/);
  assert.match(built.text, /branch_name = \$1/);
  assert.match(built.text, /department_routing = \$2/);
  assert.match(built.text, /ILIKE/);
  assert.match(built.text, /arrived_date::date >=/);
  assert.match(built.text, /arrived_date::date <=/);
  assert.match(built.text, /ORDER BY car_plate ASC/);
  assert.match(built.text, /LIMIT \$/);
  assert.match(built.text, /OFFSET \$/);
  assert.equal(built.page, 3);
  assert.equal(built.pageSize, 50);
  assert.equal(built.offset, 100);
  assert.ok(built.values.includes('Rangsit'));
  assert.ok(built.values.includes('ซ่อม'));
  assert.ok(built.values.some(v => String(v).includes('กก 1234')));
});

test('unsafe sort/filter/date fields are ignored and page size is capped', () => {
  const q = require('../read_queries');
  const built = q.buildPagedReportsReadQuery({ sort: 'id; DROP TABLE x', date_field: 'x) OR 1=1 --', limit: '99999', filters: '{"bad;sql":["x"]}' });
  assert.doesNotMatch(built.text, /DROP TABLE|OR 1=1/);
  assert.match(built.text, /ORDER BY id DESC/);
  assert.equal(built.pageSize, 200);
});


test('paged report filters support safe missing-date field checks', () => {
  const q = require('../read_queries');
  const built = q.buildPagedReportsReadQuery({ missing_field: 'arrived_date' });
  assert.match(built.text, /arrived_date IS NULL/);
  const unsafe = q.buildPagedReportsReadQuery({ missing_field: 'x OR 1=1' });
  assert.doesNotMatch(unsafe.text, /OR 1=1/);
});

test('count and facet queries reuse parameterized report filters without pagination', () => {
  const q = require('../read_queries');
  const count = q.buildReportsCountQuery({ branch: 'A', search: 'VIN' });
  assert.match(count.text, /^SELECT COUNT\(\*\)::int AS total FROM rizenicreport/);
  assert.doesNotMatch(count.text, /LIMIT|OFFSET/);
  assert.deepEqual(count.values[0], 'A');

  const facet = q.buildReportsFacetQuery({ branch: 'A', facet: 'job_status', search: 'ABC' });
  assert.match(facet.text, /SELECT DISTINCT/);
  assert.match(facet.text, /job_status/);
  assert.doesNotMatch(facet.text, /LIMIT \$/);
  assert.throws(() => q.buildReportsFacetQuery({ facet: 'id;drop' }), /facet/i);
});


test('jobs-table exclusions and current-page part-order filters stay parameterized', () => {
  const q = require('../read_queries');
  const reports = q.buildPagedReportsReadQuery({
    exclude_statuses: JSON.stringify(['18.ลูกค้ายกเลิก','21.พักซ่อม']),
    exclude_billing: '1', exclude_department: 'บัญชี', sort: 'calculated_station'
  });
  assert.match(reports.text, /(?:ANY|ALL)\(\$/);
  assert.match(reports.text, /NULLIF\(BTRIM\(COALESCE\(billing_date::text, ''\)\), ''\) IS NULL/);
  assert.match(reports.text, /department_routing/);
  assert.match(reports.text, /CASE[\s\S]*station_ready/);
  assert.deepEqual(reports.values[0], ['18%','21%']);
  assert.deepEqual(reports.values[1], ['%18.ลูกค้ายกเลิก%','%21.พักซ่อม%']);

  const parts = q.buildPartOrdersReadQuery({ branch: 'A', job_ids: '1,2,3', car_plates: 'กก1,กก2' });
  assert.match(parts.text, /branch_name = \$1/);
  assert.match(parts.text, /job_id::text = ANY/);
  assert.match(parts.text, /car_plate = ANY/);
  assert.deepEqual(parts.values[0], 'A');
});

test('reports route preserves legacy arrays but adds explicit paged and facet modes', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /buildPagedReportsReadQuery/);
  assert.match(app, /buildReportsCountQuery/);
  assert.match(app, /buildReportsFacetQuery/);
  assert.match(app, /req\.query\.paged/);
  assert.match(app, /totalPages/);
  assert.match(app, /req\.query\.facet/);
  assert.match(app, /req\.query\.full/);
  assert.match(app, /buildFilteredReportsReadQuery/);
});

test('shared pagination helper can render server metadata without slicing server items', () => {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'public/table_pagination.js'), 'utf8'), context);
  const p = context.RizenicPagination;
  assert.equal(typeof p.fromServerResponse, 'function');
  const state = p.createState(50);
  const response = { items: [{id: 51}, {id: 52}], page: 2, pageSize: 50, total: 123, totalPages: 3 };
  const normalized = p.fromServerResponse(response, state);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.items)), response.items);
  assert.equal(normalized.pageInfo.startNumber, 51);
  assert.equal(normalized.pageInfo.endNumber, 52);
  assert.equal(normalized.pageInfo.total, 123);
  assert.equal(state.page, 2);
});
