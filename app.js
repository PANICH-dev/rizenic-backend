const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());

// 🔑 เชื่อมต่อฐานข้อมูลผ่านระบบความปลอดภัย (Vercel / .env)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🌐 1. โซนหน้าบ้านพรีเมียม (เสิร์ฟเว็บ HTML หน้าเดียวจบ)
// ==========================================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RIZENIC ERP - Premium Garage Management</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Noto Sans Thai', sans-serif; }
        .bg-rizenic-green { background-color: #003220; }
        .text-rizenic-green { color: #003220; }
        .border-rizenic-green { border-color: #003220; }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">

    <header class="bg-rizenic-green text-white shadow-xl border-b border-black sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-car text-2xl text-white"></i>
                <h1 class="text-2xl font-bold tracking-wider">RIZENIC <span class="text-black bg-white px-2 py-0.5 rounded text-lg font-black">ERP</span></h1>
            </div>
            <nav class="flex gap-2">
                <button onclick="switchTab('sa-tab')" id="btn-sa-tab" class="px-5 py-2.5 rounded-lg font-semibold bg-white text-[#003220] shadow transition-all duration-200 cursor-pointer flex items-center gap-2">
                    <i class="fa-solid fa-file-invoice"></i> บันทึกข้อมูลรถเข้าซ่อม (SA)
                </button>
                <button onclick="switchTab('admin-tab')" id="btn-admin-tab" class="px-5 py-2.5 rounded-lg font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all duration-200 cursor-pointer flex items-center gap-2">
                    <i class="fa-solid fa-sliders"></i> ตั้งค่าระบบ (Admin)
                </button>
            </nav>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
        <section id="sa-tab" class="tab-content block">
            <div class="bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                <div class="bg-rizenic-green p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold flex items-center gap-2"><i class="fa-solid fa-clipboard-list"></i> ใบเปิดงานซ่อมและประเมินอาการ</h2>
                        <p class="text-gray-300 text-sm mt-1">กรอกข้อมูลรายละเอียดรถยนต์และข้อมูลการรับประกัน</p>
                    </div>
                    <span class="text-xs bg-black/40 px-3 py-1.5 rounded-full border border-white/20">RIZENIC REPORT v1.0</span>
                </div>

                <form id="saForm" class="p-6 sm:p-8 space-y-8">
                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2 flex items-center gap-2"><i class="fa-solid fa-user"></i> 1. ข้อมูลผู้ติดต่อ & ประเภทลูกค้า</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล ลูกค้า</label>
                                <input type="text" id="customer_name" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none transition" placeholder="ระบุชื่อลูกค้า">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                                <input type="text" id="customer_phone" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none transition" placeholder="เช่น 08X-XXX-XXXX">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประเภทลูกค้า</label>
                                <select id="customer_type" class="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="CT-01">บุคคลธรรมดา (ทั่วไป)</option>
                                    <option value="CT-02">นิติบุคคล / บริษัท</option>
                                    <option value="CT-03">ลูกค้า VIP / คอนเทรค</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2 flex items-center gap-2"><i class="fa-solid fa-car"></i> 2. ข้อมูลตัวรถยนต์ & ประกันภัย</h3>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ยี่ห้อและรุ่นรถยนต์ (ดึงจากคลาวด์ Neon)</label>
                                <select id="car_model_select" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 font-medium text-amber-950 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 กำลังเชื่อมต่อ Neon ดึงรุ่นรถ...</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">เลขตัวถัง / VIN (17 หลัก)</label>
                                <input type="text" id="vin_number" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none transition" placeholder="กรอกเลข VIN รถยนต์">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประกันภัย / เงินสด</label>
                                <select id="insurance_select" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 font-medium text-amber-950 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 กำลังดึงรายชื่อค่ายประกัน...</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2 flex items-center gap-2"><i class="fa-solid fa-screwdriver-wrench"></i> 3. การประเมินความเสียหาย & ชิ้นส่วนซ่อม</h3>
                        <div class="mb-4">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">ระดับความเสียหาย</label>
                            <div class="flex gap-4 mt-1">
                                <label class="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer"><input type="radio" name="damage_level" value="เบา" class="w-4 h-4 text-[#003220] mr-2" checked> 🟢 เบา</label>
                                <label class="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer"><input type="radio" name="damage_level" value="กลาง" class="w-4 h-4 text-[#003220] mr-2"> 🟡 กลาง</label>
                                <label class="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer"><input type="radio" name="damage_level" value="หนัก" class="w-4 h-4 text-[#003220] mr-2"> 🔴 หนัก</label>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">ชิ้นส่วนอะไหล่ (หลัก)</label>
                                    <input type="text" id="main_part" class="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none" placeholder="เช่น กันชนหน้า, โช๊คอัพ">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">จำนวนอะไหล่ (หลัก)</label>
                                    <input type="number" id="main_part_qty" value="0" min="0" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">ชิ้นส่วนอะไหล่ (รอง)</label>
                                    <input type="text" id="sub_part" class="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none" placeholder="เช่น น็อตยึด, ไฟหรี่">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">จำนวนอะไหล่ (รอง)</label>
                                    <input type="number" id="sub_part_qty" value="0" min="0" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2 flex items-center gap-2"><i class="fa-solid fa-baht-sign"></i> 4. ประมาณการค่าใช้จ่าย & การนัดหมาย</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ค่าแรง (บาท)</label>
                                <input type="number" id="estimated_labor_cost" value="0.00" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ค่าอะไหล่ (บาท)</label>
                                <input type="number" id="estimated_parts_cost" value="0.00" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">งานนอก (บาท)</label>
                                <input type="number" id="external_job_cost" value="0.00" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2 flex items-center gap-2"><i class="fa-solid fa-circle-info"></i> 5. หมายเหตุ & สเตตัสงาน</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">หมายเหตุเพิ่มเติม</label>
                                <input type="text" id="notes" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none" placeholder="ระบุรายละเอียดเพิ่มเติม">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">สถานะงานปัจจุบัน</label>
                                <select id="status_code" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 text-amber-900 font-bold focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 กำลังโหลดสถานะ...</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="pt-6 border-t border-gray-200 flex justify-end gap-3">
                        <button type="button" onclick="document.getElementById('saForm').reset()" class="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition cursor-pointer">ล้างข้อมูลฟอร์ม</button>
                        <button type="button" onclick="submitSaForm()" class="px-8 py-3 bg-rizenic-green hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-cloud-arrow-up"></i> บันทึกข้อมูลและยิงลง Neon DB
                        </button>
                    </div>
                </form>
            </div>
        </section>

        <section id="admin-tab" class="tab-content hidden">
            <div class="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
                <div class="p-6 bg-black text-white flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold flex items-center gap-2 text-green-400"><i class="fa-solid fa-lock"></i> ศูนย์ควบคุมข้อมูลระบบหลังบ้าน (Admin Console)</h2>
                        <p class="text-gray-400 text-sm mt-1">จัดการมาสเตอร์ผ่านคลาวด์ Vercel Single-Web</p>
                    </div>
                </div>
                <div class="p-6 text-gray-300">ระบบแอดมินมาสเตอร์เชื่อมต่อท่อตรงเรียบร้อยแล้ว</div>
            </div>
        </section>
    </main>

    <script>
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(tabId).classList.remove('hidden');
            const btnSa = document.getElementById('btn-sa-tab');
            const btnAdmin = document.getElementById('btn-admin-tab');
            if (tabId === 'sa-tab') {
                btnSa.className = "px-5 py-2.5 rounded-lg font-semibold bg-white text-[#003220] shadow transition-all duration-200 cursor-pointer flex items-center gap-2";
                btnAdmin.className = "px-5 py-2.5 rounded-lg font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all duration-200 cursor-pointer flex items-center gap-2";
            } else {
                btnSa.className = "px-5 py-2.5 rounded-lg font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all duration-200 cursor-pointer flex items-center gap-2";
                btnAdmin.className = "px-5 py-2.5 rounded-lg font-semibold bg-white text-[#003220] shadow transition-all duration-200 cursor-pointer flex items-center gap-2";
            }
        }

        // ดึงข้อมูลมาสเตอร์มาใส่ Dropdown อัตโนมัติเมื่อเปิดเว็บ
        document.addEventListener('DOMContentLoaded', () => {
            // 1. ดึงรุ่นรถ
            fetch('/api/car-models')
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('car_model_select');
                    select.innerHTML = '<option value="">-- เลือกรุ่นรถยนต์ --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.id}">\${item.brand} \${item.model} (\${item.year_model})</option>\`;
                    });
                }).catch(err => console.error(err));

            // 2. ดึงประกัน
            fetch('/api/insurances')
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('insurance_select');
                    select.innerHTML = '<option value="">-- เลือกประกันภัย/ชำระสด --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.id}">\${item.insurance_name} (\${item.insurance_type})</option>\`;
                    });
                }).catch(err => console.error(err));

            // 3. ดึงสถานะ
            fetch('/api/statuses')
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('status_code');
                    select.innerHTML = '';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.status_code}">\${item.status_name}</option>\`;
                    });
                }).catch(err => console.error(err));
        });

        // ฟังก์ชันกดยิงข้อมูลฟอร์ม
        async function submitSaForm() {
            const formData = {
                customer_name: document.getElementById('customer_name').value,
                customer_phone: document.getElementById('customer_phone').value,
                customer_type: document.getElementById('customer_type').value,
                car_model_id: document.getElementById('car_model_select').value,
                vin_number: document.getElementById('vin_number').value,
                insurance_id: document.getElementById('insurance_select').value,
                damage_level: document.querySelector('input[name="damage_level"]:checked').value,
                main_part: document.getElementById('main_part').value,
                main_part_qty: document.getElementById('main_part_qty').value,
                sub_part: document.getElementById('sub_part').value,
                sub_part_qty: document.getElementById('sub_part_qty').value,
                labor_cost: document.getElementById('estimated_labor_cost').value,
                parts_cost: document.getElementById('estimated_parts_cost').value,
                external_cost: document.getElementById('external_job_cost').value,
                notes: document.getElementById('notes').value,
                status_code: document.getElementById('status_code').value
            };

            try {
                const response = await fetch('/api/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (response.ok) {
                    alert('🎉 สำเร็จ! ข้อมูลใบเปิดงานซ่อมวิ่งข้ามท่อลงตาราง rizenicreport บน Neon DB เรียบร้อยแล้ว');
                    document.getElementById('saForm').reset();
                } else {
                    alert('❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ' + result.error);
                }
            } catch (error) {
                alert('❌ ไม่สามารถเชื่อมต่อ API หลังบ้านได้: ' + error.message);
            }
        }
    </script>
