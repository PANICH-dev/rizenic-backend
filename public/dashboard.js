// =====================================
// 1. GLOBAL VARIABLES & CORE SETUP
// =====================================
const API_BASE_URL = window.location.origin;
let allJobs = []; 
let filteredJobs = []; 
let allPartOrders = [];
let filteredPartOrders = [];
let allStatuses = [];
let allQuotas = []; 
let globalStatusOptionsHtml = ''; 

let statusChartInstance = null;
let insuranceChartInstance = null;
let financeChartInstance = null;
let paymentChartInstance = null; 
let dailyLineChartInstance = null;
let damageChartInstance = null;
let partsStatusChartInstance = null;
let mechanicChartInstance = null;

let userRole = '';
let userBranch = '';

const activeProcessStatuses = [
    '01.ติดต่อสอบถาม', '02.รอเสนอประกัน', '03.รอประกันอนุมัติ', 
    '04.รอลูกค้าอนุมัติ', '05.อนุมัติแล้ว', '06.สั่งอะไหล่', 
    '07.รอนัดหมายเข้าซ่อม', '08.นัดหมายแล้วรอเข้าซ่อม', '09.จอดรอเข้าซ่อม', 
    '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ'
];

const stationLevels = ["ส่งจ๊อบ", "01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "07.QC", "08.แม็ก", "09.กระจก", "10.ฟิล์ม", "11.พักซ่อม", "12.รอส่งมอบ"];

// =====================================
// 2. HELPER FUNCTIONS
// =====================================
function isTrue(val) {
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase();
    return strVal === 'TRUE' || strVal === '1' || val === true || val === 1;
}

function getFirstDayOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function getLastDayOfMonth() {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
}

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

function isDateInRange(dateStr, start, end) {
    if(!dateStr || String(dateStr).trim() === '') return false;
    const dStr = dateStr.split('T')[0];
    if(start && dStr < start) return false;
    if(end && dStr > end) return false;
    return true;
}

function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

function goToEditJob(jobId) { 
    sessionStorage.setItem('edit_job_id', jobId); 
    window.location.href = 'index.html'; 
}

function logout() { 
    sessionStorage.clear(); 
    window.location.href = 'index.html'; 
}

async function fastUpdateJob(jobId, field, value) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${jobId}/fast-date`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ field, value })
        });
        if (res.ok) {
            const jobIndex = allJobs.findIndex(j => j.id === jobId);
            if(jobIndex > -1) allJobs[jobIndex][field] = value;
            applyFilters(); 
        } else throw new Error();
    } catch (err) { 
        alert('บันทึกข้อมูลไม่สำเร็จ'); 
        fetchDashboardData(); 
    }
}

function computeHighestStationIFS(j) {
    if(isTrue(j.station_ready)) return "12.รอส่งมอบ";
    if(isTrue(j.station_pak)) return "11.พักซ่อม";
    if(isTrue(j.station_film)) return "10.ฟิล์ม";
    if(isTrue(j.station_kraj)) return "09.กระจก";
    if(isTrue(j.station_mag)) return "08.แม็ก";
    if(isTrue(j.station_qc)) return "07.QC";
    if(isTrue(j.station_kat)) return "06.ขัดสี";
    if(isTrue(j.station_prak)) return "05.ประกอบ";
    if(isTrue(j.station_pon)) return "04.พ่นสี";
    if(isTrue(j.station_puan)) return "03.เตรียมพื้น";
    if(isTrue(j.station_pou)) return "02.โป๊ว";
    if(isTrue(j.station_kho)) return "01.เคาะ";
    return "ส่งจ๊อบ"; 
}

// =====================================
// 3. INIT & DATA FETCHING
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html'; return;
    }
    
    userRole = sessionStorage.getItem('emp_role') || '';
    userBranch = sessionStorage.getItem('branch_name') || sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

    const rStr = String(userRole).toLowerCase();
    const navAdmin = document.getElementById('nav_admin');
    
    if (navAdmin) {
        if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
            navAdmin.classList.remove('hidden');
        } else {
            navAdmin.classList.add('hidden');
        }
    }

    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'ไม่ระบุชื่อ';
    document.getElementById('display_branch').innerText = userBranch;
    
    const today = new Date();
    document.getElementById('current_date_display').innerText = today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    
    document.getElementById('dash_start_date').value = getFirstDayOfMonth();
    document.getElementById('dash_end_date').value = getLastDayOfMonth();
    if(document.getElementById('report_start_date')) document.getElementById('report_start_date').value = getFirstDayOfMonth();
    if(document.getElementById('report_end_date')) document.getElementById('report_end_date').value = getLastDayOfMonth();

    setupBranchDropdown();
    fetchDashboardData();
});

function setupBranchDropdown() {
    const filterSelect = document.getElementById('branchFilter');
    if (!filterSelect) return;
    
    const rStr = String(userRole).toLowerCase();
    if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
        filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>`;
        filterSelect.disabled = false;
    } else {
        filterSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`;
        filterSelect.disabled = true;
    }
}

async function fetchDashboardData() {
    try {
        const resJobs = await fetch(`${API_BASE_URL}/api/reports`);
        const rawJobs = await resJobs.json();
        
        // คำนวณสถานีอัตโนมัติรอไว้เลย
        allJobs = rawJobs.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
        
        const resParts = await fetch(`${API_BASE_URL}/api/part-orders`).catch(() => null);
        if(resParts && resParts.ok) { allPartOrders = await resParts.json(); }

        const statRes = await fetch(`${API_BASE_URL}/api/statuses`).catch(() => null);
        if(statRes && statRes.ok) { 
            allStatuses = await statRes.json(); 
            globalStatusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }

        const resQuotas = await fetch(`${API_BASE_URL}/api/quotas`).catch(() => null);
        if(resQuotas && resQuotas.ok) { allQuotas = await resQuotas.json(); }

        const rStr = String(userRole).toLowerCase();
        if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
            const uniqueBranches = [...new Set(allJobs.map(j => j.branch_name).filter(b => b))];
            const filterSelect = document.getElementById('branchFilter');
            const savedVal = filterSelect.value;
            filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>`;
            uniqueBranches.forEach(b => filterSelect.innerHTML += `<option value="${b}">${b}</option>`);
            if(uniqueBranches.includes(savedVal)) filterSelect.value = savedVal;
        }

        applyFilters(); 
    } catch (err) { 
        console.error("โหลดข้อมูลแดชบอร์ดพัง:", err); 
    }
}

