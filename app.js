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
// 🔌 โซนท่อเชื่อม API หลังบ้าน (Backend ล้วนๆ)
// ==========================================

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
// 👥 API จัดการพนักงาน (Employees) - CRUD ครบหมู่!
// ==========================================

// 🟢 [GET] ดึงข้อมูลพนักงานทั้งหมดมาวาดตารางหน้าบ้าน (ท่อนี้แหละที่หายไป!)
app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC');
    res.json(result.rows);
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// 🟢 [POST] เพิ่มพนักงานใหม่
app.post('/api/employees', async (req, res) => {
  try { 
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body;
    
    // 🛑 ยามเฝ้าประตู: เช็กว่า Username นี้มีคนใช้ไปหรือยัง?
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1', [username]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย! (หากพนักงานคนนี้อยู่หลายสาขา ให้ตั้งชื่อแยก เช่น user_rangsit)' });
    }

    await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, branch_name, username, password, is_active) VALUES ($1, $2, $3, $4, $5, $6, true)', 
    [employee_code, employee_name, employee_role, branch_name, username, password]); 
    res.json({ success: true }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🟢 [PUT] แก้ไขข้อมูลพนักงาน
app.put('/api/employees/:id', async (req, res) => {
  try { 
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body;
    
    // 🛑 ยามเฝ้าประตู: เช็ก Username ซ้ำ (โดยละเว้นไอดีของตัวเองที่กำลังแก้อยู่)
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1 AND employee_id != $2', [username, req.params.id]);
    if (checkDup.rows.length > 0) {
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย! (หากพนักงานคนนี้อยู่หลายสาขา ให้ตั้งชื่อแยก เช่น user_rangsit)' });
    }

    await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6 WHERE employee_id=$7', 
    [employee_code, employee_name, employee_role, branch_name, username, password, req.params.id]); 
    res.json({ success: true }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🟢 [DELETE] ลบพนักงานออกจากระบบ (ท่อนี้ก็หายไปรอบที่แล้ว!)
app.delete('/api/employees/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
// ⚙️ 5. Masters อื่นๆ (เรียกดูข้อมูลอย่างเดียว)
// ==========================================
app.get('/api/parts', async (req, res) => {
  try { res.json((await pool.query('SELECT part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

/// ==========================================
// 🟢 Transaction บันทึกใบงาน SA (แก้ไขลำดับ branch_name ให้ถูกต้องเป๊ะ!)
// ==========================================
app.post('/api/report', async (req, res) => {
  const {
    sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
    vin_no, payment_type, damage_level, main_part_name,
    main_part_qty, sub_part_name, sub_part_qty, cost_labor,
    cost_part, cost_external, notes, job_status,
    target_finish_date, actual_finish_date, delivery_date
  } = req.body;

  // 🎯 สังเกตตรงนี้ครับ: $2 ต้องส่ง branch_name และขยับตัวอื่นลงมาให้ตรงบล็อก
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

  // 🎯 เรียงลำดับกล่อง values ให้ตรงกับไอดี $1 ถึง $21 ด้านบนเป๊ะๆ
  const values = [
    sa_owner || null, 
    branch_name || 'สำนักงานใหญ่', // $2: ตรงล็อกกับคอลัมน์ branch_name แล้วครับนาย!
    customer_name || null,        // $3
    phone_number || null,         // $4
    customer_type || null,        // $5
    car_brand || null,            // $6
    car_model || null,            // $7
    vin_no || null,               // $8
    payment_type || null,         // $9
    damage_level || 'เบา',        // $10
    main_part_name || null,       // $11
    main_part_qty || 0,           // $12
    sub_part_name || null,        // $13
    sub_part_qty || 0,            // $14
    cost_labor || 0,              // $15
    cost_part || 0,               // $16
    cost_external || 0,           // $17
    notes || null,                // $18
    job_status || null,           // $19
    target_finish_date || null,   // $20
    actual_finish_date || null,   // $21
    delivery_date || null         // $22 (ระบบใช้แค่ 21 ตัวแปรตามค่า VALUES ด้านบน)
  ];

  try {
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🚀 สตาร์ทระบบเมื่อเปิดรันบนเครื่องคอม (Local)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;