</body>
</html>
  `);
});

// ==========================================
// 🔌 2. โซนท่อเชื่อม API ข้อมูลหลังบ้าน (REST API RESTFUL)
// ==========================================

// GET: ดึงรุ่นรถยนต์จาก Neon
app.get('/api/car-models', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, brand, model, year_model FROM carmodels ORDER BY brand, model ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: ดึงรายชื่อค่ายประกันจาก Neon
app.get('/api/insurances', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, insurance_name, insurance_type FROM insurances ORDER BY insurance_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: ดึงสเตตัสงานจาก Neon
app.get('/api/statuses', async (req, res) => {
  try {
    const result = await pool.query('SELECT status_code, status_name FROM jobstatuses ORDER BY status_code ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: บันทึกข้อมูลใบเปิดงานซ่อมลงตาราง rizenicreport
app.post('/api/report', async (req, res) => {
  const {
    customer_name, customer_phone, customer_type, car_model_id,
    vin_number, insurance_id, damage_level, main_part,
    main_part_qty, sub_part, sub_part_qty, labor_cost,
    parts_cost, external_cost, notes, status_code
  } = req.body;

  const queryText = `
    INSERT INTO rizenicreport (
      customer_name, customer_phone, customer_type, car_model_id,
      vin_number, insurance_id, damage_level, main_part,
      main_part_qty, sub_part, sub_part_qty, labor_cost,
      parts_cost, external_cost, notes, status_code
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING id;
  `;

  const values = [
    customer_name || null,
    customer_phone || null,
    customer_type || null,
    car_model_id ? parseInt(car_model_id) : null,
    vin_number || null,
    insurance_id ? parseInt(insurance_id) : null,
    damage_level || 'เบา',
    main_part || null,
    main_part_qty ? parseInt(main_part_qty) : 0,
    sub_part || null,
    sub_part_qty ? parseInt(sub_part_qty) : 0,
    labor_cost ? parseFloat(labor_cost) : 0.00,
    parts_cost ? parseFloat(parts_cost) : 0.00,
    external_cost ? parseFloat(external_cost) : 0.00,
    notes || null,
    status_code || null
  ];

  try {
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) {
    console.error('❌ Database Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// เปิดเครื่องยนต์สแตนด์บายรับทราฟฟิก
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});