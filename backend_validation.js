'use strict';

const BINARY_KEYS = new Set([
  'car_diagram_image', 'customer_signature', 'inspector_signature',
  'image', 'signature', 'file', 'base64'
]);

const DATE_FIELDS = new Set([
  'quota_date', 'target_finish_date', 'actual_finish_date', 'delivery_date',
  'contact_date', 'arrived_date', 'order_part_date', 'est_part_date',
  'appointment_date', 'billing_date', 'insurance_pay_date', 'repair_finish_date',
  'order_date', 'est_arrival_date', 'received_date', 'issue_date'
]);

const MONEY_FIELDS = new Set(['cost_labor', 'cost_part', 'cost_external', 'unit_price']);
const NON_NEG_INT_FIELDS = new Set([
  'main_part_qty', 'sub_part_qty', 'qty_ordered', 'qty_received', 'qty',
  'safety_stock', 'quota_arrived', 'quota_target', 'quota_delivery',
  'quota_main_parts', 'quota_sub_parts', 'current_mileage'
]);

function normalizeBody(value, key = '') {
  if (Array.isArray(value)) return value.map(v => normalizeBody(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeBody(v, k);
    return out;
  }
  if (typeof value === 'string' && !BINARY_KEYS.has(key) && !/(?:image|signature|base64)$/i.test(key)) {
    return value.trim();
  }
  return value;
}

function isBlank(v) { return v === undefined || v === null || (typeof v === 'string' && v.trim() === ''); }
function isValidDate(v) {
  if (isBlank(v)) return true;
  if (typeof v !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)) return false;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return !Number.isNaN(d.getTime());
}
function isNonNegativeNumber(v) {
  if (isBlank(v)) return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}
function isPositiveInt(v) {
  if (isBlank(v)) return false;
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}
function isNonNegativeInt(v) {
  if (isBlank(v)) return true;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0;
}
function isPhone(v) {
  if (isBlank(v)) return true;
  return /^[0-9+()\-\s]{8,20}$/.test(String(v));
}
function isVin(v) {
  if (isBlank(v)) return true;
  return /^[A-HJ-NPR-Z0-9]{11,20}$/i.test(String(v));
}
function isSafeCode(v, max = 80) {
  if (isBlank(v)) return false;
  const s = String(v);
  return s.length <= max && /^[\p{L}\p{N}._\-/]+$/u.test(s);
}
function hasControlChars(v) {
  return typeof v === 'string' && /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v);
}

