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

function isPartsPrivilegedUser() {
    return ['BA','Manager','Admin','แอดมิน'].includes(userRole);
}

function getPartsScopeQuery() {
    return (!isPartsPrivilegedUser() && userBranch)
        ? `?branch=${encodeURIComponent(userBranch)}`
        : '';
}

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
    const scopeBase = getPartsScopeQuery();
    const cacheKey = `_t=${new Date().getTime()}`;
    const scopeQuery = scopeBase ? `${scopeBase}&${cacheKey}` : `?${cacheKey}`;

    try {
        // Reports, POs and master parts are independent reads. Start them together
        // so page startup time is the slowest request, not the sum of three waits.
        const results = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/reports${scopeQuery}`).then(async res => res.ok ? res.json() : []),
            fetch(`${API_BASE_URL}/api/part-orders${scopeQuery}`).then(async res => res.ok ? res.json() : []),
            fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(userBranch)}&${cacheKey}`).then(async res => res.ok ? res.json() : [])
        ]);

        if (results[0].status === 'fulfilled') {
            allReports = Array.isArray(results[0].value) ? results[0].value : [];
            if (!isPartsPrivilegedUser()) allReports = allReports.filter(d => d.branch_name === userBranch);
        }
        if (results[1].status === 'fulfilled') {
            allPartOrders = Array.isArray(results[1].value) ? results[1].value : [];
            if (!isPartsPrivilegedUser()) allPartOrders = allPartOrders.filter(d => d.branch_name === userBranch);
        }
        if (results[2].status === 'fulfilled') {
            allMasterPartsCache = Array.isArray(results[2].value) ? results[2].value : [];
        }

        // Render exactly the same two primary surfaces after their startup data resolves.
        if (typeof renderSAAlerts === "function") renderSAAlerts();
        if (typeof renderMasterTable === "function") renderMasterTable();
    } catch (e) {
        console.error("Data load error:", e);
    }
}

function filterTableByText(tbodyId, txt) {
    const text = String(txt || '').trim().toLowerCase();
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(tr => {
        if(tr.cells.length <= 1) return;
        if (!text) {
            tr.style.display = '';
            return;
        }
        const rowText = tr.innerText.toLowerCase();
        tr.style.display = rowText.includes(text) ? '' : 'none';
    });
    window.dispatchEvent(new Event('ui:refresh-pagination'));
}