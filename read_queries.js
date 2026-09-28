function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

const REPORT_SORT_FIELDS = new Set([
  'id','car_plate','customer_name','phone_number','customer_type','car_brand','car_model','vin_no',
  'qt_no','so_no','bl_no','payment_type','damage_level','main_part_name','main_part_qty','sub_part_name',
  'sub_part_qty','cost_labor','cost_part','cost_external','job_status','sa_owner','branch_name',
  'department_routing','contact_date','arrived_date','target_finish_date','actual_finish_date',
  'repair_finish_date','delivery_date','order_part_date','est_part_date','billing_date','part_status',
  'epc_no','ivn_no','is_parked','calculated_station','history_date','insurance_pay_date','insurance_payment_date','total_cost'
]);

const REPORT_FILTER_FIELDS = new Set([...REPORT_SORT_FIELDS].filter(f => !['id','history_date'].includes(f)));
const REPORT_DATE_FIELDS = new Set([
  'contact_date','arrived_date','target_finish_date','actual_finish_date','repair_finish_date','delivery_date',
  'order_part_date','est_part_date','billing_date','insurance_pay_date','insurance_payment_date','part_received_all_date'
]);
const REPORT_FACET_FIELDS = new Set([...REPORT_FILTER_FIELDS]);

const CALCULATED_STATION_SQL = `(CASE
  WHEN COALESCE(station_ready::text, '') IN ('true','TRUE','1') THEN '12.รอส่งมอบ'
  WHEN COALESCE(station_pak::text, '') IN ('true','TRUE','1') THEN '11.พักซ่อม'
  WHEN COALESCE(station_film::text, '') IN ('true','TRUE','1') THEN '10.ฟิล์ม'
  WHEN COALESCE(station_kraj::text, '') IN ('true','TRUE','1') THEN '09.กระจก'
  WHEN COALESCE(station_mag::text, '') IN ('true','TRUE','1') THEN '08.แม็ก'
  WHEN COALESCE(station_qc::text, '') IN ('true','TRUE','1') THEN '07.QC'
  WHEN COALESCE(station_kat::text, '') IN ('true','TRUE','1') THEN '06.ขัดสี'
  WHEN COALESCE(station_prak::text, '') IN ('true','TRUE','1') THEN '05.ประกอบ'
  WHEN COALESCE(station_pon::text, '') IN ('true','TRUE','1') THEN '04.พ่นสี'
  WHEN COALESCE(station_puan::text, '') IN ('true','TRUE','1') THEN '03.เตรียมพื้น'
  WHEN COALESCE(station_pou::text, '') IN ('true','TRUE','1') THEN '02.โป๊ว'
  WHEN COALESCE(station_kho::text, '') IN ('true','TRUE','1') THEN '01.เคาะ'
  ELSE 'ส่งจ๊อบ' END)`;

function reportFieldExpression(field) {
  if (field === 'calculated_station') return CALCULATED_STATION_SQL;
  if (field === 'history_date') return 'COALESCE(arrived_date, contact_date)';
  if (field === 'total_cost') return '(COALESCE(cost_labor,0) + COALESCE(cost_part,0) + COALESCE(cost_external,0))';
  return field;
}

function parseStringArray(raw, max = 500) {
  if (!raw) return [];
  let value = raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { value = JSON.parse(raw); } catch (_) { value = raw; }
  }
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map(clean).filter(Boolean).slice(0, max);
}

const REPORT_SEARCH_FIELDS = [
  'car_plate','customer_name','phone_number','customer_phone','vin_no','car_brand','car_model','job_status',
  'sa_owner','branch_name','department_routing','qt_no','so_no','bl_no','epc_no','ivn_no','part_status',
  'customer_type','payment_type','damage_level','notes','main_part_name','sub_part_name'
];

function safePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

function normalizeFilterDate(value) {
  const v = clean(value);
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v.split('T')[0];
}

