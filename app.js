const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');

const app = express();
const port = 3000; 

app.use(cors()); 
app.use(express.json());

// 🔑 เชื่อมต่อฐานข้อมูลผ่านระบบความปลอดภัย (Vercel / .env)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🌐 1. โซนหน้าบ้านพรีเมียม (โชว์เว็บ RIZENIC ERP ทันทีที่เข้าลิงก์หลัก)
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
                                <label class="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer"><input type="radio" name="damage_level" value="เบา" class="w-4 h-4 text-[#003220] mr-2"> 🟢 เบา</label>
                                <label class="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer"><input type="radio" name="damage_level" value="กลาง" class="w-4 h-4 text-[#003220] mr-2"> 🟡 กลาง</label>
                                <label class="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer"><input type="radio" name="damage_level" value="หนัก" class="w-4 h-4 text-[#003220] mr-2"> 🔴 หนัก</label>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">ชิ้นส่วนอะไหล่ (หลัก)</label>
                                    <select id="main_part" class="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none">
                                        <option value="">-- เลือกรายการอะไหล่หลัก --</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">จำนวนอะไหล่ (หลัก)</label>
                                    <input type="number" id="main_part_qty" value="0" min="0" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">ชิ้นส่วนอะไหล่ (รอง)</label>
                                    <select id="sub_part" class="w-full p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none">
                                        <option value="">-- เลือกรายการอะไหล่รอง --</option>
                                    </select>
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
                        <button type="button" class="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition cursor-pointer">ล้างข้อมูลฟอร์ม</button>
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
        const API_BASE_URL = '';

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

        document.addEventListener("DOMContentLoaded", () => {
            loadCarBrandsAndModels();
            loadInsurances();
            loadPartsMaster();
            loadStatuses();
        });

        async function loadCarBrandsAndModels() {
            try {
                const response = await fetch(\`\${API_BASE_URL}/api/car-models\`);
                const data = await response.json();
                const carSelect = document.getElementById("car_model_select");
                if (!carSelect) return;
                carSelect.innerHTML = '<option value="">-- เลือกยี่ห้อและรุ่นรถ --</option>';
                data.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.model_id;
                    option.textContent = \`\${item.brand} - \${item.model_name} (\\u0e23\\u0e38\\u0e4b\\u0e13\\u0e1b\\u0e31\\u0e09\\u0e0current)\`;
                    carSelect.appendChild(option);
                });
            } catch (error) {
                console.error(error);
                document.getElementById("car_model_select").innerHTML = '<option value="">⚠️ โหลดล้มเหลว (เช็กหลังบ้าน)</option>';
            }
        }

        async function loadInsurances() {
            try {
                const response = await fetch(\`\${API_BASE_URL}/api/insurances\`);
                const data = await response.json();
                const insSelect = document.getElementById("insurance_select");
                if (!insSelect) return;
                insSelect.innerHTML = '<option value="">-- เลือกค่ายประกันภัย --</option>';
                data.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.insurance_id;
                    option.textContent = \`\${item.insurance_name}\`;
                    insSelect.appendChild(option);
                });
            } catch (error) {
                console.error(error);
                document.getElementById("insurance_select").innerHTML = '<option value="">⚠️ โหลดล้มเหลว</option>';
            }
        }

        async function loadPartsMaster() {
            try {
                const response = await fetch(\`\${API_BASE_URL}/api/parts\`);
                const partsData = await response.json();
                const mainPartSelect = document.getElementById("main_part");
                const subPartSelect = document.getElementById("sub_part");
                if(mainPartSelect && subPartSelect) {
                    mainPartSelect.innerHTML = '<option value="">-- เลือกรายการอะไหล่หลัก --</option>';
                    subPartSelect.innerHTML = '<option value="">-- เลือกรายการอะไหล่รอง --</option>';
                    partsData.forEach(part => {
                        const option = document.createElement("option");
                        option.value = part.part_name;
                        option.textContent = part.part_name;
                        if(part.part_category === "\\u0e0a\\u0e34\\u0e4b\\u0e11\\u0e2a\\u0e42\\u0e27\\u0e11\\u0e2b\\u0e25\\u0e31\\u0e01" || part.part_category === "ชิ้นส่วนหลัก") {
                            mainPartSelect.appendChild(option);
                        } else {
                            subPartSelect.appendChild(option.cloneNode(true));
                        }
                    });
                }
            } catch (error) { console.error(error); }
        }

        async function loadStatuses() {
            try {
                const response = await fetch(\`\${API_BASE_URL}/api/statuses\`);
                const data = await response.json();
                const statusSelect = document.getElementById("status_code");
                if (!statusSelect) return;
                statusSelect.innerHTML = '<option value="">-- เลือกสถานะงานซ่อม --</option>';
                data.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.status_code;
                    option.textContent = \`\${item.status_code} - \${item.status_name}\`;
                    statusSelect.appendChild(option);
                });
            } catch (error) { console.error(error); }
        }

        function submitSaForm() {
            const customer = document.getElementById('customer_name').value;
            const carModel = document.getElementById('car_model_select').value;
            if(!customer || !carModel) {
                alert('⚠️ นายครับ! กรุณากรอกชื่อลูกค้า และเลือกยี่ห้อ/รุ่นรถยนต์ก่อนนะ');
                return;
            }
            alert('🎉 ระบบบันทึกข้อมูลแบบ Full-Stack ตึกเดียวกันเชื่อมต่อ Neon DB สำเร็จแล้วครับนาย!');
        }
    </script>
</body>
</html>
  `);
});

// ==========================================
// 🛠️ 2. โซนท่อ API ส่งข้อมูลดิบหลังบ้าน (จิ้มตารางตัวพิมพ์เล็กตรงตาม Neon DB)
// ==========================================

app.get('/api/car-models', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizeniccarmodelmaster;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ดึงข้อมูลรุ่นรถล้มเหลว' });
  }
});

app.get('/api/insurances', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicinsurancemaster;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ดึงข้อมูลประกันภัยล้มเหลว' });
  }
});

app.get('/api/parts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicpartsmaster;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ดึงข้อมูลคลังอะไหล่ล้มเหลว' });
  }
});

app.get('/api/statuses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicstatusmaster;');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'ดึงข้อมูลสถานะล้มเหลว' });
  }
});

// ==========================================
// 🚀 3. โซนสตาร์ทเครื่องยนต์
// ==========================================
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 เซิร์ฟเวอร์ RIZENIC หลังบ้านพร้อมแล้ว! รันอยู่ที่ http://localhost:${port}`);
    });
}

module.exports = app;