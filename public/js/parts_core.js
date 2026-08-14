// ==========================================
// ⚙️ RIZENIC - Parts Core System (parts_core.js)
// ==========================================



const API_BASE_URL = window.location.origin;
let allPartOrders = [];
let allInbounds = [];
let allOutbounds = [];
let allStock = [];
let allStatuses = [];
let allBodyPartsMaster = [];
let userRole = '';
let userBranch = '';

let allMasterPartsCache = []; 

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

function formatThaiDate(dateStr) {
    if (!dateStr || dateStr === '' || dateStr === '-') return '-';
    const parts = dateStr.split('T')[0].split('-');
    if(parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login_user').value; 
    const pass = document.getElementById('login_pass').value;
    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
        const data = await res.json();
        if (data.success) {
            sessionStorage.setItem('isLoggedIn', 'true'); 
            sessionStorage.setItem('emp_name', data.employee.employee_name);
            sessionStorage.setItem('emp_role', data.employee.employee_role);
            sessionStorage.setItem('emp_branch', data.employee.branch_name || 'สำนักงานใหญ่');
            sessionStorage.setItem('accessible_pages', data.employee.accessible_pages || '');
            window.location.reload();
        } else alert('❌ ' + data.error);
    } catch (err) { alert('❌ ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง'); }
}

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
    
    const todayStr = new Date().toISOString().split('T')[0];
    if(document.getElementById('po_date')) document.getElementById('po_date').value = todayStr;
    if(document.getElementById('edit_in_date')) document.getElementById('edit_in_date').value = todayStr;
    if(document.getElementById('out_date')) document.getElementById('out_date').value = todayStr;

    initResizableColumns('poTable');
    initResizableColumns('inTable');
    initResizableColumns('outTable');
    initResizableColumns('stockTable');
    initResizableColumns('masterTable');

    loadAllData();
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

function switchTab(tabId) {
    document.querySelectorAll('.parts-tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.overflow-x-auto button').forEach(btn => {
        btn.classList.remove('border-[#00320D]', 'text-[#00320D]', 'bg-green-50/80', 'bg-blue-50/80', 'bg-emerald-50/80', 'bg-purple-50/80', 'bg-amber-50/80', 'bg-slate-200');
        btn.classList.add('border-transparent', 'text-slate-500');
    });
    
    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-slate-500');
        activeBtn.classList.add('border-[#00320D]', 'text-[#00320D]');
        
        if(tabId === 'tab-alert') activeBtn.classList.add('bg-green-50/80');
        if(tabId === 'tab-po') activeBtn.classList.add('bg-blue-50/80');
        if(tabId === 'tab-inbound') activeBtn.classList.add('bg-emerald-50/80');
        if(tabId === 'tab-outbound') activeBtn.classList.add('bg-purple-50/80');
        if(tabId === 'tab-stock') activeBtn.classList.add('bg-amber-50/80');
        if(tabId === 'tab-master') activeBtn.classList.add('bg-slate-200');
    }

    clearAllFilters();
}

