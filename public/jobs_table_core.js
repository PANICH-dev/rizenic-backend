// ==========================================
// 🧠 RIZENIC - Jobs Table Core (Data & API)
// ==========================================

const API_BASE_URL = window.location.origin;

// 🌟 Global Variables 🌟
let allJobsData = [];
let currentFilteredData = [];
let allPartOrders = [];
let allMasterParts = [];

let allCustomerTypes = [];
let allInsurances = [];
let allEmployees = [];
let allCarModels = []; 

let globalStatusOptionsHtml = '';
let globalStatuses = []; 

let userRole = '';
let userBranch = '';

let activeFilters = {}; 
let currentFilterKey = -1;
let draggedColIdx = null; 
let searchTimeout = null;

let activeJobIdForParts = null;
let activeFieldForParts = null; 
let selectedPartsSet = new Set();
let isBulkModalMode = false; 
let activeBulkRowId = null; 

// 🌟 Calendar Scope Variables 🌟
let currentSchedMonth = new Date().getMonth();
let currentSchedYear = new Date().getFullYear();
let allSchedJobs = [];
let allSchedQuotas = [];
let currentTargetField = 'all';
let currentTargetJobId = null;
let isBulkCalendarMode = false;
let currentTargetBulkRowId = null;

// 🌟 Configurations 🌟
const excludedStatuses = [
    '13.วางบิลประกัน', '14.ชำระเงินสด', '15.วางบิล Tesla', 
    '16.วางบิล EV ME', '17.รอออกบิล', '18.ลูกค้ายกเลิก', 
    '19.ออกบิลแล้ว', '20.จอดซ่อม TC', '21.พักซ่อม'
];

