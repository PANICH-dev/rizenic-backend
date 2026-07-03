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
                                <input type="text" id="phone_number" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none transition" placeholder="เช่น 08X-XXX-XXXX">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประเภทลูกค้า</label>
                                <select id="customer_type" class="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="บุคคลธรรมดา">บุคคลธรรมดา (ทั่วไป)</option>
                                    <option value="นิติบุคคล">นิติบุคคล / บริษัท</option>
                                    <option value="ลูกค้า VIP">ลูกค้า VIP / คอนเทรค</option>
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
                                <input type="text" id="vin_no" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none transition" placeholder="กรอกเลข VIN รถยนต์">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประกันภัย / เงินสด</label>
                                <select id="payment_type" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 font-medium text-amber-950 focus:ring-2 focus:ring-[#003220] outline-none">
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
                                    <input type="text" id="main_part_name" class="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none" placeholder="เช่น กันชนหน้า, โช๊คอัพ">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">จำนวนอะไหล่ (หลัก)</label>
                                    <input type="number" id="main_part_qty" value="0" min="0" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                                </div>
                            </div>
                            
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">ชิ้นส่วนอะไหล่ (รอง)</label>
                                    <input type="text" id="sub_part_name" class="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none" placeholder="เช่น น็อตยึด, ไฟหรี่">
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
                                <input type="number" id="cost_labor" value="0.00" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ค่าอะไหล่ (บาท)</label>
                                <input type="number" id="cost_part" value="0.00" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">งานนอก (บาท)</label>
                                <input type="number" id="cost_external" value="0.00" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1"><i class="fa-regular fa-calendar-days text-amber-600"></i> กำหนดซ่อมเสร็จ</label>
                                <input type="date" id="target_finish_date" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1"><i class="fa-regular fa-calendar-check text-green-600"></i> วันที่เสร็จจริง</label>
                                <input type="date" id="actual_finish_date" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1"><i class="fa-solid fa-handshake text-blue-600"></i> วันที่ส่งมอบรถ</label>
                                <input type="date" id="delivery_date" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
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
                                <select id="job_status" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 text-amber-900 font-bold focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 กำลังโหลดสถานะจาก Neon...</option>
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
        const API_BASE_URL = window.location.origin;

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

        document.addEventListener('DOMContentLoaded', () => {
            // 1. ดึงรุ่นรถยนต์ (จูนแมตช์ตามคอลัมน์จริงของนาย)
            fetch(\`\${API_BASE_URL}/api/car-models\`)
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('car_model_select');
                    select.innerHTML = '<option value="">-- เลือกรุ่นรถยนต์ --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.brand}|\${item.model_name}">\${item.brand} \${item.model_name}</option>\`;
                    });
                }).catch(err => console.error("Car Models Load Error:", err));

            // 2. ดึงค่ายประกันภัย
            fetch(\`\${API_BASE_URL}/api/insurances\`)
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('payment_type');
                    select.innerHTML = '<option value="">-- เลือกประกันภัย/ชำระสด --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.insurance_name}">\${item.insurance_name}</option>\`;
                    });
                }).catch(err => console.error("Insurances Load Error:", err));

            // 3. ดึงสถานะงานซ่อม (คลีน ล้างท่อนผิดพลาดที่ทำข้อความหลุดออกเรียบร้อยแล้วจ๊ะ)
            fetch(\`\${API_BASE_URL}/api/statuses\`)
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('job_status');
                    select.innerHTML = '<option value="">-- เลือกสถานะงานซ่อม --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.status_name}">\${item.status_code} - \${item.status_name}</option>\`;
                    });
                }).catch(err => console.error("Statuses Load Error:", err));
        });

        async function submitSaForm() {
            const carSelectValue = document.getElementById('car_model_select').value;
            const [car_brand, car_model] = carSelectValue ? carSelectValue.split('|') : [null, null];

            const formData = {
                customer_name: document.getElementById('customer_name').value,
                phone_number: document.getElementById('phone_number').value,
                customer_type: document.getElementById('customer_type').value,
                car_brand: car_brand,
                car_model: car_model,
                vin_no: document.getElementById('vin_no').value,
                payment_type: document.getElementById('payment_type').value,
                damage_level: document.querySelector('input[name="damage_level"]:checked').value,
                main_part_name: document.getElementById('main_part_name').value,
                main_part_qty: document.getElementById('main_part_qty').value,
                sub_part_name: document.getElementById('sub_part_name').value,
                sub_part_qty: document.getElementById('sub_part_qty').value,
                cost_labor: document.getElementById('cost_labor').value,
                cost_part: document.getElementById('cost_part').value,
                cost_external: document.getElementById('cost_external').value,
                target_finish_date: document.getElementById('target_finish_date').value || null,
                actual_finish_date: document.getElementById('actual_finish_date').value || null,
                delivery_date: document.getElementById('delivery_date').value || null,
                notes: document.getElementById('notes').value,
                job_status: document.getElementById('job_status').value
            };

            if(!formData.customer_name || !formData.car_brand || !formData.job_status) {
                alert('⚠️ นายครับ! กรุณากรอกชื่อลูกค้า, เลือกยี่ห้อรถ และเลือกสถานะงานซ่อมก่อนกดส่งงานนะจ๊ะ');
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE_URL}/api/report\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                if (response.ok) {
                    alert('🎉 สำเร็จ! ข้อมูลใบเปิดงานวิ่งลงตาราง rizenicreport บน Neon DB ของจริงเรียบร้อยแล้วครับนาย!');
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
// 🔌 2. โซนท่อเชื่อม API คิวรีลงตารางมาสเตอร์ตัวพิมพ์เล็กตรงเป๊ะ
// ==========================================

app.get('/api/car-models', async (req, res) => {
  try {
    const result = await pool.query('SELECT model_id, brand, model_name FROM rizeniccarmodelmaster ORDER BY brand, model_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/insurances', async (req, res) => {
  try {
    const result = await pool.query('SELECT insurance_id, insurance_name FROM rizenicinsurancemaster ORDER BY insurance_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/statuses', async (req, res) => {
  try {
    const result = await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: บันทึกข้อมูล
app.post('/api/report', async (req, res) => {
  const {
    customer_name, phone_number, customer_type, car_brand, car_model,
    vin_no, payment_type, damage_level, main_part_name,
    main_part_qty, sub_part_name, sub_part_qty, cost_labor,
    cost_part, cost_external, notes, job_status,
    target_finish_date, actual_finish_date, delivery_date
  } = req.body;

  const queryText = `
    INSERT INTO rizenicreport (
      customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING id;
  `;

  const values = [
    customer_name || null,
    phone_number || null,
    customer_type || null,
    car_brand || null,
    car_model || null,
    vin_no || null,
    payment_type || null,
    damage_level || 'เบา',
    main_part_name || null,
    main_part_qty ? parseInt(main_part_qty) : 0,
    sub_part_name || null,
    sub_part_qty ? parseInt(sub_part_qty) : 0,
    cost_labor ? parseFloat(cost_labor) : 0.00,
    cost_part ? parseFloat(cost_part) : 0.00,
    cost_external ? parseFloat(cost_external) : 0.00,
    notes || null,
    job_status || null,
    target_finish_date || null,
    actual_finish_date || null,
    delivery_date || null
  ];

  try {
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) {
    console.error('❌ Database Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 สตาร์ทแยกโหมดรันระบบ
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 เซิร์ฟเวอร์ RIZENIC พร้อมเปิดท่อทดสอบที่: http://localhost:${port}`);
    });
}

module.exports = app;