async function loadAllData() {
    const nocache = `?_t=${new Date().getTime()}`;
    const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);

    try {
        try {
            const resPO = await fetch(`${API_BASE_URL}/api/part-orders${nocache}`);
            if(resPO.ok) {
                const dataPO = await resPO.json();
                allPartOrders = Array.isArray(dataPO) ? dataPO : [];
                if (!isManager) allPartOrders = allPartOrders.filter(d => d.branch_name === userBranch);
            }
        } catch(e) {}

        try {
            const resIn = await fetch(`${API_BASE_URL}/api/part-inbound${nocache}`);
            if(resIn.ok) {
                const dataIn = await resIn.json();
                allInbounds = Array.isArray(dataIn) ? dataIn : [];
                if (!isManager) allInbounds = allInbounds.filter(d => d.branch_name === userBranch);
            }
        } catch(e) {}

        try {
            const resOut = await fetch(`${API_BASE_URL}/api/part-outbound${nocache}`);
            if(resOut.ok) {
                const dataOut = await resOut.json();
                allOutbounds = Array.isArray(dataOut) ? dataOut : [];
                if (!isManager) allOutbounds = allOutbounds.filter(d => d.branch_name === userBranch);
            }
        } catch(e) {}

        try {
            const resStock = await fetch(`${API_BASE_URL}/api/parts-inventory?branch=${encodeURIComponent(userBranch)}&_t=${new Date().getTime()}`);
            if(resStock.ok) {
                const dataStock = await resStock.json();
                allStock = Array.isArray(dataStock) ? dataStock : [];
            }
        } catch(e) {}

        try {
            const resStat = await fetch(`${API_BASE_URL}/api/part-statuses${nocache}`);
            if(resStat.ok) {
                const dataStat = await resStat.json();
                allStatuses = Array.isArray(dataStat) ? dataStat : [];
            }
        } catch(e) {}

        try {
            const resMaster = await fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(userBranch)}&_t=${new Date().getTime()}`);
            if(resMaster.ok) {
                const dataMaster = await resMaster.json();
                allMasterPartsCache = Array.isArray(dataMaster) ? dataMaster : [];
            }
        } catch(e) {}

        // เรนเดอร์ UI จาก parts_ui.js
        if (typeof renderSAAlerts === "function") {
            renderSAAlerts(); renderPOTracking(); renderInbound();
            renderOutbound(); renderStock(); renderMasterTable();
        }

        const poSelect = document.getElementById('po_bo');
        if(poSelect && allStatuses.length > 0) {
            poSelect.innerHTML = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }

    } catch (e) { console.error("Data load error:", e); }
}

async function fastUpdateField(table, id, field, value) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/${table}/${id}/fast`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ field, value: value || null })
        });
        if(res.ok) { 
            showToast('อัปเดตช่องเรียบร้อย!'); 
            if(table === 'part-inbound' && (field === 'qty' || field === 'unit_price')) { loadAllData(); }
        } else throw new Error();
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); loadAllData(); }
}

document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.getAttribute('list') === 'master_parts_datalist') {
        const keyword = e.target.value.trim().toLowerCase();
        const datalist = document.getElementById('master_parts_datalist');
        if(!datalist) return;

        if (keyword.length < 2) { datalist.innerHTML = ''; return; }

        const filteredParts = allMasterPartsCache.filter(p => 
            (p.part_no && p.part_no.toLowerCase().includes(keyword)) || 
            (p.part_name && p.part_name.toLowerCase().includes(keyword))
        ).slice(0, 50);

        datalist.innerHTML = filteredParts.map(p => 
            `<option value="${p.part_no}">${p.part_name} (MAIN: ${p.part_main_no || '-'})</option>`
        ).join('');
    }
});

// ==========================================
// Excel Filter & Layout Functions
// ==========================================
function openExcelFilter(e, colIndex, title, tableId) {
    e.stopPropagation(); currentFilterCol = colIndex; document.getElementById('ef_col_name').innerText = title; document.getElementById('ef_search').value = '';
    document.getElementById('excelFilterModal').setAttribute('data-target-table', tableId);

    const tbody = document.getElementById(tableId).querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const uniqueValues = new Set();
    rows.forEach(row => { if(row.cells.length <= 1) return; uniqueValues.add(getCellValue(row.cells[colIndex])); });

    const sortedValues = [...uniqueValues].sort();
    const listDiv = document.getElementById('ef_checkbox_list'); listDiv.innerHTML = '';
    const activeSet = activeFilters[`${tableId}_${colIndex}`];

    sortedValues.forEach(val => {
        const isChecked = activeSet ? activeSet.has(val) : true;
        listDiv.innerHTML += `
            <label class="flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer ef-item transition border-b border-slate-100">
                <input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] mt-0.5 cursor-pointer w-3.5 h-3.5 rounded border-slate-300">
                <span class="text-slate-800 font-medium truncate w-full text-xs" title="${val}">${val === '' ? '(ว่าง)' : val}</span>
            </label>`;
    });

    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);
    const modal = document.getElementById('excelFilterModal'); const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + 8) + 'px'; let leftPos = rect.left;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270; modal.style.left = leftPos + 'px';
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeExcelFilter() { document.getElementById('excelFilterModal').classList.add('hidden'); document.getElementById('excelFilterModal').classList.remove('flex'); }
function searchExcelFilter() { const txt = document.getElementById('ef_search').value.toLowerCase(); document.querySelectorAll('.ef-item').forEach(l => { l.style.display = l.querySelector('.ef-check').value.toLowerCase().includes(txt) ? 'flex' : 'none'; }); }
function toggleAllExcelFilters(c) { document.querySelectorAll('.ef-item:not([style*="display: none"]) .ef-check').forEach(cb => cb.checked = c); }