ffunction applyFilters() {
    const filterSelect = document.getElementById('branchFilter');
    const selectedBranch = filterSelect ? filterSelect.value : 'all';
    
    const startDate = document.getElementById('dash_start_date').value;
    const endDate = document.getElementById('dash_end_date').value;
    
    const chartBranchLabel = document.getElementById('chartBranchLabel');
    if (chartBranchLabel) {
        chartBranchLabel.innerText = selectedBranch === 'all' ? 'ทุกสาขา' : selectedBranch;
    }

    if (selectedBranch === 'all') {
        filteredJobs = [...allJobs];
        filteredPartOrders = [...allPartOrders];
    } else {
        filteredJobs = allJobs.filter(j => j.branch_name === selectedBranch);
        filteredPartOrders = allPartOrders.filter(o => o.branch_name === selectedBranch);
    }

    // 🌟 ปลดคอมเมนต์ออกทั้งหมด เพื่อให้กราฟและข้อมูลทุกส่วนถูกวาดลงหน้าจอ 🌟
    if(typeof renderERPStatuses === 'function') renderERPStatuses(filteredJobs);
    if(typeof renderStationSummary === 'function') renderStationSummary(filteredJobs);
    if(typeof renderPartsTracking === 'function') renderPartsTracking(filteredPartOrders);

    if(typeof renderKPIs === 'function') renderKPIs(startDate, endDate);
    if(typeof renderDailyReport === 'function') renderDailyReport(); 
    if(typeof renderDailyLineChart === 'function') renderDailyLineChart(startDate, endDate); 
    if(typeof renderStatusChart === 'function') renderStatusChart();
    if(typeof renderInsuranceChart === 'function') renderInsuranceChart();
    if(typeof renderDamageChart === 'function') renderDamageChart(startDate, endDate);   
    if(typeof renderPaymentChart === 'function') renderPaymentChart(startDate, endDate);   
    if(typeof renderPartsStatusChart === 'function') renderPartsStatusChart();                 
    if(typeof renderMechanicChart === 'function') renderMechanicChart();                    
    if(typeof renderFinanceChart === 'function') renderFinanceChart(startDate, endDate);
    
    // สำหรับส่วนตารางและปฏิทิน (จากไฟล์ dashboard_tables.js)
    if(typeof renderSASection === 'function') renderSASection();
    if(typeof renderStationTable === 'function') renderStationTable(); 
    if(typeof renderParkedCars === 'function') renderParkedCars();
    if(typeof renderCalendarByRange === 'function') renderCalendarByRange(startDate, endDate);
}

// =====================================
// 🚀 4. NEW REQUESTED FEATURES (Dashboard)
// =====================================

