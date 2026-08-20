// ==========================================
// ⚙️ RIZENIC - Parts Core System (parts_core.js)
// ==========================================

const API_BASE_URL = window.location.origin;
let allReports = []; 
let allPartOrders = [];
let allMasterPartsCache = []; 
let userRole = '';
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
    const nocache = `?_t=${new Date().getTime()}`;
    const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);

    try {
        // 1. ดึงข้อมูลใบงานหลัก (Reports)
        try {
            const resRep = await fetch(`${API_BASE_URL}/api/reports${nocache}`);
            if(resRep.ok) {
                const dataRep = await resRep.json();
                allReports = Array.isArray(dataRep) ? dataRep : [];
                if (!isManager) allReports = allReports.filter(d => d.branch_name === userBranch);
            }
        } catch(e) {}

        // 2. ดึงรายการสั่งซื้ออะไหล่ (Part Orders)
        try {
            const resPO = await fetch(`${API_BASE_URL}/api/part-orders${nocache}`);
            if(resPO.ok) {
                const dataPO = await resPO.json();
                allPartOrders = Array.isArray(dataPO) ? dataPO : [];
                if (!isManager) allPartOrders = allPartOrders.filter(d => d.branch_name === userBranch);
            }
        } catch(e) {}

        // 3. ดึงมาสเตอร์อะไหล่ (Master Parts)
        try {
            const resMaster = await fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(userBranch)}&_t=${new Date().getTime()}`);
            if(resMaster.ok) {
                const dataMaster = await resMaster.json();
                allMasterPartsCache = Array.isArray(dataMaster) ? dataMaster : [];
            }
        } catch(e) {}

        // เรนเดอร์เฉพาะ 2 ส่วนหลัก
        if (typeof renderSAAlerts === "function") renderSAAlerts();
        if (typeof renderMasterTable === "function") renderMasterTable();

    } catch (e) { console.error("Data load error:", e); }
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