function validatePayload(method, path, body = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const required = (field, label = field) => { if (isBlank(body[field])) add(field, `กรุณาระบุ${label}`); };
  const max = (field, len, label = field) => {
    if (!isBlank(body[field]) && String(body[field]).length > len) add(field, `${label}ยาวเกิน ${len} ตัวอักษร`);
  };

  // Reject invisible/control characters in ordinary text values.
  for (const [field, value] of Object.entries(body || {})) {
    if (!BINARY_KEYS.has(field) && !/(?:image|signature|base64)$/i.test(field) && hasControlChars(value)) {
      add(field, `${field} มีอักขระที่ไม่อนุญาต`);
    }
  }

  if (path === '/login' && method === 'POST') {
    required('username', ' Username');
    required('password', ' Password');
  }

  if (/^\/employees(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    for (const [f, l] of [['employee_code','รหัสพนักงาน'],['employee_name','ชื่อพนักงาน'],['employee_role','ตำแหน่ง'],['branch_name','สาขา'],['username','Username'],['password','Password']]) required(f, l);
    if (!isBlank(body.employee_code) && !isSafeCode(body.employee_code, 50)) add('employee_code', 'รหัสพนักงานมีรูปแบบไม่ถูกต้อง');
    if (!isBlank(body.username) && !/^[A-Za-z0-9._-]{3,50}$/.test(body.username)) add('username', 'Username ใช้ได้เฉพาะ a-z, 0-9, จุด, _ และ - (3-50 ตัว)');
    if (!isBlank(body.password) && (String(body.password).length < 4 || String(body.password).length > 128)) add('password', 'Password ต้องมี 4-128 ตัวอักษร');
    max('employee_name', 150, 'ชื่อพนักงาน'); max('employee_role', 80, 'ตำแหน่ง'); max('branch_name', 100, 'สาขา');
  }

  if (/^\/car-models(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    required('car_brand', 'ยี่ห้อรถ'); required('car_model', 'รุ่นรถ');
    max('car_brand', 80, 'ยี่ห้อรถ'); max('car_model', 120, 'รุ่นรถ');
  }

  if (/^\/insurances(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    if (method === 'POST') required('insurance_code', 'รหัสประกัน');
    required('insurance_name', 'ชื่อประกัน');
    if (method === 'POST' && !isBlank(body.insurance_code) && !isSafeCode(body.insurance_code, 50)) add('insurance_code', 'รหัสประกันมีรูปแบบไม่ถูกต้อง');
    max('insurance_name', 180, 'ชื่อประกัน'); max('insurance_type', 100, 'ประเภทประกัน');
  }

  if (/^\/customer-types(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    required('type_name', 'ประเภทลูกค้า'); max('type_name', 120, 'ประเภทลูกค้า');
  }

  if (/^\/parts(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    required('part_no', 'Part No.'); required('part_name', 'ชื่ออะไหล่');
    max('part_no', 100, 'Part No.'); max('part_name', 250, 'ชื่ออะไหล่');
    if (!isNonNegativeNumber(body.unit_price)) add('unit_price', 'ราคาต่อหน่วยต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if (!isNonNegativeInt(body.safety_stock)) add('safety_stock', 'Safety Stock ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
  }

  if (path === '/statuses' && method === 'POST') {
    required('status_code', 'รหัสสถานะ'); required('status_name', 'ชื่อสถานะ');
    if (!isBlank(body.status_code) && !isSafeCode(body.status_code, 50)) add('status_code', 'รหัสสถานะมีรูปแบบไม่ถูกต้อง');
    max('status_name', 160, 'ชื่อสถานะ');
  }

  if (/^\/body-parts(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    required('category', 'หมวดหมู่'); required('part_name', 'ชื่อชิ้นส่วน');
    max('category', 100, 'หมวดหมู่'); max('part_name', 180, 'ชื่อชิ้นส่วน');
  }

  if (path === '/part-statuses' && method === 'POST') {
    required('status_name', 'สถานะอะไหล่'); max('status_name', 120, 'สถานะอะไหล่');
  }

  if (/^\/quotas(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    required('branch_name', 'สาขา');
    if (!['default', 'special'].includes(body.quota_type || 'default')) add('quota_type', 'ประเภทโควต้าไม่ถูกต้อง');
    if (body.quota_type === 'special' && !isValidDate(body.quota_date)) add('quota_date', 'วันที่โควต้าพิเศษไม่ถูกต้อง');
    if (body.quota_type === 'special' && isBlank(body.quota_date)) add('quota_date', 'กรุณาระบุวันที่โควต้าพิเศษ');
    for (const f of ['quota_arrived','quota_target','quota_delivery','quota_main_parts','quota_sub_parts']) {
      if (!isNonNegativeInt(body[f])) add(f, `${f} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
    }
  }

  if (/^\/report(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    if (!isPhone(body.phone_number)) add('phone_number', 'เบอร์โทรศัพท์มีรูปแบบไม่ถูกต้อง');
    if (!isVin(body.vin_no)) add('vin_no', 'VIN มีรูปแบบไม่ถูกต้อง');
    for (const f of DATE_FIELDS) if (Object.prototype.hasOwnProperty.call(body, f) && !isValidDate(body[f])) add(f, `${f} ต้องเป็นวันที่ที่ถูกต้อง`);
    for (const f of MONEY_FIELDS) if (Object.prototype.hasOwnProperty.call(body, f) && !isNonNegativeNumber(body[f])) add(f, `${f} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`);
    for (const f of ['main_part_qty','sub_part_qty']) if (Object.prototype.hasOwnProperty.call(body, f) && !isNonNegativeInt(body[f])) add(f, `${f} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
    max('car_plate', 30, 'ทะเบียนรถ'); max('customer_name', 180, 'ชื่อลูกค้า'); max('notes', 5000, 'หมายเหตุ');
  }

  if (/^\/report\/[^/]+\/fast-date$/.test(path) && method === 'PUT') {
    required('field', 'ฟิลด์');
    if (DATE_FIELDS.has(body.field) && !isValidDate(body.value)) add('value', 'วันที่มีรูปแบบไม่ถูกต้อง');
    if (MONEY_FIELDS.has(body.field) && !isNonNegativeNumber(body.value)) add('value', 'จำนวนเงินต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if (body.field === 'phone_number' && !isPhone(body.value)) add('value', 'เบอร์โทรศัพท์มีรูปแบบไม่ถูกต้อง');
    if (body.field === 'vin_no' && !isVin(body.value)) add('value', 'VIN มีรูปแบบไม่ถูกต้อง');
  }

  if (/^\/part-orders(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    if (method === 'POST') { required('part_no', 'Part No.'); required('part_name', 'ชื่ออะไหล่'); required('order_date', 'วันที่สั่ง'); required('branch_name', 'สาขา'); }
    if (Object.prototype.hasOwnProperty.call(body, 'qty_ordered') && !isPositiveInt(body.qty_ordered)) add('qty_ordered', 'จำนวนสั่งต้องเป็นจำนวนเต็มมากกว่า 0');
    for (const f of ['order_date','est_arrival_date','received_date']) if (Object.prototype.hasOwnProperty.call(body, f) && !isValidDate(body[f])) add(f, `${f} ต้องเป็นวันที่ที่ถูกต้อง`);
    if (!isVin(body.vin_no)) add('vin_no', 'VIN มีรูปแบบไม่ถูกต้อง');
  }

  if (/^\/(?:part-orders|part-inbound|part-outbound)\/[^/]+\/fast$/.test(path) && method === 'PUT') {
    required('field', 'ฟิลด์');
    const f = body.field;
    if (['qty', 'qty_ordered', 'qty_received'].includes(f) && !isPositiveInt(body.value)) add('value', 'จำนวนต้องเป็นจำนวนเต็มมากกว่า 0');
    if (f === 'unit_price' && !isNonNegativeNumber(body.value)) add('value', 'ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
    if (DATE_FIELDS.has(f) && !isValidDate(body.value)) add('value', 'วันที่มีรูปแบบไม่ถูกต้อง');
  }

  if (/^\/report\/[^/]+\/station$/.test(path) && method === 'PUT') {
    for (const f of ['repair_finish_date', 'target_finish_date', 'delivery_date']) {
      if (Object.prototype.hasOwnProperty.call(body, f) && !isValidDate(body[f])) add(f, `${f} ต้องเป็นวันที่ที่ถูกต้อง`);
    }
  }

  if (path === '/part-inbound' && method === 'POST') {
    required('received_date', 'วันที่รับเข้า'); required('part_no', 'Part No.'); required('part_name', 'ชื่ออะไหล่');
    if (!isValidDate(body.received_date)) add('received_date', 'วันที่รับเข้าไม่ถูกต้อง');
    if (!isPositiveInt(body.qty)) add('qty', 'จำนวนรับเข้าต้องเป็นจำนวนเต็มมากกว่า 0');
    if (!isNonNegativeNumber(body.unit_price)) add('unit_price', 'ราคาต่อหน่วยต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  }

  if (/^\/part-outbound(?:\/[^/]+)?$/.test(path) && ['POST', 'PUT'].includes(method)) {
    if (method === 'POST') { required('issue_date', 'วันที่เบิก'); required('part_no', 'Part No.'); required('part_name', 'ชื่ออะไหล่'); }
    if (Object.prototype.hasOwnProperty.call(body, 'issue_date') && !isValidDate(body.issue_date)) add('issue_date', 'วันที่เบิกไม่ถูกต้อง');
    if (Object.prototype.hasOwnProperty.call(body, 'qty') && !isPositiveInt(body.qty)) add('qty', 'จำนวนเบิกต้องเป็นจำนวนเต็มมากกว่า 0');
  }

  if (path === '/inspection' && method === 'POST') {
    required('job_id', 'Job ID');
    if (!isBlank(body.current_mileage) && !isNonNegativeInt(body.current_mileage)) add('current_mileage', 'เลขไมล์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
    if (!isBlank(body.fuel_level) && (!isNonNegativeNumber(body.fuel_level) || Number(body.fuel_level) > 100)) add('fuel_level', 'ระดับน้ำมันต้องอยู่ระหว่าง 0-100');
  }

  if (path === '/send-line-notify' && method === 'POST') {
    required('branch', 'สาขา'); required('message', 'ข้อความ'); max('message', 5000, 'ข้อความ');
  }

  if (path === '/user-preferences' && method === 'POST') required('emp_name', 'ชื่อพนักงาน');

  if (path === '/sync-dynamic' && method === 'POST') {
    required('tableName', 'ชื่อตาราง');
    if (!isBlank(body.tableName) && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.tableName)) add('tableName', 'ชื่อตารางมีรูปแบบไม่ถูกต้อง');
    if (!isBlank(body.primaryKey) && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.primaryKey)) add('primaryKey', 'Primary Key มีรูปแบบไม่ถูกต้อง');
    if (!Array.isArray(body.data) || body.data.length === 0) add('data', 'ข้อมูลสำหรับ Sync ต้องเป็น Array และห้ามว่าง');
    if (Array.isArray(body.data)) {
      for (const row of body.data.slice(0, 1000)) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) { add('data', 'รูปแบบแถวข้อมูลไม่ถูกต้อง'); break; }
        if (Object.keys(row).some(k => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))) { add('data', 'ชื่อคอลัมน์มีรูปแบบไม่ถูกต้อง'); break; }
      }
    }
  }

  return errors;
}

function parseId(path, prefix) {
  const m = path.match(new RegExp(`^/${prefix}/([^/]+)$`));
  return m ? m[1] : null;
}

async function findDuplicate(pool, method, path, body) {
  if (method === 'POST' && path === '/report' && !isBlank(body.car_plate) && !isBlank(body.contact_date)) {
    const r = await pool.query(`SELECT id FROM rizenicreport WHERE LOWER(REPLACE(TRIM(car_plate), ' ', ''))=LOWER(REPLACE(TRIM($1), ' ', '')) AND DATE(contact_date)=DATE($2) LIMIT 1`, [body.car_plate, body.contact_date]);
    if (r.rows.length) return 'ข้อมูลซ้ำ: ใบงานของรถคันนี้ในวันที่ติดต่อเดียวกันมีอยู่แล้ว';
  }
  if (method === 'POST' && path === '/employees') {
    const r = await pool.query(`SELECT employee_id FROM rizenicemployeemaster WHERE LOWER(TRIM(username))=LOWER(TRIM($1)) OR LOWER(TRIM(employee_code))=LOWER(TRIM($2)) LIMIT 1`, [body.username, body.employee_code]);
    if (r.rows.length) return 'ข้อมูลซ้ำ: Username หรือรหัสพนักงานนี้มีอยู่ในระบบแล้ว';
  }
  if (method === 'PUT' && /^\/employees\/[^/]+$/.test(path)) {
    const id = parseId(path, 'employees');
    const r = await pool.query(`SELECT employee_id FROM rizenicemployeemaster WHERE employee_id<>$3 AND (LOWER(TRIM(username))=LOWER(TRIM($1)) OR LOWER(TRIM(employee_code))=LOWER(TRIM($2))) LIMIT 1`, [body.username, body.employee_code, id]);
    if (r.rows.length) return 'Username หรือรหัสพนักงานนี้ซ้ำกับผู้ใช้งานอื่น';
  }
  if (['POST','PUT'].includes(method) && /^\/car-models(?:\/[^/]+)?$/.test(path)) {
    const id = method === 'PUT' ? parseId(path, 'car-models') : null;
    const sql = `SELECT model_id FROM rizeniccarmodelmaster WHERE LOWER(TRIM(car_brand))=LOWER(TRIM($1)) AND LOWER(TRIM(car_model))=LOWER(TRIM($2))${id ? ' AND model_id<>$3' : ''} LIMIT 1`;
    const r = await pool.query(sql, id ? [body.car_brand, body.car_model, id] : [body.car_brand, body.car_model]);
    if (r.rows.length) return 'ยี่ห้อและรุ่นรถนี้มีอยู่ในระบบแล้ว';
  }
  if (['POST','PUT'].includes(method) && /^\/insurances(?:\/[^/]+)?$/.test(path)) {
    const id = method === 'PUT' ? parseId(path, 'insurances') : null;
    const vals = [body.insurance_code || id, body.insurance_name];
    let sql = `SELECT insurance_code FROM rizenicinsurancemaster WHERE (LOWER(TRIM(insurance_code))=LOWER(TRIM($1)) OR LOWER(TRIM(insurance_name))=LOWER(TRIM($2)))`;
    if (id) { sql += ` AND insurance_code<>$3`; vals.push(id); }
    sql += ' LIMIT 1';
    const r = await pool.query(sql, vals);
    if (r.rows.length) return 'รหัสหรือชื่อประกันภัยนี้มีอยู่ในระบบแล้ว';
  }
  if (['POST','PUT'].includes(method) && /^\/customer-types(?:\/[^/]+)?$/.test(path)) {
    const id = method === 'PUT' ? parseId(path, 'customer-types') : null;
    const sql = `SELECT customer_type_id FROM rizeniccustomertypemaster WHERE LOWER(TRIM(type_name))=LOWER(TRIM($1))${id ? ' AND customer_type_id<>$2' : ''} LIMIT 1`;
    const r = await pool.query(sql, id ? [body.type_name, id] : [body.type_name]);
    if (r.rows.length) return 'ประเภทลูกค้านี้มีอยู่ในระบบแล้ว';
  }
  if (method === 'POST' && path === '/parts') {
    const r = await pool.query(`SELECT part_id FROM rizenicpartsmaster WHERE LOWER(TRIM(part_no))=LOWER(TRIM($1)) LIMIT 1`, [body.part_no]);
    if (r.rows.length) return 'Part No. นี้มีอยู่ใน Master แล้ว กรุณาแก้ไขรายการเดิม';
  }
  if (method === 'PUT' && /^\/parts\/[^/]+$/.test(path)) {
    const id = parseId(path, 'parts');
    const r = await pool.query(`SELECT part_id FROM rizenicpartsmaster WHERE part_id<>$2 AND LOWER(TRIM(part_no))=LOWER(TRIM($1)) LIMIT 1`, [body.part_no, id]);
    if (r.rows.length) return 'Part No. นี้ซ้ำกับรายการอื่น';
  }
  if (method === 'POST' && path === '/statuses') {
    // /api/statuses intentionally uses POST + ON CONFLICT(status_code) for both create and edit.
    // Keep that flow, but block reusing the same status name on a different code.
    const r = await pool.query(`SELECT status_code FROM rizenicstatusmaster WHERE LOWER(TRIM(status_name))=LOWER(TRIM($2)) AND LOWER(TRIM(status_code))<>LOWER(TRIM($1)) LIMIT 1`, [body.status_code, body.status_name]);
    if (r.rows.length) return 'ชื่อสถานะนี้ซ้ำกับรหัสสถานะอื่นในระบบ';
  }
  if (['POST','PUT'].includes(method) && /^\/body-parts(?:\/[^/]+)?$/.test(path)) {
    const id = method === 'PUT' ? parseId(path, 'body-parts') : null;
    const sql = `SELECT id FROM rizenic_body_parts WHERE LOWER(TRIM(category))=LOWER(TRIM($1)) AND LOWER(TRIM(part_name))=LOWER(TRIM($2))${id ? ' AND id<>$3' : ''} LIMIT 1`;
    const r = await pool.query(sql, id ? [body.category, body.part_name, id] : [body.category, body.part_name]);
    if (r.rows.length) return 'หมวดหมู่และชิ้นส่วนนี้มีอยู่ในระบบแล้ว';
  }
  if (method === 'POST' && path === '/part-statuses') {
    const r = await pool.query(`SELECT status_id FROM rizenic_part_status_master WHERE LOWER(TRIM(status_name))=LOWER(TRIM($1)) LIMIT 1`, [body.status_name]);
    if (r.rows.length) return 'สถานะอะไหล่นี้มีอยู่ในระบบแล้ว';
  }
  if (['POST','PUT'].includes(method) && /^\/quotas(?:\/[^/]+)?$/.test(path)) {
    const id = method === 'PUT' ? parseId(path, 'quotas') : null;
    const vals = [body.branch_name, body.quota_type || 'default'];
    let sql = `SELECT id FROM rizenic_quotas WHERE LOWER(TRIM(branch_name))=LOWER(TRIM($1)) AND quota_type=$2`;
    if ((body.quota_type || 'default') === 'special') { sql += ` AND quota_date::date=$3::date`; vals.push(body.quota_date); }
    else sql += ` AND quota_date IS NULL`;
    if (id) { sql += ` AND id<>$${vals.length + 1}`; vals.push(id); }
    sql += ' LIMIT 1';
    const r = await pool.query(sql, vals);
    if (r.rows.length) return 'โควต้าสาขา/วันที่นี้มีอยู่แล้ว กรุณาแก้ไขรายการเดิม';
  }
  return null;
}

function createApiValidationMiddleware(pool) {
  return async function apiValidation(req, res, next) {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
    req.body = normalizeBody(req.body || {});
    const errors = validatePayload(req.method, req.path, req.body);
    if (errors.length) {
      return res.status(400).json({
        error: `ข้อมูลไม่ถูกต้อง: ${errors[0].message}`,
        validationErrors: errors,
      });
    }
    try {
      const duplicateMessage = await findDuplicate(pool, req.method, req.path, req.body);
      if (duplicateMessage) return res.status(409).json({ error: duplicateMessage, code: 'DUPLICATE_DATA' });
      return next();
    } catch (err) {
      console.error('Validation middleware error:', err);
      return res.status(500).json({ error: 'ตรวจสอบข้อมูลไม่สำเร็จ: ' + err.message });
    }
  };
}

function registerApiValidation(app, pool) {
  app.use('/api', createApiValidationMiddleware(pool));
}

module.exports = {
  normalizeBody,
  validatePayload,
  createApiValidationMiddleware,
  registerApiValidation,
};
