const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors()); 
app.use(express.json());

// 🔑 เชื่อมต่อฐานข้อมูลผ่านระบบความปลอดภัย
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 🌐 1. โซนหน้าบ้านพรีเมียม (เสิร์ฟเว็บ HTML)
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
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #4B5563; border-radius: 4px; }
        
        /* สไตล์สำหรับปุ่มอะไหล่ (Chips) */
        .part-chip { transition: all 0.2s; cursor: pointer; user-select: none; }
        .part-chip:hover { transform: scale(1.05); }
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
                    <i class="fa-solid fa-file-invoice"></i> บันทึกข้อมูล (SA)
                </button>
                <button onclick="switchTab('admin-tab')" id="btn-admin-tab" class="px-5 py-2.5 rounded-lg font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all duration-200 cursor-pointer flex items-center gap-2">
                    <i class="fa-solid fa-sliders"></i> แอดมิน (Admin)
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
                    </div>
                </div>

                <form id="saForm" class="p-6 sm:p-8 space-y-8">
                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2"><i class="fa-solid fa-user"></i> 1. ข้อมูลลูกค้า & พนักงานรับรถ</h3>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">พนักงานรับรถ (SA Owner)</label>
                                <select id="sa_owner" class="w-full p-3 border border-gray-300 rounded-xl bg-blue-50 text-blue-900 font-bold focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 กำลังโหลดรายชื่อพนักงาน...</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประเภทลูกค้า</label>
                                <select id="customer_type" class="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="บุคคลธรรมดา">บุคคลธรรมดา (ทั่วไป)</option>
                                    <option value="นิติบุคคล">นิติบุคคล / บริษัท</option>
                                    <option value="ลูกค้า VIP">ลูกค้า VIP / คอนเทรค</option>
                                </select>
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล ลูกค้า</label>
                                <input type="text" id="customer_name" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none" placeholder="ระบุชื่อลูกค้า">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                                <input type="text" id="phone_number" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none" placeholder="เช่น 08X-XXX-XXXX">
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2"><i class="fa-solid fa-car"></i> 2. ข้อมูลตัวรถยนต์ & ประกันภัย</h3>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ยี่ห้อรถยนต์ (Brand)</label>
                                <select id="car_brand" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 font-bold text-amber-950 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="Tesla" selected>Tesla (Default)</option>
                                    <option value="Toyota">Toyota</option>
                                    <option value="Honda">Honda</option>
                                    <option value="BYD">BYD</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">รุ่นรถยนต์ (Model)</label>
                                <select id="car_model" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 font-medium text-amber-950 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 รอเลือกรุ่น...</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">เลขตัวถัง / VIN (17 หลัก)</label>
                                <input type="text" id="vin_no" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประกันภัย / เงินสด</label>
                                <select id="payment_type" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="">🔄 กำลังโหลด...</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2"><i class="fa-solid fa-screwdriver-wrench"></i> 3. การประเมินความเสียหาย & ชิ้นส่วนซ่อม</h3>
                        <div class="mb-4">
                            <label class="block text-sm font-semibold text-gray-700 mb-1">ระดับความเสียหาย</label>
                            <div class="flex gap-4">
                                <label><input type="radio" name="damage_level" value="เบา" checked> 🟢 เบา</label>
                                <label><input type="radio" name="damage_level" value="กลาง"> 🟡 กลาง</label>
                                <label><input type="radio" name="damage_level" value="หนัก"> 🔴 หนัก</label>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col h-full">
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-sm font-bold text-gray-800">🛠️ ชิ้นส่วนอะไหล่ (หลัก)</label>
                                    <span class="text-xs bg-gray-800 text-white px-2 py-1 rounded-lg">เลือกแล้ว: <span id="main_part_qty_display" class="font-bold text-green-400">0</span> ชิ้น</span>
                                </div>
                                <div class="flex-1 border border-gray-300 bg-white rounded-lg p-3 overflow-y-auto h-32 custom-scrollbar flex flex-wrap gap-2 content-start" id="main_parts_available">
                                    <span class="text-xs text-gray-400">กำลังโหลด...</span>
                                </div>
                                <div class="mt-2 pt-2 border-t border-gray-300">
                                    <p class="text-xs text-gray-500 mb-1">รายการที่เลือก (กดเพื่อเอาออก):</p>
                                    <div class="flex flex-wrap gap-2" id="main_parts_selected"></div>
                                </div>
                            </div>
                            
                            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col h-full">
                                <div class="flex justify-between items-center mb-2">
                                    <label class="text-sm font-bold text-gray-800">🔩 ชิ้นส่วนอะไหล่ (รอง)</label>
                                    <span class="text-xs bg-gray-800 text-white px-2 py-1 rounded-lg">เลือกแล้ว: <span id="sub_part_qty_display" class="font-bold text-green-400">0</span> ชิ้น</span>
                                </div>
                                <div class="flex-1 border border-gray-300 bg-white rounded-lg p-3 overflow-y-auto h-32 custom-scrollbar flex flex-wrap gap-2 content-start" id="sub_parts_available">
                                    <span class="text-xs text-gray-400">กำลังโหลด...</span>
                                </div>
                                <div class="mt-2 pt-2 border-t border-gray-300">
                                    <p class="text-xs text-gray-500 mb-1">รายการที่เลือก (กดเพื่อเอาออก):</p>
                                    <div class="flex flex-wrap gap-2" id="sub_parts_selected"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2"><i class="fa-solid fa-baht-sign"></i> 4. ประมาณการค่าใช้จ่าย & การนัดหมาย</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">ค่าแรง (บาท)</label><input type="number" id="cost_labor" value="0" class="w-full p-3 border border-gray-300 rounded-xl"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">ค่าอะไหล่ (บาท)</label><input type="number" id="cost_part" value="0" class="w-full p-3 border border-gray-300 rounded-xl"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">งานนอก (บาท)</label><input type="number" id="cost_external" value="0" class="w-full p-3 border border-gray-300 rounded-xl"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">กำหนดซ่อมเสร็จ</label><input type="date" id="target_finish_date" class="w-full p-3 border border-gray-300 rounded-xl"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">วันที่เสร็จจริง</label><input type="date" id="actual_finish_date" class="w-full p-3 border border-gray-300 rounded-xl"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">วันที่ส่งมอบรถ</label><input type="date" id="delivery_date" class="w-full p-3 border border-gray-300 rounded-xl"></div>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2"><i class="fa-solid fa-circle-info"></i> 5. สเตตัสงาน</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">หมายเหตุเพิ่มเติม</label>
                                <input type="text" id="notes" class="w-full p-3 border border-gray-300 rounded-xl">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">สถานะงานปัจจุบัน</label>
                                <select id="job_status" class="w-full p-3 border border-gray-300 rounded-xl bg-amber-50 text-amber-900 font-bold outline-none"></select>
                            </div>
                        </div>
                    </div>

                    <div class="pt-6 border-t border-gray-200 flex justify-end">
                        <button type="button" onclick="submitSaForm()" class="px-8 py-3 bg-rizenic-green text-white font-bold rounded-xl shadow-lg cursor-pointer hover:bg-[#002210] transition">
                            <i class="fa-solid fa-cloud-arrow-up"></i> บันทึกข้อมูล
                        </button>
                    </div>
                </form>
            </div>
        </section>

        <section id="admin-tab" class="tab-content hidden">
            <div class="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col md:flex-row min-h-[700px]">
                
                <div class="w-full md:w-64 bg-gray-900 border-r border-gray-700 p-4 flex flex-col gap-2">
                    <h3 class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 px-2">Master Tables</h3>
                    <button class="text-left px-4 py-3 rounded-xl bg-green-900/40 text-green-400 font-semibold border border-green-800"><i class="fa-solid fa-users-gear w-6"></i> Employees (พร้อมใช้)</button>
                    <button class="text-left px-4 py-3 rounded-xl text-gray-500 cursor-not-allowed"><i class="fa-solid fa-car w-6"></i> Car Models</button>
                    <button class="text-left px-4 py-3 rounded-xl text-gray-500 cursor-not-allowed"><i class="fa-solid fa-shield-halved w-6"></i> Insurances</button>
                </div>

                <div class="flex-1 bg-gray-800 p-6 flex flex-col">
                    <div class="flex justify-between items-end mb-6">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-1">Employee Master</h2>
                            <p class="text-gray-400 text-sm">จัดการข้อมูลพนักงาน และตั้งค่า SA</p>
                        </div>
                    </div>

                    <div class="bg-gray-900 p-4 rounded-xl border border-gray-700 mb-6 flex gap-4 items-end flex-wrap">
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">รหัสพนักงาน</label>
                            <input type="text" id="add_emp_code" class="p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm" placeholder="เช่น SA-001">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">ชื่อ-นามสกุล</label>
                            <input type="text" id="add_emp_name" class="p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm" placeholder="ชื่อพนักงาน">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">ตำแหน่ง</label>
                            <select id="add_emp_role" class="p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                                <option value="SA">SA (รับรถ)</option>
                                <option value="Technician">ช่างซ่อม</option>
                                <option value="Admin">แอดมิน</option>
                            </select>
                        </div>
                        <button onclick="addEmployee()" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded text-sm transition">
                            <i class="fa-solid fa-plus"></i> เพิ่มข้อมูล
                        </button>
                    </div>

                    <div class="bg-gray-900 border border-gray-700 rounded-xl overflow-x-auto custom-scrollbar flex-1">
                        <table class="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr class="bg-black/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                                    <th class="p-4 font-semibold">Code</th>
                                    <th class="p-4 font-semibold">Name</th>
                                    <th class="p-4 font-semibold">Role</th>
                                    <th class="p-4 font-semibold">Status</th>
                                    <th class="p-4 font-semibold text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody id="employee_table_body" class="text-sm text-gray-300 divide-y divide-gray-800">
                                <tr><td colspan="5" class="p-4 text-center">กำลังโหลดข้อมูล...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script>
        const API_BASE_URL = window.location.origin;

        // 🟢 ระบบรักษาความปลอดภัย: สลับแท็บพร้อมเช็ก PIN 1234
        function switchTab(tabId) {
            if (tabId === 'admin-tab') {
                const pin = prompt("🔒 กรุณาใส่รหัสผ่านแอดมิน (PIN):");
                if (pin !== "1234") {
                    alert("❌ รหัสผ่านไม่ถูกต้อง! ปฏิเสธการเข้าถึง");
                    return;
                }
                loadAdminEmployees(); // โหลดข้อมูลตารางพนักงานเมื่อรหัสผ่านถูก
            }

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

        // ==========================================
        // 🟢 ระบบจัดการอะไหล่แบบปุ่มกด (Chips Multi-Select)
        // ==========================================
        let partsDB = { main: [], sub: [] };
        let selectedParts = { main: [], sub: [] };

        function renderPartsUI() {
            // โซนอะไหล่หลัก
            const mainAvailBox = document.getElementById('main_parts_available');
            const mainSelBox = document.getElementById('main_parts_selected');
            mainAvailBox.innerHTML = ''; mainSelBox.innerHTML = '';
            
            partsDB.main.forEach(p => {
                if(!selectedParts.main.includes(p)) {
                    mainAvailBox.innerHTML += \`<span onclick="togglePart('main', '\${p}', 'add')" class="part-chip px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold hover:bg-[#003220] hover:text-white border border-gray-300">\${p} +</span>\`;
                }
            });
            selectedParts.main.forEach(p => {
                mainSelBox.innerHTML += \`<span onclick="togglePart('main', '\${p}', 'remove')" class="part-chip px-3 py-1 bg-[#003220] text-white rounded-full text-xs font-bold shadow-sm border border-black">\${p} <i class="fa-solid fa-xmark ml-1"></i></span>\`;
            });
            document.getElementById('main_part_qty_display').innerText = selectedParts.main.length;
            document.getElementById('main_part_qty').value = selectedParts.main.length;

            // โซนอะไหล่รอง
            const subAvailBox = document.getElementById('sub_parts_available');
            const subSelBox = document.getElementById('sub_parts_selected');
            subAvailBox.innerHTML = ''; subSelBox.innerHTML = '';

            partsDB.sub.forEach(p => {
                if(!selectedParts.sub.includes(p)) {
                    subAvailBox.innerHTML += \`<span onclick="togglePart('sub', '\${p}', 'add')" class="part-chip px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold hover:bg-gray-600 hover:text-white border border-gray-300">\${p} +</span>\`;
                }
            });
            selectedParts.sub.forEach(p => {
                subSelBox.innerHTML += \`<span onclick="togglePart('sub', '\${p}', 'remove')" class="part-chip px-3 py-1 bg-gray-700 text-white rounded-full text-xs font-bold shadow-sm border border-black">\${p} <i class="fa-solid fa-xmark ml-1"></i></span>\`;
            });
            document.getElementById('sub_part_qty_display').innerText = selectedParts.sub.length;
            document.getElementById('sub_part_qty').value = selectedParts.sub.length;
        }

        function togglePart(category, partName, action) {
            if(action === 'add') {
                selectedParts[category].push(partName);
            } else {
                selectedParts[category] = selectedParts[category].filter(p => p !== partName);
            }
            renderPartsUI();
        }

        // ==========================================
        // 🟢 โหลดข้อมูลเมื่อเปิดหน้าเว็บ
        // ==========================================
        let globalCarData = [];
        document.addEventListener('DOMContentLoaded', () => {
            // โหลดพนักงาน SA
            fetch(\`\${API_BASE_URL}/api/employees\`).then(r=>r.json()).then(data => {
                const select = document.getElementById('sa_owner');
                select.innerHTML = '<option value="">-- เลือกพนักงานรับรถ --</option>';
                data.filter(e => e.is_active).forEach(e => {
                    select.innerHTML += \`<option value="\${e.employee_name}">\${e.employee_code} - \${e.employee_name}</option>\`;
                });
            });

            // โหลดอะไหล่เข้า Array
            fetch(\`\${API_BASE_URL}/api/parts\`).then(r=>r.json()).then(data => {
                partsDB.main = data.filter(p => p.part_category === 'ชิ้นส่วนหลัก').map(p => p.part_name);
                partsDB.sub = data.filter(p => p.part_category === 'ชิ้นส่วนรอง').map(p => p.part_name);
                renderPartsUI();
            });

            // โหลดรถยนต์
            fetch(\`\${API_BASE_URL}/api/car-models\`).then(r=>r.json()).then(data => {
                globalCarData = data;
                updateCarModels('Tesla'); // Default
            });
            document.getElementById('car_brand').addEventListener('change', function() { updateCarModels(this.value); });

            // โหลดประกัน & สเตตัส
            fetch(\`\${API_BASE_URL}/api/insurances\`).then(r=>r.json()).then(data => {
                const s = document.getElementById('payment_type'); s.innerHTML = '<option value="">-- เลือกประกันภัย --</option>';
                data.forEach(i => s.innerHTML += \`<option value="\${i.insurance_name}">\${i.insurance_name}</option>\`);
            });
            fetch(\`\${API_BASE_URL}/api/statuses\`).then(r=>r.json()).then(data => {
                const s = document.getElementById('job_status'); s.innerHTML = '<option value="">-- เลือกสถานะ --</option>';
                data.forEach(i => s.innerHTML += \`<option value="\${i.status_name}">\${i.status_code} - \${i.status_name}</option>\`);
            });
        });

        function updateCarModels(brandName) {
            const select = document.getElementById('car_model'); select.innerHTML = '';
            const filtered = globalCarData.filter(car => car.car_brand.toUpperCase() === brandName.toUpperCase());
            filtered.forEach(car => select.innerHTML += \`<option value="\${car.car_model}">\${car.car_model}</option>\`);
        }

        // ==========================================
        // 🟢 ระบบ Admin Employee CRUD
        // ==========================================
        async function loadAdminEmployees() {
            const res = await fetch(\`\${API_BASE_URL}/api/employees\`);
            const data = await res.json();
            const tbody = document.getElementById('employee_table_body');
            tbody.innerHTML = '';
            data.forEach(emp => {
                tbody.innerHTML += \`
                    <tr class="hover:bg-gray-800/50 transition">
                        <td class="p-4 text-green-400 font-mono">\${emp.employee_code}</td>
                        <td class="p-4 font-semibold text-white">\${emp.employee_name}</td>
                        <td class="p-4"><span class="px-2 py-1 bg-gray-700 rounded text-xs">\${emp.employee_role}</span></td>
                        <td class="p-4 text-green-500">Active</td>
                        <td class="p-4 text-center">
                            <button onclick="deleteEmployee(\${emp.employee_id})" class="text-gray-400 hover:text-red-400 px-2 cursor-pointer"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                \`;
            });
        }

        async function addEmployee() {
            const payload = {
                employee_code: document.getElementById('add_emp_code').value,
                employee_name: document.getElementById('add_emp_name').value,
                employee_role: document.getElementById('add_emp_role').value
            };
            if(!payload.employee_code || !payload.employee_name) return alert('กรอกข้อมูลให้ครบก่อนครับ');
            
            await fetch(\`\${API_BASE_URL}/api/employees\`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            document.getElementById('add_emp_code').value = '';
            document.getElementById('add_emp_name').value = '';
            loadAdminEmployees(); // โหลดตารางใหม่
        }

        async function deleteEmployee(id) {
            if(!confirm('🚨 ยืนยันการลบพนักงานคนนี้?')) return;
            await fetch(\`\${API_BASE_URL}/api/employees/\${id}\`, { method: 'DELETE' });
            loadAdminEmployees();
        }

        // ==========================================
        // 🟢 ส่งข้อมูลใบรับรถ (SA)
        // ==========================================
        async function submitSaForm() {
            const formData = {
                sa_owner: document.getElementById('sa_owner').value, // เพิ่ม SA ลงท่อ
                customer_name: document.getElementById('customer_name').value,
                phone_number: document.getElementById('phone_number').value,
                customer_type: document.getElementById('customer_type').value,
                car_brand: document.getElementById('car_brand').value,
                car_model: document.getElementById('car_model').value,
                vin_no: document.getElementById('vin_no').value,
                payment_type: document.getElementById('payment_type').value,
                damage_level: document.querySelector('input[name="damage_level"]:checked').value,
                main_part_name: selectedParts.main.join(', '), // นำ Array มาต่อกันด้วยลูกน้ำ
                main_part_qty: selectedParts.main.length,
                sub_part_name: selectedParts.sub.join(', '),
                sub_part_qty: selectedParts.sub.length,
                cost_labor: document.getElementById('cost_labor').value,
                cost_part: document.getElementById('cost_part').value,
                cost_external: document.getElementById('cost_external').value,
                target_finish_date: document.getElementById('target_finish_date').value || null,
                actual_finish_date: document.getElementById('actual_finish_date').value || null,
                delivery_date: document.getElementById('delivery_date').value || null,
                notes: document.getElementById('notes').value,
                job_status: document.getElementById('job_status').value
            };

            if(!formData.sa_owner || !formData.customer_name || !formData.job_status) {
                return alert('⚠️ กรุณาเลือกพนักงาน SA, ชื่อลูกค้า และสถานะงานก่อนส่งครับ!');
            }

            try {
                const response = await fetch(\`\${API_BASE_URL}/api/report\`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
                });
                if (response.ok) {
                    alert('🎉 สำเร็จ! ข้อมูลบันทึกพร้อมรายชื่ออะไหล่และ SA เรียบร้อยแล้ว!');
                    document.getElementById('saForm').reset();
                    selectedParts = { main: [], sub: [] }; renderPartsUI(); // เคลียร์ปุ่มอะไหล่
                } else {
                    alert('❌ ข้อผิดพลาด: ' + (await response.json()).error);
                }
            } catch (error) { alert('❌ ติดต่อ API ไม่ได้'); }
        }
    </script>
</body>
</html>
  `);
});

// ==========================================
// 🔌 2. โซนท่อเชื่อม API คิวรีหลังบ้าน
// ==========================================

// 🟢 พนักงาน (Employee Master) - GET, POST, DELETE
app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rizenicemployeemaster ORDER BY employee_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { employee_code, employee_name, employee_role } = req.body;
    await pool.query('INSERT INTO rizenicemployeemaster (employee_code, employee_name, employee_role, is_active) VALUES ($1, $2, $3, true)', [employee_code, employee_name, employee_role]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rizenicemployeemaster WHERE employee_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🟢 ดึงข้อมูลอะไหล่
app.get('/api/parts', async (req, res) => {
  try {
    const result = await pool.query('SELECT part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🟢 รุ่นรถ / ประกัน / สถานะ
app.get('/api/car-models', async (req, res) => {
  try { res.json((await pool.query('SELECT model_id, car_brand, car_model FROM rizeniccarmodelmaster ORDER BY car_brand, car_model ASC')).rows); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/insurances', async (req, res) => {
  try { res.json((await pool.query('SELECT insurance_code, insurance_name, insurance_type FROM rizenicinsurancemaster ORDER BY insurance_name ASC')).rows); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/statuses', async (req, res) => {
  try { res.json((await pool.query('SELECT status_code, status_name FROM rizenicstatusmaster ORDER BY status_code ASC')).rows); } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🟢 บันทึกใบงาน (รับ sa_owner และ String รายชื่ออะไหล่)
app.post('/api/report', async (req, res) => {
  const {
    sa_owner, customer_name, phone_number, customer_type, car_brand, car_model,
    vin_no, payment_type, damage_level, main_part_name,
    main_part_qty, sub_part_name, sub_part_qty, cost_labor,
    cost_part, cost_external, notes, job_status,
    target_finish_date, actual_finish_date, delivery_date
  } = req.body;

  const queryText = `
    INSERT INTO rizenicreport (
      sa_owner, customer_name, phone_number, customer_type, car_brand, car_model,
      vin_no, payment_type, damage_level, main_part_name,
      main_part_qty, sub_part_name, sub_part_qty, cost_labor,
      cost_part, cost_external, notes, job_status,
      target_finish_date, actual_finish_date, delivery_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING id;
  `;

  const values = [
    sa_owner || null, customer_name || null, phone_number || null, customer_type || null, car_brand || null, car_model || null,
    vin_no || null, payment_type || null, damage_level || 'เบา', main_part_name || null,
    main_part_qty || 0, sub_part_name || null, sub_part_qty || 0,
    cost_labor || 0, cost_part || 0, cost_external || 0,
    notes || null, job_status || null, target_finish_date || null, actual_finish_date || null, delivery_date || null
  ];

  try {
    const result = await pool.query(queryText, values);
    res.status(201).json({ success: true, insertedId: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🚀 โหมด Local Development
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => console.log(`🚀 พร้อมที่: http://localhost:${port}`));
}

module.exports = app;