// 🎯 1. ปริมาณรถจำแนกตามสถานะ (ERP) แบบ Responsive
function renderERPStatuses(jobs) {
    const statusCounts = {};
    
    jobs.forEach(job => {
        const st = job.job_status || "ไม่ระบุสถานะ";
        // ละเว้นสถานะที่ยกเลิกหรือปิดบิลไปแล้วถ้าต้องการ
        const excluded = ['14.ชำระเงินสด', '18.ลูกค้ายกเลิก', '19.ออกบิลแล้ว'];
        if (!excluded.some(ex => st.includes(ex))) {
            statusCounts[st] = (statusCounts[st] || 0) + 1;
        }
    });

    const grid = document.getElementById('erp_status_grid');
    if(!grid) return; // ถ้าหน้า HTML ไม่มีกล่องนี้ให้ข้ามไป

    const sortedStatuses = Object.keys(statusCounts).sort();

    if(sortedStatuses.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-6">ไม่มีงานค้าง</div>`;
        return;
    }

    grid.innerHTML = sortedStatuses.map(st => {
        // ตัดตัวเลขนำหน้าออกให้ดูคลีนขึ้นบนหน้าจอมือถือ (เช่น 01.ติดต่อสอบถาม -> ติดต่อสอบถาม)
        const cleanStatus = st.replace(/^[0-9.]+\s*/, '');
        
        return `
        <div class="bg-white border border-slate-200 shadow-sm rounded-lg p-3 flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition cursor-pointer">
            <span class="text-[10px] sm:text-xs font-bold text-slate-600 truncate mb-2" title="${st}">
                ${cleanStatus}
            </span>
            <div class="flex justify-between items-end">
                <i class="fa-solid fa-car-side text-slate-300 text-lg"></i>
                <span class="text-xl sm:text-2xl font-black text-blue-700 leading-none">${statusCounts[st]}</span>
            </div>
        </div>
        `;
    }).join('');
}


// 🎯 2. ปริมาณงานแยกสถานีช่าง (เอาเฉพาะคันที่กำลังซ่อม)
function renderStationSummary(jobs) {
    // กรองเฉพาะสถานะที่มีคำว่ากำลังซ่อม
    const repairingJobs = jobs.filter(job => (job.job_status || '').includes('กำลังซ่อม'));

    const stationCounts = {
        '01.เคาะ': 0, '02.โป๊ว': 0, '03.เตรียมพื้น': 0, '04.พ่นสี': 0, 
        '05.ประกอบ': 0, '06.ขัดสี': 0, '07.QC': 0, '08.แม็ก': 0, 
        '09.กระจก': 0, '10.ฟิล์ม': 0, '11.พักซ่อม': 0, '12.รอส่งมอบ': 0
    };

    repairingJobs.forEach(job => {
        const st = job.calculated_station || '';
        if (stationCounts[st] !== undefined) stationCounts[st]++;
    });

    // สมมติว่ามี Element รอรับตัวเลขอยู่แล้ว เช่น <span id="stat_01"></span>
    // อันนี้คือนำไปใส่ในจุดที่นายต้องการให้แสดงผลครับ
    for (const [station, count] of Object.entries(stationCounts)) {
        // ดึงแค่ตัวเลข เช่น '01' ไปเชื่อมกับ ID 'stat_01'
        const prefix = station.substring(0, 2); 
        const el = document.getElementById(`stat_${prefix}`);
        if(el) {
            el.innerText = count;
            // ใส่สีแดงถ้างานล้นสถานี
            if(count >= 10) el.classList.add('text-red-500', 'animate-pulse');
            else el.classList.remove('text-red-500', 'animate-pulse');
        }
    }
}


// 🎯 3. แจ้งเตือนใบสั่งอะไหล่ (จัดกลุ่ม 2 หมวด)
function renderPartsTracking(partOrders) {
    let poReadyCount = 0;   // มีของ/ครบ + มีสต๊อค
    let poWaitingCount = 0; // รอสั่ง + ติด Back Order + สั่งแล้วรอเข้า

    partOrders.forEach(po => {
        const st = po.order_status || '';
        if (st === 'ยกเลิก') return; // ข้ามของยกเลิก

        // กลุ่ม 1: มีของพร้อมลุย
        if (st.includes('ครบ') || st.includes('มีของ') || st.includes('สต๊อค')) {
            poReadyCount++;
        } 
        // กลุ่ม 2: กำลังรอ/สั่งอยู่
        else if (st.includes('รอ') || st.includes('สั่ง') || st.includes('Back Order')) {
            poWaitingCount++;
        }
    });

    const elReady = document.getElementById('dash_po_ready');
    const elWaiting = document.getElementById('dash_po_waiting');

    if(elReady) elReady.innerText = poReadyCount;
    if(elWaiting) {
        elWaiting.innerText = poWaitingCount;
        if(poWaitingCount > 0) {
            elWaiting.classList.add('text-rose-600', 'animate-pulse');
        } else {
            elWaiting.classList.remove('text-rose-600', 'animate-pulse');
            elWaiting.classList.add('text-amber-600');
        }
    }
}