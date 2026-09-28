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
  'arrived_date','target_finish_date','repair_finish_date','delivery_date','main_part_name','main_part_qty','sub_part_name',
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

async function buildScopedPartOrdersForReports(pool, reports, rawBranch, fields = PART_ORDER_DASHBOARD_FIELDS) {
  const ids = [...new Set((reports || []).map(row => clean(row.id ?? row.report_id)).filter(Boolean))];
  const plates = [...new Set((reports || []).map(row => clean(row.car_plate)).filter(Boolean))];
  if (!ids.length && !plates.length) return [];

  const where = [];
  const values = [];
  const idParam = `$${values.length + 1}`;
  values.push(ids);
  const plateParam = `$${values.length + 1}`;
  values.push(plates);
  where.push(`(job_id::text = ANY(${idParam}::text[]) OR car_plate = ANY(${plateParam}::text[]))`);
  addBranch(where, values, rawBranch);
  const result = await pool.query(`SELECT ${fields.join(', ')} FROM rizenic_part_orders WHERE ${where.join(' AND ')} ORDER BY order_id DESC`, values);
  return result.rows;
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

function registerServerSideViews(app, pool) {
  app.get('/api/server/parts-master', async (req, res) => {
    try {
      const page = safePositiveInt(req.query.page, 1, 1000000);
      const pageSize = safePositiveInt(req.query.limit, 50, 100);
      const offset = (page - 1) * pageSize;
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
      const sql = `SELECT m.*, l.location, l.safety_stock, COUNT(*) OVER() AS __total_count
        FROM rizenicpartsmaster m
        LEFT JOIN rizenic_part_locations l ON m.part_no = l.part_no AND l.branch_name = $1
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY m.part_name ASC
        LIMIT ${limitParam} OFFSET ${offsetParam}`;
      const result = await pool.query(sql, values);
      let total = Number(result.rows[0]?.__total_count || 0);
      if (!result.rows.length && page > 1) {
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
      const sql = `SELECT ${cfg.fields}, COUNT(*) OVER() AS __total_count FROM ${cfg.table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${cfg.order} LIMIT ${limitParam} OFFSET ${offsetParam}`;
      const result = await pool.query(sql, values);
      let total = Number(result.rows[0]?.__total_count || 0);
      if (!result.rows.length && page > 1) {
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
      const reportWhere = [];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const orderWhere = [];
      const orderValues = [];
      addBranch(orderWhere, orderValues, req.query.branch);

      const [reports, branches] = await Promise.all([
        pool.query(`SELECT ${REPORT_DASHBOARD_FIELDS.join(', ')} FROM rizenicreport${reportWhere.length ? ` WHERE ${reportWhere.join(' AND ')}` : ''} ORDER BY id DESC`, reportValues),
        pool.query(`SELECT DISTINCT branch_name FROM rizenicreport WHERE NULLIF(BTRIM(COALESCE(branch_name, '')), '') IS NOT NULL ORDER BY branch_name ASC`)
      ]);
      const includeParts = clean(req.query.includeParts) !== '0';
      const partOrders = includeParts
        ? await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_DASHBOARD_FIELDS)
        : [];
      res.json({ reports: reports.rows, partOrders, branches: branches.rows.map(row => row.branch_name) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Secondary dashboard dataset: runs in parallel with the primary report view so
  // first paint does not wait for part-order tracking data.
  app.get('/api/server/dashboard-parts', async (req, res) => {
    try {
      const reportWhere = [];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const reports = await pool.query(
        `SELECT id, car_plate FROM rizenicreport${reportWhere.length ? ` WHERE ${reportWhere.join(' AND ')}` : ''} ORDER BY id DESC`,
        reportValues
      );
      const partOrders = await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_DASHBOARD_FIELDS);
      res.json({ partOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/sa-overview', async (req, res) => {
    try {
      const reportWhere = [];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const orderWhere = [];
      const orderValues = [];
      addBranch(orderWhere, orderValues, req.query.branch);

      const [reports, branches] = await Promise.all([
        pool.query(`SELECT ${REPORT_SA_FIELDS.join(', ')} FROM rizenicreport${reportWhere.length ? ` WHERE ${reportWhere.join(' AND ')}` : ''} ORDER BY id DESC`, reportValues),
        pool.query(`SELECT DISTINCT branch_name FROM rizenicemployeemaster WHERE NULLIF(BTRIM(COALESCE(branch_name, '')), '') IS NOT NULL ORDER BY branch_name ASC`)
      ]);
      const includeParts = clean(req.query.includeParts) !== '0';
      const partOrders = includeParts
        ? await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_DASHBOARD_FIELDS)
        : [];
      res.json({ reports: reports.rows, partOrders, branches: branches.rows.map(row => row.branch_name) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/sa-parts', async (req, res) => {
    try {
      const reportWhere = [];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const reports = await pool.query(
        `SELECT id, car_plate FROM rizenicreport${reportWhere.length ? ` WHERE ${reportWhere.join(' AND ')}` : ''} ORDER BY id DESC`,
        reportValues
      );
      const partOrders = await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_DASHBOARD_FIELDS);
      res.json({ partOrders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/parts-alerts', async (req, res) => {
    try {
      const reportWhere = [];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const orderWhere = [];
      const orderValues = [];
      addBranch(orderWhere, orderValues, req.query.branch);

      const relevantSql = `(department_routing = 'อะไหล่'
        OR COALESCE(job_status, '') ILIKE ANY($${reportValues.length + 1}::text[])
        OR EXISTS (
          SELECT 1 FROM rizenic_part_orders po
          WHERE po.job_id::text = rizenicreport.id::text
             OR (NULLIF(BTRIM(COALESCE(po.car_plate, '')), '') IS NOT NULL AND po.car_plate = rizenicreport.car_plate)
        ))`;
      reportValues.push(['%สั่งอะไหล่%','%รอรถเข้าซ่อม%','%รออะไหล่%']);
      reportWhere.push(relevantSql);
      const reports = await pool.query(`SELECT ${REPORT_PARTS_FIELDS.join(', ')} FROM rizenicreport${reportWhere.length ? ` WHERE ${reportWhere.join(' AND ')}` : ''} ORDER BY id DESC`, reportValues);
      const partOrders = await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_DASHBOARD_FIELDS);
      res.json({ reports: reports.rows, partOrders });
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

  app.get('/api/server/repair-page', async (req, res) => {
    try {
      const reportWhere = ["COALESCE(job_status, '') NOT ILIKE '%ยกเลิก%'", "COALESCE(job_status, '') NOT ILIKE '%ส่งมอบแล้ว%'", "COALESCE(job_status, '') <> '12.ส่งมอบ'"];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const orderWhere = [];
      const orderValues = [];
      addBranch(orderWhere, orderValues, req.query.branch);
      const quotaWhere = [];
      const quotaValues = [];
      addBranch(quotaWhere, quotaValues, req.query.branch);

      const [reports, quotas, bodyParts] = await Promise.all([
        pool.query(`SELECT ${REPORT_REPAIR_FIELDS.join(', ')} FROM rizenicreport WHERE ${reportWhere.join(' AND ')} ORDER BY id DESC`, reportValues),
        pool.query(`SELECT * FROM rizenic_quotas${quotaWhere.length ? ` WHERE ${quotaWhere.join(' AND ')}` : ''} ORDER BY quota_type ASC, quota_date DESC`, quotaValues),
        pool.query('SELECT * FROM rizenic_body_parts ORDER BY id ASC')
      ]);
      const includeParts = clean(req.query.includeParts) !== '0';
      const partOrders = includeParts
        ? await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_REPAIR_FIELDS)
        : [];
      res.json({ reports: reports.rows, partOrders, quotas: quotas.rows, bodyParts: bodyParts.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/server/repair-parts', async (req, res) => {
    try {
      const reportWhere = ["COALESCE(job_status, '') NOT ILIKE '%ยกเลิก%'", "COALESCE(job_status, '') NOT ILIKE '%ส่งมอบแล้ว%'", "COALESCE(job_status, '') <> '12.ส่งมอบ'"];
      const reportValues = [];
      addBranch(reportWhere, reportValues, req.query.branch);
      const reports = await pool.query(
        `SELECT id, car_plate FROM rizenicreport WHERE ${reportWhere.join(' AND ')} ORDER BY id DESC`,
        reportValues
      );
      const partOrders = await buildScopedPartOrdersForReports(pool, reports.rows, req.query.branch, PART_ORDER_REPAIR_FIELDS);
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
        WHERE branch_name = $1 AND (department_routing = 'ซ่อม' OR job_status = ANY($2::text[]))
        ORDER BY id DESC`;
      const statuses = ['09.จอดรอเข้าซ่อม', '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ'];
      const result = await pool.query(sql, [branch, statuses]);
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
      const branchWhere = ["department_routing = 'บัญชี'"];
      const branchValues = [];
      const [branches, years] = await Promise.all([
        pool.query(`SELECT DISTINCT branch_name FROM rizenicreport WHERE department_routing = 'บัญชี' AND NULLIF(BTRIM(COALESCE(branch_name, '')), '') IS NOT NULL ORDER BY branch_name ASC`),
        pool.query(`SELECT DISTINCT EXTRACT(YEAR FROM billing_date::date)::int AS year FROM rizenicreport WHERE department_routing = 'บัญชี' AND billing_date IS NOT NULL ORDER BY year DESC`)
      ]);
      res.json({ branches: branches.rows.map(row => row.branch_name), years: years.rows.map(row => Number(row.year)).filter(Boolean) });
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
