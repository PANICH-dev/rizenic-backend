const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json({ limit: '10mb' })); // 🌟 เพิ่ม Limit ป้องกันข้อมูล Excel เยอะเกิน

// บังคับไม่ให้ Express และ Vercel จำ Cache ไฟล์ในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function (res, path) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🚀 API สะพานเชื่อม Dynamic (รับได้ทุกตารางจาก Google Sheet)
// ==========================================
app.post('/api/sync-dynamic', async (req, res) => {
    const { tableName, primaryKey, data } = req.body;

    // เช็กว่าส่งข้อมูลมาครบไหม
    if (!tableName || !data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: "ข้อมูล Payload ไม่ถูกต้องครับนาย" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // เริ่ม Transaction

        for (const row of data) {
            // ดึงเฉพาะคอลัมน์ที่มีข้อมูลส่งมา
            const rowKeys = Object.keys(row);
            if (rowKeys.length === 0) continue;

            const colsStr = rowKeys.join(', ');
            const valuePlaceholders = rowKeys.map((_, idx) => `$${idx + 1}`).join(', ');
            const values = rowKeys.map(k => row[k]);

            // สร้างคำสั่ง INSERT อัตโนมัติ
            let sql = `INSERT INTO ${tableName} (${colsStr}) VALUES (${valuePlaceholders})`;

            // ถ้ามี Primary Key ให้สร้างเงื่อนไข ON CONFLICT เพื่ออัปเดตข้อมูลทับของเดิม
            if (primaryKey) {
                // กรอง Primary Key และพวก ID ที่เป็น Auto Increment ออกจากการ Update
                const updateCols = rowKeys.filter(col => col !== primaryKey && col !== 'id' && col !== 'part_id');
                if (updateCols.length > 0) {
                    const updateStr = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(', ');
                    sql += ` ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateStr}`;
                } else {
                    sql += ` ON CONFLICT (${primaryKey}) DO NOTHING`;
                }
            }

            // ยิงข้อมูลลง DB ทีละแถว
            await client.query(sql, values);
        }

        await client.query('COMMIT'); // ผ่านหมด บันทึกจริง
        res.json({ success: true, message: `อัปโหลดเข้าตาราง ${tableName} สำเร็จ ${data.length} รายการ!` });
    } catch (err) {
        await client.query('ROLLBACK'); // ถ้าพัง ยกเลิกทั้งหมด
        console.error(`Dynamic Sync Error [${tableName}]:`, err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 🛡️ ฟังก์ชันเช็กโควต้า "ชิ้นส่วนหลัก" และ "ชิ้นส่วนรอง" (แยกส่วนกัน)
// ==========================================
async function checkColorPartsQuota(branch_name, dateStr, newMainQty, newSubQty, excludeReportId = null) {
    if (!dateStr || !branch_name) return null; 
    const targetDate = dateStr.split('T')[0]; 
    
    // 1. ดึงโควต้าของสาขาและวันที่ระบุ
    const quotaRes = await pool.query(`
        SELECT * FROM rizenic_quotas 
        WHERE branch_name = $1 
        AND (quota_type = 'default' OR (quota_type = 'special' AND quota_date = $2))
        ORDER BY quota_type DESC LIMIT 1
    `, [branch_name, targetDate]);
    
    if (quotaRes.rows.length === 0) return null; 
    const maxMainParts = parseInt(quotaRes.rows[0].quota_main_parts) || 0;
    const maxSubParts = parseInt(quotaRes.rows[0].quota_sub_parts) || 0;
    
    if (maxMainParts === 0 && maxSubParts === 0) return null; 
    
    // 2. ดึงยอดชิ้นส่วน "หลัก" และ "รอง" ที่รับไว้แล้วในวันนั้น
    let sumQuery = `
        SELECT 
            COALESCE(SUM(main_part_qty), 0) as total_main,
            COALESCE(SUM(sub_part_qty), 0) as total_sub
        FROM rizenicreport 
        WHERE branch_name = $1 AND arrived_date::text LIKE $2 || '%'
    `;
    let sumParams = [branch_name, targetDate];

    if (excludeReportId) {
        sumQuery += ` AND id != $3`;
        sumParams.push(excludeReportId);
    }
    
    const sumRes = await pool.query(sumQuery, sumParams);
    const currentMainTotal = parseInt(sumRes.rows[0].total_main) || 0;
    const currentSubTotal = parseInt(sumRes.rows[0].total_sub) || 0;
    
    const requestingMainTotal = parseInt(newMainQty) || 0;
    const requestingSubTotal = parseInt(newSubQty) || 0;
    
    // 3. เช็กเงื่อนไขการเกินโควต้าทีละส่วน
    let errorMsg = [];
    if (maxMainParts > 0 && (currentMainTotal + requestingMainTotal > maxMainParts)) {
        errorMsg.push(`ชิ้นส่วนหลักเกินโควต้า! (รับได้ ${maxMainParts} ชิ้น, ปัจจุบันมี ${currentMainTotal} ชิ้น, คุณกำลังเพิ่ม ${requestingMainTotal} ชิ้น)`);
    }
    
    if (maxSubParts > 0 && (currentSubTotal + requestingSubTotal > maxSubParts)) {
        errorMsg.push(`ชิ้นส่วนรองเกินโควต้า! (รับได้ ${maxSubParts} ชิ้น, ปัจจุบันมี ${currentSubTotal} ชิ้น, คุณกำลังเพิ่ม ${requestingSubTotal} ชิ้น)`);
    }
    
    if (errorMsg.length > 0) {
        return `โควต้าสำหรับวันที่ ${targetDate} สาขา ${branch_name}:\n` + errorMsg.join('\n');
    }
    
    return null; 
}


// ==========================================
// 🎯 API ระบบโควต้าสาขา (rizenic_quotas)
// ==========================================
app.get('/api/quotas', async (req, res) => {
  try { 
    res.json((await pool.query('SELECT * FROM rizenic_quotas ORDER BY quota_type ASC, quota_date DESC')).rows); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quotas', async (req, res) => {
  try {
    const { quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery, quota_main_parts, quota_sub_parts } = req.body;
    const queryText = `
      INSERT INTO rizenic_quotas (quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery, quota_main_parts, quota_sub_parts) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
    `;
    const values = [
      quota_type || 'default', 
      quota_type === 'special' ? quota_date : null, 
      branch_name, 
      parseInt(quota_arrived) || 0, 
      parseInt(quota_target) || 0, 
      parseInt(quota_delivery) || 0,
      parseInt(quota_main_parts) || 0,
      parseInt(quota_sub_parts) || 0  
    ];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/quotas/:id', async (req, res) => {
  try {
    const { quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery, quota_main_parts, quota_sub_parts } = req.body;
    const queryText = `
      UPDATE rizenic_quotas SET quota_type=$1, quota_date=$2, branch_name=$3, quota_arrived=$4, quota_target=$5, quota_delivery=$6, quota_main_parts=$7, quota_sub_parts=$8 
      WHERE id=$9;
    `;
    const values = [
      quota_type || 'default', 
      quota_type === 'special' ? quota_date : null, 
      branch_name, 
      parseInt(quota_arrived) || 0, 
      parseInt(quota_target) || 0, 
      parseInt(quota_delivery) || 0,
      parseInt(quota_main_parts) || 0, 
      parseInt(quota_sub_parts) || 0,  
      req.params.id
    ];
    await pool.query(queryText, values);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/quotas/:id', async (req, res) => {
  try { 
    await pool.query('DELETE FROM rizenic_quotas WHERE id = $1', [req.params.id]); 
    res.json({ success: true }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🔒 API ล็อกอิน
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM rizenicemployeemaster WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length > 0) res.json({ success: true, employee: result.rows[0] });
    else res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้องครับนาย!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 👥 API พนักงาน - CRUD
// ==========================================
app.get('/api/employees', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/employees', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages } = req.body;
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1', [username]);
    if (checkDup.rows.length > 0) return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' });
    
    await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, true)', [employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages } = req.body;
    await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6, accessible_pages=$7 WHERE employee_id=$8', [employee_code, employee_name, employee_role, branch_name, username, password, accessible_pages, req.params.id]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/employees/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🚗 API Car Models - CRUD
// ==========================================
app.get('/api/car-models', async (req, res) => {
  try { res.json((await pool.query('SELECT model_id, car_brand, car_model FROM rizeniccarmodelmaster ORDER BY car_brand ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/car-models', async (req, res) => {
  try { await pool.query('INSERT INTO rizeniccarmodelmaster (car_brand, car_model) VALUES ($1, $2)', [req.body.car_brand, req.body.car_model]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/car-models/:id', async (req, res) => {
  try { await pool.query('UPDATE rizeniccarmodelmaster SET car_brand=$1, car_model=$2 WHERE model_id=$3', [req.body.car_brand, req.body.car_model, req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/car-models/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizeniccarmodelmaster WHERE model_id = $1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🛡️ API Insurances - CRUD
// ==========================================
app.get('/api/insurances', async (req, res) => {
  try { res.json((await pool.query('SELECT insurance_code, insurance_name, insurance_type FROM rizenicinsurancemaster ORDER BY insurance_code ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/insurances', async (req, res) => {
  try { await pool.query('INSERT INTO rizenicinsurancemaster (insurance_code, insurance_name, insurance_type) VALUES ($1, $2, $3)', [req.body.insurance_code, req.body.insurance_name, req.body.insurance_type]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/insurances/:id', async (req, res) => {
  try { await pool.query('UPDATE rizenicinsurancemaster SET insurance_name=$1, insurance_type=$2 WHERE insurance_code=$3', [req.body.insurance_name, req.body.insurance_type, req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/insurances/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicinsurancemaster WHERE insurance_code = $1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 👥 API Customer Types - CRUD
// ==========================================
app.get('/api/customer-types', async (req, res) => {
  try { res.json((await pool.query('SELECT customer_type_id, type_code, type_name FROM rizeniccustomertypemaster ORDER BY type_code ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/customer-types', async (req, res) => {
  try {
    const { type_name } = req.body; 
    const countResult = await pool.query('SELECT COUNT(*) FROM rizeniccustomertypemaster'); 
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    await pool.query('INSERT INTO rizeniccustomertypemaster (type_code, type_name) VALUES ($1, $2)', ['CT-' + String(nextNum).padStart(2, '0'), type_name]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/customer-types/:id', async (req, res) => {
  try { await pool.query('UPDATE rizeniccustomertypemaster SET type_name = $1 WHERE customer_type_id = $2', [req.body.type_name, req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/customer-types/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizeniccustomertypemaster WHERE customer_type_id = $1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ⚙️ API Masters อะไหล่
// ==========================================
app.get('/api/parts', async (req, res) => {
  try {
    const branch = req.query.branch || 'สำนักงานใหญ่';
    const queryText = `
      SELECT m.*, l.location, l.safety_stock
      FROM rizenicpartsmaster m
      LEFT JOIN rizenic_part_locations l ON m.part_no = l.part_no AND l.branch_name = $1
      ORDER BY m.part_name ASC
    `;
    const result = await pool.query(queryText, [branch]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/parts/check/:part_no', async (req, res) => {
  try {
    const branch = req.query.branch || 'สำนักงานใหญ่';
    const queryText = `
      SELECT m.*, l.location, l.safety_stock 
      FROM rizenicpartsmaster m 
      LEFT JOIN rizenic_part_locations l ON m.part_no = l.part_no AND l.branch_name = $2
      WHERE m.part_no = $1 LIMIT 1
    `;
    const result = await pool.query(queryText, [req.params.part_no, branch]);
    res.json(result.rows[0] || null); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/parts', async (req, res) => {
  const client = await pool.connect();
  try {
    const { part_main_no, part_no, part_name, car_model, part_category, unit_price, location, safety_stock, branch_name } = req.body;
    const branch = branch_name || 'สำนักงานใหญ่';

    await client.query('BEGIN'); 
    
    const masterSql = `
      INSERT INTO rizenicpartsmaster (part_main_no, part_no, part_name, car_model, part_category, unit_price) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (part_no) DO UPDATE 
      SET part_name = $3, car_model = $4, part_category = $5, unit_price = $6;
    `;
    await client.query(masterSql, [part_main_no || null, part_no, part_name, car_model || null, part_category || 'อะไหล่ทั่วไป', parseFloat(unit_price) || 0.00]);

    const locSql = `
      INSERT INTO rizenic_part_locations (part_no, branch_name, location, safety_stock)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (part_no, branch_name) DO UPDATE
      SET location = $3, safety_stock = $4;
    `;
    await client.query(locSql, [part_no, branch, location || null, parseInt(safety_stock) || 0]);

    await client.query('COMMIT'); 
    res.json({ success: true });
  } catch (e) { 
    await client.query('ROLLBACK'); 
    res.status(500).json({ error: e.message }); 
  } finally { client.release(); }
});

app.put('/api/parts/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { part_main_no, part_no, part_name, car_model, part_category, unit_price, location, safety_stock, branch_name } = req.body;
    const branch = branch_name || 'สำนักงานใหญ่';

    await client.query('BEGIN');
    
    const masterSql = `
      UPDATE rizenicpartsmaster SET 
      part_main_no=$1, part_no=$2, part_name=$3, car_model=$4, part_category=$5, unit_price=$6 
      WHERE part_id=$7;
    `;
    await client.query(masterSql, [part_main_no || null, part_no, part_name, car_model || null, part_category, parseFloat(unit_price) || 0.00, req.params.id]);

    const locSql = `
      INSERT INTO rizenic_part_locations (part_no, branch_name, location, safety_stock)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (part_no, branch_name) DO UPDATE
      SET location = $3, safety_stock = $4;
    `;
    await client.query(locSql, [part_no, branch, location || null, parseInt(safety_stock) || 0]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message }); 
  } finally { client.release(); }
});

app.delete('/api/parts/:id', async (req, res) => {
  try { 
    await pool.query('DELETE FROM rizenicpartsmaster WHERE part_id = $1', [req.params.id]); 
    res.json({ success: true }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 📌 API จัดการสถานะหลักและ Routing
// ==========================================
app.get('/api/statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/statuses', async (req, res) => {
  try {
    const { status_code, status_name, department, route_page } = req.body;
    const queryText = `
      INSERT INTO rizenicstatusmaster (status_code, status_name, department, route_page) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (status_code) DO UPDATE 
      SET status_name = EXCLUDED.status_name, 
          department = EXCLUDED.department, 
          route_page = EXCLUDED.route_page;
    `;
    await pool.query(queryText, [status_code, status_name, department || 'บริการ', route_page || 'jobs']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/statuses/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicstatusmaster WHERE status_code = $1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🎨 API Master: ชิ้นส่วนซ่อมสี
// ==========================================
app.get('/api/body-parts', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_body_parts ORDER BY id ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/body-parts', async (req, res) => {
  try { await pool.query('INSERT INTO rizenic_body_parts (category, part_name) VALUES ($1, $2)', [req.body.category, req.body.part_name]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/body-parts/:id', async (req, res) => {
  try { await pool.query('UPDATE rizenic_body_parts SET category=$1, part_name=$2 WHERE id=$3', [req.body.category, req.body.part_name, req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/body-parts/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenic_body_parts WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 📋 API ระบบจัดการใบงานซ่อมหลัก (rizenicreport)
// ==========================================
app.get('/api/reports', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicreport ORDER BY id DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/report/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicreport WHERE id = $1', [req.params.id]);
    if(result.rows.length > 0) res.json(result.rows[0]);
    else res.status(404).json({ error: 'ไม่พบข้อมูลใบงานนี้ครับนาย' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/report', async (req, res) => {
  try {
    const {
      sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, qt_no, so_no, bl_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date,
      contact_date, arrived_date, car_plate,
      epc_no, part_status, order_part_date, est_part_date, ordered_part_names,
      department_routing, is_parked
    } = req.body;

    // 🌟 เช็กโควต้าชิ้นส่วนทำสี ก่อนกดบันทึก
    const quotaErrorMsg = await checkColorPartsQuota(branch_name, arrived_date, main_part_qty, sub_part_qty, null);
    if (quotaErrorMsg) {
        return res.status(400).json({ error: quotaErrorMsg });
    }

    const queryText = `
      INSERT INTO rizenicreport (
        sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
        vin_no, qt_no, so_no, bl_no, payment_type, damage_level, main_part_name,
        main_part_qty, sub_part_name, sub_part_qty, cost_labor,
        cost_part, cost_external, notes, job_status,
        target_finish_date, actual_finish_date, delivery_date,
        contact_date, arrived_date, car_plate,
        epc_no, part_status, order_part_date, est_part_date, ordered_part_names, department_routing,
        is_parked
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
      RETURNING id;
    `;

    const values = [
      sa_owner || null, branch_name || 'สำนักงานใหญ่', customer_name || null, phone_number || null, customer_type || null, car_brand || null, car_model || null,
      vin_no || null, qt_no || null, so_no || null, bl_no || null, payment_type || null, damage_level || 'เบา', main_part_name || null,
      main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
      cost_labor || 0, cost_part || 0, cost_external || 0,
      notes || null, job_status || null, target_finish_date || null, actual_finish_date || null, delivery_date || null,
      contact_date || null, arrived_date || null, car_plate || null,
      epc_no || null, part_status || null, order_part_date || null, est_part_date || null, ordered_part_names || null,
      department_routing || 'รอดำเนินการ',
      is_parked || 'ไม่จอดซ่อม'
    ];

    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/report/:id', async (req, res) => {
  try {
    const {
      sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, qt_no, so_no, bl_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date,
      contact_date, arrived_date, car_plate,
      station_kho, station_pou, station_puan, station_pon, station_prak, station_kat,
      station_qc, station_mag, station_kraj, station_film, station_pak, station_ready,
      repair_notes, repair_finish_date,
      epc_no, part_status, order_part_date, est_part_date, ordered_part_names,
      department_routing, is_parked
    } = req.body;

    // 🌟 เช็กโควต้าชิ้นส่วนทำสี ก่อนกดแก้ไข
    const quotaErrorMsg = await checkColorPartsQuota(branch_name, arrived_date, main_part_qty, sub_part_qty, req.params.id);
    if (quotaErrorMsg) {
        return res.status(400).json({ error: quotaErrorMsg });
    }

    const queryText = `
      UPDATE rizenicreport SET 
        sa_owner=$1, branch_name=$2, customer_name=$3, phone_number=$4, customer_type=$5, 
        car_brand=$6, car_model=$7, vin_no=$8, qt_no=$9, so_no=$10, bl_no=$11, payment_type=$12, damage_level=$13, 
        main_part_name=$14, main_part_qty=$15, sub_part_name=$16, sub_part_qty=$17, 
        cost_labor=$18, cost_part=$19, cost_external=$20, notes=$21, job_status=$22, 
        target_finish_date=$23, actual_finish_date=$24, delivery_date=$25,
        contact_date=$26, arrived_date=$27, car_plate=$28,
        station_kho=$29, station_pou=$30, station_puan=$31, station_pon=$32, station_prak=$33, station_kat=$34,
        station_qc=$35, station_mag=$36, station_kraj=$37, station_film=$38, station_pak=$39, station_ready=$40,
        repair_notes=$41, repair_finish_date=$42,
        epc_no=$43, part_status=$44, order_part_date=$45, est_part_date=$46, ordered_part_names=$47,
        department_routing=$48,
        is_parked=$49
      WHERE id=$50;
    `;

    const values = [
      sa_owner || null, branch_name || 'สำนักงานใหญ่', customer_name || null, phone_number || null, customer_type || null,
      car_brand || null, car_model || null, vin_no || null, qt_no || null, so_no || null, bl_no || null, payment_type || null, damage_level || 'เบา',
      main_part_name || null, main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
      cost_labor || 0, cost_part || 0, cost_external || 0, notes || null, job_status || null,
      target_finish_date || null, actual_finish_date || null, delivery_date || null,
      contact_date || null, arrived_date || null, car_plate || null,
      station_kho || false, station_pou || false, station_puan || false, station_pon || false, station_prak || false, station_kat || false,
      station_qc || false, station_mag || false, station_kraj || false, station_film || false, station_pak || false, station_ready || false,
      repair_notes || null, repair_finish_date || null,
      epc_no || null, part_status || null, order_part_date || null, est_part_date || null, ordered_part_names || null,
      department_routing || 'รอดำเนินการ',
      is_parked || 'ไม่จอดซ่อม', 
      req.params.id 
    ];

    await pool.query(queryText, values);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/report/:id/station', async (req, res) => {
  try {
    const {
      station_kho, station_pou, station_puan, station_pon, station_prak, station_kat,
      station_qc, station_mag, station_kraj, station_film, station_pak, station_ready,
      repair_notes, repair_finish_date, job_status, department_routing,
      target_finish_date, delivery_date
    } = req.body;

    const queryText = `
      UPDATE rizenicreport SET 
        station_kho=$1, station_pou=$2, station_puan=$3, station_pon=$4, station_prak=$5, station_kat=$6,
        station_qc=$7, station_mag=$8, station_kraj=$9, station_film=$10, station_pak=$11, station_ready=$12,
        repair_notes=$13, repair_finish_date=$14, job_status=$15, department_routing=$16,
        target_finish_date=$17, delivery_date=$18
      WHERE id=$19;
    `;

    const values = [
      station_kho || false, station_pou || false, station_puan || false, station_pon || false, station_prak || false, station_kat || false,
      station_qc || false, station_mag || false, station_kraj || false, station_film || false, station_pak || false, station_ready || false,
      repair_notes || null, repair_finish_date || null, job_status || null, department_routing || 'ซ่อม',
      target_finish_date || null, delivery_date || null,
      req.params.id
    ];

    await pool.query(queryText, values);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/report/:id/fast-date', async (req, res) => {
  try {
    const { field, value } = req.body;
    
    const validFields = [
      'target_finish_date', 'repair_finish_date', 'delivery_date', 'contact_date', 'arrived_date', 'order_part_date', 'est_part_date',
      'car_plate', 'notes', 'qt_no', 'so_no', 'bl_no', 'sa_owner', 'damage_level', 'job_status',
      'billing_date', 'ivn_no', 'cost_labor', 'cost_part', 'cost_external'
    ];
    if (!validFields.includes(field)) return res.status(400).json({ error: 'ไม่อนุญาตให้แก้ฟิลด์นี้' });
    
    let safeValue = value || null;
    if (['cost_labor', 'cost_part', 'cost_external'].includes(field)) {
        safeValue = parseFloat(value) || 0;
    }

    if (field === 'job_status') {
        const statusRes = await pool.query('SELECT department FROM rizenicstatusmaster WHERE status_name = $1', [value]);
        if (statusRes.rows.length > 0) {
            const newDepartment = statusRes.rows[0].department;
            await pool.query(
                `UPDATE rizenicreport SET job_status = $1, department_routing = $2 WHERE id = $3`,
                [value, newDepartment, req.params.id]
            );
            return res.json({ success: true, department_routing: newDepartment });
        }
    }

    const queryText = `UPDATE rizenicreport SET ${field} = $1 WHERE id = $2`;
    await pool.query(queryText, [safeValue, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 📦 API แผนกอะไหล่ (สั่งซื้อ / รับเข้า / เบิกจ่าย / สถานะ)
// ==========================================
app.get('/api/part-statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_part_status_master ORDER BY status_id ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/part-statuses', async (req, res) => {
  try { await pool.query('INSERT INTO rizenic_part_status_master (status_name) VALUES ($1)', [req.body.status_name]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/part-statuses/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenic_part_status_master WHERE status_id = $1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/part-orders', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_part_orders ORDER BY order_id DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/part-orders', async (req, res) => {
  try {
    const d = req.body;
    const queryText = `
      INSERT INTO rizenic_part_orders (
        qt_no, so_no, epc_no, order_date, est_arrival_date, car_plate,
        vin_no, car_model, part_main_no, part_no, part_name, qty_ordered, qty_received, order_status, part_type, branch_name, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, 'รอสั่งซื้อ', $13, $14, $15) RETURNING *;
    `;
    const values = [
      d.qt_no || null, d.so_no || null, d.epc_no || null, d.order_date, d.est_arrival_date || null, d.car_plate || null,
      d.vin_no || null, d.car_model || null, d.part_main_no || null, d.part_no, d.part_name, parseInt(d.qty_ordered) || 1,
      d.part_type || 'อะไหล่แท้', d.branch_name, d.notes || null
    ];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/part-orders/:id', async (req, res) => {
  try {
    const { 
      part_no, part_main_no, part_name, qty_ordered, 
      epc_no, order_status, est_arrival_date, received_date,
      qt_no, so_no, order_date, car_plate, vin_no, car_model, part_type, notes
    } = req.body;
    await pool.query(`
      UPDATE rizenic_part_orders 
      SET part_no = COALESCE($1, part_no), 
          part_main_no = $2, 
          part_name = COALESCE($3, part_name), 
          qty_ordered = COALESCE($4, qty_ordered),
          epc_no = $5,
          order_status = COALESCE($6, order_status),
          est_arrival_date = $7,
          received_date = $8,
          qt_no = COALESCE($9, qt_no),
          so_no = COALESCE($10, so_no),
          order_date = COALESCE($11, order_date),
          car_plate = COALESCE($12, car_plate),
          vin_no = COALESCE($13, vin_no),
          car_model = COALESCE($14, car_model),
          part_type = COALESCE($15, part_type),
          notes = $16
      WHERE order_id = $17
    `, [
      part_no, part_main_no || null, part_name, qty_ordered,
      epc_no || null, order_status, est_arrival_date || null, received_date || null,
      qt_no, so_no, order_date, car_plate, vin_no, car_model, part_type, notes || null,
      req.params.id
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/part-orders/:id/fast', async (req, res) => {
  try {
    const { field, value } = req.body;
    const validFields = ['epc_no', 'order_status', 'qty_ordered', 'est_arrival_date'];
    if (!validFields.includes(field)) return res.status(400).json({ error: 'ไม่อนุญาตให้แก้ฟิลด์นี้' });
    await pool.query(`UPDATE rizenic_part_orders SET ${field} = $1 WHERE order_id = $2`, [value || null, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/part-orders/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rizenic_part_orders WHERE order_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 📥 การรับเข้า (Inbound)
app.post('/api/part-inbound', async (req, res) => {
  try {
    const { received_date, epc_no, part_main_no, part_no, part_name, car_model, qty, unit_price, branch_name } = req.body;
    const inputQty = parseInt(qty) || 1;
    const insertInboundQuery = `
      INSERT INTO rizenic_part_inbound (received_date, epc_no, part_main_no, part_no, part_name, car_model, qty, unit_price, branch_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
    `;
    await pool.query(insertInboundQuery, [
      received_date, epc_no || null, part_main_no || null, part_no, part_name, car_model || null,
      inputQty, parseFloat(unit_price) || 0.00, branch_name || 'สำนักงานใหญ่'
    ]);
    if (epc_no && epc_no.trim() !== "" && part_no) {
      const orderCheck = await pool.query(
        `SELECT order_id, qty_ordered, COALESCE(qty_received, 0) as current_rcv FROM rizenic_part_orders 
         WHERE epc_no = $1 AND part_no = $2 LIMIT 1`,
        [epc_no, part_no]
      );
      if (orderCheck.rows.length > 0) {
        const order = orderCheck.rows[0];
        const newQtyReceived = parseInt(order.current_rcv) + inputQty; 
        let newStatus = 'อะไหล่ยังมาไม่ครบ';
        if (newQtyReceived >= parseInt(order.qty_ordered)) {
          newStatus = 'อะไหล่มาครบแล้ว';
        }
        await pool.query(
          `UPDATE rizenic_part_orders SET qty_received = $1, order_status = $2, received_date = $3 WHERE order_id = $4`,
          [newQtyReceived, newStatus, received_date, order.order_id]
        );
      }
    }
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/part-inbound', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_part_inbound ORDER BY inbound_id DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/part-inbound/:id', async (req, res) => {
  try {
    const { received_date, epc_no, part_no, part_name, qty, unit_price } = req.body;
    await pool.query(
      `UPDATE rizenic_part_inbound SET received_date=$1, epc_no=$2, part_no=$3, part_name=$4, qty=$5, unit_price=$6 WHERE inbound_id=$7`,
      [received_date, epc_no, part_no, part_name, parseInt(qty), parseFloat(unit_price), req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/part-inbound/:id/fast', async (req, res) => {
  try {
    const { field, value } = req.body;
    const validFields = ['received_date', 'qty', 'unit_price'];
    if (!validFields.includes(field)) return res.status(400).json({ error: 'ไม่อนุญาต' });
    await pool.query(`UPDATE rizenic_part_inbound SET ${field} = $1 WHERE inbound_id = $2`, [value || null, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/part-inbound/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenic_part_inbound WHERE inbound_id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// 📤 การเบิก/จอง (Outbound)
app.post('/api/part-outbound', async (req, res) => {
  try {
    const { issue_date, part_no, part_main_no, part_name, qty, car_plate, qt_no, so_no, unit_price, part_type, car_model, job_status, branch_name } = req.body;
    const queryText = `
      INSERT INTO rizenic_part_outbound (issue_date, part_no, part_main_no, part_name, qty, car_plate, qt_no, so_no, unit_price, part_type, car_model, job_status, branch_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *;
    `;
    const values = [
      issue_date, part_no, part_main_no || null, part_name, parseInt(qty) || 1, car_plate,
      qt_no || null, so_no || null, parseFloat(unit_price) || 0.00, part_type || null, car_model || null, job_status || null, branch_name || 'สำนักงานใหญ่'
    ];
    await pool.query(queryText, values);
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/part-outbound', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_part_outbound ORDER BY outbound_id DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/part-outbound/:id', async (req, res) => {
  try {
    const { issue_date, part_no, part_name, qty, car_plate, qt_no, so_no, job_status } = req.body;
    await pool.query(
      `UPDATE rizenic_part_outbound SET issue_date=$1, part_no=$2, part_name=$3, qty=$4, car_plate=$5, qt_no=$6, so_no=$7, job_status=$8 WHERE outbound_id=$9`,
      [issue_date, part_no, part_name, parseInt(qty), car_plate, qt_no, so_no, job_status, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/part-outbound/:id/fast', async (req, res) => {
  try {
    const { field, value } = req.body;
    const validFields = ['issue_date', 'qty', 'job_status'];
    if (!validFields.includes(field)) return res.status(400).json({ error: 'ไม่อนุญาต' });
    await pool.query(`UPDATE rizenic_part_outbound SET ${field} = $1 WHERE outbound_id = $2`, [value || null, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/part-outbound/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenic_part_outbound WHERE outbound_id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/parts-inventory', async (req, res) => {
  const { branch } = req.query; 
  if (!branch) return res.status(400).json({ error: 'กรุณาระบุสาขาครับนาย' });
  try {
    const queryText = `
      SELECT 
        i.part_main_no, i.part_no, i.part_name, i.car_model,
        COALESCE(SUM(i.qty), 0) AS total_inbound,
        COALESCE((
          SELECT SUM(o.qty) FROM rizenic_part_outbound o 
          WHERE o.part_no = i.part_no AND o.branch_name = i.branch_name AND COALESCE(o.job_status, '') != 'รอเข้าซ่อม'
        ), 0) AS total_issued,
        COALESCE((
          SELECT SUM(o.qty) FROM rizenic_part_outbound o 
          WHERE o.part_no = i.part_no AND o.branch_name = i.branch_name AND o.job_status = 'รอเข้าซ่อม'
        ), 0) AS total_booked
      FROM rizenic_part_inbound i
      WHERE i.branch_name = $1
      GROUP BY i.part_main_no, i.part_no, i.part_name, i.car_model, i.branch_name
      ORDER BY i.part_name ASC;
    `;
    const result = await pool.query(queryText, [branch]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

if (require.main === module) {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;