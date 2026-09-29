'use strict';

const { buildReportsWhere } = require('./read_queries');

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function addBranch(where, values, rawBranch, column = 'branch_name') {
  const branch = clean(rawBranch);
  if (!branch || branch.toUpperCase() === 'ALL' || branch.toLowerCase() === 'all') return;
  values.push(branch);
  where.push(`${column} = $${values.length}`);
}

function monthBounds(yearRaw, monthRaw) {
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const start = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}

const REPORT_DASHBOARD_FIELDS = [
  'id','sa_owner','branch_name','customer_name','customer_type','car_brand','car_model','car_plate','payment_type',
  'damage_level','main_part_name','main_part_qty','sub_part_name','sub_part_qty','cost_labor','cost_part','cost_external',
  'job_status','target_finish_date','actual_finish_date','delivery_date','contact_date','arrived_date','billing_date',
  'repair_finish_date','part_status','is_parked','station_kho','station_pou','station_puan','station_pon','station_prak',
  'station_kat','station_qc','station_mag','station_kraj','station_film','station_pak','station_ready'
];

const REPORT_SA_FIELDS = [
  'id','sa_owner','branch_name','customer_name','car_brand','car_model','car_plate','vin_no','qt_no','so_no','damage_level',
  'main_part_name','main_part_qty','sub_part_name','sub_part_qty','cost_labor','cost_part','cost_external','job_status',
  'target_finish_date','delivery_date','contact_date','arrived_date','billing_date','repair_finish_date','department_routing',
  'is_parked','station_kho','station_pou','station_puan','station_pon','station_prak','station_kat','station_qc','station_mag',
  'station_kraj','station_film','station_pak','station_ready'
];

const REPORT_PARTS_FIELDS = [
  'id','branch_name','sa_owner','customer_name','car_plate','vin_no','qt_no','so_no','car_model','job_status',
  'department_routing','arrived_date','contact_date'
];

const REPORT_REPAIR_FIELDS = [
  'id','branch_name','sa_owner','car_plate','vin_no','car_brand','car_model','car_color','qt_no','so_no',
  'appointment_date','arrived_date','target_finish_date','repair_finish_date','delivery_date','main_part_name','main_part_qty','sub_part_name',
  'sub_part_qty','job_status','department_routing','repair_notes','station_kho','station_pou','station_puan','station_pon',
  'station_prak','station_kat','station_qc','station_mag','station_kraj','station_film','station_pak','station_ready'
];

const PART_ORDER_REPAIR_FIELDS = [
  'order_id','job_id','branch_name','car_plate','qt_no','so_no','epc_no','part_no','part_main_no','part_name','qty_ordered',
  'order_status','est_arrival_date','received_date'
];

const PART_ORDER_DASHBOARD_FIELDS = [
  'order_id','job_id','branch_name','car_plate','part_no','part_main_no','part_name','qty_ordered','qty_received',
  'order_status','order_date','est_arrival_date','received_date','part_type','qt_no','so_no','epc_no'
];


function safePositiveInt(value, fallback, max = 100) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}

function pagedRequest(req, fallbackLimit = 50, maxLimit = 100) {
  const page = safePositiveInt(req.query.page, 1, 1000000);
  const pageSize = safePositiveInt(req.query.limit, fallbackLimit, maxLimit);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function splitQueryList(raw, max = 200) {
  if (raw == null || raw === '') return [];
  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(values.map(clean).filter(Boolean))].slice(0, max);
}

