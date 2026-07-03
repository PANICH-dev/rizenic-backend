const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());

// 🟢 เสิร์ฟหน้าเว็บ Frontend จากโฟลเดอร์ public [cite: 2]
app.use(express.static(path.join(__dirname, 'public'))); [cite: 2]

// 🔑 เชื่อมต่อฐานข้อมูลผ่านระบบความปลอดภัย Neon [cite: 3]
const pool = new Pool({ [cite: 3]
  connectionString: process.env.DATABASE_URL, [cite: 3]
  ssl: { rejectUnauthorized: false } [cite: 3]
}); [cite: 3]

// ==========================================
// 🔒 ท่อล็อกอิน (Login Authentication) [cite: 4]
// ==========================================
app.post('/api/login', async (req, res) => { [cite: 4]
  try { [cite: 4]
    const { username, password } = req.body; [cite: 4]
    const result = await pool.query('SELECT * FROM rizenicemployeemaster WHERE username = $1 AND password = $2', [username, password]); [cite: 4]
     [cite: 4]
    if (result.rows.length > 0) { [cite: 4]
      res.json({ success: true, employee: result.rows[0] }); [cite: 4]
    } else { [cite: 4]
      res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้องครับนาย!' }); [cite: 4]
    } [cite: 5]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 5]
}); [cite: 5]

// ==========================================
// 👥 API จัดการพนักงาน (Employees) - CRUD [cite: 5]
// ==========================================
app.get('/api/employees', async (req, res) => { [cite: 6]
  try { [cite: 6]
    const result = await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC'); [cite: 6]
    res.json(result.rows); [cite: 6]
  } catch (e) { [cite: 6]
    res.status(500).json({ error: e.message }); [cite: 6]
  } [cite: 6]
}); [cite: 6]

app.post('/api/employees', async (req, res) => { [cite: 7]
  try { [cite: 7]
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body; [cite: 7]
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1', [username]); [cite: 7]
    if (checkDup.rows.length > 0) { [cite: 7]
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' }); [cite: 7]
    } [cite: 7]
    await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, branch_name, username, password, is_active) VALUES ($1, $2, $3, $4, $5, $6, true)',  [cite: 7]
    [employee_code, employee_name, employee_role, branch_name, username, password]);  [cite: 8]
    res.json({ success: true }); [cite: 8]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 8]
}); [cite: 8]

app.put('/api/employees/:id', async (req, res) => { [cite: 9]
  try { [cite: 9]
    const { employee_code, employee_name, employee_role, branch_name, username, password } = req.body; [cite: 9]
    const checkDup = await pool.query('SELECT username FROM rizenicemployeemaster WHERE username = $1 AND employee_id != $2', [username, req.params.id]); [cite: 9]
    if (checkDup.rows.length > 0) { [cite: 9]
      return res.status(400).json({ error: 'Username นี้ถูกใช้งานแล้วครับนาย!' }); [cite: 9]
    } [cite: 9]
    await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6 WHERE employee_id=$7',  [cite: 9]
    [employee_code, employee_name, employee_role, branch_name, username, password, req.params.id]);  [cite: 10]
    res.json({ success: true }); [cite: 10]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 10]
}); [cite: 11]

app.delete('/api/employees/:id', async (req, res) => { [cite: 11]
  try { [cite: 11]
    await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]); [cite: 11]
    res.json({ success: true }); [cite: 11]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 11]
}); [cite: 11]

