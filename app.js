const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ⚙️ ตั้งค่าการเชื่อมต่อฐานข้อมูล Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🔐 API ระบบ Login
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM rizenic_employees WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length > 0) {
      res.json({ success: true, employee: result.rows[0] });
    } else {
      res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้อง' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 📝 API ใบงานซ่อม (SA Reports)
// ==========================================
app.get('/api/reports', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicreports ORDER BY id DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/report/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicreports WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🟢 สร้างบิลใหม่ (อัปเกรดฟิลด์ครบ 100%)
app.post('/api/report', async (req, res) => {
  try {
    const d = req.body;
    const queryText = `
      INSERT INTO rizenicreports (
        sa_owner, branch_name, customer_name, phone_number, customer_type, payment_type, 
        car_plate, car_brand, car_model, vin_no, qt_no, so_no, bl_no, 
        main_part_name, main_part_qty, sub_part_name, sub_part_qty, 
        epc_no, part_status, order_part_date, est_part_date, ordered_part_names, 
        damage_level, job_status, notes, 
        contact_date, arrived_date, target_finish_date, actual_finish_date, delivery_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *;
    `;
    const values = [
      d.sa_owner, d.branch_name, d.customer_name, d.phone_number, d.customer_type, d.payment_type,
      d.car_plate, d.car_brand, d.car_model, d.vin_no, d.qt_no, d.so_no, d.bl_no,
      d.main_part_name, d.main_part_qty || 0, d.sub_part_name, d.sub_part_qty || 0,
      d.epc_no, d.part_status, d.order_part_date, d.est_part_date, d.ordered_part_names,
      d.damage_level, d.job_status, d.notes,
      d.contact_date, d.arrived_date, d.target_finish_date, d.actual_finish_date, d.delivery_date
    ];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🟠 แก้ไขบิลเก่า (SA Update)
app.put('/api/report/:id', async (req, res) => {
  try {
    const d = req.body;
    const queryText = `
      UPDATE rizenicreports SET 
        customer_name=$1, phone_number=$2, customer_type=$3, payment_type=$4, 
        car_plate=$5, car_brand=$6, car_model=$7, vin_no=$8, 
        qt_no=$9, so_no=$10, bl_no=$11, 
        main_part_name=$12, main_part_qty=$13, sub_part_name=$14, sub_part_qty=$15, 
        epc_no=$16, part_status=$17, order_part_date=$18, est_part_date=$19, ordered_part_names=$20, 
        damage_level=$21, job_status=$22, notes=$23, 
        contact_date=$24, arrived_date=$25, target_finish_date=$26, actual_finish_date=$27, delivery_date=$28
      WHERE id=$29
    `;
    const values = [
      d.customer_name, d.phone_number, d.customer_type, d.payment_type,
      d.car_plate, d.car_brand, d.car_model, d.vin_no, d.qt_no, d.so_no, d.bl_no,
      d.main_part_name, d.main_part_qty || 0, d.sub_part_name, d.sub_part_qty || 0,
      d.epc_no, d.part_status, d.order_part_date, d.est_part_date, d.ordered_part_names,
      d.damage_level, d.job_status, d.notes,
      d.contact_date, d.arrived_date, d.target_finish_date, d.actual_finish_date, d.delivery_date, req.params.id
    ];
    await pool.query(queryText, values);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🔵 อัปเดตสถานีซ่อม (ช่างอัปเดต)
app.put('/api/report/:id/station', async (req, res) => {
  try {
    const { station_kho, station_pou, station_puan, station_pon, station_prak, station_qc, job_status, repair_notes } = req.body;
    await pool.query(
      `UPDATE rizenicreports SET 
       station_kho=$1, station_pou=$2, station_puan=$3, station_pon=$4, station_prak=$5, station_qc=$6, 
       job_status=$7, repair_notes=$8 WHERE id=$9`,
      [station_kho, station_pou, station_puan, station_pon, station_prak, station_qc, job_status, repair_notes, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ==========================================
// 📦 API จัดการอะไหล่สั่งซื้อและคลังสินค้า (Parts & Inventory)
// ==========================================

// 1. ส่งใบสั่งซื้อ (จากหน้า SA เข้าแผนกจัดซื้อ)
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

// 2. ดึงข้อมูลประวัติสั่งซื้ออะไหล่
app.get('/api/part-orders', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_part_orders ORDER BY order_id DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. แผนกอะไหล่เปลี่ยนสถานะออเดอร์ด้วยมือ
app.put('/api/part-orders/:id/status', async (req, res) => {
  try {
    const { order_status } = req.body;
    await pool.query('UPDATE rizenic_part_orders SET order_status = $1 WHERE order_id = $2', [order_status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. รับเข้าคลัง (Inbound)
app.post('/api/part-inbound', async (req, res) => {
  try {
    const { received_date, part_no, part_main_no, part_name, qty, unit_price, car_model, epc_no, branch_name } = req.body;
    const queryText = `
      INSERT INTO rizenic_part_inbound (received_date, part_no, part_main_no, part_name, qty, unit_price, car_model, epc_no, branch_name) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
    `;
    const result = await pool.query(queryText, [received_date, part_no, part_main_no||null, part_name, parseInt(qty)||1, parseFloat(unit_price)||0.00, car_model||null, epc_no||null, branch_name]);
    
    // อัปเดตยอดรับเข้าในออเดอร์อัตโนมัติ
    await pool.query('UPDATE rizenic_part_orders SET qty_received = qty_received + $1 WHERE part_no = $2 AND branch_name = $3', [parseInt(qty)||1, part_no, branch_name]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. เบิกจ่ายให้ช่าง (Outbound)
app.post('/api/part-outbound', async (req, res) => {
  try {
    const { issue_date, part_no, part_main_no, part_name, qty, car_plate, qt_no, unit_price, part_type, car_model, job_status, branch_name } = req.body;
    const queryText = `
      INSERT INTO rizenic_part_outbound (issue_date, part_no, part_main_no, part_name, qty, car_plate, qt_no, unit_price, part_type, car_model, job_status, branch_name) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;
    `;
    const result = await pool.query(queryText, [issue_date, part_no, part_main_no||null, part_name, parseInt(qty)||1, car_plate, qt_no||null, parseFloat(unit_price)||0.00, part_type||null, car_model||null, job_status||null, branch_name]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. ดึงยอดสต๊อกคงเหลือจริง (Inbound - Outbound)
app.get('/api/parts-inventory', async (req, res) => {
  const { branch } = req.query; 
  if (!branch) return res.status(400).json({ error: 'กรุณาระบุสาขา' });
  try {
    const queryText = `
      SELECT 
        i.part_main_no, i.part_no, i.part_name, i.car_model,
        COALESCE(SUM(i.qty), 0) - COALESCE((
          SELECT SUM(o.qty) FROM rizenic_part_outbound o 
          WHERE o.part_no = i.part_no AND o.branch_name = i.branch_name
        ), 0) AS stock_in_house
      FROM rizenic_part_inbound i
      WHERE i.branch_name = $1
      GROUP BY i.part_main_no, i.part_no, i.part_name, i.car_model, i.branch_name
      ORDER BY i.part_name ASC;
    `;
    res.json((await pool.query(queryText, [branch])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ==========================================
// 🛠️ API ฐานข้อมูล Master ต่างๆ (Admin Settings)
// ==========================================

// 🎨 Master: ชิ้นส่วนซ่อมสี (Body Parts)
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

// ⚙️ Master: อะไหล่ (Spare Parts) สำหรับสมองกล
app.get('/api/parts', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicpartsmaster ORDER BY part_name ASC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/parts/check/:part_no', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicpartsmaster WHERE part_no = $1 LIMIT 1', [req.params.part_no])).rows[0] || null); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/parts', async (req, res) => {
  try {
    const { part_no, part_name, part_category } = req.body;
    await pool.query(`
      INSERT INTO rizenicpartsmaster (part_no, part_name, part_category) VALUES ($1, $2, $3)
      ON CONFLICT (part_no) DO UPDATE SET part_name = $2, part_category = $3
    `, [part_no, part_name, part_category || 'อะไหล่รอง']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/parts/:id', async (req, res) => {
  try { await pool.query('UPDATE rizenicpartsmaster SET part_no=$1, part_category=$2, part_name=$3 WHERE part_id=$4', [req.body.part_no, req.body.part_category, req.body.part_name, req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/parts/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicpartsmaster WHERE part_id=$1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// 📅 Master: โควต้ารายวัน
app.get('/api/quotas', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenic_quotas ORDER BY quota_type ASC, quota_date DESC')).rows); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/quotas', async (req, res) => {
  try { await pool.query('INSERT INTO rizenic_quotas (quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery) VALUES ($1,$2,$3,$4,$5,$6)', [req.body.quota_type, req.body.quota_date, req.body.branch_name, req.body.quota_arrived, req.body.quota_target, req.body.quota_delivery]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/quotas/:id', async (req, res) => {
  try { await pool.query('UPDATE rizenic_quotas SET quota_type=$1, quota_date=$2, branch_name=$3, quota_arrived=$4, quota_target=$5, quota_delivery=$6 WHERE id=$7', [req.body.quota_type, req.body.quota_date, req.body.branch_name, req.body.quota_arrived, req.body.quota_target, req.body.quota_delivery, req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/quotas/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenic_quotas WHERE id=$1', [req.params.id]); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// 👥 Master: พนักงาน, รุ่นรถ, ประกันภัย, ประเภทลูกค้า
const masterRoutes = [
  { path: 'employees', table: 'rizenic_employees', idField: 'employee_id', fields: ['employee_code', 'employee_name', 'employee_role', 'branch_name', 'username', 'password'] },
  { path: 'car-models', table: 'rizeniccarmodels', idField: 'model_id', fields: ['car_brand', 'car_model'] },
  { path: 'insurances', table: 'rizenicinsurances', idField: 'insurance_code', fields: ['insurance_code', 'insurance_name', 'insurance_type'] },
  { path: 'customer-types', table: 'rizeniccustomertypes', idField: 'customer_type_id', fields: ['type_name'] }
];

masterRoutes.forEach(({ path: routePath, table, idField, fields }) => {
  app.get(`/api/${routePath}`, async (req, res) => {
    try { res.json((await pool.query(`SELECT * FROM ${table} ORDER BY ${idField} DESC`)).rows); } 
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  
  app.post(`/api/${routePath}`, async (req, res) => {
    try {
      const vals = fields.map(f => req.body[f]);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      await pool.query(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`, vals);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put(`/api/${routePath}/:id`, async (req, res) => {
    try {
      const vals = fields.map(f => req.body[f]);
      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      await pool.query(`UPDATE ${table} SET ${setClause} WHERE ${idField} = $${fields.length + 1}`, [...vals, req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete(`/api/${routePath}/:id`, async (req, res) => {
    try { await pool.query(`DELETE FROM ${table} WHERE ${idField} = $1`, [req.params.id]); res.json({ success: true }); } 
    catch (e) { res.status(500).json({ error: e.message }); }
  });
});

app.listen(port, () => console.log(`🚀 RIZENIC ERP Server running on port ${port}`));