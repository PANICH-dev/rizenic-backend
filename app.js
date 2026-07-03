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
// 🌐 1. โซนหน้าบ้านพรีเมียม
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
        
        /* สไตล์สำหรับ Scrollbar ใน Admin */
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #4B5563; border-radius: 4px; }
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
                        <h3 class="text-md font-bold text-rizenic-green mb-4 border-b pb-2"><i class="fa-solid fa-user"></i> 1. ข้อมูลผู้ติดต่อ & ประเภทลูกค้า</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ชื่อ-นามสกุล ลูกค้า</label>
                                <input type="text" id="customer_name" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                                <input type="text" id="phone_number" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003220] outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ประเภทลูกค้า</label>
                                <select id="customer_type" class="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#003220] outline-none">
                                    <option value="บุคคลธรรมดา">บุคคลธรรมดา (ทั่วไป)</option>
                                    <option value="นิติบุคคล">นิติบุคคล / บริษัท</option>
                                </select>
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

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <div class="space-y-2">
                                <label class="block text-sm font-semibold text-gray-700">ชิ้นส่วนอะไหล่ (หลัก) <span class="text-xs text-gray-400 font-normal">*กด Ctrl/Cmd เพื่อเลือกหลายอัน</span></label>
                                <select id="main_part_name" multiple class="w-full p-3 h-32 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none custom-scrollbar">
                                    <option disabled>🔄 กำลังดึงข้อมูลคลังอะไหล่หลัก...</option>
                                </select>
                                <label class="block text-sm font-semibold text-gray-700 mt-2">จำนวนรวม (ชิ้น)</label>
                                <input type="number" id="main_part_qty" value="1" min="0" class="w-full p-3 border border-gray-300 rounded-xl">
                            </div>
                            
                            <div class="space-y-2">
                                <label class="block text-sm font-semibold text-gray-700">ชิ้นส่วนอะไหล่ (รอง) <span class="text-xs text-gray-400 font-normal">*กด Ctrl/Cmd เพื่อเลือกหลายอัน</span></label>
                                <select id="sub_part_name" multiple class="w-full p-3 h-32 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003220] outline-none custom-scrollbar">
                                    <option disabled>🔄 กำลังดึงข้อมูลคลังอะไหล่รอง...</option>
                                </select>
                                <label class="block text-sm font-semibold text-gray-700 mt-2">จำนวนรวม (ชิ้น)</label>
                                <input type="number" id="sub_part_qty" value="0" min="0" class="w-full p-3 border border-gray-300 rounded-xl">
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
                        <button type="button" onclick="submitSaForm()" class="px-8 py-3 bg-rizenic-green text-white font-bold rounded-xl shadow-lg cursor-pointer">
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
                    <button class="text-left px-4 py-3 rounded-xl bg-green-900/40 text-green-400 font-semibold border border-green-800"><i class="fa-solid fa-users-gear w-6"></i> Employees</button>
                    <button class="text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 transition"><i class="fa-solid fa-car w-6"></i> Car Models</button>
                    <button class="text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 transition"><i class="fa-solid fa-shield-halved w-6"></i> Insurances</button>
                    <button class="text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 transition"><i class="fa-solid fa-screwdriver-wrench w-6"></i> Parts Master</button>
                    <button class="text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 transition"><i class="fa-solid fa-address-card w-6"></i> Customer Types</button>
                    <button class="text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 transition"><i class="fa-solid fa-bars-progress w-6"></i> Job Statuses</button>
                    
                    <h3 class="text-gray-400 text-xs font-bold uppercase tracking-wider mt-6 mb-2 px-2">Transaction</h3>
                    <button class="text-left px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-300 transition"><i class="fa-solid fa-table w-6"></i> Report Data</button>
                </div>

                <div class="flex-1 bg-gray-800 p-6 flex flex-col">
                    <div class="flex justify-between items-end mb-6">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-1">Employee Master</h2>
                            <p class="text-gray-400 text-sm">จัดการข้อมูลพนักงาน rizenicemployeemaster</p>
                        </div>
                        <button class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition">+ Add Employee</button>
                    </div>

                    <div class="bg-gray-900 border border-gray-700 rounded-xl overflow-x-auto custom-scrollbar flex-1">
                        <table class="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr class="bg-black/50 text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                                    <th class="p-4 font-semibold">employee_id</th>
                                    <th class="p-4 font-semibold">employee_code</th>
                                    <th class="p-4 font-semibold">employee_name</th>
                                    <th class="p-4 font-semibold">employee_role</th>
                                    <th class="p-4 font-semibold">employee_phone</th>
                                    <th class="p-4 font-semibold">is_active</th>
                                    <th class="p-4 font-semibold text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm text-gray-300 divide-y divide-gray-800">
                                <tr class="hover:bg-gray-800/50 transition">
                                    <td class="p-4 text-gray-500">1</td>
                                    <td class="p-4 text-green-400 font-mono">SA-001</td>
                                    <td class="p-4 font-semibold text-white">คุณพานิช (Admin)</td>
                                    <td class="p-4"><span class="px-2 py-1 bg-blue-900/30 text-blue-400 rounded border border-blue-800/50 text-xs">Manager</span></td>
                                    <td class="p-4">081-234-5678</td>
                                    <td class="p-4"><i class="fa-solid fa-circle-check text-green-500"></i> Active</td>
                                    <td class="p-4 text-center">
                                        <button class="text-gray-400 hover:text-white px-2"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button class="text-gray-400 hover:text-red-400 px-2"><i class="fa-solid fa-trash"></i></button>
                                    </td>
                                </tr>
                                <tr class="hover:bg-gray-800/50 transition">
                                    <td class="p-4 text-gray-500">2</td>
                                    <td class="p-4 text-green-400 font-mono">TECH-01</td>
                                    <td class="p-4 font-semibold text-white">สมชาย ช่างเครื่อง</td>
                                    <td class="p-4"><span class="px-2 py-1 bg-orange-900/30 text-orange-400 rounded border border-orange-800/50 text-xs">Technician</span></td>
                                    <td class="p-4">089-999-9999</td>
                                    <td class="p-4"><i class="fa-solid fa-circle-check text-green-500"></i> Active</td>
                                    <td class="p-4 text-center">
                                        <button class="text-gray-400 hover:text-white px-2"><i class="fa-solid fa-pen-to-square"></i></button>
                                        <button class="text-gray-400 hover:text-red-400 px-2"><i class="fa-solid fa-trash"></i></button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <div class="p-4 border-t border-gray-700 text-gray-400 text-xs flex justify-between items-center">
                            <span>Showing 1 to 2 of 2 entries</span>
                            <div class="flex gap-1">
                                <button class="px-2 py-1 border border-gray-600 rounded hover:bg-gray-700">Prev</button>
                                <button class="px-2 py-1 border border-gray-600 rounded bg-gray-700 text-white">1</button>
                                <button class="px-2 py-1 border border-gray-600 rounded hover:bg-gray-700">Next</button>
                            </div>
                        </div>
                    </div>
                </div>
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

        // เก็บข้อมูลรถไว้กรอง
        let globalCarData = [];

        document.addEventListener('DOMContentLoaded', () => {
            // 1. ดึงข้อมูลอะไหล่ทั้งหมดแล้วแยกตามหมวดหมู่ (Multi-select)
            fetch(\`\${API_BASE_URL}/api/parts\`)
                .then(res => res.json())
                .then(data => {
                    const mainSelect = document.getElementById('main_part_name');
                    const subSelect = document.getElementById('sub_part_name');
                    mainSelect.innerHTML = ''; subSelect.innerHTML = '';
                    
                    data.forEach(part => {
                        const opt = \`<option value="\${part.part_name}">\${part.part_name}</option>\`;
                        if(part.part_category === 'ชิ้นส่วนหลัก') mainSelect.innerHTML += opt;
                        if(part.part_category === 'ชิ้นส่วนรอง') subSelect.innerHTML += opt;
                    });
                }).catch(e => console.error(e));

            // 2. ดึงรุ่นรถยนต์
            fetch(\`\${API_BASE_URL}/api/car-models\`)
                .then(res => res.json())
                .then(data => {
                    globalCarData = data;
                    updateCarModels('Tesla'); // ตั้งค่า Default ให้ดึงรุ่นของ Tesla มาแสดง
                }).catch(e => console.error(e));
                
            // ฟังเหตุการณ์เปลี่ยน Brand รถ
            document.getElementById('car_brand').addEventListener('change', function() {
                updateCarModels(this.value);
            });

            // 3. ดึงค่ายประกันภัย
            fetch(\`\${API_BASE_URL}/api/insurances\`)
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('payment_type');
                    select.innerHTML = '<option value="">-- เลือกประกันภัย/ชำระสด --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.insurance_name}">\${item.insurance_name}</option>\`;
                    });
                });

            // 4. ดึงสถานะ
            fetch(\`\${API_BASE_URL}/api/statuses\`)
                .then(res => res.json())
                .then(data => {
                    const select = document.getElementById('job_status');
                    select.innerHTML = '<option value="">-- เลือกสถานะ --</option>';
                    data.forEach(item => {
                        select.innerHTML += \`<option value="\${item.status_name}">\${item.status_code} - \${item.status_name}</option>\`;
                    });
                });
        });

        // ฟังก์ชันอัปเดต Dropdown รุ่นรถ ตามแบรนด์ที่เลือก
        function updateCarModels(brandName) {
            const select = document.getElementById('car_model');
            select.innerHTML = '';
            const filtered = globalCarData.filter(car => car.car_brand.toUpperCase() === brandName.toUpperCase());
            if(filtered.length === 0) {
                select.innerHTML = '<option value="">-- ไม่มีรุ่นรถในระบบ --</option>';
                return;
            }
            filtered.forEach(car => {
                select.innerHTML += \`<option value="\${car.car_model}">\${car.car_model}</option>\`;
            });
        }

        async function submitSaForm() {
            // ดึงค่า Multi-select จับมัดรวมกันเป็น String เดียว
            const getMultiSelectValues = (id) => {
                const el = document.getElementById(id);
                return Array.from(el.selectedOptions).map(opt => opt.value).join(', ');
            };

            const formData = {
                customer_name: document.getElementById('customer_name').value,
                phone_number: document.getElementById('phone_number').value,
                customer_type: document.getElementById('customer_type').value,
                car_brand: document.getElementById('car_brand').value,
                car_model: document.getElementById('car_model').value,
                vin_no: document.getElementById('vin_no').value,
                payment_type: document.getElementById('payment_type').value,
                damage_level: document.querySelector('input[name="damage_level"]:checked').value,
                // แปลงค่าหลายรายการเป็น Text คั่นด้วยลูกน้ำ
                main_part_name: getMultiSelectValues('main_part_name'),
                main_part_qty: document.getElementById('main_part_qty').value,
                sub_part_name: getMultiSelectValues('sub_part_name'),
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
                alert('⚠️ นายครับ! กรุณากรอกชื่อลูกค้า, แบรนด์รถ และสถานะงานก่อนนะจ๊ะ');
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
                    alert('🎉 สำเร็จ! ข้อมูลวิ่งลงตาราง rizenicreport บน Neon DB เรียบร้อยแล้วครับ!');
                    document.getElementById('saForm').reset();
                    updateCarModels('Tesla'); // รีเซ็ตกลับเป็น Tesla
                } else {
                    alert('❌ ข้อผิดพลาด: ' + result.error);
                }
            } catch (error) {
                alert('❌ ติดต่อ API ไม่ได้: ' + error.message);
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

// 🔧 (ใหม่!) ดึงข้อมูลอะไหล่จาก rizenicpartsmaster
app.get('/api/parts', async (req, res) => {
  try {
    // สมมติคอลัมน์ part_name และ part_category ตามที่นายบอกครับ
    const result = await pool.query('SELECT part_name, part_category FROM rizenicpartsmaster ORDER BY part_name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚗 ดึงรุ่นรถยนต์
app.get('/api/car-models', async (req, res) => {
  try {
    const result = await pool.query('SELECT model_id, car_brand, car_model FROM rizeniccarmodelmaster ORDER BY car_brand, car_model ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/insurances', async (req, res) => {
  try {
    const result = await pool.query('SELECT insurance_code, insurance_name, insurance_type FROM rizenicinsurancemaster ORDER BY insurance_name ASC');
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
    main_part_name || null, // ข้อมูลจะมาเป็น String ซ้อนกัน เช่น "กันชนหน้า, โช๊คอัพ"
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

// 🚀 รันระบบในโหมด Local Development
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`🚀 เซิร์ฟเวอร์ RIZENIC พร้อมเปิดท่อทดสอบที่: http://localhost:${port}`);
    });
}

module.exports = app;