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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body;
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1', [username]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' });
    }
    await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, branch_name, username, password, is_active) VALUES ($1, $2, $3, $4, $5, $6, true)', 
    [employee_code, employee_name, employee_role, branch_name, username, password]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body;
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1 AND employee_id != $2', [username, req.params.id]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' });
    }
    await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6 WHERE employee_id=$7', 
    [employee_code, employee_name, employee_role, branch_name, username, password, req.params.id]); 
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
// 🚗 2. Car Models (รุ่นรถ) - CRUD
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
// 🛡️ 3. Insurances (ประกันภัย) - CRUD
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
// 👥 4. Customer Types (ประเภทลูกค้า) - CRUD
// ==========================================
app.get('/api/customer-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT customer_type_id, type_code, type_name FROM rizeniccustomertypemaster ORDER BY type_code ASC');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/customer-types', async (req, res) => {
  try {
    const { type_name } = req.body;
    const countResult = await pool.query('SELECT COUNT(*) FROM rizeniccustomertypemaster');
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    const type_code = 'CT-' + String(nextNum).padStart(2, '0');
    await pool.query('INSERT INTO rizeniccustomertypemaster (type_code, type_name) VALUES ($1, $2)', [type_code, type_name]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/customer-types/:id', async (req, res) => {
  try {
    const { type_name } = req.body;
    await pool.query('UPDATE rizeniccustomertypemaster SET type_name = $1 WHERE customer_type_id = $2', [type_name, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/customer-types/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rizeniccustomertypemaster WHERE customer_type_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ⚙️ 5. Masters อื่นๆ
// ==========================================
app.get('/api/parts', async (req, res) => {
  try { res.json((await pool.query('SELECT part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 🟢 6. Transaction: บันทึกใบงาน SA (ล็อกจำนวน 21 ตัวแปรเป๊ะ)
// ==========================================
app.post('/api/report', async (req, res) => {
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
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING id;
  `;

  // 🎯 เคลียร์สล็อตอาร์เรย์ คัดเหลือ 21 พารามิเตอร์ ลงล็อกตู้ SQL พอดีเป๊ะ!
  const values = [
    sa_owner || null,
    branch_name || 'สำนักงานใหญ่',
    customer_name || null,
    phone_number || null,
    customer_type || null,
    car_brand || null,
    car_model || null,
    vin_no || null,
    payment_type || null,
    damage_level || 'เบา',
    main_part_name || null,
    main_part_qty || 0,
    sub_part_name || null,
    sub_part_qty || 0,
    cost_labor || 0,
    cost_part || 0,
    cost_external || 0,
    notes || null,
    job_status || null,
    target_finish_date || null,
    actual_finish_date || null,
    delivery_date || null
  ];

  try {
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;