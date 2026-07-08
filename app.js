const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🎯 API ระบบโควต้าสาขา (rizenic_quotas) - บันทึกและดึงข้อมูล
// ==========================================
app.get('/api/quotas', async (req, res) => {
  try { 
    res.json((await pool.query('SELECT * FROM rizenic_quotas ORDER BY quota_type ASC, quota_date DESC')).rows); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quotas', async (req, res) => {
  try {
    const { quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery } = req.body;
    const queryText = `
      INSERT INTO rizenic_quotas (quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
    `;
    const values = [
      quota_type || 'default', 
      quota_type === 'special' ? quota_date : null, 
      branch_name, 
      parseInt(quota_arrived) || 0, 
      parseInt(quota_target) || 0, 
      parseInt(quota_delivery) || 0
    ];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/quotas/:id', async (req, res) => {
  try {
    const { quota_type, quota_date, branch_name, quota_arrived, quota_target, quota_delivery } = req.body;
    const queryText = `
      UPDATE rizenic_quotas SET quota_type=$1, quota_date=$2, branch_name=$3, quota_arrived=$4, quota_target=$5, quota_delivery=$6 
      WHERE id=$7;
    `;
    const values = [
      quota_type || 'default', 
      quota_type === 'special' ? quota_date : null, 
      branch_name, 
      parseInt(quota_arrived) || 0, 
      parseInt(quota_target) || 0, 
      parseInt(quota_delivery) || 0,
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


// 🔒 API ล็อกอิน
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM rizenicemployeemaster WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length > 0) res.json({ success: true, employee: result.rows[0] });
    else res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้องครับนาย!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 👥 API พนักงาน - CRUD
app.get('/api/employees', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY branch_name ASC, employee_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
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
    await pool.query('UPDATE rizenicemployeemaster SET employee_code=$1, employee_name=$2, employee_role=$3, branch_name=$4, username=$5, password=$6 WHERE employee_id=$7', [employee_code, employee_name, employee_role, branch_name, username, password, req.params.id]); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/employees/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🚗 Car Models - CRUD
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

// 🛡️ Insurances - CRUD
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

// 👥 Customer Types - CRUD
app.get('/api/customer-types', async (req, res) => {
  try { res.json((await pool.query('SELECT customer_type_id, type_code, type_name FROM rizeniccustomertypemaster ORDER BY type_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/customer-types', async (req, res) => {
  try {
    const { type_name } = req.body; const countResult = await pool.query('SELECT COUNT(*) FROM rizeniccustomertypemaster'); const nextNum = parseInt(countResult.rows[0].count) + 1;
    await pool.query('INSERT INTO rizeniccustomertypemaster (type_code, type_name) VALUES ($1, $2)', ['CT-' + String(nextNum).padStart(2, '0'), type_name]); res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/customer-types/:id', async (req, res) => {
  try { await pool.query('UPDATE rizeniccustomertypemaster SET type_name = $1 WHERE customer_type_id = $2', [req.body.type_name, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/customer-types/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizeniccustomertypemaster WHERE customer_type_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⚙️ Masters อะไหล่ และสเตตัส (อัปเดต POST/PUT/DELETE ครบวงจรสำหรับ rizenicpartsmaster)
app.get('/api/parts', async (req, res) => {
  try { res.json((await pool.query('SELECT part_id, part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/parts', async (req, res) => {
  try { await pool.query('INSERT INTO rizenicpartsmaster (part_name, part_category) VALUES ($1, $2)', [req.body.part_name, req.body.part_category]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/parts/:id', async (req, res) => {
  try { await pool.query('UPDATE rizenicpartsmaster SET part_name=$1, part_category=$2 WHERE part_id=$3', [req.body.part_name, req.body.part_category, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/parts/:id', async (req, res) => {
  try { await pool.query('DELETE FROM rizenicpartsmaster WHERE part_id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 📋 ระบบจัดการใบงานซ่อมหลัก (Reports & Stations API)
// ==========================================
app.get('/api/reports', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM rizenicreport ORDER BY id DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); }
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
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date,
      contact_date, arrived_date, car_plate
    } = req.body;

    const queryText = `
      INSERT INTO rizenicreport (
        sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
        vin_no, payment_type, damage_level, main_part_name,
        main_part_qty, sub_part_name, sub_part_qty, cost_labor,
        cost_part, cost_external, notes, job_status,
        target_finish_date, actual_finish_date, delivery_date,
        contact_date, arrived_date, car_plate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING id;
    `;

    const values = [
      sa_owner || null, branch_name || 'สำนักงานใหญ่', customer_name || null, phone_number || null, customer_type || null, car_brand || null, car_model || null,
      vin_no || null, payment_type || null, damage_level || 'เบา', main_part_name || null,
      main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
      cost_labor || 0, cost_part || 0, cost_external || 0,
      notes || null, job_status || null, target_finish_date || null, actual_finish_date || null, delivery_date || null,
      contact_date || null, arrived_date || null, car_plate || null
    ];

    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/report/:id', async (req, res) => {
  try {
    const {
      sa_owner, branch_name, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date,
      contact_date, arrived_date, car_plate,
      station_kho, station_pou, station_puan, station_pon, station_prak, station_kat,
      station_qc, station_mag, station_kraj, station_film, station_pak, station_ready,
      repair_notes, repair_finish_date
    } = req.body;

    const queryText = `
      UPDATE rizenicreport SET 
        sa_owner=$1, branch_name=$2, customer_name=$3, phone_number=$4, customer_type=$5, 
        car_brand=$6, car_model=$7, vin_no=$8, payment_type=$9, damage_level=$10, 
        main_part_name=$11, main_part_qty=$12, sub_part_name=$13, sub_part_qty=$14, 
        cost_labor=$15, cost_part=$16, cost_external=$17, notes=$18, job_status=$19, 
        target_finish_date=$20, actual_finish_date=$21, delivery_date=$22,
        contact_date=$23, arrived_date=$24, car_plate=$25,
        station_kho=$26, station_pou=$27, station_puan=$28, station_pon=$29, station_prak=$30, station_kat=$31,
        station_qc=$32, station_mag=$33, station_kraj=$34, station_film=$35, station_pak=$36, station_ready=$37,
        repair_notes=$38, repair_finish_date=$39
      WHERE id=$40;
    `;

    const values = [
      sa_owner || null, branch_name || 'สำนักงานใหญ่', customer_name || null, phone_number || null, customer_type || null,
      car_brand || null, car_model || null, vin_no || null, payment_type || null, damage_level || 'เบา',
      main_part_name || null, main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
      cost_labor || 0, cost_part || 0, cost_external || 0, notes || null, job_status || null,
      target_finish_date || null, actual_finish_date || null, delivery_date || null,
      contact_date || null, arrived_date || null, car_plate || null,
      station_kho || false, station_pou || false, station_puan || false, station_pon || false, station_prak || false, station_kat || false,
      station_qc || false, station_mag || false, station_kraj || false, station_film || false, station_pak || false, station_ready || false,
      repair_notes || null, repair_finish_date || null,
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
      repair_notes, repair_finish_date, job_status
    } = req.body;

    const queryText = `
      UPDATE rizenicreport SET 
        station_kho=$1, station_pou=$2, station_puan=$3, station_pon=$4, station_prak=$5, station_kat=$6,
        station_qc=$7, station_mag=$8, station_kraj=$9, station_film=$10, station_pak=$11, station_ready=$12,
        repair_notes=$13, repair_finish_date=$14, job_status=$15
      WHERE id=$16;
    `;

    const values = [
      station_kho || false, station_pou || false, station_puan || false, station_pon || false, station_prak || false, station_kat || false,
      station_qc || false, station_mag || false, station_kraj || false, station_film || false, station_pak || false, station_ready || false,
      repair_notes || null, repair_finish_date || null, job_status || null,
      req.params.id
    ];

    await pool.query(queryText, values);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (process.env.NODE_ENV !== 'production') {// ==========================================
// 📦 API แผนกอะไหล่ (สั่งซื้อ / รับเข้า / เบิกจ่าย) - เชื่อมโยง Google Sheet ของท่าน BA
// ==========================================

// 🛒 1. สั่งอะไหล่ (Order Parts / Back Order)
app.get('/api/part-orders', async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM rizenic_part_orders ORDER BY order_id DESC')).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/part-orders', async (req, res) => {
  try {
    const {
      qt_no, so_no, epc_no, order_date, est_arrival_date, car_plate,
      vin_no, car_model, part_main_no, part_no, part_name, qty_ordered, part_type, branch_name, notes
    } = req.body;

    const queryText = `
      INSERT INTO rizenic_part_orders (
        qt_no, so_no, epc_no, order_date, est_arrival_date, car_plate,
        vin_no, car_model, part_main_no, part_no, part_name, qty_ordered, part_type, branch_name, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *;
    `;
    const values = [
      qt_no || null, so_no || null, epc_no || null, order_date, est_arrival_date || null, car_plate || null,
      vin_no || null, car_model || null, part_main_no || null, part_no, part_name, parseInt(qty_ordered) || 1,
      part_type || 'อะไหล่แท้', branch_name, notes || null
    ];
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 📥 2. รับเข้าอะไหล่ (Inbound)
app.get('/api/part-inbound', async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM rizenic_part_inbound ORDER BY inbound_id DESC')).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= 📊 5. ระบบคำนวณและแสดงยอดสต๊อกคงเหลือจริง (Stock In House) =================
        async function loadStockInHouse() {
            try {
                // 📡 ยิงไปหา API ตัวคำนวณหลังบ้าน พร้อมแนบชื่อสาขาปัจจุบันไปฟิลเตอร์
                const res = await fetch(`${API_BASE_URL}/api/parts-inventory?branch=${encodeURIComponent(currentBranch)}`);
                const tbody = document.getElementById('stock_table_body');
                if(!tbody) return;

                if(!res.ok) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400 font-mono text-xs">⚠️ แผนกอะไหล่สแตนด์บายเรียบร้อย! กำลังรอเชื่อมต่อ API สต๊อกตามตารางความเชื่อมโยงใน Neon</td></tr>`;
                    return;
                }

                const data = await res.json();
                
                // 📈 1. สรุปตัวเลขลงการ์ดแดชบอร์ด 3 ใบด้านบน
                document.getElementById('total_sku_count').innerText = `${data.length} รายการ`;
                
                const totalPcs = data.reduce((sum, item) => sum + Math.max(parseInt(item.stock_in_house) || 0, 0), 0);
                document.getElementById('total_pcs_count').innerText = `${totalPcs} ชิ้น`;

                // ดึงข้อมูลยอดค้างส่ง (Back Order) จากตารางสั่งซื้อมานับจำนวนชิ้นที่สถานะยังไม่จบ
                const resOrders = await fetch(`${API_BASE_URL}/api/part-orders`).catch(() => null);
                if(resOrders && resOrders.ok) {
                    const orders = await resOrders.json();
                    const boCount = orders.filter(o => o.order_status === 'รอดำเนินการ' && o.branch_name === currentBranch).length;
                    document.getElementById('total_backorder_count').innerText = `${boCount} รายการ`;
                }

                if(data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400 font-mono text-xs">📦 คลังสินค้าว่างเปล่า ยอดสต๊อกในสาขาเป็น 0 (กรุณาบันทึกรับเข้าอะไหล่ที่แท็บรับเข้าก่อน)</td></tr>`;
                    return;
                }

                // 📝 2. วาดตารางแสดงข้อมูลจริง (ดึงข้ามตารางเชื่อมเลขย่อยเข้าหาเลข MAIN ให้ตามสูตร)
                tbody.innerHTML = data.map(item => {
                    const isLow = parseInt(item.stock_in_house) <= 0;
                    return `
                        <tr class="hover:bg-slate-50 transition font-medium ${isLow ? 'bg-red-50/50 text-red-900' : ''}">
                            <td class="px-5 py-3 font-mono text-xs text-slate-400 font-bold">${item.part_main_no || '-'}</td>
                            <td class="px-5 py-3 font-mono font-black text-[#00320D]">${item.part_no}</td>
                            <td class="px-5 py-3 font-bold text-slate-800">${item.part_name}</td>
                            <td class="px-5 py-3 text-slate-600">${item.car_model || '-'}</td>
                            <td class="px-5 py-3 text-xs">
                                <span class="px-2 py-0.5 rounded font-bold border ${isLow ? 'bg-red-100 border-red-300 text-red-700' : 'bg-green-100 border-green-300 text-green-700'}">
                                    ${isLow ? 'สินค้าหมด / ค้างส่ง' : 'พร้อมจ่าย'}
                                </span>
                            </td>
                            <td class="px-5 py-3 text-center font-black text-base ${isLow ? 'text-red-600' : 'text-emerald-700'}">${item.stock_in_house}</td>
                            <td class="px-5 py-3 text-xs font-mono text-slate-500 font-bold">${isLow ? '🚨 คิวสั่งด่วน (BO)' : 'Rack-' + item.part_no.substring(0,2).toUpperCase()}</td>
                        </tr>
                    `;
                }).join('');

            } catch (err) { 
                console.error("Stock Inventory UI Error:", err); 
            }
        }

module.exports = app;