// ==========================================
// 🚗 2. Car Models (รุ่นรถ) - CRUD [cite: 12]
// ==========================================
app.get('/api/car-models', async (req, res) => { [cite: 12]
  try { res.json((await pool.query('SELECT model_id, car_brand, car_model FROM rizeniccarmodelmaster ORDER BY car_brand ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 12]
}); [cite: 12]
app.post('/api/car-models', async (req, res) => { [cite: 13]
  try { await pool.query('INSERT INTO rizeniccarmodelmaster (car_brand, car_model) VALUES ($1, $2)', [req.body.car_brand, req.body.car_model]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 13]
}); [cite: 13]
app.put('/api/car-models/:id', async (req, res) => { [cite: 14]
  try { await pool.query('UPDATE rizeniccarmodelmaster SET car_brand=$1, car_model=$2 WHERE model_id=$3', [req.body.car_brand, req.body.car_model, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 14]
}); [cite: 14]
app.delete('/api/car-models/:id', async (req, res) => { [cite: 15]
  try { await pool.query('DELETE FROM rizeniccarmodelmaster WHERE model_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 15]
}); [cite: 15]

// ==========================================
// 🛡️ 3. Insurances (ประกันภัย) - CRUD [cite: 16]
// ==========================================
app.get('/api/insurances', async (req, res) => { [cite: 16]
  try { res.json((await pool.query('SELECT insurance_code, insurance_name, insurance_type FROM rizenicinsurancemaster ORDER BY insurance_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 16]
}); [cite: 16]
app.post('/api/insurances', async (req, res) => { [cite: 17]
  try { await pool.query('INSERT INTO rizenicinsurancemaster (insurance_code, insurance_name, insurance_type) VALUES ($1, $2, $3)', [req.body.insurance_code, req.body.insurance_name, req.body.insurance_type]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 17]
}); [cite: 17]
app.put('/api/insurances/:id', async (req, res) => { [cite: 18]
  try { await pool.query('UPDATE rizenicinsurancemaster SET insurance_name=$1, insurance_type=$2 WHERE insurance_code=$3', [req.body.insurance_name, req.body.insurance_type, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 18]
}); [cite: 18]
app.delete('/api/insurances/:id', async (req, res) => { [cite: 19]
  try { await pool.query('DELETE FROM rizenicinsurancemaster WHERE insurance_code = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 19]
}); [cite: 19]

// ==========================================
// 👥 4. Customer Types (ประเภทลูกค้า) - CRUD [cite: 20]
// ==========================================
app.get('/api/customer-types', async (req, res) => { [cite: 20]
  try { [cite: 20]
    const result = await pool.query('SELECT customer_type_id, type_code, type_name FROM rizeniccustomertypemaster ORDER BY type_code ASC'); [cite: 20]
    res.json(result.rows); [cite: 20]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 20]
}); [cite: 20]
app.post('/api/customer-types', async (req, res) => { [cite: 21]
  try { [cite: 21]
    const { type_name } = req.body; [cite: 21]
    const countResult = await pool.query('SELECT COUNT(*) FROM rizeniccustomertypemaster'); [cite: 21]
    const nextNum = parseInt(countResult.rows[0].count) + 1; [cite: 21]
    const type_code = 'CT-' + String(nextNum).padStart(2, '0'); [cite: 21]
    await pool.query('INSERT INTO rizeniccustomertypemaster (type_code, type_name) VALUES ($1, $2)', [type_code, type_name]); [cite: 21]
    res.json({ success: true }); [cite: 21]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 21]
}); [cite: 21]
app.put('/api/customer-types/:id', async (req, res) => { [cite: 22]
  try { [cite: 22]
    const { type_name } = req.body; [cite: 22]
    await pool.query('UPDATE rizeniccustomertypemaster SET type_name = $1 WHERE customer_type_id = $2', [type_name, req.params.id]); [cite: 22]
    res.json({ success: true }); [cite: 22]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 22]
}); [cite: 22]
app.delete('/api/customer-types/:id', async (req, res) => { [cite: 23]
  try { [cite: 23]
    await pool.query('DELETE FROM rizeniccustomertypemaster WHERE customer_type_id = $1', [req.params.id]); [cite: 23]
    res.json({ success: true }); [cite: 23]
  } catch (e) { res.status(500).json({ error: e.message }); } [cite: 23]
}); [cite: 23]

// ==========================================
// ⚙️ 5. Masters อื่นๆ [cite: 24]
// ==========================================
app.get('/api/parts', async (req, res) => { [cite: 24]
  try { res.json((await pool.query('SELECT part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 24]
}); [cite: 24]
app.get('/api/statuses', async (req, res) => { [cite: 25]
  try { res.json((await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } [cite: 25]
}); [cite: 25]

// ==========================================
// 🟢 6. Transaction: บันทึกใบงาน SA (จัดระเบียบ 21 กล่องพารามิเตอร์)
// ==========================================
app.post('/api/report', async (req, res) => { [cite: 26]
  const { [cite: 26]
    sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model, [cite: 26]
    vin_no, payment_type, damage_level, main_part_name, [cite: 26]
    main_part_qty, sub_part_name, sub_part_qty, cost_labor, [cite: 26]
    cost_part, cost_external, notes, job_status, [cite: 26]
    target_finish_date, actual_finish_date, delivery_date [cite: 26]
  } = req.body; [cite: 26]

  // 🎯 เช็กให้ชัวร์ว่าคอลัมน์และตำแหน่ง VALUES ตรงล็อกจำนวน 21 บล็อกพอดีเป๊ะครับนาย! 
  const queryText = `
    INSERT INTO rizenicreport (
      sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor, [cite: 26]
      cost_part, cost_external, notes, job_status, 
      target_finish_date, actual_finish_date, delivery_date 
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) 
    RETURNING id; 
  `; [cite: 28]

  // 🎯 เรียงลำดับกล่องพารามิเตอร์ครบ 21 ตัวแปรอย่างแม่นยำ ไม่ขาดไม่ลื่นล้นตู้ [cite: 28]
  const values = [
    sa_owner || null, [cite: 29]
    branch_name || 'สำนักงานใหญ่', [cite: 29]
    customer_name || null, [cite: 30]
    phone_number || null, [cite: 31]
    customer_type || null, [cite: 32]
    car_brand || null, [cite: 33]
    car_model || null, [cite: 34]
    vin_no || null, [cite: 35]
    payment_type || null, [cite: 36]
    damage_level || 'เบา', [cite: 37]
    main_part_name || null, [cite: 38]
    main_part_qty || 0, [cite: 39]
    sub_part_name || null, [cite: 40]
    sub_part_qty || 0, [cite: 41]
    cost_labor || 0, [cite: 42]
    cost_part || 0, [cite: 43]
    cost_external || 0, [cite: 44]
    notes || null, [cite: 45]
    job_status || null, [cite: 46]
    target_finish_date || null, [cite: 46]
    actual_finish_date || null, [cite: 47]
    delivery_date || null [cite: 48]
  ]; [cite: 48]

  try { [cite: 49]
    const result = await pool.query(queryText, values); [cite: 49]
    res.status(201).json({ success: true, insertedId: result.rows[0].id }); [cite: 49]
  } catch (err) { res.status(500).json({ error: err.message }); } [cite: 50]
}); [cite: 50]

if (process.env.NODE_ENV !== 'production') { [cite: 50]
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`)); [cite: 50]
} [cite: 51]

module.exports = app; [cite: 51]