function parseFilters(raw) {
  if (!raw) return {};
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (_) { return {}; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out = {};
  for (const [field, values] of Object.entries(parsed)) {
    if (!REPORT_FILTER_FIELDS.has(field)) continue;
    const arr = Array.isArray(values) ? values : [values];
    const cleaned = arr.map(v => REPORT_DATE_FIELDS.has(field) ? normalizeFilterDate(v) : clean(v)).slice(0, 500);
    if (cleaned.length) out[field] = cleaned;
  }
  return out;
}

function buildReportsWhere(query = {}, options = {}) {
  const where = [];
  const values = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  const addExact = (column, raw) => {
    const v = clean(raw);
    if (!v) return;
    where.push(`${column} = ${addValue(v)}`);
  };

  addExact('branch_name', query.branch);
  addExact('department_routing', query.department_routing);
  addExact('sa_owner', query.sa_owner);
  addExact('job_status', query.job_status);

  const excluded = clean(query.exclude_status);
  if (excluded) where.push(`COALESCE(job_status, '') <> ${addValue(excluded)}`);

  const excludedStatuses = parseStringArray(query.exclude_statuses, 100);
  if (excludedStatuses.length) {
    // Preserve the legacy Jobs Table rule exactly:
    // exclude statuses that contain the configured label OR start with its 2-character code.
    const prefixPatterns = [...new Set(excludedStatuses.map(status => `${status.substring(0, 2)}%`))];
    const containsPatterns = excludedStatuses.map(status => `%${status}%`);
    const prefixParam = addValue(prefixPatterns);
    const containsParam = addValue(containsPatterns);
    where.push(`NOT (COALESCE(job_status, '') LIKE ANY(${prefixParam}::text[]) OR COALESCE(job_status, '') LIKE ANY(${containsParam}::text[]))`);
  }
  if (String(query.exclude_billing || '') === '1') {
    // Legacy browser logic treats null, empty string and whitespace as "not billed yet".
    // Cast to text so the same query is safe whether billing_date is DATE or TEXT in an older DB.
    where.push(`NULLIF(BTRIM(COALESCE(billing_date::text, '')), '') IS NULL`);
  }
  const excludeDepartment = clean(query.exclude_department);
  if (excludeDepartment) where.push(`COALESCE(department_routing, '') <> ${addValue(excludeDepartment)}`);

  const search = clean(query.search);
  if (search) {
    const placeholder = addValue(`%${search}%`);
    const concat = REPORT_SEARCH_FIELDS.map(f => `COALESCE(${f}::text, '')`).join(', ');
    where.push(`CONCAT_WS(' ', ${concat}) ILIKE ${placeholder}`);
  }

  const missingField = REPORT_DATE_FIELDS.has(clean(query.missing_field)) ? clean(query.missing_field) : '';
  if (missingField) where.push(`${missingField} IS NULL`);

  const presentField = REPORT_DATE_FIELDS.has(clean(query.present_field)) ? clean(query.present_field) : '';
  if (presentField) where.push(`${presentField} IS NOT NULL`);

  const dateField = REPORT_DATE_FIELDS.has(clean(query.date_field)) ? clean(query.date_field) : '';
  const dateFrom = clean(query.date_from);
  const dateTo = clean(query.date_to);
  if (dateField && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) where.push(`${dateField}::date >= ${addValue(dateFrom)}::date`);
  if (dateField && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) where.push(`${dateField}::date <= ${addValue(dateTo)}::date`);

  const filters = parseFilters(query.filters);
  const omitFilterField = options.omitFilterField || '';
  for (const [field, selected] of Object.entries(filters)) {
    if (field === omitFilterField || selected.length === 0) continue;
    const placeholder = addValue(selected);
    const expr = reportFieldExpression(field);
    if (REPORT_DATE_FIELDS.has(field)) {
      where.push(`COALESCE(${expr}::date::text, '') = ANY(${placeholder}::text[])`);
    } else {
      where.push(`COALESCE(${expr}::text, '') = ANY(${placeholder}::text[])`);
    }
  }

  return { where, values };
}

function buildReportsReadQuery(query = {}) {
  const where = [];
  const values = [];
  const add = (sql, value) => {
    const v = clean(value);
    if (!v) return;
    values.push(v);
    where.push(sql.replace('?', `$${values.length}`));
  };

  add('branch_name = ?', query.branch);
  add('department_routing = ?', query.department_routing);
  add("COALESCE(job_status, '') <> ?", query.exclude_status);

  return {
    text: `SELECT * FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`,
    values
  };
}

function buildPagedReportsReadQuery(query = {}) {
  const { where, values } = buildReportsWhere(query);
  const page = safePositiveInt(query.page, 1);
  const pageSize = safePositiveInt(query.limit, 50, 200);
  const offset = (page - 1) * pageSize;
  const sortField = REPORT_SORT_FIELDS.has(clean(query.sort)) ? clean(query.sort) : 'id';
  const direction = clean(query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortExpression = reportFieldExpression(sortField);
  const limitParam = `$${values.length + 1}`;
  const offsetParam = `$${values.length + 2}`;
  return {
    text: `SELECT rizenicreport.*, COUNT(*) OVER() AS __total_count FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${sortExpression} ${direction} NULLS LAST LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values: [...values, pageSize, offset],
    page,
    pageSize,
    offset,
    sortField,
    direction
  };
}


function buildFilteredReportsReadQuery(query = {}) {
  const { where, values } = buildReportsWhere(query);
  const sortField = REPORT_SORT_FIELDS.has(clean(query.sort)) ? clean(query.sort) : 'id';
  const direction = clean(query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortExpression = reportFieldExpression(sortField);
  return {
    text: `SELECT * FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${sortExpression} ${direction} NULLS LAST`,
    values,
    sortField,
    direction
  };
}

function buildReportsCountQuery(query = {}) {
  const { where, values } = buildReportsWhere(query);
  return {
    text: `SELECT COUNT(*)::int AS total FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`,
    values
  };
}

function buildReportsFacetQuery(query = {}) {
  const field = clean(query.facet);
  if (!REPORT_FACET_FIELDS.has(field)) throw new Error('Invalid report facet field');
  const { where, values } = buildReportsWhere(query, { omitFilterField: field });
  const fieldExpr = reportFieldExpression(field);
  const valueExpr = REPORT_DATE_FIELDS.has(field) ? `COALESCE(${fieldExpr}::date::text, '')` : `COALESCE(${fieldExpr}::text, '')`;
  return {
    text: `SELECT DISTINCT ${valueExpr} AS value FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY value ASC`,
    values,
    field
  };
}

function buildPartOrdersReadQuery(query = {}) {
  const where = [];
  const values = [];
  const add = (sql, value) => {
    values.push(value);
    where.push(sql.replace('?', `$${values.length}`));
  };
  const branch = clean(query.branch);
  if (branch) add('branch_name = ?', branch);

  const jobIds = parseStringArray(query.job_ids, 200);
  const carPlates = parseStringArray(query.car_plates, 200);
  if (jobIds.length && carPlates.length) {
    const jobP = `$${values.length + 1}`;
    values.push(jobIds);
    const plateP = `$${values.length + 1}`;
    values.push(carPlates);
    where.push(`(job_id::text = ANY(${jobP}::text[]) OR car_plate = ANY(${plateP}::text[]))`);
  } else if (jobIds.length) {
    const p = `$${values.length + 1}`;
    values.push(jobIds);
    where.push(`job_id::text = ANY(${p}::text[])`);
  } else if (carPlates.length) {
    const p = `$${values.length + 1}`;
    values.push(carPlates);
    where.push(`car_plate = ANY(${p}::text[])`);
  }

  return {
    text: `SELECT * FROM rizenic_part_orders${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY order_id DESC`,
    values
  };
}

function buildEmployeesReadQuery(query = {}) {
  const branch = clean(query.branch);
  const safeFields = 'employee_id, employee_code, employee_name, employee_role, branch_name, username, accessible_pages, is_active';
  if (!branch) {
    return { text: `SELECT ${safeFields} FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC`, values: [] };
  }
  return {
    text: `SELECT ${safeFields} FROM rizenicemployeemaster WHERE branch_name = $1 ORDER BY branch_name ASC, employee_code ASC`,
    values: [branch]
  };
}

module.exports = {
  buildReportsReadQuery,
  buildPagedReportsReadQuery,
  buildReportsCountQuery,
  buildFilteredReportsReadQuery,
  buildReportsFacetQuery,
  buildReportsWhere,
  buildPartOrdersReadQuery,
  buildEmployeesReadQuery,
  REPORT_SORT_FIELDS,
  REPORT_FILTER_FIELDS,
  REPORT_DATE_FIELDS
};