function parseKnownTotal(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pageCountProjection(knownTotal) {
  return knownTotal === null ? ', COUNT(*) OVER() AS __total_count' : '';
}

function pageMeta(rows, page, pageSize, knownTotal = null) {
  const total = knownTotal === null ? Number(rows[0]?.__total_count || 0) : knownTotal;
  return { total, totalPages: Math.max(1, Math.ceil(total / pageSize)), page, pageSize };
}

function stripWindowCount(rows) {
  return rows.map(row => {
    const { __total_count, ...item } = row;
    return item;
  });
}

async function buildScopedPartOrdersForKeys(pool, query, rawBranch, fields = PART_ORDER_DASHBOARD_FIELDS) {
  const ids = splitQueryList(query.job_ids);
  const plates = splitQueryList(query.car_plates);
  if (!ids.length && !plates.length) return [];
  const reports = [];
  ids.forEach(id => reports.push({ id }));
  plates.forEach(car_plate => reports.push({ car_plate }));
  return buildScopedPartOrdersForReports(pool, reports, rawBranch, fields);
}

function addSearch(where, values, rawSearch, fields) {
  const search = clean(rawSearch);
  if (!search) return;
  values.push(`%${search}%`);
  const p = `$${values.length}`;
  where.push(`CONCAT_WS(' ', ${fields.map(field => `COALESCE(${field}::text, '')`).join(', ')}) ILIKE ${p}`);
}

const REPAIR_FILTER_FIELDS = new Set([
  'car_plate','vin_no','sa_owner','car_brand','car_model','car_color','appointment_date','arrived_date','target_finish_date',
  'repair_finish_date','delivery_date','main_part_name','main_part_qty','sub_part_name','sub_part_qty','job_status','department_routing','calculated_station'
]);

const REPAIR_STATION_SQL = `(CASE
  WHEN COALESCE(station_ready::text,'') IN ('true','TRUE','1') THEN '12.รอส่งมอบ'
  WHEN COALESCE(station_pak::text,'') IN ('true','TRUE','1') THEN '11.พักซ่อม'
  WHEN COALESCE(station_film::text,'') IN ('true','TRUE','1') THEN '10.ฟิล์ม'
  WHEN COALESCE(station_kraj::text,'') IN ('true','TRUE','1') THEN '09.กระจก'
  WHEN COALESCE(station_mag::text,'') IN ('true','TRUE','1') THEN '08.แม็ก'
  WHEN COALESCE(station_qc::text,'') IN ('true','TRUE','1') THEN '07.QC'
  WHEN COALESCE(station_kat::text,'') IN ('true','TRUE','1') THEN '06.ขัดสี'
  WHEN COALESCE(station_prak::text,'') IN ('true','TRUE','1') THEN '05.ประกอบ'
  WHEN COALESCE(station_pon::text,'') IN ('true','TRUE','1') THEN '04.พ่นสี'
  WHEN COALESCE(station_puan::text,'') IN ('true','TRUE','1') THEN '03.เตรียมพื้น'
  WHEN COALESCE(station_pou::text,'') IN ('true','TRUE','1') THEN '02.โป๊ว'
  WHEN COALESCE(station_kho::text,'') IN ('true','TRUE','1') THEN '01.เคาะ'
  ELSE 'ส่งจ๊อบ' END)`;

function repairFilterExpression(field) {
  if (field === 'calculated_station') return REPAIR_STATION_SQL;
  if (field === 'car_brand') return `CONCAT_WS(' ', COALESCE(car_brand::text,''), COALESCE(car_model::text,''))`;
  if (['appointment_date','arrived_date','target_finish_date','repair_finish_date','delivery_date'].includes(field)) {
    return `COALESCE(${field}::date::text, '')`;
  }
  if (field === 'main_part_qty') {
    return `(CASE WHEN COALESCE(main_part_qty,0) > 0 THEN COALESCE(main_part_qty,0) WHEN NULLIF(BTRIM(COALESCE(main_part_name,'')),'') IS NOT NULL THEN array_length(string_to_array(main_part_name, ','),1) ELSE 0 END)::text`;
  }
  if (field === 'sub_part_qty') {
    return `(CASE WHEN COALESCE(sub_part_qty,0) > 0 THEN COALESCE(sub_part_qty,0) WHEN NULLIF(BTRIM(COALESCE(sub_part_name,'')),'') IS NOT NULL THEN array_length(string_to_array(sub_part_name, ','),1) ELSE 0 END)::text`;
  }
  return `COALESCE(${field}::text, '')`;
}

function addRepairFilters(where, values, rawFilters) {
  if (!rawFilters) return;
  let filters = rawFilters;
  if (typeof rawFilters === 'string') {
    try { filters = JSON.parse(rawFilters); } catch (_) { return; }
  }
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return;
  for (const [field, rawSelected] of Object.entries(filters)) {
    if (!REPAIR_FILTER_FIELDS.has(field)) continue;
    const selected = (Array.isArray(rawSelected) ? rawSelected : [rawSelected]).map(clean).filter(Boolean).slice(0, 100);
    if (!selected.length) continue;
    values.push(selected);
    const p = `$${values.length}`;
    where.push(`${repairFilterExpression(field)} = ANY(${p}::text[])`);
  }
}

async function buildScopedPartOrdersForReports(pool, reports, rawBranch, fields = PART_ORDER_DASHBOARD_FIELDS) {
  const ids = [...new Set((reports || []).map(row => clean(row.id ?? row.report_id)).filter(Boolean))];
  const plates = [...new Set((reports || []).map(row => clean(row.car_plate)).filter(Boolean))];
  if (!ids.length && !plates.length) return [];

  const runScoped = (condition, firstValue) => {
    const where = [condition];
    const values = [firstValue];
    addBranch(where, values, rawBranch);
    return pool.query(`SELECT ${fields.join(', ')} FROM rizenic_part_orders WHERE ${where.join(' AND ')} ORDER BY order_id DESC`, values);
  };

  const byJobPromise = ids.length
    ? runScoped(`job_id::text = ANY($1::text[])`, ids)
    : Promise.resolve({ rows: [] });
  const byPlateFallbackPromise = plates.length
    ? runScoped(`NULLIF(BTRIM(COALESCE(job_id::text, '')), '') IS NULL AND car_plate = ANY($1::text[])`, plates)
    : Promise.resolve({ rows: [] });
  const [byJob, byPlateFallback] = await Promise.all([byJobPromise, byPlateFallbackPromise]);

  const seen = new Set();
  return [...byJob.rows, ...byPlateFallback.rows]
    .filter(row => {
      const key = clean(row.order_id) || JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(b.order_id || 0) - Number(a.order_id || 0));
}

const ADMIN_RESOURCES = Object.freeze({
  employees: {
    table: 'rizenicemployeemaster', fields: 'employee_id, employee_code, employee_name, employee_role, branch_name, username, accessible_pages, is_active',
    search: ['employee_code','employee_name','employee_role','branch_name','username'],
    order: 'branch_name ASC, employee_code ASC'
  },
  'car-models': {
    table: 'rizeniccarmodelmaster', fields: 'model_id, car_brand, car_model',
    search: ['car_brand','car_model'], order: 'car_brand ASC, car_model ASC'
  },
  insurances: {
    table: 'rizenicinsurancemaster', fields: 'insurance_code, insurance_name, insurance_type',
    search: ['insurance_code','insurance_name','insurance_type'], order: 'insurance_code ASC'
  },
  'customer-types': {
    table: 'rizeniccustomertypemaster', fields: 'customer_type_id, type_code, type_name',
    search: ['type_code','type_name'], order: 'type_code ASC'
  },
  'body-parts': {
    table: 'rizenic_body_parts', fields: 'id, category, part_name',
    search: ['category','part_name'], order: 'id ASC'
  },
  statuses: {
    table: 'rizenicstatusmaster', fields: 'status_code, status_name, department, route_page',
    search: ['status_code','status_name','department','route_page'], order: 'status_code ASC'
  },
  'part-statuses': {
    table: 'rizenic_part_status_master', fields: 'status_id, status_name',
    search: ['status_name'], order: 'status_id ASC'
  },
  quotas: {
    table: 'rizenic_quotas', fields: '*',
    search: ['quota_type','branch_name','quota_date'], order: 'quota_type ASC, quota_date DESC NULLS LAST, id DESC'
  }
});

function normalizedRepairJobStatusSql() {
  return "TRANSLATE(BTRIM(COALESCE(job_status,'')), U&'\\200B\\200C\\200D\\2060\\FEFF', '')";
}

function repairLegacyBaseConditions() {
  // Preserve the original Repair-page eligibility everywhere outside the
  // explicitly-special Calendar and repair-queue rules.
  return [
    "COALESCE(job_status,'') NOT ILIKE '%ยกเลิก%'",
    "COALESCE(job_status,'') NOT ILIKE '%ส่งมอบแล้ว%'",
    "COALESCE(job_status,'') <> '12.ส่งมอบ'"
  ];
}

function repairQueueConditions(calendarMode = false) {
  if (calendarMode) return ['TRUE'];
  const statusExpr = normalizedRepairJobStatusSql();
  return [
    "department_routing = 'ซ่อม'",
    `${statusExpr} ~ '^(09|10|11)([.[:space:]]|$)'`,
    ...repairLegacyBaseConditions(),
    `${statusExpr} <> '12.ส่งมอบ'`
  ];
}

function registerServerSideViews(app, pool) {
  app.get('/api/server/parts-master', async (req, res) => {
    try {
      const page = safePositiveInt(req.query.page, 1, 1000000);
      const pageSize = safePositiveInt(req.query.limit, 50, 100);
      const offset = (page - 1) * pageSize;
      const knownTotal = parseKnownTotal(req.query.known_total);
      const branch = clean(req.query.branch) || 'สำนักงานใหญ่';
      const search = clean(req.query.search);
      const values = [branch];
      const where = [];
      if (search) {
        values.push(`%${search}%`);
        where.push(`CONCAT_WS(' ', COALESCE(m.part_no::text,''), COALESCE(m.part_name::text,''), COALESCE(m.part_main_no::text,''), COALESCE(m.car_model::text,''), COALESCE(m.part_category::text,'')) ILIKE $${values.length}`);
      }
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const sql = `SELECT m.*, l.location, l.safety_stock${pageCountProjection(knownTotal)}
        FROM rizenicpartsmaster m
        LEFT JOIN rizenic_part_locations l ON m.part_no = l.part_no AND l.branch_name = $1
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY m.part_name ASC
        LIMIT ${limitParam} OFFSET ${offsetParam}`;
      const result = await pool.query(sql, values);
      let total = knownTotal === null ? Number(result.rows[0]?.__total_count || 0) : knownTotal;
      if (knownTotal === null && !result.rows.length && page > 1) {
        const countValues = [];
        let countWhere = '';
        if (search) {
          countValues.push(`%${search}%`);
          countWhere = ` WHERE CONCAT_WS(' ', COALESCE(m.part_no::text,''), COALESCE(m.part_name::text,''), COALESCE(m.part_main_no::text,''), COALESCE(m.car_model::text,''), COALESCE(m.part_category::text,'')) ILIKE $1`;
        }
        const counted = await pool.query(`SELECT COUNT(*)::int AS total FROM rizenicpartsmaster m${countWhere}`, countValues);
        total = Number(counted.rows[0]?.total || 0);
      }
      const items = result.rows.map(row => {
        const { __total_count, ...item } = row;
        return item;
      });
      res.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/server/admin/:resource', async (req, res) => {
    try {
      const cfg = ADMIN_RESOURCES[req.params.resource];
      if (!cfg) return res.status(404).json({ error: 'Unknown admin resource' });
      const page = safePositiveInt(req.query.page, 1, 1000000);
      const pageSize = safePositiveInt(req.query.limit, 50, 100);
      const offset = (page - 1) * pageSize;
      const knownTotal = parseKnownTotal(req.query.known_total);
      const values = [];
      const where = [];
      const search = clean(req.query.search);
      if (search) {
        values.push(`%${search}%`);
        const concat = cfg.search.map(col => `COALESCE(${col}::text, '')`).join(', ');
        where.push(`CONCAT_WS(' ', ${concat}) ILIKE $${values.length}`);
      }
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const sql = `SELECT ${cfg.fields}${pageCountProjection(knownTotal)} FROM ${cfg.table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${cfg.order} LIMIT ${limitParam} OFFSET ${offsetParam}`;
      const result = await pool.query(sql, values);
      let total = knownTotal === null ? Number(result.rows[0]?.__total_count || 0) : knownTotal;
      if (knownTotal === null && !result.rows.length && page > 1) {
        const countValues = search ? [`%${search}%`] : [];
        const countWhere = search ? ` WHERE CONCAT_WS(' ', ${cfg.search.map(col => `COALESCE(${col}::text, '')`).join(', ')}) ILIKE $1` : '';
        const counted = await pool.query(`SELECT COUNT(*)::int AS total FROM ${cfg.table}${countWhere}`, countValues);
        total = Number(counted.rows[0]?.total || 0);
      }
      const items = result.rows.map(row => {
        const { __total_count, ...item } = row;
        return item;
      });
      res.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/server/dashboard', async (req, res) => {
    try {
      const { page, pageSize, offset } = pagedRequest(req, 20, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const where = [];
      const values = [];
      addBranch(where, values, req.query.branch);
      addSearch(where, values, req.query.search, ['car_plate','customer_name','car_brand','car_model','job_status','sa_owner','branch_name']);
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const reportSql = `SELECT ${REPORT_DASHBOARD_FIELDS.join(', ')}${pageCountProjection(knownTotal)}
        FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
        ORDER BY id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`;

      const branchValues = [];
      const branchWhere = [];
      addBranch(branchWhere, branchValues, req.query.branch);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.start)) ? clean(req.query.start) : null;
      const end = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.end)) ? clean(req.query.end) : null;
      const summaryValues = [...branchValues];
      let startParam = null; let endParam = null;
      if (start) { summaryValues.push(start); startParam = `$${summaryValues.length}`; }
      if (end) { summaryValues.push(end); endParam = `$${summaryValues.length}`; }
      const dateRange = field => {
        const parts = [];
        if (startParam) parts.push(`${field}::date >= ${startParam}::date`);
        if (endParam) parts.push(`${field}::date <= ${endParam}::date`);
        return parts.length ? parts.join(' AND ') : 'TRUE';
      };
      const includeBranches = clean(req.query.includeBranches) !== '0';
      const [reportsResult, branches, summaryResult, statusCounts, stationCounts, saCounts] = await Promise.all([
        pool.query(reportSql, values),
        includeBranches ? pool.query(`SELECT DISTINCT branch_name FROM rizenicreport WHERE NULLIF(BTRIM(COALESCE(branch_name, '')), '') IS NOT NULL ORDER BY branch_name ASC`) : Promise.resolve({ rows: [] }),
        pool.query(`SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE ${dateRange('contact_date')})::int AS contacted,
          COUNT(*) FILTER (WHERE COALESCE(job_status,'') LIKE ANY(ARRAY['01%','02%','03%','04%','05%','06%','07%','08%','09%','10%','11%']) AND ${dateRange('COALESCE(appointment_date, arrived_date)')})::int AS parked_range,
          COUNT(*) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%12.ส่งมอบ%' OR COALESCE(job_status,'') ILIKE '%13.วางบิล%' OR COALESCE(job_status,'') ILIKE '%14.ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%15.วางบิล Tesla%' OR COALESCE(job_status,'') ILIKE '%16.วางบิล EV%' OR COALESCE(job_status,'') ILIKE '%17.รอออกบิล%' OR COALESCE(job_status,'') ILIKE '%19.ออกบิลแล้ว%') AND ${dateRange('delivery_date')})::int AS delivered,
          COUNT(*) FILTER (WHERE ${dateRange('billing_date')})::int AS billed,
          COALESCE(SUM(cost_labor) FILTER (WHERE ${dateRange('billing_date')}),0)::numeric AS sum_labor,
          COALESCE(SUM(cost_part) FILTER (WHERE ${dateRange('billing_date')}),0)::numeric AS sum_parts,
          COALESCE(SUM(cost_external) FILTER (WHERE ${dateRange('billing_date')}),0)::numeric AS sum_outsource,
          COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%กำลังซ่อม%')::int AS repairing,
          COUNT(*) FILTER (WHERE COALESCE(is_parked::text,'') ILIKE '%จอดซ่อม%')::int AS parked
          FROM rizenicreport${branchWhere.length ? ` WHERE ${branchWhere.join(' AND ')}` : ''}`, summaryValues),
        pool.query(`SELECT COALESCE(job_status,'ไม่ระบุสถานะ') AS label, COUNT(*)::int AS count FROM rizenicreport${branchWhere.length ? ` WHERE ${branchWhere.join(' AND ')}` : ''} GROUP BY COALESCE(job_status,'ไม่ระบุสถานะ') ORDER BY label`, branchValues),
        pool.query(`SELECT (CASE
          WHEN COALESCE(station_ready::text,'') IN ('true','TRUE','1') THEN '12.รอส่งมอบ'
          WHEN COALESCE(station_pak::text,'') IN ('true','TRUE','1') THEN '11.พักซ่อม'
          WHEN COALESCE(station_film::text,'') IN ('true','TRUE','1') THEN '10.ฟิล์ม'
          WHEN COALESCE(station_kraj::text,'') IN ('true','TRUE','1') THEN '09.กระจก'
          WHEN COALESCE(station_mag::text,'') IN ('true','TRUE','1') THEN '08.แม็ก'
          WHEN COALESCE(station_qc::text,'') IN ('true','TRUE','1') THEN '07.QC'
          WHEN COALESCE(station_kat::text,'') IN ('true','TRUE','1') THEN '06.ขัดสี'
          WHEN COALESCE(station_prak::text,'') IN ('true','TRUE','1') THEN '05.ประกอบ'
          WHEN COALESCE(station_pon::text,'') IN ('true','TRUE','1') THEN '04.พ่นสี'
          WHEN COALESCE(station_puan::text,'') IN ('true','TRUE','1') THEN '03.เตรียมพื้น'
          WHEN COALESCE(station_pou::text,'') IN ('true','TRUE','1') THEN '02.โป๊ว'
          WHEN COALESCE(station_kho::text,'') IN ('true','TRUE','1') THEN '01.เคาะ'
          ELSE 'ส่งจ๊อบ' END) AS label, COUNT(*)::int AS count
          FROM rizenicreport${branchWhere.length ? ` WHERE ${branchWhere.join(' AND ')} AND` : ' WHERE'} COALESCE(job_status,'') ILIKE '%กำลังซ่อม%'
          GROUP BY 1 ORDER BY 1`, branchValues),
        pool.query(`SELECT COALESCE(NULLIF(BTRIM(sa_owner),''),'ไม่ระบุ SA') AS label, COUNT(*)::int AS count
          FROM rizenicreport${branchWhere.length ? ` WHERE ${branchWhere.join(' AND ')} AND` : ' WHERE'} COALESCE(job_status,'') LIKE ANY(ARRAY['01%','02%','03%','04%','05%','06%','07%','08%','09%','10%','11%','12%'])
          GROUP BY 1 ORDER BY count DESC, label`, branchValues)
      ]);
      const meta = pageMeta(reportsResult.rows, page, pageSize, knownTotal);
      const reports = stripWindowCount(reportsResult.rows);
      const includeParts = clean(req.query.includeParts) !== '0';
      const partOrders = includeParts
        ? await buildScopedPartOrdersForReports(pool, reports, req.query.branch, PART_ORDER_DASHBOARD_FIELDS)
        : [];
      res.json({ reports, partOrders, branches: branches.rows.map(row => row.branch_name), summary: { ...(summaryResult.rows[0] || {}), statusCounts: statusCounts.rows, stationCounts: stationCounts.rows, saCounts: saCounts.rows }, ...meta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/dashboard-analytics', async (req, res) => {
    try {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.start)) ? clean(req.query.start) : null;
      const end = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.end)) ? clean(req.query.end) : null;
      const reportStart = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.report_start)) ? clean(req.query.report_start) : start;
      const reportEnd = /^\d{4}-\d{2}-\d{2}$/.test(clean(req.query.report_end)) ? clean(req.query.report_end) : end;

      const scoped = (column = 'branch_name') => {
        const where = [];
        const values = [];
        addBranch(where, values, req.query.branch, column);
        return { where, values };
      };
      const addBounds = (scope, expr, from, to) => {
        if (from) { scope.values.push(from); scope.where.push(`${expr}::date >= $${scope.values.length}::date`); }
        if (to) { scope.values.push(to); scope.where.push(`${expr}::date <= $${scope.values.length}::date`); }
      };
      const sqlWhere = scope => scope.where.length ? ` WHERE ${scope.where.join(' AND ')}` : '';

      const dailyScope = scoped();
      const reportStartParam = reportStart ? (dailyScope.values.push(reportStart), `$${dailyScope.values.length}`) : null;
      const reportEndParam = reportEnd ? (dailyScope.values.push(reportEnd), `$${dailyScope.values.length}`) : null;
      const reportRange = field => {
        const parts = [];
        if (reportStartParam) parts.push(`${field}::date >= ${reportStartParam}::date`);
        if (reportEndParam) parts.push(`${field}::date <= ${reportEndParam}::date`);
        return parts.length ? parts.join(' AND ') : 'TRUE';
      };
      const dailyReportSql = `SELECT
        COUNT(*) FILTER (WHERE contact_date::date = CURRENT_DATE)::int AS contact_today,
        COUNT(*) FILTER (WHERE ${reportRange('contact_date')})::int AS contact_range,
        COUNT(*) FILTER (WHERE arrived_date::date = CURRENT_DATE)::int AS arrived_today,
        COUNT(*) FILTER (WHERE repair_finish_date::date = CURRENT_DATE)::int AS repair_finish_today,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%ส่งมอบ%' AND COALESCE(job_status,'') NOT ILIKE '%ซ่อมเสร็จรอส่งมอบ%' AND delivery_date::date = CURRENT_DATE)::int AS delivery_today,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอเสนอประกัน%')::int AS wait_quote,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอประกันอนุมัติ%')::int AS wait_insurance,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอลูกค้าอนุมัติ%')::int AS wait_customer,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%อนุมัติแล้ว%')::int AS approved,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%สั่งอะไหล่%')::int AS ordering_parts,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอนัดหมายเข้าซ่อม%')::int AS wait_appointment,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%นัดหมายแล้วรอเข้าซ่อม%')::int AS appointed_wait,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%จอดรอเข้าซ่อม%')::int AS parked_wait,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%กำลังซ่อม%')::int AS repairing,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%ซ่อม TC%' OR COALESCE(job_status,'') ILIKE '%ซ่อมTC%')::int AS repair_tc,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%ซ่อมเสร็จรอส่งมอบ%')::int AS ready_delivery,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') IN ('12.ส่งมอบแล้ว','ส่งมอบแล้ว'))::int AS delivered_done,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%พักซ่อม%')::int AS repair_hold,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%วางบิลประกัน%' AND ${reportRange('billing_date')})::int AS bill_insurance,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' AND ${reportRange('billing_date')})::int AS cash_paid,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%วางบิล Tesla%' AND ${reportRange('billing_date')})::int AS bill_tesla,
        COUNT(*) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%วางบิล EV ME%' OR COALESCE(job_status,'') ILIKE '%วางบิล EVME%') AND ${reportRange('billing_date')})::int AS bill_evme,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอออกบิล%')::int AS wait_bill,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%ยกเลิก%')::int AS cancelled,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' AND ${reportRange('billing_date')})::int AS billed_done,
        COUNT(*) FILTER (WHERE ${reportRange('billing_date')})::int AS billed_range
        FROM rizenicreport${sqlWhere(dailyScope)}`;

      const customerScope = scoped();
      addBounds(customerScope, 'contact_date', reportStart, reportEnd);
      const customerTypesSql = `SELECT COALESCE(NULLIF(BTRIM(customer_type),''),'ไม่ระบุ') AS label, COUNT(*)::int AS count
        FROM rizenicreport${sqlWhere(customerScope)} GROUP BY 1 ORDER BY count DESC, label`;

      const statusScope = scoped();
      const dashStartParam = start ? (statusScope.values.push(start), `$${statusScope.values.length}`) : null;
      const dashEndParam = end ? (statusScope.values.push(end), `$${statusScope.values.length}`) : null;
      const statusDateExpr = `COALESCE(billing_date, delivery_date, repair_finish_date)`;
      const statusDateParts = [];
      if (dashStartParam) statusDateParts.push(`${statusDateExpr}::date >= ${dashStartParam}::date`);
      if (dashEndParam) statusDateParts.push(`${statusDateExpr}::date <= ${dashEndParam}::date`);
      const statusDateRange = statusDateParts.length ? statusDateParts.join(' AND ') : 'TRUE';
      const statusCountsSql = `SELECT LEFT(COALESCE(job_status,''),2) AS code,
        COUNT(*) FILTER (WHERE CASE WHEN LEFT(COALESCE(job_status,''),2) = ANY(ARRAY['12','13','14','15','16','19']) THEN (${statusDateRange}) ELSE TRUE END)::int AS count
        FROM rizenicreport${sqlWhere(statusScope)} GROUP BY 1 ORDER BY 1`;

      const insuranceScope = scoped();
      addBounds(insuranceScope, 'COALESCE(arrived_date, contact_date, appointment_date)', start, end);
      const insuranceSql = `SELECT COALESCE(NULLIF(BTRIM(customer_type),''),'ไม่มีข้อมูล') AS label, COUNT(*)::int AS count
        FROM rizenicreport${sqlWhere(insuranceScope)} GROUP BY 1 ORDER BY count DESC, label`;

      const paymentScope = scoped();
      addBounds(paymentScope, 'COALESCE(arrived_date, contact_date)', start, end);
      const paymentSql = `SELECT COALESCE(NULLIF(BTRIM(payment_type),''),'ไม่ระบุ') AS label, COUNT(*)::int AS count
        FROM rizenicreport${sqlWhere(paymentScope)} GROUP BY 1 ORDER BY count DESC, label`;

      const financeScope = scoped();
      const financeStartParam = start ? (financeScope.values.push(start), `$${financeScope.values.length}`) : null;
      const financeEndParam = end ? (financeScope.values.push(end), `$${financeScope.values.length}`) : null;
      const financeDateParts = [];
      if (financeStartParam) financeDateParts.push(`billing_date::date >= ${financeStartParam}::date`);
      if (financeEndParam) financeDateParts.push(`billing_date::date <= ${financeEndParam}::date`);
      const financeDateRange = financeDateParts.length ? financeDateParts.join(' AND ') : 'TRUE';
      const financeSql = `SELECT
        COUNT(*) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND ${financeDateRange})::int AS managed,
        COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอออกบิล%')::int AS unmanaged
        FROM rizenicreport${sqlWhere(financeScope)}`;

      const damageCalendarScope = scoped();
      addBounds(damageCalendarScope, 'COALESCE(arrived_date, contact_date)', start, end);
      const damageBucket = `CASE WHEN COALESCE(damage_level,'') ILIKE '%เบา%' THEN 'เบา' WHEN COALESCE(damage_level,'') ILIKE '%กลาง%' THEN 'กลาง' WHEN COALESCE(damage_level,'') ILIKE '%หนัก%' THEN 'หนัก' ELSE 'ไม่ระบุ' END`;
      const damageCalendarSql = `SELECT ${damageBucket} AS label, COUNT(*)::int AS count FROM rizenicreport${sqlWhere(damageCalendarScope)} GROUP BY 1 ORDER BY 1`;
      const damageParkedScope = scoped();
      damageParkedScope.where.push(`(COALESCE(job_status,'') ILIKE '%09.จอดรอเข้าซ่อม%' OR COALESCE(job_status,'') ILIKE '%10.กำลังซ่อม%' OR COALESCE(job_status,'') ILIKE '%11.รถซ่อมเสร็จรอส่งมอบ%' OR COALESCE(job_status,'') ILIKE '%จอดรอเข้าซ่อม%' OR COALESCE(job_status,'') ILIKE '%กำลังซ่อม%' OR COALESCE(job_status,'') ILIKE '%รถซ่อมเสร็จรอส่งมอบ%')`);
      const damageParkedSql = `SELECT ${damageBucket} AS label, COUNT(*)::int AS count FROM rizenicreport${sqlWhere(damageParkedScope)} GROUP BY 1 ORDER BY 1`;

      const seriesScope = scoped();
      const seriesBranchWhere = seriesScope.where.length ? `${seriesScope.where.join(' AND ')} AND ` : '';
      const seriesValues = seriesScope.values;
      const seriesStartParam = start ? (seriesValues.push(start), `$${seriesValues.length}`) : null;
      const seriesEndParam = end ? (seriesValues.push(end), `$${seriesValues.length}`) : null;
      const seriesRange = field => {
        const parts = [`${field} IS NOT NULL`];
        if (seriesStartParam) parts.push(`${field}::date >= ${seriesStartParam}::date`);
        if (seriesEndParam) parts.push(`${field}::date <= ${seriesEndParam}::date`);
        return parts.join(' AND ');
      };
      const dailySeriesSql = `SELECT kind, date_value, count FROM (
        SELECT 'arrived'::text AS kind, arrived_date::date::text AS date_value, COUNT(*)::int AS count FROM rizenicreport WHERE ${seriesBranchWhere}${seriesRange('arrived_date')} GROUP BY arrived_date::date
        UNION ALL SELECT 'target', target_finish_date::date::text, COUNT(*)::int FROM rizenicreport WHERE ${seriesBranchWhere}${seriesRange('target_finish_date')} GROUP BY target_finish_date::date
        UNION ALL SELECT 'delivery', delivery_date::date::text, COUNT(*)::int FROM rizenicreport WHERE ${seriesBranchWhere}${seriesRange('delivery_date')} GROUP BY delivery_date::date
      ) s ORDER BY date_value, kind`;

      const calendarScope = scoped();
      const calendarBranchWhere = calendarScope.where.length ? `${calendarScope.where.join(' AND ')} AND ` : '';
      const calendarValues = calendarScope.values;
      const calStartParam = start ? (calendarValues.push(start), `$${calendarValues.length}`) : null;
      const calEndParam = end ? (calendarValues.push(end), `$${calendarValues.length}`) : null;
      const calRange = field => {
        const parts = [`${field} IS NOT NULL`];
        if (calStartParam) parts.push(`${field}::date >= ${calStartParam}::date`);
        if (calEndParam) parts.push(`${field}::date <= ${calEndParam}::date`);
        return parts.join(' AND ');
      };
      const calendarSql = `SELECT kind, date_value, count, done_count, main_sum, sub_sum, has_overdue FROM (
        SELECT 'arrived'::text AS kind, arrived_date::date::text AS date_value, COUNT(*)::int AS count, 0::int AS done_count, 0::int AS main_sum, 0::int AS sub_sum, false AS has_overdue
          FROM rizenicreport WHERE ${calendarBranchWhere}${calRange('arrived_date')} GROUP BY arrived_date::date
        UNION ALL
        SELECT 'target', target_finish_date::date::text, COUNT(*)::int,
          COUNT(*) FILTER (WHERE LEFT(COALESCE(job_status,''),2) = ANY(ARRAY['11','12','13','14','15','16','17','19','20','21']))::int,
          COALESCE(SUM(CASE
            WHEN COALESCE(main_part_qty,0) <> 0 THEN main_part_qty::int
            WHEN BTRIM(COALESCE(main_part_name,'')) NOT IN ('','-') THEN cardinality(array_remove(string_to_array(main_part_name, ','), ''))
            ELSE 0 END),0)::int,
          COALESCE(SUM(CASE
            WHEN COALESCE(sub_part_qty,0) <> 0 THEN sub_part_qty::int
            WHEN BTRIM(COALESCE(sub_part_name,'')) NOT IN ('','-') THEN cardinality(array_remove(string_to_array(sub_part_name, ','), ''))
            ELSE 0 END),0)::int,
          BOOL_OR(target_finish_date::date < CURRENT_DATE AND repair_finish_date IS NULL)
          FROM rizenicreport WHERE ${calendarBranchWhere}${calRange('target_finish_date')} GROUP BY target_finish_date::date
        UNION ALL
        SELECT 'delivery', delivery_date::date::text, COUNT(*)::int, 0::int, 0::int, 0::int, false
          FROM rizenicreport WHERE ${calendarBranchWhere}${calRange('delivery_date')} GROUP BY delivery_date::date
      ) c ORDER BY date_value, kind`;

      const partsScope = scoped('r.branch_name');
      const partsWhere = partsScope.where.length ? ` WHERE ${partsScope.where.join(' AND ')} AND` : ' WHERE';
      const partsStatusSql = `WITH ordering_jobs AS (
          SELECT r.id, r.car_plate, r.branch_name,
            ROW_NUMBER() OVER (PARTITION BY BTRIM(COALESCE(r.branch_name,'')), BTRIM(COALESCE(r.car_plate,'')) ORDER BY r.id DESC) AS plate_rank
          FROM rizenicreport r${partsWhere} COALESCE(r.job_status,'') ILIKE '%สั่งอะไหล่%'
        ), classified AS (
          SELECT j.id,
            COUNT(po.order_id)::int AS part_count,
            CASE
              WHEN COUNT(po.order_id) = 0 THEN 'รอสั่งซื้อ'
              WHEN BOOL_OR(COALESCE(po.order_status,'') ILIKE '%รอสั่งซื้อ%') THEN 'รอสั่งซื้อ'
              WHEN BOOL_OR(COALESCE(po.order_status,'') ILIKE '%Back Order%') THEN 'ติด Back Order'
              WHEN BOOL_OR(COALESCE(po.order_status,'') ILIKE '%รออะไหล่%') THEN 'รออะไหล่'
              WHEN BOOL_AND(COALESCE(po.order_status,'') ILIKE '%ครบ%' OR COALESCE(po.order_status,'') ILIKE '%มีของ%') THEN 'มีของ/ครบ'
              ELSE 'รออัปเดต' END AS label
          FROM ordering_jobs j
          LEFT JOIN rizenic_part_orders po ON COALESCE(po.order_status,'') <> 'ยกเลิก'
            AND (
              po.job_id::text = j.id::text
              OR (
                NULLIF(BTRIM(COALESCE(po.job_id::text,'')),'') IS NULL
                AND j.plate_rank = 1
                AND BTRIM(COALESCE(po.branch_name,'')) = BTRIM(COALESCE(j.branch_name,''))
                AND BTRIM(COALESCE(po.car_plate,'')) = BTRIM(COALESCE(j.car_plate,''))
              )
            )
          GROUP BY j.id
        ) SELECT label, COUNT(*)::int AS cars, COALESCE(SUM(part_count),0)::int AS parts FROM classified GROUP BY label ORDER BY label`;

      const mechanicScope = scoped();
      mechanicScope.where.push(`(COALESCE(job_status,'') ILIKE '%09.จอดรอเข้าซ่อม%' OR COALESCE(job_status,'') ILIKE '%10.กำลังซ่อม%' OR COALESCE(job_status,'') ILIKE '%11.รถซ่อมเสร็จรอส่งมอบ%' OR COALESCE(job_status,'') ILIKE '%จอดรอเข้าซ่อม%' OR COALESCE(job_status,'') ILIKE '%กำลังซ่อม%' OR COALESCE(job_status,'') ILIKE '%รถซ่อมเสร็จรอส่งมอบ%')`);
      const stationCase = `CASE
          WHEN COALESCE(station_ready::text,'') IN ('true','TRUE','1') THEN '12.รอส่งมอบ'
          WHEN COALESCE(station_pak::text,'') IN ('true','TRUE','1') THEN '11.พักซ่อม'
          WHEN COALESCE(station_film::text,'') IN ('true','TRUE','1') THEN '10.ฟิล์ม'
          WHEN COALESCE(station_kraj::text,'') IN ('true','TRUE','1') THEN '09.กระจก'
          WHEN COALESCE(station_mag::text,'') IN ('true','TRUE','1') THEN '08.แม็ก'
          WHEN COALESCE(station_qc::text,'') IN ('true','TRUE','1') THEN '07.QC'
          WHEN COALESCE(station_kat::text,'') IN ('true','TRUE','1') THEN '06.ขัดสี'
          WHEN COALESCE(station_prak::text,'') IN ('true','TRUE','1') THEN '05.ประกอบ'
          WHEN COALESCE(station_pon::text,'') IN ('true','TRUE','1') THEN '04.พ่นสี'
          WHEN COALESCE(station_puan::text,'') IN ('true','TRUE','1') THEN '03.เตรียมพื้น'
          WHEN COALESCE(station_pou::text,'') IN ('true','TRUE','1') THEN '02.โป๊ว'
          WHEN COALESCE(station_kho::text,'') IN ('true','TRUE','1') THEN '01.เคาะ'
          ELSE 'ส่งจ๊อบ' END`;
      const mechanicSql = `SELECT (${stationCase}) AS label, COUNT(*)::int AS count FROM rizenicreport${sqlWhere(mechanicScope)} GROUP BY 1 ORDER BY 1`;

      const [dailyReportResult, customerTypesResult, statusCountsResult, insuranceResult, dailySeriesResult, paymentResult, financeResult, damageCalendarResult, damageParkedResult, partsStatusResult, mechanicResult, calendarResult, quotasResult] = await Promise.all([
        pool.query(dailyReportSql, dailyScope.values),
        pool.query(customerTypesSql, customerScope.values),
        pool.query(statusCountsSql, statusScope.values),
        pool.query(insuranceSql, insuranceScope.values),
        pool.query(dailySeriesSql, seriesValues),
        pool.query(paymentSql, paymentScope.values),
        pool.query(financeSql, financeScope.values),
        pool.query(damageCalendarSql, damageCalendarScope.values),
        pool.query(damageParkedSql, damageParkedScope.values),
        pool.query(partsStatusSql, partsScope.values),
        pool.query(mechanicSql, mechanicScope.values),
        pool.query(calendarSql, calendarValues),
        pool.query(`SELECT quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery, quota_main_parts, quota_sub_parts FROM rizenic_quotas ORDER BY quota_type ASC, quota_date DESC`)
      ]);

      const dailyBase = dailyReportResult.rows[0] || {};
      const calendarMap = new Map();
      for (const row of calendarResult.rows) {
        const key = row.date_value;
        if (!calendarMap.has(key)) calendarMap.set(key, { date: key, arrived: 0, target: 0, delivery: 0, targetDone: 0, mainSum: 0, subSum: 0, hasOverdue: false });
        const day = calendarMap.get(key);
        if (row.kind === 'arrived') day.arrived = Number(row.count || 0);
        if (row.kind === 'delivery') day.delivery = Number(row.count || 0);
        if (row.kind === 'target') {
          day.target = Number(row.count || 0);
          day.targetDone = Number(row.done_count || 0);
          day.mainSum = Number(row.main_sum || 0);
          day.subSum = Number(row.sub_sum || 0);
          day.hasOverdue = Boolean(row.has_overdue);
        }
      }

      res.json({
        dailyReport: {
          customers: { today: Number(dailyBase.contact_today || 0), range: Number(dailyBase.contact_range || 0) },
          customerTypes: customerTypesResult.rows,
          workStatus: {
            arrivedToday: Number(dailyBase.arrived_today || 0), repairFinishToday: Number(dailyBase.repair_finish_today || 0), deliveryToday: Number(dailyBase.delivery_today || 0),
            waitQuote: Number(dailyBase.wait_quote || 0), waitInsurance: Number(dailyBase.wait_insurance || 0), waitCustomer: Number(dailyBase.wait_customer || 0), approved: Number(dailyBase.approved || 0),
            orderingParts: Number(dailyBase.ordering_parts || 0), waitAppointment: Number(dailyBase.wait_appointment || 0), appointedWait: Number(dailyBase.appointed_wait || 0), parkedWait: Number(dailyBase.parked_wait || 0),
            repairing: Number(dailyBase.repairing || 0), repairTc: Number(dailyBase.repair_tc || 0), readyDelivery: Number(dailyBase.ready_delivery || 0), deliveredDone: Number(dailyBase.delivered_done || 0), repairHold: Number(dailyBase.repair_hold || 0)
          },
          finance: { billInsurance: Number(dailyBase.bill_insurance || 0), cashPaid: Number(dailyBase.cash_paid || 0), billTesla: Number(dailyBase.bill_tesla || 0), billEvme: Number(dailyBase.bill_evme || 0), waitBill: Number(dailyBase.wait_bill || 0), cancelled: Number(dailyBase.cancelled || 0), billedDone: Number(dailyBase.billed_done || 0), billedRange: Number(dailyBase.billed_range || 0) }
        },
        statusChartCounts: statusCountsResult.rows,
        insuranceCounts: insuranceResult.rows,
        dailySeries: dailySeriesResult.rows,
        paymentCounts: paymentResult.rows,
        financeCounts: financeResult.rows[0] || { managed: 0, unmanaged: 0 },
        damageCounts: { calendar: damageCalendarResult.rows, parked: damageParkedResult.rows },
        partsStatusCounts: partsStatusResult.rows,
        mechanicCounts: mechanicResult.rows,
        calendarDays: [...calendarMap.values()],
        quotas: quotasResult.rows
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/dashboard-drilldown-snapshot', async (req, res) => {
    try {
      const reportWhere = [];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const partWhere = [`COALESCE(order_status,'') <> 'ยกเลิก'`];
      const partValues = [];
      addBranch(partWhere, partValues, req.query.branch);
      const [reportsResult, partOrdersResult] = await Promise.all([
        pool.query(
          `SELECT ${REPORT_DASHBOARD_FIELDS.join(', ')} FROM rizenicreport${reportWhere.length ? ` WHERE ${reportWhere.join(' AND ')}` : ''} ORDER BY id DESC`,
          reportValues
        ),
        pool.query(
          `SELECT ${PART_ORDER_DASHBOARD_FIELDS.join(', ')} FROM rizenic_part_orders WHERE ${partWhere.join(' AND ')} ORDER BY order_id DESC`,
          partValues
        )
      ]);

      res.json({ reports: reportsResult.rows, partOrders: partOrdersResult.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/dashboard-po', async (req, res) => {
    try {
      const { page, pageSize, offset } = pagedRequest(req, 20, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const branch = clean(req.query.branch);
      const search = clean(req.query.search).toLowerCase();
      const selectedPlates = splitQueryList(req.query.plate, 500);
      const selectedSAs = splitQueryList(req.query.sa, 500);
      const selectedStatuses = splitQueryList(req.query.status, 100);
      const selectedParked = splitQueryList(req.query.parked, 10);
      const includeFacets = clean(req.query.includeFacets) !== '0';

      const values = [];
      const branchWhere = [];
      addBranch(branchWhere, values, branch, 'po.branch_name');
      branchWhere.push(`COALESCE(po.order_status,'') <> 'ยกเลิก'`);
      const baseWhere = `WHERE ${branchWhere.join(' AND ')}`;
      const reportBranchSql = branch && branch.toLowerCase() !== 'all' ? `AND r.branch_name = $${values.length + 1}` : '';
      if (branch && branch.toLowerCase() !== 'all') values.push(branch);

      const baseCte = `WITH grouped AS (
        SELECT COALESCE(NULLIF(BTRIM(po.car_plate),''),'ไม่ระบุ') AS plate,
          MAX(po.order_id)::bigint AS latest_order_id,
          COUNT(*)::int AS item_count,
          STRING_AGG(CONCAT_WS(' ', COALESCE(po.part_no,''), COALESCE(po.part_main_no,''), COALESCE(po.part_name,''), COALESCE(po.qt_no,''), COALESCE(po.so_no,''), COALESCE(po.epc_no,'')), ' ') AS search_text,
          CASE
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'รอสั่งซื้อ') THEN 'รอสั่งซื้อ'
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'ติด Back Order') THEN 'ติด Back Order'
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'รออะไหล่') THEN 'รออะไหล่'
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'รออัปเดต') THEN 'รออัปเดต'
            WHEN BOOL_AND(COALESCE(po.order_status,'') ILIKE '%ครบ%' OR COALESCE(po.order_status,'') ILIKE '%มีของ%') THEN 'มีของ/ครบ'
            ELSE COALESCE(MAX(NULLIF(BTRIM(po.order_status),'')), 'รออัปเดต') END AS worst_status
        FROM rizenic_part_orders po ${baseWhere}
        GROUP BY COALESCE(NULLIF(BTRIM(po.car_plate),''),'ไม่ระบุ')
      ), enriched AS (
        SELECT g.*,
          COALESCE(NULLIF(BTRIM(rm.sa_owner),''),'ไม่ระบุ') AS sa_name,
          COALESCE(NULLIF(BTRIM(rm.is_parked::text),''),'ไม่ระบุ') AS is_parked,
          CASE WHEN COALESCE(rm.is_parked::text,'') ILIKE '%จอดซ่อม%' THEN 'จอดซ่อม' ELSE 'ไม่จอดซ่อม' END AS parked_label
        FROM grouped g
        LEFT JOIN LATERAL (
          SELECT r.sa_owner, r.is_parked FROM rizenicreport r
          WHERE BTRIM(COALESCE(r.car_plate,'')) = g.plate ${reportBranchSql}
          ORDER BY r.id DESC LIMIT 1
        ) rm ON TRUE
      )`;

      const filterWhere = [];
      if (search) { values.push(`%${search}%`); filterWhere.push(`LOWER(CONCAT_WS(' ', plate, sa_name, parked_label, worst_status, search_text)) LIKE $${values.length}`); }
      if (selectedPlates.length) { values.push(selectedPlates); filterWhere.push(`plate = ANY($${values.length}::text[])`); }
      if (selectedSAs.length) { values.push(selectedSAs); filterWhere.push(`sa_name = ANY($${values.length}::text[])`); }
      if (selectedStatuses.length) { values.push(selectedStatuses); filterWhere.push(`worst_status = ANY($${values.length}::text[])`); }
      if (selectedParked.length) { values.push(selectedParked); filterWhere.push(`parked_label = ANY($${values.length}::text[])`); }
      values.push(pageSize); const limitParam = `$${values.length}`;
      values.push(offset); const offsetParam = `$${values.length}`;
      const filteredWhere = filterWhere.length ? `WHERE ${filterWhere.join(' AND ')}` : '';
      const pageSql = `${baseCte}
        SELECT plate, sa_name, is_parked, parked_label, item_count, worst_status, latest_order_id${pageCountProjection(knownTotal)}
        FROM enriched ${filteredWhere} ORDER BY plate ASC LIMIT ${limitParam} OFFSET ${offsetParam}`;
      const pageResult = await pool.query(pageSql, values);
      const meta = pageMeta(pageResult.rows, page, pageSize, knownTotal);
      const groupRows = stripWindowCount(pageResult.rows);
      const plates = groupRows.map(row => row.plate).filter(Boolean);

      let partRows = [];
      if (plates.length) {
        const itemValues = [plates];
        const itemWhere = [`COALESCE(NULLIF(BTRIM(car_plate),''),'ไม่ระบุ') = ANY($1::text[])`, `COALESCE(order_status,'') <> 'ยกเลิก'`];
        addBranch(itemWhere, itemValues, branch);
        const itemResult = await pool.query(`SELECT ${PART_ORDER_DASHBOARD_FIELDS.join(', ')} FROM rizenic_part_orders WHERE ${itemWhere.join(' AND ')} ORDER BY order_id DESC`, itemValues);
        partRows = itemResult.rows;
      }
      const byPlate = new Map();
      for (const item of partRows) {
        const key = clean(item.car_plate) || 'ไม่ระบุ';
        if (!byPlate.has(key)) byPlate.set(key, []);
        byPlate.get(key).push(item);
      }
      const entries = groupRows.map(row => ({
        plate: row.plate,
        worstStatus: row.worst_status,
        group: { saName: row.sa_name, isParked: row.is_parked, items: byPlate.get(row.plate) || [] }
      }));

      // Facets are grouped metadata only; no raw order history is sent for off-page cars.
      const facetValues = [];
      const facetWhere = [];
      addBranch(facetWhere, facetValues, branch, 'po.branch_name');
      facetWhere.push(`COALESCE(po.order_status,'') <> 'ยกเลิก'`);
      const facetReportBranch = branch && branch.toLowerCase() !== 'all' ? `AND r.branch_name = $${facetValues.length + 1}` : '';
      if (branch && branch.toLowerCase() !== 'all') facetValues.push(branch);
      const facetCte = `WITH grouped AS (
        SELECT COALESCE(NULLIF(BTRIM(po.car_plate),''),'ไม่ระบุ') AS plate,
          CASE
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'รอสั่งซื้อ') THEN 'รอสั่งซื้อ'
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'ติด Back Order') THEN 'ติด Back Order'
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'รออะไหล่') THEN 'รออะไหล่'
            WHEN BOOL_OR(COALESCE(po.order_status,'') = 'รออัปเดต') THEN 'รออัปเดต'
            WHEN BOOL_AND(COALESCE(po.order_status,'') ILIKE '%ครบ%' OR COALESCE(po.order_status,'') ILIKE '%มีของ%') THEN 'มีของ/ครบ'
            ELSE COALESCE(MAX(NULLIF(BTRIM(po.order_status),'')), 'รออัปเดต') END AS worst_status
        FROM rizenic_part_orders po WHERE ${facetWhere.join(' AND ')} GROUP BY COALESCE(NULLIF(BTRIM(po.car_plate),''),'ไม่ระบุ')
      ), enriched AS (
        SELECT g.*, COALESCE(NULLIF(BTRIM(rm.sa_owner),''),'ไม่ระบุ') AS sa_name,
          CASE WHEN COALESCE(rm.is_parked::text,'') ILIKE '%จอดซ่อม%' THEN 'จอดซ่อม' ELSE 'ไม่จอดซ่อม' END AS parked_label
        FROM grouped g LEFT JOIN LATERAL (
          SELECT r.sa_owner, r.is_parked FROM rizenicreport r WHERE BTRIM(COALESCE(r.car_plate,'')) = g.plate ${facetReportBranch} ORDER BY r.id DESC LIMIT 1
        ) rm ON TRUE
      ) SELECT ARRAY_AGG(DISTINCT plate ORDER BY plate) AS plates,
        ARRAY_AGG(DISTINCT sa_name ORDER BY sa_name) AS sas,
        ARRAY_AGG(DISTINCT worst_status ORDER BY worst_status) AS statuses,
        ARRAY_AGG(DISTINCT parked_label ORDER BY parked_label) AS parked FROM enriched`;
      const facetResult = includeFacets ? await pool.query(facetCte, facetValues) : { rows: [] };
      const f = facetResult.rows[0] || {};
      const facets = includeFacets ? { plate: f.plates || [], sa: f.sas || [], status: f.statuses || [], parked: f.parked || [] } : null;
      res.json({ entries, facets, ...meta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/dashboard-list', async (req, res) => {
    try {
      const kind = clean(req.query.kind);
      if (!['station','parked'].includes(kind)) return res.status(400).json({ error: 'invalid dashboard list kind' });
      const { page, pageSize, offset } = pagedRequest(req, 20, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const where = [];
      const values = [];
      addBranch(where, values, req.query.branch);
      if (kind === 'station') where.push(`COALESCE(job_status,'') ILIKE '%10.กำลังซ่อม%'`);
      if (kind === 'parked') where.push(`COALESCE(is_parked::text,'') ILIKE '%จอดซ่อม%'`);
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const orderBy = kind === 'station' ? 'target_finish_date ASC NULLS LAST, id DESC' : 'arrived_date ASC NULLS LAST, id DESC';
      const result = await pool.query(`SELECT ${REPORT_DASHBOARD_FIELDS.join(', ')}${pageCountProjection(knownTotal)} FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy} LIMIT ${limitParam} OFFSET ${offsetParam}`, values);
      const meta = pageMeta(result.rows, page, pageSize, knownTotal);
      res.json({ reports: stripWindowCount(result.rows), ...meta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/dashboard-parts', async (req, res) => {
    try {
      const partOrders = await buildScopedPartOrdersForKeys(pool, req.query, req.query.branch, PART_ORDER_DASHBOARD_FIELDS);
      res.json({ partOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/sa-overview', async (req, res) => {
    try {
      const { page, pageSize, offset } = pagedRequest(req, 50, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const includeMeta = clean(req.query.includeMeta) !== '0';
      const where = [];
      const values = [];
      addBranch(where, values, req.query.branch);
      const saOwner = clean(req.query.sa_owner);
      if (saOwner) { values.push(saOwner); where.push(`COALESCE(sa_owner, '') = $${values.length}`); }
      addSearch(where, values, req.query.search, ['car_plate','customer_name','car_brand','car_model','job_status','sa_owner','vin_no','qt_no','so_no']);
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const reportSql = `SELECT ${REPORT_SA_FIELDS.join(', ')}${pageCountProjection(knownTotal)}
        FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
        ORDER BY id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`;

      const summaryWhere = [];
      const summaryValues = [];
      addBranch(summaryWhere, summaryValues, req.query.branch);
      const branchesPromise = includeMeta
        ? pool.query(`SELECT DISTINCT branch_name FROM rizenicemployeemaster WHERE NULLIF(BTRIM(COALESCE(branch_name, '')), '') IS NOT NULL ORDER BY branch_name ASC`)
        : Promise.resolve({ rows: [] });
      const summaryPromise = includeMeta ? pool.query(`SELECT COALESCE(NULLIF(BTRIM(sa_owner), ''), 'ไม่ระบุ SA') AS sa_owner,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE COALESCE(job_status,'') LIKE ANY(ARRAY['01%','02%','03%','04%','05%','06%','07%','08%','09%','10%','11%','12%','21%']))::int AS pending,
          COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%รอออกบิล%')::int AS wait_bill,
          COUNT(*) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND EXTRACT(MONTH FROM billing_date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM billing_date::date) = EXTRACT(YEAR FROM CURRENT_DATE))::int AS billed,
          COALESCE(SUM(main_part_qty) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND EXTRACT(MONTH FROM billing_date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM billing_date::date) = EXTRACT(YEAR FROM CURRENT_DATE)),0)::numeric AS main_parts,
          COALESCE(SUM(sub_part_qty) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND EXTRACT(MONTH FROM billing_date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM billing_date::date) = EXTRACT(YEAR FROM CURRENT_DATE)),0)::numeric AS sub_parts,
          COALESCE(SUM(cost_labor) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND EXTRACT(MONTH FROM billing_date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM billing_date::date) = EXTRACT(YEAR FROM CURRENT_DATE)),0)::numeric AS sum_labor,
          COALESCE(SUM(cost_part) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND EXTRACT(MONTH FROM billing_date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM billing_date::date) = EXTRACT(YEAR FROM CURRENT_DATE)),0)::numeric AS sum_parts,
          COALESCE(SUM(cost_external) FILTER (WHERE (COALESCE(job_status,'') ILIKE '%ชำระเงินสด%' OR COALESCE(job_status,'') ILIKE '%ออกบิลแล้ว%' OR COALESCE(job_status,'') ILIKE '%วางบิล%') AND EXTRACT(MONTH FROM billing_date::date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM billing_date::date) = EXTRACT(YEAR FROM CURRENT_DATE)),0)::numeric AS sum_outsource,
          COUNT(*) FILTER (WHERE target_finish_date::date < CURRENT_DATE AND NULLIF(BTRIM(COALESCE(repair_finish_date::text,'')), '') IS NULL AND COALESCE(job_status,'') LIKE ANY(ARRAY['01%','02%','03%','04%','05%','06%','07%','08%','09%','10%','11%']))::int AS ov_tgt,
          COUNT(*) FILTER (WHERE delivery_date::date < CURRENT_DATE AND COALESCE(job_status,'') NOT ILIKE '%ส่งมอบ%' AND COALESCE(job_status,'') LIKE ANY(ARRAY['01%','02%','03%','04%','05%','06%','07%','08%','09%','10%','11%']))::int AS ov_del,
          COUNT(*) FILTER (WHERE arrived_date::date <= CURRENT_DATE AND COALESCE(is_parked::text,'') NOT ILIKE '%จอดซ่อม%' AND COALESCE(job_status,'') LIKE ANY(ARRAY['01%','02%','03%','04%','05%','06%','07%','08%']))::int AS ov_app
          FROM rizenicreport${summaryWhere.length ? ` WHERE ${summaryWhere.join(' AND ')}` : ''}
          GROUP BY COALESCE(NULLIF(BTRIM(sa_owner), ''), 'ไม่ระบุ SA') ORDER BY pending DESC, sa_owner ASC`, summaryValues)
        : Promise.resolve({ rows: [] });
      const [reportsResult, branches, summary] = await Promise.all([
        pool.query(reportSql, values),
        branchesPromise,
        summaryPromise
      ]);
      const meta = pageMeta(reportsResult.rows, page, pageSize, knownTotal);
      const reports = stripWindowCount(reportsResult.rows);
      const includeParts = clean(req.query.includeParts) !== '0';
      const partOrders = includeParts
        ? await buildScopedPartOrdersForReports(pool, reports, req.query.branch, PART_ORDER_DASHBOARD_FIELDS)
        : [];
      res.json({ reports, partOrders, branches: branches.rows.map(row => row.branch_name), saSummary: summary.rows, ...meta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/sa-parts', async (req, res) => {
    try {
      const partOrders = await buildScopedPartOrdersForKeys(pool, req.query, req.query.branch, PART_ORDER_DASHBOARD_FIELDS);
      res.json({ partOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/parts-alerts', async (req, res) => {
    try {
      const { page, pageSize, offset } = pagedRequest(req, 50, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const where = [];
      const values = [];
      addBranch(where, values, req.query.branch);
      const statusPatternsParam = `$${values.length + 1}`;
      values.push(['%สั่งอะไหล่%','%รอรถเข้าซ่อม%','%รออะไหล่%']);
      where.push(`(department_routing = 'อะไหล่'
        OR COALESCE(job_status, '') ILIKE ANY(${statusPatternsParam}::text[])
        OR EXISTS (
          SELECT 1 FROM rizenic_part_orders po
          WHERE COALESCE(po.branch_name, '') = COALESCE(rizenicreport.branch_name, '')
            AND (po.job_id::text = rizenicreport.id::text
              OR (NULLIF(BTRIM(COALESCE(po.job_id::text, '')), '') IS NULL
                AND NULLIF(BTRIM(COALESCE(po.car_plate, '')), '') IS NOT NULL
                AND po.car_plate = rizenicreport.car_plate))
        ))`);
      addSearch(where, values, req.query.search, ['car_plate','customer_name','sa_owner','vin_no','qt_no','so_no','car_model','job_status']);
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const result = await pool.query(`SELECT ${REPORT_PARTS_FIELDS.join(', ')}${pageCountProjection(knownTotal)}
        FROM rizenicreport WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`, values);
      const meta = pageMeta(result.rows, page, pageSize, knownTotal);
      const reports = stripWindowCount(result.rows);
      const partOrders = await buildScopedPartOrdersForReports(pool, reports, req.query.branch, PART_ORDER_DASHBOARD_FIELDS);
      res.json({ reports, partOrders, ...meta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/calendar-capacity', async (req, res) => {
    try {
      const bounds = monthBounds(req.query.year, req.query.month);
      const branch = clean(req.query.branch);
      if (!bounds || !branch) return res.status(400).json({ error: 'branch, year and month are required' });
      const values = [branch, bounds.start, bounds.end];
      let excludeSql = '';
      const excludeId = clean(req.query.exclude_id);
      if (excludeId) {
        values.push(excludeId);
        excludeSql = ` AND id::text <> $${values.length}`;
      }
      const jobsSql = `SELECT id, arrived_date, target_finish_date, delivery_date, main_part_qty, sub_part_qty
        FROM rizenicreport
        WHERE branch_name = $1${excludeSql}
          AND ((arrived_date::date >= $2::date AND arrived_date::date < $3::date)
            OR (target_finish_date::date >= $2::date AND target_finish_date::date < $3::date)
            OR (delivery_date::date >= $2::date AND delivery_date::date < $3::date))`;
      const quotasSql = `SELECT * FROM rizenic_quotas WHERE branch_name = $1 ORDER BY quota_type ASC, quota_date DESC`;
      const [jobs, quotas] = await Promise.all([
        pool.query(jobsSql, values),
        pool.query(quotasSql, [branch])
      ]);
      res.json({ jobs: jobs.rows, quotas: quotas.rows, start: bounds.start, end: bounds.end });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/quota-context', async (req, res) => {
    try {
      const branch = clean(req.query.branch);
      if (!branch) return res.status(400).json({ error: 'branch is required' });
      const dates = [...new Set(clean(req.query.dates).split(',').map(v => v.trim()).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)))].slice(0, 100);
      if (!dates.length) {
        const quotas = await pool.query(`SELECT * FROM rizenic_quotas WHERE branch_name = $1 ORDER BY quota_type ASC, quota_date DESC`, [branch]);
        return res.json({ jobs: [], quotas: quotas.rows });
      }
      const jobsSql = `SELECT id, branch_name, arrived_date, target_finish_date, delivery_date, main_part_qty, sub_part_qty
        FROM rizenicreport
        WHERE branch_name = $1
          AND (arrived_date::date::text = ANY($2::text[]) OR target_finish_date::date::text = ANY($2::text[]) OR delivery_date::date::text = ANY($2::text[]))`;
      const [jobs, quotas] = await Promise.all([
        pool.query(jobsSql, [branch, dates]),
        pool.query(`SELECT * FROM rizenic_quotas WHERE branch_name = $1 ORDER BY quota_type ASC, quota_date DESC`, [branch])
      ]);
      res.json({ jobs: jobs.rows, quotas: quotas.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/quota-check', async (req, res) => {
    try {
      const branch = clean(req.query.branch);
      if (!branch) return res.status(400).json({ error: 'branch is required' });
      const dates = [req.query.arrived, req.query.target, req.query.delivery].map(clean).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v));
      if (!dates.length) return res.json({ counts: {}, quotas: [] });
      const values = [branch, [...new Set(dates)]];
      let excludeSql = '';
      const excludeId = clean(req.query.exclude_id);
      if (excludeId) {
        values.push(excludeId);
        excludeSql = ` AND id::text <> $${values.length}`;
      }
      const jobsSql = `SELECT arrived_date, target_finish_date, delivery_date, main_part_qty, sub_part_qty
        FROM rizenicreport
        WHERE branch_name = $1${excludeSql}
          AND (arrived_date::date::text = ANY($2::text[]) OR target_finish_date::date::text = ANY($2::text[]) OR delivery_date::date::text = ANY($2::text[]))`;
      const [jobs, quotas] = await Promise.all([
        pool.query(jobsSql, values),
        pool.query(`SELECT * FROM rizenic_quotas WHERE branch_name = $1 ORDER BY quota_type ASC, quota_date DESC`, [branch])
      ]);
      res.json({ jobs: jobs.rows, quotas: quotas.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-facet', async (req, res) => {
    try {
      const field = clean(req.query.field);
      if (!REPAIR_FILTER_FIELDS.has(field)) return res.status(400).json({ error: 'invalid repair facet field' });
      const calendarMode = clean(req.query.calendar) === '1';
      const where = repairQueueConditions(calendarMode);
      const values = [];
      addBranch(where, values, req.query.branch);
      addSearch(where, values, req.query.search, ['car_plate','vin_no','sa_owner','car_brand','car_model','car_color','appointment_date','arrived_date','target_finish_date','repair_finish_date','delivery_date','job_status','department_routing','main_part_name','sub_part_name']);
      addRepairFilters(where, values, req.query.filters);
      const kpi = clean(req.query.kpi);
      if (kpi === 'repairing') where.push(`department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') NOT IN ('true','TRUE','1')`);
      if (kpi === 'done') where.push(`department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') IN ('true','TRUE','1')`);
      if (kpi === 'delayed') where.push(`department_routing = 'ซ่อม' AND target_finish_date::date < CURRENT_DATE AND NULLIF(BTRIM(COALESCE(repair_finish_date::text,'')), '') IS NULL`);
      const expr = repairFilterExpression(field);
      const result = await pool.query(
        `SELECT DISTINCT ${expr} AS value FROM rizenicreport WHERE ${where.join(' AND ')} ORDER BY value ASC LIMIT 500`,
        values
      );
      res.json({ field, values: result.rows.map(row => clean(row.value)) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-kpi-drilldown', async (req, res) => {
    try {
      const bucket = clean(req.query.bucket);
      if (!['arrived', 'repairing', 'done', 'delayed'].includes(bucket)) {
        return res.status(400).json({ error: 'invalid repair KPI bucket' });
      }
      const { page, pageSize, offset } = pagedRequest(req, 20, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const where = repairLegacyBaseConditions();
      const values = [];
      addBranch(where, values, req.query.branch);
      if (bucket === 'arrived') {
        where.push(`(COALESCE(job_status,'') ILIKE '%จอดรอเข้าซ่อม%' OR COALESCE(job_status,'') ILIKE '%พักซ่อม%')`);
      } else if (bucket === 'repairing') {
        where.push(`department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') NOT IN ('true','TRUE','1')`);
      } else if (bucket === 'done') {
        where.push(`department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') IN ('true','TRUE','1')`);
      } else if (bucket === 'delayed') {
        where.push(`department_routing = 'ซ่อม' AND target_finish_date::date < CURRENT_DATE AND NULLIF(BTRIM(COALESCE(repair_finish_date::text,'')), '') IS NULL`);
      }
      values.push(pageSize);
      const limitParam = `$${values.length}`;
      values.push(offset);
      const offsetParam = `$${values.length}`;
      const result = await pool.query(
        `SELECT ${REPORT_REPAIR_FIELDS.join(', ')}${pageCountProjection(knownTotal)}
         FROM rizenicreport
         WHERE ${where.join(' AND ')}
         ORDER BY id DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        values
      );
      const meta = pageMeta(result.rows, page, pageSize, knownTotal);
      const reports = stripWindowCount(result.rows);
      const partOrders = await buildScopedPartOrdersForReports(pool, reports, req.query.branch, PART_ORDER_REPAIR_FIELDS);
      res.json({ reports, partOrders, ...meta, bucket });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-calendar', async (req, res) => {
    try {
      const bounds = monthBounds(req.query.year, req.query.month);
      if (!bounds) return res.status(400).json({ error: 'valid year and month are required' });
      const baseWhere = ['TRUE'];
      const values = [];
      addBranch(baseWhere, values, req.query.branch);
      values.push(bounds.start);
      const startP = `$${values.length}`;
      values.push(bounds.end);
      const endP = `$${values.length}`;
      const mainQtyExpr = `COALESCE(main_part_qty,0)`;
      const subQtyExpr = `COALESCE(sub_part_qty,0)`;
      const doneExpr = `${normalizedRepairJobStatusSql()} ~ '^(11|12|13|14|15|16|17|18|19|20|21|22)([.[:space:]]|$)'`;
      const sql = `WITH base AS (
          SELECT appointment_date::date AS appointment_day,
                 target_finish_date::date AS target_day,
                 delivery_date::date AS delivery_day,
                 repair_finish_date, job_status,
                 ${mainQtyExpr} AS main_qty,
                 ${subQtyExpr} AS sub_qty
          FROM rizenicreport
          WHERE ${baseWhere.join(' AND ')}
            AND (
              (appointment_date >= ${startP}::date AND appointment_date < ${endP}::date)
              OR (target_finish_date >= ${startP}::date AND target_finish_date < ${endP}::date)
              OR (delivery_date >= ${startP}::date AND delivery_date < ${endP}::date)
            )
        ), events AS (
          SELECT appointment_day AS day, COUNT(*)::int AS appointment_count, 0::int AS target_count,
                 0::int AS done_count, 0::int AS delivery_count, 0::numeric AS main_parts,
                 0::numeric AS sub_parts, 0::int AS overdue_count
          FROM base WHERE appointment_day IS NOT NULL GROUP BY appointment_day
          UNION ALL
          SELECT target_day AS day, 0::int, COUNT(*)::int,
                 COUNT(*) FILTER (WHERE ${doneExpr})::int,
                 0::int, COALESCE(SUM(main_qty),0)::numeric, COALESCE(SUM(sub_qty),0)::numeric,
                 COUNT(*) FILTER (WHERE target_day < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date AND NULLIF(BTRIM(COALESCE(repair_finish_date::text,'')), '') IS NULL)::int
          FROM base WHERE target_day IS NOT NULL GROUP BY target_day
          UNION ALL
          SELECT delivery_day AS day, 0::int, 0::int, 0::int, COUNT(*)::int,
                 0::numeric, 0::numeric, 0::int
          FROM base WHERE delivery_day IS NOT NULL GROUP BY delivery_day
        )
        SELECT day::text AS date,
               SUM(appointment_count)::int AS appointment,
               SUM(target_count)::int AS target,
               SUM(done_count)::int AS done,
               SUM(delivery_count)::int AS delivery,
               SUM(main_parts)::numeric AS main_parts,
               SUM(sub_parts)::numeric AS sub_parts,
               SUM(overdue_count)::int AS overdue
        FROM events WHERE day >= ${startP}::date AND day < ${endP}::date GROUP BY day ORDER BY day ASC`;
      const result = await pool.query(sql, values);
      res.json({ days: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-summary', async (req, res) => {
    try {
      const where = [...repairLegacyBaseConditions(), "department_routing = 'ซ่อม'"];
      const values = [];
      addBranch(where, values, req.query.branch);
      const fields = ['id','branch_name','car_plate','car_brand','car_model','target_finish_date','repair_finish_date','job_status','department_routing','station_kho','station_pou','station_puan','station_pon','station_prak','station_kat','station_qc','station_mag','station_kraj','station_film','station_pak','station_ready'];
      const result = await pool.query(`SELECT ${fields.join(', ')} FROM rizenicreport WHERE ${where.join(' AND ')} ORDER BY id DESC`, values);
      res.json({ reports: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-page', async (req, res) => {
    try {
      const { page, pageSize, offset } = pagedRequest(req, 50, 50);
      const knownTotal = parseKnownTotal(req.query.known_total);
      const includeMeta = clean(req.query.includeMeta) !== '0';
      const calendarMode = clean(req.query.calendar) === '1';
      const reportWhere = repairQueueConditions(calendarMode);
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      addSearch(reportWhere, reportValues, req.query.search, ['car_plate','vin_no','sa_owner','car_brand','car_model','car_color','appointment_date','arrived_date','target_finish_date','repair_finish_date','delivery_date','job_status','department_routing','main_part_name','sub_part_name']);
      addRepairFilters(reportWhere, reportValues, req.query.filters);
      const kpi = clean(req.query.kpi);
      if (kpi === 'repairing') reportWhere.push(`department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') NOT IN ('true','TRUE','1')`);
      if (kpi === 'done') reportWhere.push(`department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') IN ('true','TRUE','1')`);
      if (kpi === 'delayed') reportWhere.push(`department_routing = 'ซ่อม' AND target_finish_date::date < CURRENT_DATE AND NULLIF(BTRIM(COALESCE(repair_finish_date::text,'')), '') IS NULL`);
      const repairSortFields = new Set(['id','car_plate','vin_no','sa_owner','car_brand','car_model','car_color','appointment_date','arrived_date','target_finish_date','repair_finish_date','delivery_date','main_part_qty','sub_part_qty','job_status','department_routing']);
      const sortField = repairSortFields.has(clean(req.query.sort)) ? clean(req.query.sort) : 'id';
      const sortDir = clean(req.query.dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      reportValues.push(pageSize);
      const limitParam = `$${reportValues.length}`;
      reportValues.push(offset);
      const offsetParam = `$${reportValues.length}`;

      const quotaWhere = [];
      const quotaValues = [];
      addBranch(quotaWhere, quotaValues, req.query.branch);
      const summaryWhere = repairLegacyBaseConditions();
      const summaryValues = [];
      addBranch(summaryWhere, summaryValues, req.query.branch);

      const [reportsResult, quotas, bodyParts, kpis] = await Promise.all([
        pool.query(`SELECT ${REPORT_REPAIR_FIELDS.join(', ')}${pageCountProjection(knownTotal)} FROM rizenicreport WHERE ${reportWhere.join(' AND ')} ORDER BY ${sortField} ${sortDir} NULLS LAST LIMIT ${limitParam} OFFSET ${offsetParam}`, reportValues),
        includeMeta ? pool.query(`SELECT * FROM rizenic_quotas${quotaWhere.length ? ` WHERE ${quotaWhere.join(' AND ')}` : ''} ORDER BY quota_type ASC, quota_date DESC`, quotaValues) : Promise.resolve({ rows: [] }),
        includeMeta ? pool.query('SELECT * FROM rizenic_body_parts ORDER BY id ASC') : Promise.resolve({ rows: [] }),
        includeMeta ? pool.query(`SELECT
          COUNT(*) FILTER (WHERE COALESCE(job_status,'') ILIKE '%จอดรอเข้าซ่อม%' OR COALESCE(job_status,'') ILIKE '%พักซ่อม%')::int AS arrived,
          COUNT(*) FILTER (WHERE department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') NOT IN ('true','TRUE','1'))::int AS repairing,
          COUNT(*) FILTER (WHERE department_routing = 'ซ่อม' AND COALESCE(station_ready::text,'') IN ('true','TRUE','1'))::int AS done,
          COUNT(*) FILTER (WHERE department_routing = 'ซ่อม' AND target_finish_date::date < CURRENT_DATE AND NULLIF(BTRIM(COALESCE(repair_finish_date::text,'')), '') IS NULL)::int AS delayed
          FROM rizenicreport WHERE ${summaryWhere.join(' AND ')}`, summaryValues) : Promise.resolve({ rows: [] })
      ]);
      const meta = pageMeta(reportsResult.rows, page, pageSize, knownTotal);
      const reports = stripWindowCount(reportsResult.rows);
      const includeParts = clean(req.query.includeParts) !== '0';
      const partOrders = includeParts
        ? await buildScopedPartOrdersForReports(pool, reports, req.query.branch, PART_ORDER_REPAIR_FIELDS)
        : [];
      res.json({ reports, partOrders, quotas: quotas.rows, bodyParts: bodyParts.rows, kpis: kpis.rows[0] || {}, ...meta });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-parts', async (req, res) => {
    try {
      const partOrders = await buildScopedPartOrdersForKeys(pool, req.query, req.query.branch, PART_ORDER_REPAIR_FIELDS);
      res.json({ partOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-board', async (req, res) => {
    try {
      const branch = clean(req.query.branch);
      if (!branch) return res.status(400).json({ error: 'branch is required' });
      const sql = `SELECT id, car_plate, vin_no, car_brand, car_model, damage_level, target_finish_date, repair_finish_date,
          job_status, repair_notes, station_kho, station_pou, station_puan, station_pon, station_prak, station_kat,
          station_qc, station_mag, station_kraj, station_film, station_pak, station_ready
        FROM rizenicreport
        WHERE branch_name = $1 AND ${repairQueueConditions().join(' AND ')}
        ORDER BY id DESC`;
      const result = await pool.query(sql, [branch]);
      const grouped = {};
      const stationOf = row => {
        const truthy = value => value === true || value === 1 || value === '1' || value === 'TRUE' || value === 'true';
        if (truthy(row.station_ready)) return '12. รอส่งมอบ';
        if (truthy(row.station_pak)) return '11. พักซ่อม';
        if (truthy(row.station_film)) return '10. ฟิล์ม';
        if (truthy(row.station_kraj)) return '09. กระจก';
        if (truthy(row.station_mag)) return '08. ซ่อมแม็ก';
        if (truthy(row.station_qc)) return '07. เก็บงาน';
        if (truthy(row.station_kat)) return '06. ขัดสี';
        if (truthy(row.station_prak)) return '05. ประกอบ';
        if (truthy(row.station_pon)) return '04. พ่นสี';
        if (truthy(row.station_puan)) return '03. เตรียมพื้น';
        if (truthy(row.station_pou)) return '02. โป๊ว';
        if (truthy(row.station_kho)) return '01. เคาะ';
        return 'ยังไม่ระบุสถานี';
      };
      for (const row of result.rows) {
        const station = stationOf(row);
        if (!grouped[station]) grouped[station] = [];
        grouped[station].push({
          plate: row.car_plate || 'ไม่มีป้าย',
          vin: row.vin_no || '-',
          car: `${row.car_brand || ''} ${row.car_model || ''}`.trim(),
          damage: row.damage_level || 'เบา',
          target: row.target_finish_date ? String(row.target_finish_date).split('T')[0] : 'ยังไม่ระบุ',
          actual: row.repair_finish_date ? String(row.repair_finish_date).split('T')[0] : '-',
          status: row.job_status,
          notes: row.repair_notes || '-'
        });
      }
      res.json({ grouped });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  app.get('/api/server/finance-meta', async (req, res) => {
    try {
      const result = await pool.query(`SELECT
        COALESCE(
          ARRAY_AGG(DISTINCT branch_name ORDER BY branch_name)
            FILTER (WHERE NULLIF(BTRIM(COALESCE(branch_name, '')), '') IS NOT NULL),
          ARRAY[]::text[]
        ) AS branches,
        COALESCE(
          ARRAY_AGG(DISTINCT EXTRACT(YEAR FROM billing_date::date)::int ORDER BY EXTRACT(YEAR FROM billing_date::date)::int DESC)
            FILTER (WHERE billing_date IS NOT NULL),
          ARRAY[]::int[]
        ) AS years
        FROM rizenicreport
        WHERE department_routing = 'บัญชี'`);
      const row = result.rows[0] || {};
      res.json({ branches: row.branches || [], years: (row.years || []).map(Number).filter(Boolean) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/finance-totals', async (req, res) => {
    try {
      const built = buildReportsWhere(req.query);
      const where = [...built.where, "department_routing = 'บัญชี'", "COALESCE(job_status, '') NOT LIKE '%ปิดงาน%'", "COALESCE(job_status, '') NOT LIKE '%18.ลูกค้ายกเลิก%'"];
      const sql = `SELECT
          COALESCE(SUM(cost_labor), 0)::numeric AS labor,
          COALESCE(SUM(cost_part), 0)::numeric AS part,
          COALESCE(SUM(cost_external), 0)::numeric AS external,
          COALESCE(SUM(COALESCE(cost_labor,0) + COALESCE(cost_part,0) + COALESCE(cost_external,0)), 0)::numeric AS total,
          COUNT(*)::int AS count
        FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
      const result = await pool.query(sql, built.values);
      res.json(result.rows[0] || { labor: 0, part: 0, external: 0, total: 0, count: 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/finance-summary', async (req, res) => {
    try {
      const where = ["department_routing = 'บัญชี'", "COALESCE(job_status, '') NOT LIKE '%ปิดงาน%'", "COALESCE(job_status, '') NOT LIKE '%18.ลูกค้ายกเลิก%'"];
      const values = [];
      addBranch(where, values, req.query.branch);
      const year = Number.parseInt(req.query.year, 10);
      const month = Number.parseInt(req.query.month, 10);
      let managedCondition = `NULLIF(BTRIM(COALESCE(billing_date::text, '')), '') IS NOT NULL`;
      if (Number.isFinite(year)) {
        values.push(year);
        managedCondition += ` AND EXTRACT(YEAR FROM billing_date::date) = $${values.length}`;
      }
      if (Number.isFinite(month) && month >= 1 && month <= 12) {
        values.push(month);
        managedCondition += ` AND EXTRACT(MONTH FROM billing_date::date) = $${values.length}`;
      }
      const sql = `SELECT
          COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(billing_date::text, '')), '') IS NULL)::int AS unmanaged,
          COUNT(*) FILTER (WHERE ${managedCondition})::int AS managed
        FROM rizenicreport${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
      const result = await pool.query(sql, values);
      res.json(result.rows[0] || { unmanaged: 0, managed: 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerServerSideViews, monthBounds };