function applyExcelFilter() {
    const modal = document.getElementById('excelFilterModal'); const tableId = modal.getAttribute('data-target-table'); const filterKey = `${tableId}_${currentFilterCol}`;
    const checks = document.querySelectorAll('.ef-check'); const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const table = document.getElementById(tableId); const ths = table.querySelectorAll('thead th');
    let thIcon = ths[currentFilterCol] ? ths[currentFilterCol].querySelector('.filter-icon') : null;

    if (checkedVals.length === checks.length || checkedVals.length === 0) { delete activeFilters[filterKey]; if(thIcon) thIcon.classList.remove('text-amber-400'); } 
    else { activeFilters[filterKey] = new Set(checkedVals); if(thIcon) thIcon.classList.add('text-amber-400'); }
    closeExcelFilter(); executeTableFilter(tableId);
}

function clearSpecificExcelFilter() {
    const tableId = document.getElementById('excelFilterModal').getAttribute('data-target-table'); const filterKey = `${tableId}_${currentFilterCol}`;
    delete activeFilters[filterKey];
    const thIcon = document.getElementById(tableId).querySelectorAll('thead th')[currentFilterCol]?.querySelector('.filter-icon');
    if(thIcon) thIcon.classList.remove('text-amber-400');
    closeExcelFilter(); executeTableFilter(tableId);
}

function clearAllFilters() {
    activeFilters = {}; document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400'); });
    ['poTable', 'inTable', 'outTable', 'stockTable', 'masterTable'].forEach(tid => { if(document.getElementById(tid)) executeTableFilter(tid); });
}

function executeTableFilter(tableId) {
    const table = document.getElementById(tableId); if(!table) return;
    const rows = table.querySelector('tbody').querySelectorAll('tr');
    rows.forEach(tr => {
        if(tr.cells.length <= 1) return;
        let show = true;
        for (let key in activeFilters) {
            if (!key.startsWith(`${tableId}_`)) continue;
            const colIdx = parseInt(key.split('_')[1]); const cellVal = getCellValue(tr.cells[colIdx]);
            if (!activeFilters[key].has(cellVal)) { show = false; break; }
        }
        tr.style.display = show ? '' : 'none';
    });
}

function initResizableColumns(tableId) {
    const table = document.getElementById(tableId); if(!table) return;
    const cols = table.querySelectorAll('th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer') || col.querySelector('.resizer-po'); if(!resizer) return;
        let x = 0; let w = 0;
        const mouseDownHandler = function(e) { e.stopPropagation(); e.preventDefault(); x = e.clientX; w = parseInt(window.getComputedStyle(col).width, 10); resizer.classList.add('bg-amber-400'); document.addEventListener('mousemove', mouseMoveHandler); document.addEventListener('mouseup', mouseUpHandler); };
        const mouseMoveHandler = function(e) { const newW = Math.max(40, w + (e.clientX - x)); col.style.width = `${newW}px`; col.style.minWidth = `${newW}px`; };
        const mouseUpHandler = function() { resizer.classList.remove('bg-amber-400'); document.removeEventListener('mousemove', mouseMoveHandler); document.removeEventListener('mouseup', mouseUpHandler); };
        resizer.addEventListener('mousedown', mouseDownHandler);
    });
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