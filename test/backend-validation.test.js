const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeBody,
  validatePayload,
  createApiValidationMiddleware,
} = require('../backend_validation');

test('normalizeBody trims ordinary string fields without mutating binary/image payload fields', () => {
  const input = {
    employee_name: '  Test User  ',
    username: ' test.user ',
    notes: '  note  ',
    car_diagram_image: '  data:image/png;base64,AAAA  ',
  };
  const out = normalizeBody(input);
  assert.equal(out.employee_name, 'Test User');
  assert.equal(out.username, 'test.user');
  assert.equal(out.notes, 'note');
  assert.equal(out.car_diagram_image, input.car_diagram_image);
});

test('employee validation rejects malformed usernames and missing required values', () => {
  const errors = validatePayload('POST', '/employees', {
    employee_code: 'EMP001',
    employee_name: '',
    employee_role: 'SA',
    branch_name: 'Navamin',
    username: 'bad user !!',
    password: '1234',
  });
  assert.ok(errors.some(x => x.field === 'employee_name'));
  assert.ok(errors.some(x => x.field === 'username'));
});

test('report validation rejects malformed phone, vin, date and negative money but accepts Thai plate text', () => {
  const errors = validatePayload('POST', '/report', {
    branch_name: 'Navamin',
    car_plate: '6ขก 1234',
    phone_number: 'abc',
    vin_no: '***',
    contact_date: 'not-a-date',
    cost_labor: -1,
    main_part_qty: -3,
  });
  assert.ok(errors.some(x => x.field === 'phone_number'));
  assert.ok(errors.some(x => x.field === 'vin_no'));
  assert.ok(errors.some(x => x.field === 'contact_date'));
  assert.ok(errors.some(x => x.field === 'cost_labor'));
  assert.ok(errors.some(x => x.field === 'main_part_qty'));
  assert.ok(!errors.some(x => x.field === 'car_plate'));
});

test('transactional part order route does not use duplicate blocking', async () => {
  let queryCount = 0;
  const pool = { query: async () => { queryCount += 1; return { rows: [] }; } };
  const mw = createApiValidationMiddleware(pool);
  const req = { method: 'POST', path: '/part-orders', body: { part_no: 'P1', part_name: 'Part', qty_ordered: 1, order_date: '2026-09-22', branch_name: 'Navamin' } };
  let nextCalled = false;
  const res = fakeRes();
  await mw(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(queryCount, 0);
});

test('master duplicate is blocked case-insensitively with 409 before route handler', async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [{ employee_id: 2 }] };
    }
  };
  const mw = createApiValidationMiddleware(pool);
  const req = {
    method: 'POST', path: '/employees', params: {},
    body: {
      employee_code: ' EMP001 ', employee_name: ' Tester ', employee_role: 'SA', branch_name: 'Navamin',
      username: ' TestUser ', password: '1234', accessible_pages: []
    }
  };
  let nextCalled = false;
  const res = fakeRes();
  await mw(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 409);
  assert.match(res.payload.error, /ซ้ำ|ใช้งานแล้ว/);
  assert.equal(req.body.username, 'TestUser');
  assert.ok(queries[0].sql.includes('LOWER'));
});

function fakeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('fast update validation rejects negative quantity before hitting database', async () => {
  let queryCount = 0;
  const pool = { query: async () => { queryCount += 1; return { rows: [] }; } };
  const mw = createApiValidationMiddleware(pool);
  const req = { method: 'PUT', path: '/part-orders/9/fast', body: { field: 'qty_ordered', value: -4 } };
  let nextCalled = false;
  const res = fakeRes();
  await mw(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(queryCount, 0);
});

test('report duplicate guard normalizes plate spacing and checks same contact date', async () => {
  const pool = { query: async () => ({ rows: [{ id: 7 }] }) };
  const mw = createApiValidationMiddleware(pool);
  const req = { method: 'POST', path: '/report', body: { car_plate: ' 6ขก 1234 ', contact_date: '2026-09-22' } };
  let nextCalled = false;
  const res = fakeRes();
  await mw(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 409);
  assert.match(res.payload.error, /ใบงาน|ข้อมูลซ้ำ/);
});

test('status POST preserves existing upsert/edit flow while checking duplicate names on other codes', async () => {
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  const mw = createApiValidationMiddleware(pool);
  const req = { method: 'POST', path: '/statuses', body: { status_code: '10', status_name: 'กำลังซ่อม', department: 'ซ่อม', route_page: 'repair' } };
  let nextCalled = false;
  const res = fakeRes();
  await mw(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /LOWER\(TRIM\(status_code\)\)<>LOWER\(TRIM\(\$1\)\)/);
  assert.deepEqual(calls[0].params, ['10', 'กำลังซ่อม']);
});