const stationLevels = ["ส่งจ๊อบ", "01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "07.QC", "08.แม็ก", "09.กระจก", "10.ฟิล์ม", "11.พักซ่อม", "12.รอส่งมอบ"];

let columnsDef = [
    { idx: 1, key: 'action', title: 'Action', width: 90 },
    { idx: 2, key: 'contact_date', title: 'เข้ามาติดต่อวันที่', width: 115 },
    { idx: 36, key: 'arrived_date', title: 'วันที่รถเข้าจอดอู่', width: 150 },
    { idx: 4, key: 'car_plate', title: 'ทะเบียนรถ', width: 110 },
    { idx: 5, key: 'customer_type', title: 'ประเภทลูกค้า', width: 120 },
    { idx: 6, key: 'car_brand', title: 'ยี่ห้อรถ', width: 120 },
    { idx: 7, key: 'car_model', title: 'รุ่นรถ', width: 120 },
    { idx: 8, key: 'vin_no', title: 'เลขตัวถัง', width: 150 },
    { idx: 9, key: 'payment_type', title: 'ประกันภัย / เงินสด', width: 140 },
    { idx: 10, key: 'customer_name', title: 'ชื่อลูกค้า', width: 140 },
    { idx: 11, key: 'phone_number', title: 'เบอร์โทร', width: 115 },
    { idx: 12, key: 'damage_level', title: 'ระดับความเสียหาย', width: 120 },
    { idx: 13, key: 'main_part_name', title: 'ชิ้นส่วนอะไหล่ (หลัก)', width: 240 },
    { idx: 14, key: 'main_part_qty', title: 'จำนวนอะไหล่ (หลัก)', width: 130 },
    { idx: 15, key: 'sub_part_name', title: 'ชิ้นส่วนอะไหล่ (รอง)', width: 240 },
    { idx: 16, key: 'sub_part_qty', title: 'จำนวนอะไหล่ (รอง)', width: 130 },
    { idx: 17, key: 'cost_labor', title: 'ค่าแรง', width: 85 },
    { idx: 18, key: 'cost_part', title: 'ค่าอะไหล่', width: 85 },
    { idx: 19, key: 'cost_external', title: 'งานนอก', width: 85 },
    { idx: 20, key: 'target_finish_date', title: 'กำหนดซ่อมเสร็จ', width: 150 },
    { idx: 21, key: 'repair_finish_date', title: 'วันที่เสร็จจริง', width: 120 },
    { idx: 22, key: 'delivery_date', title: 'วันที่ส่งมอบ', width: 150 },
    { idx: 23, key: 'notes', title: 'หมายเหตุ', width: 180 },
    { idx: 24, key: 'job_status', title: 'สถานะงาน', width: 140 },
    { idx: 38, key: 'calculated_station', title: 'ความคืบหน้าสถานีซ่อม', width: 160 },
    { idx: 25, key: 'part_status', title: 'สถานะอะไหล่', width: 120 },
    { idx: 26, key: 'epc_no', title: 'EPC No.', width: 115 },
    { idx: 27, key: 'ordered_part_names', title: 'รายการอะไหล่ที่สั่ง', width: 240 },
    { idx: 28, key: 'order_part_date', title: 'วันที่สั่งอะไหล่', width: 115 },
    { idx: 29, key: 'est_part_date', title: 'วันที่คาดการณ์อะไหล่เข้า', width: 140 },
    { idx: 30, key: 'part_received_all_date', title: 'วันที่อะไหล่เข้าครบแล้ว', width: 140 },
    { idx: 31, key: 'billing_date', title: 'วันที่ออกบิล', width: 115 },
    { idx: 32, key: 'qt_no', title: 'เลขที่ใบเสนอราคา', width: 130 },
    { idx: 33, key: 'so_no', title: 'เลขที่ใบสั่งซ่อม', width: 120 },
    { idx: 34, key: 'ivn_no', title: 'เลข IVN.', width: 115 },
    { idx: 35, key: 'sa_owner', title: 'SA ที่รับผิดชอบ', width: 115 }
];

const defaultVisibleKeys = [
    'action', 'contact_date', 'arrived_date', 'car_plate', 'car_brand', 'car_model', 
    'customer_name', 'damage_level', 'target_finish_date', 'repair_finish_date', 'delivery_date', 'job_status', 'calculated_station', 'sa_owner'
];

let hiddenCols = new Set(columnsDef.filter(c => !defaultVisibleKeys.includes(c.key)).map(c => c.idx));

// ==========================================
// 🛠️ Utility Functions
// ==========================================

function isTrue(val) { 
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase(); return strVal === "TRUE" || strVal === "1" || val === true || val === 1; 
}

function computeHighestStationIFS(j) {
    if(isTrue(j.station_ready)) return "12.รอส่งมอบ"; if(isTrue(j.station_pak)) return "11.พักซ่อม"; if(isTrue(j.station_film)) return "10.ฟิล์ม";
    if(isTrue(j.station_kraj)) return "09.กระจก"; if(isTrue(j.station_mag)) return "08.แม็ก"; if(isTrue(j.station_qc)) return "07.QC";
    if(isTrue(j.station_kat)) return "06.ขัดสี"; if(isTrue(j.station_prak)) return "05.ประกอบ"; if(isTrue(j.station_pon)) return "04.พ่นสี";
    if(isTrue(j.station_puan)) return "03.เตรียมพื้น"; if(isTrue(j.station_pou)) return "02.โป๊ว"; if(isTrue(j.station_kho)) return "01.เคาะ";
    return "ส่งจ๊อบ"; 
}

function getSAsForCurrentBranch() {
    if (!allEmployees || allEmployees.length === 0) return [];
    return [...new Set(allEmployees.filter(e => {
        const isSameBranch = e.branch_name === userBranch;
        const role = (e.employee_role || '').toUpperCase();
        const isSA = role === 'SA' || role.includes('SERVICE ADVISOR') || role.includes('SERVICE');
        return isSameBranch && isSA;
    }).map(e => e.employee_name).filter(Boolean))].sort();
}

function formatToThaiDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    toast.className = `fixed bottom-5 right-5 font-bold px-5 py-2.5 rounded shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-emerald-600')} text-white text-xs`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${type==='error'?'fa-circle-xmark':(type==='info'?'fa-info-circle':'fa-circle-check')} text-base"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

// ==========================================
// 🚀 Lifecycle & API Load
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    userRole = sessionStorage.getItem('emp_role'); userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name');
    document.getElementById('display_branch').innerText = userBranch;

    await loadUserColumnPreferences();
    if(typeof initColumns === 'function') initColumns(); // จาก jobs_table_ui.js
    loadJobsData();

    const searchPlate = sessionStorage.getItem('search_plate');
    if(searchPlate) {
        document.getElementById('search_input').value = searchPlate;
        sessionStorage.removeItem('search_plate');
    }

    document.addEventListener('click', (e) => {
        const modal = document.getElementById('excelFilterModal');
        if (modal && !modal.contains(e.target) && !e.target.closest('.filter-icon') && !modal.classList.contains('hidden')) {
            if(typeof closeExcelFilter === 'function') closeExcelFilter();
        }
    });
});

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

