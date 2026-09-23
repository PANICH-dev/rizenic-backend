// ==========================================
// ⚙️ RIZENIC - Parts Core System (parts_core.js)
// ==========================================

const API_BASE_URL = window.location.origin;
let allReports = []; 
let allPartOrders = [];
let allMasterPartsCache = []; 
let partOrdersByJobKey = new Map();
let userRole = '';

function rebuildPartOrderIndexes() {
    const next = new Map();
    allPartOrders.forEach(order => {
        const keys = new Set();
        if (order && order.report_id != null && String(order.report_id) !== '') keys.add(String(order.report_id));
        if (order && order.job_id != null && String(order.job_id) !== '') keys.add(String(order.job_id));
        keys.forEach(key => {
            if (!next.has(key)) next.set(key, []);
            next.get(key).push(order);
        });
    });
    partOrdersByJobKey = next;
}

function getPartOrdersForJob(jobId) {
    if (jobId == null || String(jobId) === '') return [];
    return partOrdersByJobKey.get(String(jobId)) || [];
}

let userBranch = '';

let currentFilterCol = -1;
let activeFilters = {};

// ================== ระบบ Toast & Helpers ==================
function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    const content = document.getElementById('toastContent');
    if (!toast || !content) return;
    
    if (type === 'error') {
        toast.className = 'fixed bottom-5 right-5 bg-red-600 text-white font-bold px-6 py-3 rounded-xl shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-red-500';
        content.innerHTML = `<i class="fa-solid fa-circle-xmark text-xl"></i> ${msg}`;
    } else if (type === 'info') {
        toast.className = 'fixed bottom-5 right-5 bg-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-blue-500';
        content.innerHTML = `<i class="fa-solid fa-circle-info text-xl text-amber-400"></i> ${msg}`;
    } else {
        toast.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-emerald-500';
        content.innerHTML = `<i class="fa-solid fa-circle-check text-xl text-amber-400"></i> ${msg}`;
    }
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 2500);
}

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) {
        if(input.tagName === 'SELECT') return input.options[input.selectedIndex].text.trim();
        if(input.type === 'checkbox') return input.checked ? '1' : '0';
        return input.value.trim();
    }
    return cell.innerText.trim();
}

// ================== ระบบ Login & Initial Load ==================
document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        return;
    }
    enterApp();
});

function enterApp() {
    const allowedPages = (sessionStorage.getItem('accessible_pages') || '').split(',');
    if (!allowedPages.includes('parts')) { 
        alert('⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าแผนกอะไหล่ครับ!');
        window.location.href = allowedPages.length > 0 ? allowedPages[0] + '.html' : 'index.html';
        return; 
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('main-app').classList.add('flex');
    
    userRole = sessionStorage.getItem('emp_role') || '';
    userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'Parts Admin';
    document.getElementById('display_branch').innerText = userBranch;

    loadAllData();
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

function switchTab(tabId) {
    document.querySelectorAll('.parts-tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.overflow-x-auto button').forEach(btn => {
        btn.classList.remove('border-[#00320D]', 'text-[#00320D]', 'bg-green-50/80', 'bg-slate-200');
        btn.classList.add('border-transparent', 'text-slate-500');
    });
    
    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-slate-500');
        activeBtn.classList.add('border-[#00320D]', 'text-[#00320D]');
        
        if(tabId === 'tab-alert') activeBtn.classList.add('bg-green-50/80');
        if(tabId === 'tab-master') activeBtn.classList.add('bg-slate-200');
    }

    clearAllFilters();
}

// 🌟 โหลดเฉพาะ Reports, POs และ Master
async function loadAllData() {
    const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);
    const reportParams = new URLSearchParams({ _t: String(Date.now()) });
    const orderParams = new URLSearchParams({ _t: String(Date.now()) });
    if (!isManager) {
        reportParams.set('branch', userBranch);
        orderParams.set('branch', userBranch);
    }

    try {
        // Master table and SA Alerts are independent views. Start both immediately,
        // and paint whichever becomes usable first instead of waiting for all 3 APIs.
        const masterPromise = fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(userBranch)}&_t=${Date.now()}`)
            .then(async res => res.ok ? res.json() : null)
            .then(data => {
                if (Array.isArray(data)) allMasterPartsCache = data;
                if (typeof renderMasterTable === 'function') renderMasterTable();
            });

        const alertsPromise = Promise.allSettled([
            fetch(`${API_BASE_URL}/api/reports?${reportParams.toString()}`).then(async res => res.ok ? res.json() : null),
            fetch(`${API_BASE_URL}/api/part-orders?${orderParams.toString()}`).then(async res => res.ok ? res.json() : null)
        ]).then(([reportsResult, ordersResult]) => {
            if (reportsResult.status === 'fulfilled' && Array.isArray(reportsResult.value)) {
                allReports = reportsResult.value;
                if (!isManager) allReports = allReports.filter(d => d.branch_name === userBranch);
            }

            if (ordersResult.status === 'fulfilled' && Array.isArray(ordersResult.value)) {
                allPartOrders = ordersResult.value;
                if (!isManager) allPartOrders = allPartOrders.filter(d => d.branch_name === userBranch);
            }
            rebuildPartOrderIndexes();
            if (typeof renderSAAlerts === 'function') renderSAAlerts();
        });

        await Promise.allSettled([masterPromise, alertsPromise]);
    } catch (e) { console.error('Data load error:', e); }
}

function filterTableByText(tbodyId, txt) {
    const text = txt.toLowerCase();
    const rows = document.getElementById(tbodyId).querySelectorAll('tr');
    rows.forEach(tr => {
        if(tr.cells.length <= 1) return;
        const rowText = tr.innerText.toLowerCase();
        tr.style.display = rowText.includes(text) ? '' : 'none';
    });
}