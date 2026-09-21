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
    document.getElementById('report_start_date').value = getFirstDayOfMonth();
    document.getElementById('report_end_date').value = getLastDayOfMonth();

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
        allJobs = await resJobs.json();
        
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

function applyFilters() {
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

    /// เรียก renders ทั้งหมด
    renderKPIs(startDate, endDate);
    renderDailyReport(); 
    renderDailyLineChart(startDate, endDate); // <--- กราฟเส้นใหม่
    renderStatusChart();
    renderInsuranceChart();
    renderDamageChart(startDate, endDate);    // <--- Damage Level ใหม่
    renderPaymentChart(startDate, endDate);   // <--- อัปเดต Payment ให้กรองปฏิทิน
    renderPartsStatusChart();                 // <--- กราฟโดนัทอะไหล่
    renderMechanicChart();                    // <--- กราฟโดนัทสถานะช่าง
    renderFinanceChart(startDate, endDate);
    renderSASection();
    renderStationSection();
    renderPartsTracking();
    renderStationTable(); 
    renderParkedCars();
    renderCalendarByRange(startDate, endDate);
}