async function loadUserColumnPreferences() {
    const empName = sessionStorage.getItem('emp_name'); if (!empName) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/user-preferences/${encodeURIComponent(empName)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.hidden_columns && typeof data.hidden_columns === 'object') {
                if (data.hidden_columns.hidden) hiddenCols = new Set(data.hidden_columns.hidden);
                if (data.hidden_columns.order && Array.isArray(data.hidden_columns.order)) {
                    const colMap = new Map(); columnsDef.forEach(c => colMap.set(c.key, c));
                    let newCols = [];
                    data.hidden_columns.order.forEach(k => { if(colMap.has(k)) { newCols.push(colMap.get(k)); colMap.delete(k); } });
                    colMap.forEach(c => newCols.push(c));
                    columnsDef.length = 0; columnsDef.push(...newCols);
                }
            }
        }
    } catch (err) {}
}

async function saveUserPreferences() {
    const empName = sessionStorage.getItem('emp_name'); if (!empName) return;
    try {
        await fetch(`${API_BASE_URL}/api/user-preferences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp_name: empName, hidden_columns: { hidden: Array.from(hiddenCols), order: columnsDef.map(c => c.key) } }) });
    } catch (err) {}
}

function getActiveJobsData() {
    return allJobsData.filter(job => {
        const st = job.job_status || '';
        if (excludedStatuses.some(ex => st.includes(ex) || st.startsWith(ex.substring(0, 2)))) return false;
        if (job.billing_date || job.department_routing === 'บัญชี') return false;
        return true;
    });
}

async function loadJobsData() {
    document.getElementById('jobs_table_body').innerHTML = `<tr><td colspan="40" class="text-center py-20 text-slate-400 font-bold bg-white"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-green-800"></i><br>กำลังโหลดข้อมูล...</td></tr>`;
    try {
        const results = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/statuses`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/part-orders`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/body-parts`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/reports`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/customer-types`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/insurances`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/employees`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/car-models`).then(res => res.json())
        ]);

        if (results[0].status === 'fulfilled') {
            globalStatuses = results[0].value;
            globalStatusOptionsHtml = globalStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }
        if (results[1].status === 'fulfilled') allPartOrders = results[1].value;
        if (results[2].status === 'fulfilled') allMasterParts = results[2].value;
        if (results[4].status === 'fulfilled') allCustomerTypes = results[4].value;
        if (results[5].status === 'fulfilled') allInsurances = results[5].value;
        if (results[6].status === 'fulfilled') allEmployees = results[6].value;
        if (results[7].status === 'fulfilled') allCarModels = results[7].value;

        if (results[3].status === 'fulfilled') {
            const data = results[3].value;
            let tempJobs = (['BA','Manager','Admin','แอดมิน'].includes(userRole)) ? data : data.filter(d => d.branch_name === userBranch);
            allJobsData = tempJobs.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
        }
        
        const dlBrands = document.getElementById('dl_car_brands');
        if(dlBrands) {
            const uniqueBrands = [...new Set(allCarModels.map(c => c.car_brand).filter(Boolean))].sort();
            dlBrands.innerHTML = uniqueBrands.map(b => `<option value="${b}">`).join('');
        }

        const dlModels = document.getElementById('dl_car_models');
        if(dlModels) {
            const uniqueModels = [...new Set(allCarModels.map(c => c.car_model).filter(Boolean))].sort();
            dlModels.innerHTML = uniqueModels.map(m => `<option value="${m}">`).join('');
        }

        if(typeof initColumns === 'function') initColumns(); 
        if(typeof buildBranchDropdown === 'function') buildBranchDropdown(); 
        if(typeof buildSADropdown === 'function') buildSADropdown(); 
        if(typeof applyFilters === 'function') applyFilters(); 
    } catch (error) {
        document.getElementById('jobs_table_body').innerHTML = `<tr><td colspan="40" class="text-center py-20 text-red-600 font-bold bg-white"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><br>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

// ==========================================
// ✏️ Data Updaters (API PUT/DELETE)
// ==========================================

function goToEditJob(jobId) { sessionStorage.setItem('edit_job_id', jobId); window.location.href = 'index.html'; }

async function autoMapRouting(jobId, newStatus) {
    const mapping = globalStatuses.find(s => s.status_name === newStatus);
    if(mapping && mapping.department) {
        const newDept = mapping.department;
        const row = document.getElementById(`row_${jobId}`);
        if(row) {
            const routingSelect = row.querySelector('.routing-select');
            if(routingSelect) routingSelect.value = newDept;
        }
        await fastUpdateJob(jobId, 'department_routing', newDept, true);
    }
}

async function fastUpdateStationDropdown(id, selectedLevel) {
    const job = allJobsData.find(j => String(j.id) === String(id));
    if (!job) return;
    const selectedIdx = stationLevels.indexOf(selectedLevel);
    
    const payload = {
        station_kho: selectedIdx >= 1, station_pou: selectedIdx >= 2, station_puan: selectedIdx >= 3,
        station_pon: selectedIdx >= 4, station_prak: selectedIdx >= 5, station_kat: selectedIdx >= 6,
        station_qc: selectedIdx >= 7, station_mag: selectedIdx >= 8, station_kraj: selectedIdx >= 9,
        station_film: selectedIdx >= 10, station_pak: selectedIdx >= 11, station_ready: selectedIdx >= 12
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${id}/station`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        if(res.ok) {
            showToast('อัปเดตความคืบหน้าสถานีเรียบร้อย!');
            Object.assign(job, payload);
            job.calculated_station = computeHighestStationIFS(job);
            if(typeof applyFilters === 'function') applyFilters();
        } else throw new Error();
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); }
}

