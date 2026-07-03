const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());

// 🟢 เสิร์ฟหน้าเว็บ Frontend จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// 🔑 เชื่อมต่อฐานข้อมูลผ่านระบบความปลอดภัย Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🔒 ท่อล็อกอิน (Login Authentication)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM rizenicemployeemaster WHERE username = $1 AND password = $2', [username, password]);
    
    if (result.rows.length > 0) {
      res.json({ success: true, employee: result.rows[0] });
    } else {
      res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้องครับนาย!' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 👥 API จัดการพนักงาน (Employees) - CRUD
// ==========================================
app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body;
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1', [username]);
    if (checkDup.rows.length > 0) return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' });
    await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, branch_name, username, password, is_active) VALUES ($1, $2, $3, $4, $5, $6, true)', [employee_code, employee_name, employee_role, branch_name, username, password]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body;
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1 AND employee_id != $2', [username, req.params.id]);
    if (checkDup.rows.length > 0) return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' });
    await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6 WHERE employee_id=$7', [employee_code, employee_name, employee_role, branch_name, username, password, req.params.id]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🚗 Car Models (รุ่นรถ) - CRUD
// ==========================================
app.get('/api/car-models', async (req, res) => {
  try { res.json((await pool.query('SELECT model_id, car_brand, car_model FROM rizeniccarmodelmaster ORDER BY car_brand ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/car-models', async (req, res) => {
  try { await pool.query('INSERT INTO rizeniccarmodelmaster (car_brand, car_model) VALUES ($1, $2)', [req.body.car_brand, req.body.car_model]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/car-models/:id', async (req, res) => {
  try { await pool.query('UPDATE rizeniccarmodelmaster SET car_brand=$1, car_model=$2 WHERE model_id=$3', [req.body.car_brand, req.body.car_model, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/car-models/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizeniccarmodelmaster WHERE model_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🛡️ Insurances (ประกันภัย) - CRUD
// ==========================================
app.get('/api/insurances', async (req, res) => {
  try { res.json((await pool.query('SELECT insurance_code, insurance_name, insurance_type FROM rizenicinsurancemaster ORDER BY insurance_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/insurances', async (req, res) => {
  try { await pool.query('INSERT INTO rizenicinsurancemaster (insurance_code, insurance_name, insurance_type) VALUES ($1, $2, $3)', [req.body.insurance_code, req.body.insurance_name, req.body.insurance_type]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/insurances/:id', async (req, res) => {
  try { await pool.query('UPDATE rizenicinsurancemaster SET insurance_name=$1, insurance_type=$2 WHERE insurance_code=$3', [req.body.insurance_name, req.body.insurance_type, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/insurances/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicinsurancemaster WHERE insurance_code = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 👥 Customer Types (ประเภทลูกค้า) - CRUD
// ==========================================
app.get('/api/customer-types', async (req, res) => {
  try { res.json((await pool.query('SELECT customer_type_id, type_code, type_name FROM rizeniccustomertypemaster ORDER BY type_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
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
  try { await pool.query('UPDATE rizeniccustomertypemaster SET type_name = $1 WHERE customer_type_id = $2', [req.body.type_name, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/customer-types/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizeniccustomertypemaster WHERE customer_type_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ⚙️ Masters อื่นๆ
// ==========================================
app.get('/api/parts', async (req, res) => {
  try { res.json((await pool.query('SELECT part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🟢 7. โซนท่อใหม่: ระบบจัดการใบงานซ่อมหลัก (Reports Panel API)
// ==========================================

// 🎯 [GET ALL] ดึงใบงานซ่อมทั้งหมดมาวาดตารางหน้า jobs.html (อุดรอยรั่ว 404 ตัวนี้เลยครับ!)
app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicreport ORDER BY id DESC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🎯 [GET SINGLE] ดึงข้อมูลเฉพาะ 1 ใบงานซ่อมตาม ID (ใช้ตอนกดแก้ไขข้ามหน้า)
app.get('/api/report/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicreport WHERE id = $1', [req.params.id]);
    if(result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'ไม่พบข้อมูลใบงานนี้ครับนาย' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🎯 [POST] บันทึกใบงานใหม่แกะกล่อง
app.post('/api/report', async (req, res) => {
  try {
    const {
      sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date
    } = req.body;

    const queryText = `
      INSERT INTO rizenicreport (
        sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
        vin_no, payment_type, damage_level, main_part_name,
        main_part_qty, sub_part_name, sub_part_qty, cost_labor,
        cost_part, cost_external, notes, job_status,
        target_finish_date, actual_finish_date, delivery_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id;
    `;

    const values = [
      sa_owner || null, branch_name || 'สำนักงานใหญ่', customer_name || null, phone_number || null, customer_type || null, car_brand || null, car_model || null,
      vin_no || null, payment_type || null, damage_level || 'เบา', main_part_name || null,
      main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
      cost_labor || 0, cost_part || 0, cost_external || 0,
      notes || null, job_status || null, target_finish_date || null, actual_finish_date || null, delivery_date || null
    ];

    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🎯 [PUT] บันทึกอัปเดตใบงานซ่อมเดิมที่มีอยู่แล้วในฐานข้อมูล (ใช้ตอนแก้ฟอร์มเสร็จแล้วส่งเซฟ)
app.put('/api/report/:id', async (req, res) => {
  try {
    const {
      sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date
    } = req.body;

    const queryText = `
      UPDATE rizenicreport SET 
        sa_owner=$1, branch_name=$2, customer_name=$3, phone_number=$4, customer_type=$5, 
        car_brand=$6, car_model=$7, vin_no=$8, payment_type=$9, damage_level=$10, 
        main_part_name=$11, main_part_qty=$12, sub_part_name=$13, sub_part_qty=$14, 
        cost_labor=$15, cost_part=$16, cost_external=$17, notes=$18, job_status=$19, 
        target_finish_date=$20, actual_finish_date=$21, delivery_date=$22 
      WHERE id=$23;
    `;

    const values = [
      sa_owner || null, branch_name || 'สำนักงานใหญ่', customer_name || null, phone_number || null, customer_type || null,
      car_brand || null, car_model || null, vin_no || null, payment_type || null, damage_level || 'เบา',
      main_part_name || null, main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
      cost_labor || 0, cost_part || 0, cost_external || 0, notes || null, job_status || null,
      target_finish_date || null, actual_finish_date || null, delivery_date || null,
      req.params.id // $23 บล็อกสุดท้ายชี้เป้าแถวที่จะบันทึก
    ];

    await pool.query(queryText, values);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;