async function fastUpdateJob(jobId, field, value, silent = false) {
    let formattedValue = value;
    if (field.includes('date') || ['repair_finish_date', 'target_finish_date', 'delivery_date', 'contact_date', 'arrived_date'].includes(field)) {
        if (value === '' || value === undefined || value === null) formattedValue = null;
        else formattedValue = String(value).split('T')[0];
    }

    const job = allJobsData.find(j => String(j.id) === String(jobId));
    if (!job) return;

    if (formattedValue && (field === 'arrived_date' || field === 'target_finish_date' || field === 'delivery_date')) {
        const reqCount = { 
            main: parseInt(job.main_part_qty) || 0, 
            sub: parseInt(job.sub_part_qty) || 0 
        };
        
        if (!silent) showToast('กำลังตรวจสอบโควต้า...', 'info');
        if(typeof checkQuotaForInlineEdit === 'function') {
            const quotaCheck = await checkQuotaForInlineEdit(jobId, job.branch_name, formattedValue, field, reqCount);
            if (quotaCheck !== true) {
                alert('❌ ไม่สามารถอัปเดตได้:\n\n' + quotaCheck);
                if(typeof applyFilters === 'function') applyFilters(); 
                return;
            }
        }
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${jobId}/fast-date`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: field, value: formattedValue })
        });

        if (res.ok) {
            const jobIndex = allJobsData.findIndex(j => String(j.id) === String(jobId));
            if (jobIndex > -1) allJobsData[jobIndex][field] = formattedValue;
            
            if(!silent) showToast('บันทึกข้อมูลเรียบร้อย!');
            if(field === 'job_status') await autoMapRouting(jobId, value);
            if(!silent && typeof applyFilters === 'function') applyFilters();
        } else throw new Error('บันทึกไม่สำเร็จ');
    } catch (err) {
        if(!silent) showToast('บันทึกไม่สำเร็จ!', 'error'); 
    }
}

async function deleteJobRow(jobId, carPlate) {
    if (!confirm(`🚨 ยืนยันการลบใบงานรถทะเบียน [ ${carPlate} ] ?\n(ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร)`)) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${jobId}`, { method: 'DELETE' });
        
        if (res.ok) { 
            allJobsData = allJobsData.filter(j => String(j.id) !== String(jobId));
            const rowToRemove = document.getElementById(`row_${jobId}`);
            if (rowToRemove) rowToRemove.remove();
            const currentRowCount = document.querySelectorAll('#jobs_table_body tr[id^="row_"]').length;
            document.getElementById('row_count').innerText = currentRowCount;
            showToast(`✅ ลบรายการทะเบียน ${carPlate} สำเร็จ`);
        } else {
            const errData = await res.json();
            showToast('ไม่สามารถลบได้: ' + (errData.error || 'Unknown Error'), 'error'); 
        }
    } catch (e) { 
        showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error'); 
    }
}