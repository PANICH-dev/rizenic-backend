const API_BASE_URL = window.location.origin;
let allPartOrders = [];
let allInbounds = [];
let allOutbounds = [];
let allStock = [];
let allStatuses = [];
let allBodyPartsMaster = [];
let userRole = '';
let userBranch = '';

// 🌟 ตัวแปรเก็บแคชสำหรับระบบ Dropdown อะไหล่แบบไม่กระตุก (Fast Datalist)
let allMasterPartsCache = []; 

let currentFilterCol = -1;
let activeFilters = {};

// ================== ระบบ Toast ==================
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

// ================== เริ่มระบบเมื่อหน้าเว็บโหลดเสร็จ ==================
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

// 🌟 ปรับปรุงการโหลดข้อมูล ป้องกันระบบขัดข้องค้าง
async function loadAllData() {
    const nocache = `?_t=${new Date().getTime()}`;
    const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);

    try {
        // 1. PO Orders
        try {
            const resPO = await fetch(`${API_BASE_URL}/api/part-orders${nocache}`);
            if(resPO.ok) {
                const dataPO = await resPO.json();
                allPartOrders = Array.isArray(dataPO) ? dataPO : [];
                if (!isManager) allPartOrders = allPartOrders.filter(d => d.branch_name === userBranch);
            }
        } catch(e) { console.warn("Load PO failed", e); }

        // 2. Inbound
        try {
            const resIn = await fetch(`${API_BASE_URL}/api/part-inbound${nocache}`);
            if(resIn.ok) {
                const dataIn = await resIn.json();
                allInbounds = Array.isArray(dataIn) ? dataIn : [];
                if (!isManager) allInbounds = allInbounds.filter(d => d.branch_name === userBranch);
            }
        } catch(e) { console.warn("Load Inbound failed", e); }

        // 3. Outbound
        try {
            const resOut = await fetch(`${API_BASE_URL}/api/part-outbound${nocache}`);
            if(resOut.ok) {
                const dataOut = await resOut.json();
                allOutbounds = Array.isArray(dataOut) ? dataOut : [];
                if (!isManager) allOutbounds = allOutbounds.filter(d => d.branch_name === userBranch);
            }
        } catch(e) { console.warn("Load Outbound failed", e); }

        // 4. Inventory Stock
        // 4. Inventory Stock
        try {
            const resStock = await fetch(`${API_BASE_URL}/api/parts-inventory?branch=${encodeURIComponent(userBranch)}&_t=${new Date().getTime()}`);
            if(resStock.ok) {
                const dataStock = await resStock.json();
                allStock = Array.isArray(dataStock) ? dataStock : [];
            }
        } catch(e) { console.warn("Load Stock failed", e); }

        // 5. Part Statuses
        try {
            const resStat = await fetch(`${API_BASE_URL}/api/part-statuses${nocache}`);
            if(resStat.ok) {
                const dataStat = await resStat.json();
                allStatuses = Array.isArray(dataStat) ? dataStat : [];
            }
        } catch(e) { console.warn("Load Statuses failed", e); }

        /// 6. Master Parts
        try {
            const resMaster = await fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(userBranch)}&_t=${new Date().getTime()}`);
            if(resMaster.ok) {
                const dataMaster = await resMaster.json();
                allMasterPartsCache = Array.isArray(dataMaster) ? dataMaster : [];
            }
        } catch(e) { console.warn("Load Master Parts failed", e); }

        // เรนเดอร์ UI หลังโหลดเสร็จ
        renderSAAlerts();
        renderPOTracking();
        renderInbound();
        renderOutbound();
        renderStock();
        renderMasterTable();

        const poSelect = document.getElementById('po_bo');
        if(poSelect && allStatuses.length > 0) {
            poSelect.innerHTML = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }

    } catch (e) {
        console.error("Data load error:", e);
    }
}

// 🌟 ระบบ Fast Datalist ค้นหาเรียลไทม์ ลื่นๆ
document.addEventListener('input', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.getAttribute('list') === 'master_parts_datalist') {
        const keyword = e.target.value.trim().toLowerCase();
        const datalist = document.getElementById('master_parts_datalist');
        if(!datalist) return;

        if (keyword.length < 2) {
            datalist.innerHTML = '';
            return;
        }

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
// 1. แจ้งเตือน SA (SA Alerts)
// ==========================================
function renderSAAlerts() {
    const tbody = document.getElementById('sa_alerts_body');
    const badge = document.getElementById('alert_count');
    if(!tbody) return;
    
    const uncompletedPOs = allPartOrders.filter(p => !p.order_status || !p.order_status.includes('ครบ'));
    if (uncompletedPOs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 font-bold bg-white"><i class="fa-solid fa-check-circle text-3xl mb-3 text-emerald-300 block"></i> ไม่มีรายการอะไหล่ค้างสั่งครับ! 🎉</td></tr>`;
        if(badge) badge.classList.add('hidden');
        return;
    }

    const grouped = {};
    uncompletedPOs.forEach(p => {
        const plate = p.car_plate || 'ไม่ระบุทะเบียน';
        if (!grouped[plate]) grouped[plate] = [];
        grouped[plate].push(p);
    });

    const plates = Object.keys(grouped);
    if(badge) {
        badge.innerText = plates.length;
        badge.classList.remove('hidden');
    }

    tbody.innerHTML = plates.map(plate => {
        const items = grouped[plate];
        const first = items[0];
        const arrDate = first.order_date ? String(first.order_date).split('T')[0] : '-';
        
        let itemsHtml = items.map(p => {
            let color = p.order_status === 'รอสั่งซื้อ' ? 'text-red-600' : 'text-amber-600';
            return `<span class="text-[11px] font-bold ${color} block truncate" title="${p.part_name}"><i class="fa-solid fa-caret-right"></i> [${p.order_status || '-'}] ${p.part_name}</span>`;
        }).join('');

        return `
            <tr class="hover:bg-amber-50/50 transition border-b border-slate-100">
                <td class="font-black text-amber-700 text-sm px-2 py-2"><span class="bg-amber-50 px-2 py-1 rounded shadow-sm border border-amber-200">${plate}</span></td>
                <td class="text-slate-500 font-mono font-bold text-center px-2 py-2">${arrDate}</td>
                <td class="font-bold text-slate-600 text-xs px-2 py-2">${first.car_model || '-'}</td>
                <td class="font-bold text-slate-700 text-xs px-2 py-2 truncate max-w-[150px]" title="ดูจากฐานข้อมูล">-</td>
                <td class="font-mono text-xs font-bold text-blue-600 px-2 py-2">${first.epc_no || '-'}</td>
                <td class="px-2 py-2 max-h-[80px] overflow-y-auto block custom-scrollbar bg-slate-50/50 rounded my-1 border border-slate-100">${itemsHtml}</td>
                <td class="text-center px-2 py-2">
                    <button onclick="openAlertModal('${plate}')" class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm w-full"><i class="fa-solid fa-pen-to-square"></i> คีย์อะไหล่</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openAlertModal(plate) {
    const uncompleted = allPartOrders.filter(p => p.car_plate === plate && (!p.order_status || !p.order_status.includes('ครบ')));
    const container = document.getElementById('modal_dynamic_table_container');
    
    let html = `
        <div class="mb-4 bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center shadow-sm">
            <div>
                <h4 class="font-black text-amber-900 text-lg">อัปเดตสถานะอะไหล่รถ: <span class="bg-white px-2 py-0.5 rounded shadow-sm font-mono border border-amber-300 ml-1 text-amber-700">${plate}</span></h4>
                <p class="text-xs font-bold text-amber-700 mt-1">คีย์ข้อมูลแบบ Excel (พิมพ์แก้อัตโนมัติในช่องตารางแล้วกดบันทึก)</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-slate-600">ตั้งค่า EPC No:</span>
                <input type="text" id="mass_epc_update" class="px-3 py-1.5 border border-slate-300 rounded font-mono text-sm w-32 outline-none focus:border-amber-500 uppercase" placeholder="EPC-XXX" onkeyup="document.querySelectorAll('.dyn-epc').forEach(el=>el.value=this.value)">
            </div>
        </div>
        <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
            <table class="excel-table w-full">
                <thead class="bg-[#00320D] text-white sticky top-0 z-10">
                    <tr>
                        <th class="w-24 text-center px-2 py-2">EPC No</th>
                        <th class="w-32 text-center px-2 py-2">บาร์โค้ด</th>
                        <th class="w-32 px-2 py-2">MAIN No</th>
                        <th class="w-48 px-2 py-2">ชื่อชิ้นส่วน</th>
                        <th class="w-16 text-center px-2 py-2">จำนวน</th>
                        <th class="w-36 text-center px-2 py-2">สถานะ</th>
                        <th class="w-24 text-center px-2 py-2">คาดการณ์ (ETA)</th>
                        <th class="w-24 text-center px-2 py-2">เข้าครบ</th>
                        <th class="w-40 px-2 py-2">หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
    `;

    window.addNewAlertRow = function(plate) {
    const tbody = document.querySelector('#modal_dynamic_table_container tbody');
    const statusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
    let safeOpts = statusOptionsHtml.replace(`value="รอสั่งซื้อ"`, `value="รอสั่งซื้อ" selected`);
    
    const tr = document.createElement('tr');
    tr.className = "hover:bg-amber-50/50 transition-colors";
    tr.setAttribute('data-id', 'new'); // 🌟 มาร์คว่าเป็นแถวใหม่
    tr.setAttribute('data-plate', plate);
    tr.innerHTML = `
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-epc font-mono uppercase text-center"></td>
        <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" class="inline-edit-input dyn-partno font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30" onchange="autoFillDynName(this)"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-main font-mono text-slate-500"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-name font-bold"></td>
        <td class="p-0 border border-slate-200"><input type="number" class="inline-edit-input dyn-qty text-center font-black text-amber-600 bg-amber-50" value="1" min="1"></td>
        <td class="p-0 border border-slate-200"><select class="inline-edit-select dyn-status font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer">${safeOpts}</select></td>
        <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-eta font-mono text-center text-xs"></td>
        <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-rcv font-mono text-center text-xs"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-notes text-xs"></td>
    `;
    tbody.appendChild(tr);
};

    const statusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');

    uncompleted.forEach(p => {
        let safeOpts = statusOptionsHtml;
        if (p.order_status && !safeOpts.includes(`value="${p.order_status}"`)) {
            safeOpts = `<option value="${p.order_status}">${p.order_status}</option>` + safeOpts;
        }
        safeOpts = safeOpts.replace(`value="${p.order_status || 'รอสั่งซื้อ'}"`, `value="${p.order_status || 'รอสั่งซื้อ'}" selected`);

        html += `
            <tr class="hover:bg-amber-50/50 transition-colors" data-id="${p.order_id}">
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-epc font-mono uppercase text-center" value="${p.epc_no || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" class="inline-edit-input dyn-partno font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30" value="${p.part_no || ''}" onchange="autoFillDynName(this)"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-main font-mono text-slate-500" value="${p.part_main_no || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-name font-bold" value="${p.part_name || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="number" class="inline-edit-input dyn-qty text-center font-black text-amber-600 bg-amber-50" value="${p.qty_ordered || 1}"></td>
                <td class="p-0 border border-slate-200"><select class="inline-edit-select dyn-status font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer">${safeOpts}</select></td>
                <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-eta font-mono text-center text-xs" value="${p.est_arrival_date ? String(p.est_arrival_date).split('T')[0] : ''}"></td>
                <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-rcv font-mono text-center text-xs" value="${p.part_received_all_date ? String(p.part_received_all_date).split('T')[0] : ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-notes text-xs" value="${p.notes || ''}"></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;

    // ... โค้ดเดิมด้านบน ...
    html += `</tbody></table></div>`;
    
    // 🌟 เพิ่มปุ่มสำหรับ Add Row ใหม่ตรงนี้
    html += `
        <div class="mt-3">
            <button type="button" onclick="addNewAlertRow('${plate}')" class="px-4 py-2 bg-white border border-amber-300 text-amber-700 font-bold rounded-lg hover:bg-amber-50 text-xs shadow-sm transition">
                <i class="fa-solid fa-plus"></i> เพิ่มอะไหล่ใหม่
            </button>
        </div>
    `;

    container.innerHTML = html;
    document.getElementById('alertModal').classList.remove('hidden');
    document.getElementById('alertModal').classList.add('flex');
}
    container.innerHTML = html;
    document.getElementById('alertModal').classList.remove('hidden');
    document.getElementById('alertModal').classList.add('flex');
}

function autoFillDynName(inputEl) {
    const pNo = inputEl.value.trim().toUpperCase();
    if (!pNo) return;
    const tr = inputEl.closest('tr');
    // ดึงค่าจาก cache แบบรวดเร็ว
    const matched = allMasterPartsCache.find(x => x.part_no.toUpperCase() === pNo);
    if(matched) {
        tr.querySelector('.dyn-name').value = matched.part_name || '';
        tr.querySelector('.dyn-main').value = matched.part_main_no || '';
    }
}

function closeAlertModal() { 
    document.getElementById('alertModal').classList.add('hidden'); 
    document.getElementById('alertModal').classList.remove('flex'); 
}

async function saveSAAlertUpdate(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('#modal_dynamic_table_container tbody tr');
    const updates = [];

    rows.forEach(tr => {
        updates.push({
            id: tr.getAttribute('data-id'),
            epc_no: tr.querySelector('.dyn-epc').value.trim() || null,
            part_no: tr.querySelector('.dyn-partno').value.trim() || null,
            part_main_no: tr.querySelector('.dyn-main').value.trim() || null,
            part_name: tr.querySelector('.dyn-name').value.trim() || null,
            qty_ordered: parseInt(tr.querySelector('.dyn-qty').value) || 1,
            order_status: tr.querySelector('.dyn-status').value,
            est_arrival_date: tr.querySelector('.dyn-eta').value || null,
            part_received_all_date: tr.querySelector('.dyn-rcv').value || null,
            notes: tr.querySelector('.dyn-notes').value.trim() || null
        });
    });

    if (updates.length === 0) return closeAlertModal();

    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> บันทึก...'; btn.disabled = true;

        await Promise.all(updates.map(u => {
            const promises = [];
            ['epc_no', 'part_no', 'part_main_no', 'part_name', 'qty_ordered', 'order_status', 'est_arrival_date', 'part_received_all_date', 'notes'].forEach(field => {
                promises.push(fetch(`${API_BASE_URL}/api/part-orders/${u.id}/fast`, {
                    method: 'PUT', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ field, value: u[field] })
                }));
            });
            return Promise.all(promises);
        }));

        showToast('อัปเดตข้อมูลอะไหล่เรียบร้อย!', 'success');
        closeAlertModal();
        loadAllData();
    } catch(err) {
        showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
}

// ==========================================
// 2. สั่งซื้อ (PO Tracking)
// ==========================================
function renderPOTracking() {
    const tbody = document.getElementById('po_table_body');
    if(!tbody) return;
    
    const btnHide = document.getElementById('btn_toggle_completed_po');
    const hideCompleted = btnHide ? btnHide.classList.contains('active-hide') : false;
    
    let filteredData = allPartOrders;
    if (hideCompleted) {
        filteredData = filteredData.filter(p => !p.order_status || !p.order_status.includes('ครบ'));
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีรายการสั่งซื้ออะไหล่</td></tr>`;
        return;
    }

    const sortedData = [...filteredData].sort((a,b) => b.order_id - a.order_id);

    tbody.innerHTML = sortedData.map(p => {
        let isComplete = p.order_status && p.order_status.includes('ครบ');
        let statusBadge = isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
            (p.order_status === 'รอสั่งซื้อ' || String(p.order_status).includes('Back Order') ? 'bg-red-50 text-red-700 border-red-300 font-black animate-pulse' : 'bg-amber-50 text-amber-700 border-amber-300 font-bold');
        
        let qtyClass = isComplete ? 'text-emerald-600' : 'text-amber-600';
        const hasETA = p.est_arrival_date && String(p.est_arrival_date).trim() !== '';

        const actionBtns = hasETA ? 
            `<span class="text-slate-400 font-bold text-[10px]"><i class="fa-solid fa-lock"></i> ล็อก</span>` : 
            `<button onclick="deletePO('${p.order_id}')" class="bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-slate-200 transition shadow-sm"><i class="fa-solid fa-trash"></i></button>`;

        return `
            <tr class="${isComplete ? 'bg-emerald-50/20' : 'hover:bg-blue-50/50'} transition-colors border-b border-slate-100">
                <td class="text-center font-mono text-[10px] text-slate-400 border border-slate-200">${p.order_id}</td>
                <td class="p-0 border border-slate-200"><input type="text" value="${p.epc_no||''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'epc_no', this.value)" class="inline-edit-input font-mono uppercase text-center ${p.epc_no ? 'font-bold' : ''}" placeholder="-"></td>
                <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" value="${p.part_no||''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'part_no', this.value)" class="inline-edit-input font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${p.car_plate||''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'car_plate', this.value)" class="inline-edit-input font-mono uppercase text-center font-bold" placeholder="-"></td>
                <td class="p-0 border border-slate-200">
                    <select onchange="fastUpdateField('part-orders', '${p.order_id}', 'order_status', this.value)" class="inline-edit-select ${statusBadge}">
                        ${allStatuses.map(s => `<option value="${s.status_name}" ${p.order_status === s.status_name ? 'selected' : ''}>${s.status_name}</option>`).join('')}
                    </select>
                </td>
                <td class="p-0 border border-slate-200"><input type="number" value="${p.qty_ordered||1}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'qty_ordered', this.value)" class="inline-edit-input text-center font-black ${qtyClass}"></td>
                <td class="text-center font-black ${p.qty_received >= p.qty_ordered ? 'text-emerald-600' : 'text-slate-400'} border border-slate-200">${p.qty_received||0}</td>
                <td class="p-0 border border-slate-200"><input type="text" value="${p.part_name||''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'part_name', this.value)" class="inline-edit-input font-bold" placeholder="-"></td>
                <td class="text-center font-mono text-xs text-slate-500 border border-slate-200">${p.order_date ? String(p.order_date).split('T')[0] : '-'}</td>
                <td class="p-0 border border-slate-200"><input type="date" value="${p.est_arrival_date ? String(p.est_arrival_date).split('T')[0] : ''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'est_arrival_date', this.value)" class="inline-edit-input font-mono text-center text-xs ${hasETA ? 'text-amber-600 font-bold' : ''}"></td>
                <td class="p-0 border border-slate-200"><input type="date" value="${p.part_received_all_date ? String(p.part_received_all_date).split('T')[0] : ''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'part_received_all_date', this.value)" class="inline-edit-input font-mono text-center text-xs text-emerald-600 font-bold"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${p.notes||''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'notes', this.value)" class="inline-edit-input text-xs" placeholder="-"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${p.part_main_no||''}" onchange="fastUpdateField('part-orders', '${p.order_id}', 'part_main_no', this.value)" class="inline-edit-input font-mono text-slate-500" placeholder="-"></td>
                <td class="text-center border border-slate-200">${actionBtns}</td>
            </tr>
        `;
    }).join('');
}

function toggleCompletedPO() {
    const btn = document.getElementById('btn_toggle_completed_po');
    if(!btn) return;
    if (btn.classList.contains('active-hide')) {
        btn.classList.remove('active-hide');
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> ซ่อนที่เข้าครบแล้ว';
        btn.classList.replace('bg-blue-100', 'bg-white');
        btn.classList.replace('text-blue-700', 'text-slate-600');
    } else {
        btn.classList.add('active-hide');
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> แสดงทั้งหมด';
        btn.classList.replace('bg-white', 'bg-blue-100');
        btn.classList.replace('text-slate-600', 'text-blue-700');
    }
    renderPOTracking();
}

function openPOModal() {
    document.getElementById('poForm').reset();
    document.getElementById('edit_po_id').value = '';
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('po_date').value = todayStr;
    document.getElementById('poModal').classList.remove('hidden');
    document.getElementById('poModal').classList.add('flex');
}
function closePOModal() { document.getElementById('poModal').classList.add('hidden'); document.getElementById('poModal').classList.remove('flex'); }

async function submitPO(e) {
    e.preventDefault();
    const id = document.getElementById('edit_po_id').value;
    const payload = {
        qt_no: document.getElementById('po_qt').value.trim() || null,
        so_no: document.getElementById('po_so').value.trim() || null,
        epc_no: document.getElementById('po_epc').value.trim() || null,
        order_date: document.getElementById('po_date').value,
        est_arrival_date: document.getElementById('po_est').value || null,
        part_received_all_date: document.getElementById('po_rcv_all_date').value || null,
        car_plate: document.getElementById('po_plate').value.trim().toUpperCase(),
        part_no: document.getElementById('po_part_no').value.trim().toUpperCase(),
        qty_ordered: parseInt(document.getElementById('po_qty').value) || 1,
        order_status: document.getElementById('po_bo').value,
        notes: document.getElementById('po_note').value.trim() || null,
        part_main_no: document.getElementById('po_part_main').value.trim() || null,
        part_name: document.getElementById('po_part_name').value.trim(),
        part_type: document.getElementById('po_type').value || 'อะไหล่แท้',
        car_model: document.getElementById('po_model').value || null,
        vin_no: document.getElementById('po_vin').value || null,
        branch_name: userBranch
    };

    try {
        const url = id ? `${API_BASE_URL}/api/part-orders/${id}` : `${API_BASE_URL}/api/part-orders`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            showToast('บันทึกคำสั่งซื้อเรียบร้อย!');
            closePOModal();
            loadAllData();
        } else throw new Error();
    } catch(e) { showToast('บันทึกล้มเหลว', 'error'); }
}

async function deletePO(id) {
    if(!confirm('🚨 ยืนยันการลบรายการสั่งซื้อนี้?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/part-orders/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('ลบรายการสำเร็จ'); loadAllData(); }
        else throw new Error();
    } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
}

// ==========================================
// 3. รับเข้า (Inbound)
// ==========================================
function renderInbound() {
    const tbody = document.getElementById('inbound_table_body');
    if(!tbody) return;
    if (allInbounds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีประวัติการรับเข้า</td></tr>`;
        return;
    }

    const sortedData = [...allInbounds].sort((a,b) => b.inbound_id - a.inbound_id);

    tbody.innerHTML = sortedData.map(i => `
        <tr class="hover:bg-emerald-50/40 transition-colors border-b border-slate-100">
            <td class="text-center font-mono text-[10px] text-slate-400 border border-slate-200">${i.inbound_id}</td>
            <td class="p-0 border border-slate-200"><input type="date" value="${i.received_date ? String(i.received_date).split('T')[0] : ''}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'received_date', this.value)" class="inline-edit-input font-mono text-center text-xs text-emerald-700 font-bold"></td>
            <td class="p-0 border border-slate-200"><input type="text" value="${i.epc_no||''}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'epc_no', this.value)" class="inline-edit-input font-mono uppercase text-center" placeholder="-"></td>
            <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" value="${i.part_no||''}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'part_no', this.value)" class="inline-edit-input font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30"></td>
            <td class="p-0 border border-slate-200"><input type="text" value="${i.part_main_no||''}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'part_main_no', this.value)" class="inline-edit-input font-mono text-slate-500" placeholder="-"></td>
            <td class="p-0 border border-slate-200"><input type="text" value="${i.part_name||''}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'part_name', this.value)" class="inline-edit-input font-bold text-slate-800" placeholder="-"></td>
            <td class="p-0 border border-slate-200"><input type="number" value="${i.qty||1}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'qty', this.value)" class="inline-edit-input text-center font-black text-emerald-600 bg-emerald-50"></td>
            <td class="p-0 border border-slate-200"><input type="number" value="${i.unit_price||0}" onchange="fastUpdateField('part-inbound', '${i.inbound_id}', 'unit_price', this.value)" class="inline-edit-input text-right font-mono" step="0.01"></td>
            <td class="text-center border border-slate-200">
                <button onclick="deleteInbound('${i.inbound_id}')" class="bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-slate-200 transition shadow-sm"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openInboundModal() {
    const tbody = document.getElementById('multi_inbound_body');
    const pendingOrders = allPartOrders.filter(p => !p.order_status || !p.order_status.includes('ครบ'));
    
    if (pendingOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-emerald-600 font-bold bg-white text-sm"><i class="fa-solid fa-check-circle text-2xl block mb-2 text-emerald-400"></i> ไม่มีรายการอะไหล่ที่ค้างรับจากศูนย์เลยครับ! ยอดเยี่ยมมาก 🎉</td></tr>`;
    } else {
        const sorted = [...pendingOrders].sort((a,b) => new Date(a.order_date||0) - new Date(b.order_date||0));
        const todayStr = new Date().toISOString().split('T')[0];
        
        tbody.innerHTML = sorted.map(p => {
            const pendingQty = Math.max(0, (p.qty_ordered || 0) - (p.qty_received || 0));
            return `
                <tr class="hover:bg-slate-50 transition" data-po-id="${p.order_id}">
                    <td class="text-center py-2"><input type="checkbox" class="inbound-chk w-4 h-4 accent-emerald-500 cursor-pointer" onchange="updateInboundCount()"></td>
                    <td class="py-2 px-1"><input type="date" class="in-date w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono outline-none focus:border-emerald-500" value="${todayStr}"></td>
                    <td class="text-center py-2 font-black text-amber-700 text-xs">${p.car_plate || '-'}</td>
                    <td class="text-center py-2"><input type="text" class="in-epc w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] font-mono uppercase text-center outline-none focus:border-emerald-500" value="${p.epc_no || ''}" placeholder="EPC"></td>
                    <td class="text-center py-2 font-mono text-blue-700 font-bold text-[11px] in-partno">${p.part_no || '-'}</td>
                    <td class="py-2 text-[11px] font-bold text-slate-700 truncate max-w-[200px]" title="${p.part_name}"><span class="in-name hidden">${p.part_name||''}</span><span class="in-main hidden">${p.part_main_no||''}</span><span class="in-model hidden">${p.car_model||''}</span>${p.part_name}</td>
                    <td class="text-center py-2 font-black text-red-500">${pendingQty}</td>
                    <td class="py-2 px-1"><input type="number" class="in-qty w-full bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-center text-xs font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/30" value="${pendingQty}" min="1" max="${pendingQty}"></td>
                </tr>
            `;
        }).join('');
    }
    
    if(document.getElementById('chk_all_inbound')) document.getElementById('chk_all_inbound').checked = false;
    updateInboundCount();
    document.getElementById('inboundModal').classList.remove('hidden');
    document.getElementById('inboundModal').classList.add('flex');
}
function closeInboundModal() { document.getElementById('inboundModal').classList.add('hidden'); document.getElementById('inboundModal').classList.remove('flex'); }

function toggleAllInbound(checked) {
    document.querySelectorAll('.inbound-chk').forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') cb.checked = checked;
    });
    updateInboundCount();
}
function updateInboundCount() {
    const count = document.querySelectorAll('.inbound-chk:checked').length;
    if(document.getElementById('multi_inbound_count')) document.getElementById('multi_inbound_count').innerText = count;
}

async function submitMultiInbound(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('#multi_inbound_body tr');
    const selected = [];
    rows.forEach(tr => {
        const chk = tr.querySelector('.inbound-chk');
        if (chk && chk.checked) {
            selected.push({
                po_id: tr.getAttribute('data-po-id'),
                received_date: tr.querySelector('.in-date').value,
                epc_no: tr.querySelector('.in-epc').value.trim() || null,
                part_no: tr.querySelector('.in-partno').innerText.trim() || null,
                part_name: tr.querySelector('.in-name').innerText.trim() || null,
                part_main_no: tr.querySelector('.in-main').innerText.trim() || null,
                car_model: tr.querySelector('.in-model').innerText.trim() || null,
                qty: parseInt(tr.querySelector('.in-qty').value) || 1,
                unit_price: 0,
                branch_name: userBranch
            });
        }
    });

    if (selected.length === 0) return alert('กรุณาเลือกรายการที่ต้องการรับเข้าอย่างน้อย 1 รายการครับ!');

    try {
        const btn = document.getElementById('btn_submit_inbound');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; btn.disabled = true;

        await Promise.all(selected.map(item => fetch(`${API_BASE_URL}/api/part-inbound`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item)
        })));

        showToast(`รับเข้าสำเร็จ ${selected.length} รายการ!`);
        closeInboundModal();
        loadAllData();
    } catch(err) { showToast('บันทึกล้มเหลว', 'error'); }
}

async function deleteInbound(id) {
    if(!confirm('🚨 ยืนยันการลบประวัติรับเข้านี้?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/part-inbound/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('ลบรายการสำเร็จ'); loadAllData(); }
        else throw new Error();
    } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
}

// ==========================================
// 4. เบิก / จอง (Outbound)
// ==========================================
function renderOutbound() {
    const tbody = document.getElementById('outbound_table_body');
    if(!tbody) return;
    if (allOutbounds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีประวัติการเบิกหรือจองอะไหล่</td></tr>`;
        return;
    }

    const sortedData = [...allOutbounds].sort((a,b) => b.outbound_id - a.outbound_id);

    tbody.innerHTML = sortedData.map((o, idx) => {
        let badge = o.job_status === 'รอเข้าซ่อม' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-purple-100 text-purple-700 border-purple-300';
        return `
            <tr class="hover:bg-purple-50/40 transition-colors border-b border-slate-100">
                <td class="text-center font-mono text-[10px] text-slate-400 border border-slate-200">${o.outbound_id}</td>
                <td class="text-center font-bold text-slate-400 text-[10px] border border-slate-200">${sortedData.length - idx}</td>
                <td class="p-0 border border-slate-200"><input type="date" value="${o.issue_date ? String(o.issue_date).split('T')[0] : ''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'issue_date', this.value)" class="inline-edit-input font-mono text-center text-xs"></td>
                <td class="p-0 border border-slate-200">
                    <select onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'job_status', this.value)" class="inline-edit-select font-bold text-xs text-center ${badge}">
                        <option value="รอเข้าซ่อม" ${o.job_status === 'รอเข้าซ่อม' ? 'selected' : ''}>จอง (รอซ่อม)</option>
                        <option value="เบิกอะไหล่" ${o.job_status === 'เบิกอะไหล่' ? 'selected' : ''}>เบิกตัดสต๊อกจริง</option>
                    </select>
                </td>
                <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" value="${o.part_no||''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'part_no', this.value)" class="inline-edit-input font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${o.part_main_no||''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'part_main_no', this.value)" class="inline-edit-input font-mono text-slate-500" placeholder="-"></td>
                <td class="p-0 border border-slate-200"><input type="number" value="${o.qty||1}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'qty', this.value)" class="inline-edit-input text-center font-black text-purple-600 bg-purple-50"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${o.car_plate||''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'car_plate', this.value)" class="inline-edit-input font-mono uppercase text-center font-bold text-amber-700" placeholder="-"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${o.qt_no||''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'qt_no', this.value)" class="inline-edit-input font-mono uppercase" placeholder="-"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${o.so_no||''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'so_no', this.value)" class="inline-edit-input font-mono uppercase" placeholder="-"></td>
                <td class="p-0 border border-slate-200"><input type="text" value="${o.part_name||''}" onchange="fastUpdateField('part-outbound', '${o.outbound_id}', 'part_name', this.value)" class="inline-edit-input font-bold text-slate-800" placeholder="-"></td>
                <td class="text-center border border-slate-200">
                    <button onclick="deleteOutbound('${o.outbound_id}')" class="bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded border border-slate-200 transition shadow-sm"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function openOutboundModal() {
    document.getElementById('outboundForm').reset();
    document.getElementById('edit_outbound_id').value = '';
    document.getElementById('out_date').value = new Date().toISOString().split('T')[0];
    document.getElementById('outboundModal').classList.remove('hidden');
    document.getElementById('outboundModal').classList.add('flex');
}
function closeOutboundModal() { document.getElementById('outboundModal').classList.add('hidden'); document.getElementById('outboundModal').classList.remove('flex'); }

async function submitOutbound(e) {
    e.preventDefault();
    const id = document.getElementById('edit_outbound_id').value;
    const payload = {
        issue_date: document.getElementById('out_date').value,
        part_no: document.getElementById('out_part_no').value.trim().toUpperCase(),
        part_main_no: document.getElementById('out_part_main').value.trim() || null,
        part_name: document.getElementById('out_part_name').value.trim(),
        qty: parseInt(document.getElementById('out_qty').value) || 1,
        car_plate: document.getElementById('out_plate').value.trim().toUpperCase(),
        qt_no: document.getElementById('out_qt').value.trim() || null,
        so_no: document.getElementById('out_so').value.trim() || null,
        unit_price: parseFloat(document.getElementById('out_price').value) || 0,
        part_type: document.getElementById('out_type').value || 'อะไหล่หลัก',
        car_model: document.getElementById('out_model').value || null,
        job_status: document.getElementById('out_job_status').value,
        branch_name: userBranch
    };

    try {
        const url = id ? `${API_BASE_URL}/api/part-outbound/${id}` : `${API_BASE_URL}/api/part-outbound`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            showToast('บันทึกรายการเบิก/จองเรียบร้อย!');
            closeOutboundModal();
            loadAllData();
        } else throw new Error();
    } catch(e) { showToast('บันทึกล้มเหลว', 'error'); }
}

async function deleteOutbound(id) {
    if(!confirm('🚨 ยืนยันการลบประวัติการเบิก/จองนี้?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/part-outbound/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('ลบรายการสำเร็จ'); loadAllData(); }
        else throw new Error();
    } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
}

// ==========================================
// 5. สต๊อกคงเหลือ (Inventory)
// ==========================================
async function loadStockInHouse() {
    try {
        const resStock = await fetch(`${API_BASE_URL}/api/parts-inventory?branch=${encodeURIComponent(userBranch)}&_t=${new Date().getTime()}`);
        if(resStock.ok) {
            allStock = await resStock.json();
            renderStock();
            showToast('อัปเดตสต๊อกล่าสุดแล้ว!', 'info');
        }
    } catch(e) { showToast('โหลดสต๊อกล้มเหลว', 'error'); }
}

function renderStock() {
    const tbody = document.getElementById('stock_table_body');
    if(!tbody) return;
    if (allStock.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีข้อมูลสต๊อกคงเหลือ</td></tr>`;
        return;
    }

    const html = allStock.map(s => {
        const master = allMasterPartsCache.find(m => m.part_no === s.part_no) || {};
        const safe = parseInt(master.safety_stock) || 0;
        const totalIn = parseInt(s.total_inbound) || 0;
        const totalIss = parseInt(s.total_issued) || 0;
        const totalBook = parseInt(s.total_booked) || 0;
        
        const actualRemain = totalIn - totalIss - totalBook;
        
        let rowClass = 'hover:bg-amber-50/30';
        let safeBadge = '';
        if (actualRemain < 0) {
            rowClass = 'bg-red-50 hover:bg-red-100';
            safeBadge = '<i class="fa-solid fa-triangle-exclamation text-red-500 ml-1 animate-pulse" title="สต๊อกติดลบ!"></i>';
        } else if (safe > 0 && actualRemain <= safe) {
            rowClass = 'bg-amber-50 hover:bg-amber-100';
            safeBadge = '<i class="fa-solid fa-bell text-amber-500 ml-1" title="ต่ำกว่าจุดสั่งซื้อ (Safety Stock)"></i>';
        }

        return `
            <tr class="${rowClass} transition-colors border-b border-slate-100">
                <td class="font-mono text-slate-500 text-center px-4 py-2">${s.part_main_no || '-'}</td>
                <td class="font-mono text-blue-700 font-bold px-4 py-2">${s.part_no}</td>
                <td class="font-bold text-slate-800 px-4 py-2">${s.part_name}</td>
                <td class="text-center font-bold px-4 py-2">${totalIn - totalIss}</td>
                <td class="text-center font-bold text-amber-600 px-4 py-2">${totalBook}</td>
                <td class="text-center font-black text-lg ${actualRemain < 0 ? 'text-red-600' : 'text-emerald-600'} px-4 py-2">${actualRemain} ${safeBadge}</td>
                <td class="text-center font-bold text-slate-600 px-4 py-2">${master.location || '-'}</td>
                <td class="text-slate-600 text-[11px] font-bold px-4 py-2">${s.car_model || master.car_model || '-'}</td>
                <td class="text-right font-mono text-slate-600 px-4 py-2">${parseFloat(master.unit_price || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}</td>
                <td class="text-center px-4 py-2"><span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">${master.part_category || 'อะไหล่ทั่วไป'}</span></td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

// ==========================================
// 6. ข้อมูลมาสเตอร์ (Master)
// ==========================================
function renderMasterTable() {
    const tbody = document.getElementById('master_table_body');
    if(!tbody) return;
    if (allMasterPartsCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีข้อมูลมาสเตอร์อะไหล่</td></tr>`;
        return;
    }
    
    tbody.innerHTML = allMasterPartsCache.map(m => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="font-mono text-blue-700 font-bold px-4 py-2.5">${m.part_no}</td>
            <td class="font-bold text-slate-800 px-4 py-2.5">${m.part_name}</td>
            <td class="font-mono text-slate-500 px-4 py-2.5">${m.part_main_no || '-'}</td>
            <td class="text-slate-600 text-xs font-bold px-4 py-2.5">${m.car_model || '-'}</td>
            <td class="px-4 py-2.5"><span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm">${m.part_category || 'อะไหล่ทั่วไป'}</span></td>
            <td class="text-right font-mono font-bold text-slate-700 px-4 py-2.5">${parseFloat(m.unit_price || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}</td>
            <td class="text-center font-bold text-slate-600 px-4 py-2.5">${m.location || '-'}</td>
            <td class="text-center px-4 py-2.5">
                <button onclick="editMaster('${m.part_no}')" class="text-blue-500 hover:text-blue-700 px-2 transition"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteMaster('${m.part_id}')" class="text-slate-300 hover:text-red-500 px-2 transition"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function searchMasterTable() {
    const txt = event.target.value.toLowerCase();
    const rows = document.getElementById('master_table_body').querySelectorAll('tr');
    rows.forEach(tr => {
        if(tr.cells.length <= 1) return;
        const text = tr.innerText.toLowerCase();
        tr.style.display = text.includes(txt) ? '' : 'none';
    });
}

function openMasterModal() {
    document.getElementById('edit_master_id').value = '';
    document.getElementById('master_part_no').value = '';
    document.getElementById('master_part_name').value = '';
    document.getElementById('master_part_main').value = '';
    document.getElementById('master_category').value = 'อะไหล่หลัก';
    document.getElementById('master_price').value = '0.00';
    document.getElementById('master_location').value = '';
    document.getElementById('master_safety').value = '0';
    
    renderCarModelsCheckbox('');
    
    document.getElementById('masterModal').classList.remove('hidden');
    document.getElementById('masterModal').classList.add('flex');
}

function closeMasterModal() { document.getElementById('masterModal').classList.add('hidden'); document.getElementById('masterModal').classList.remove('flex'); }

async function editMaster(partNo) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(partNo)}?branch=${encodeURIComponent(userBranch)}`);
        if(res.ok) {
            const data = await res.json();
            const m = Array.isArray(data) ? data[0] : (data.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : data);
            if(m) {
                document.getElementById('edit_master_id').value = m.part_id;
                document.getElementById('master_part_no').value = m.part_no;
                document.getElementById('master_part_name').value = m.part_name;
                document.getElementById('master_part_main').value = m.part_main_no || '';
                document.getElementById('master_category').value = m.part_category || 'อะไหล่หลัก';
                document.getElementById('master_price').value = parseFloat(m.unit_price || 0).toFixed(2);
                document.getElementById('master_location').value = m.location || '';
                document.getElementById('master_safety').value = m.safety_stock || '0';
                
                renderCarModelsCheckbox(m.car_model || '');
                
                document.getElementById('masterModal').classList.remove('hidden');
                document.getElementById('masterModal').classList.add('flex');
            }
        }
    } catch(e) { showToast('ดึงข้อมูลผิดพลาด', 'error'); }
}

async function saveMasterPart() {
    const id = document.getElementById('edit_master_id').value;
    const pNo = document.getElementById('master_part_no').value.trim().toUpperCase();
    const pName = document.getElementById('master_part_name').value.trim();
    if(!pNo || !pName) return alert('กรุณากรอกบาร์โค้ดและชื่อชิ้นส่วนให้ครบถ้วน');

    const chks = document.querySelectorAll('.master-car-chk:checked');
    const models = Array.from(chks).map(c => c.value).join(', ');

    const payload = {
        part_no: pNo, part_main_no: document.getElementById('master_part_main').value.trim().toUpperCase() || null,
        part_name: pName, car_model: models || null,
        part_category: document.getElementById('master_category').value,
        unit_price: parseFloat(document.getElementById('master_price').value) || 0,
        location: document.getElementById('master_location').value.trim() || null,
        safety_stock: parseInt(document.getElementById('master_safety').value) || 0,
        branch_name: userBranch
    };

    try {
        const url = id ? `${API_BASE_URL}/api/parts/${id}` : `${API_BASE_URL}/api/parts`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            showToast('บันทึกมาสเตอร์สำเร็จ!');
            closeMasterModal();
            loadAllData();
        } else throw new Error();
    } catch(e) { showToast('บันทึกล้มเหลว', 'error'); }
}

async function deleteMaster(id) {
    if(!confirm('🚨 ยืนยันการลบข้อมูลมาสเตอร์นี้?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('ลบมาสเตอร์สำเร็จ'); loadAllData(); }
        else throw new Error();
    } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
}

function renderCarModelsCheckbox(selectedStr) {
    const container = document.getElementById('master_car_models_container');
    if(!container) return;
    const selectedArr = selectedStr.split(',').map(s => s.trim());
    
    fetch(`${API_BASE_URL}/api/car-models`).then(async r => {
        if(r.ok) {
            const data = await r.json();
            container.innerHTML = data.map(c => `
                <label class="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded border border-transparent hover:border-slate-200 transition">
                    <input type="checkbox" value="${c.car_model}" class="master-car-chk w-4 h-4 accent-blue-600 cursor-pointer" ${selectedArr.includes(c.car_model) ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-700 select-none">${c.car_brand} <span class="font-medium text-slate-500">${c.car_model}</span></span>
                </label>
            `).join('');
        }
    }).catch(()=>{});
}

// ==========================================
// ระบบ Fast Update
// ==========================================
async function fastUpdateField(table, id, field, value) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/${table}/${id}/fast`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ field, value: value || null })
        });
        if(res.ok) { 
            showToast('อัปเดตช่องเรียบร้อย!'); 
            if(table === 'part-inbound' && (field === 'qty' || field === 'unit_price')) {
                loadAllData();
            }
        }
        else throw new Error();
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); loadAllData(); }
}

// ==========================================
// Helper Functions
// ==========================================
async function fetchJobDataByPlate(prefix) {
    const plate = document.getElementById(`${prefix}_plate`).value.trim().toUpperCase();
    if(!plate) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`);
        if(res.ok) {
            const data = await res.json();
            const job = data.find(j => j.car_plate === plate);
            if(job) {
                if(document.getElementById(`${prefix}_qt`)) document.getElementById(`${prefix}_qt`).value = job.qt_no || '';
                if(document.getElementById(`${prefix}_so`)) document.getElementById(`${prefix}_so`).value = job.so_no || '';
                if(document.getElementById(`${prefix}_model`)) document.getElementById(`${prefix}_model`).value = job.car_model || '';
                if(document.getElementById(`${prefix}_vin`)) document.getElementById(`${prefix}_vin`).value = job.vin_no || '';
            }
        }
    } catch(e){}
}

function fetchMasterPart(prefix) {
    const pNo = document.getElementById(`${prefix}_part_no`).value.trim().toUpperCase();
    if(!pNo) return;
    const m = allMasterPartsCache.find(x => x.part_no && x.part_no.toUpperCase() === pNo);
    if(m) {
        if(document.getElementById(`${prefix}_part_name`)) document.getElementById(`${prefix}_part_name`).value = m.part_name || '';
        if(document.getElementById(`${prefix}_part_main`)) document.getElementById(`${prefix}_part_main`).value = m.part_main_no || '';
        if(document.getElementById(`${prefix}_model`) && !document.getElementById(`${prefix}_model`).value) document.getElementById(`${prefix}_model`).value = m.car_model || '';
        if(document.getElementById(`${prefix}_type`)) document.getElementById(`${prefix}_type`).value = m.part_category || 'อะไหล่ทั่วไป';
        if(document.getElementById(`${prefix}_price`)) document.getElementById(`${prefix}_price`).value = m.unit_price || 0;
    }
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

// ==========================================
// Excel Grid Paste Multi-Items
// ==========================================
function openExcelPasteModal(type) {
    document.getElementById('paste_target_type').value = type;
    const title = document.getElementById('paste_modal_title');
    const text = document.getElementById('paste_instructions_text');
    const thead = document.getElementById('paste_grid_thead');
    const tbody = document.getElementById('paste_grid_tbody');
    
    tbody.innerHTML = '';
    
    if (type === 'po') {
        title.innerHTML = '<i class="fa-solid fa-cart-plus text-blue-600 mr-2"></i> สร้างใบสั่งซื้อ (PO) หลายรายการพร้อมกัน';
        title.className = "font-black text-blue-900 text-sm sm:text-base";
        document.getElementById('btn_submit_paste').className = "px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-md transition flex items-center gap-2";
        text.innerHTML = `<b>วิธีใช้งาน:</b> ก๊อปปี้ข้อมูลจาก Excel แล้วคลิกที่ช่องแรก (ทะเบียนรถ) กด <b>Ctrl+V</b> <br> *ลำดับคอลัมน์ Excel ต้องเรียงตามนี้: 1.ทะเบียนรถ, 2.หมายเลขอะไหล่, 3.จำนวน, 4.หมายเหตุ, 5.EPC No (ถ้ามี)`;
        thead.innerHTML = `<tr><th class="excel-grid-th w-32">1. ทะเบียนรถ *</th><th class="excel-grid-th w-40">2. บาร์โค้ดอะไหล่ *</th><th class="excel-grid-th w-20 text-center">3. จำนวน *</th><th class="excel-grid-th w-48">4. หมายเหตุ</th><th class="excel-grid-th w-32">5. EPC No (ตัวเลือก)</th><th class="excel-grid-th w-10">ลบ</th></tr>`;
    } else {
        title.innerHTML = '<i class="fa-solid fa-truck-ramp-box text-emerald-600 mr-2"></i> รับเข้าคลัง (Inbound) หลายรายการพร้อมกัน';
        title.className = "font-black text-emerald-900 text-sm sm:text-base";
        document.getElementById('btn_submit_paste').className = "px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg shadow-md transition flex items-center gap-2";
        text.innerHTML = `<b>วิธีใช้งาน:</b> ก๊อปปี้ข้อมูลจาก Excel แล้วคลิกที่ช่องแรก (บาร์โค้ดอะไหล่) กด <b>Ctrl+V</b> <br> *ลำดับคอลัมน์ Excel ต้องเรียงตามนี้: 1.หมายเลขอะไหล่, 2.จำนวน, 3.ราคาต่อหน่วย, 4.EPC No (ถ้ามี)`;
        thead.innerHTML = `<tr><th class="excel-grid-th w-40">1. บาร์โค้ดอะไหล่ *</th><th class="excel-grid-th w-20 text-center">2. จำนวน *</th><th class="excel-grid-th w-32 text-center">3. ราคา/หน่วย *</th><th class="excel-grid-th w-32">4. EPC No (ตัวเลือก)</th><th class="excel-grid-th w-10">ลบ</th></tr>`;
    }
    
    for(let i=0; i<5; i++) addPasteRow();
    
    document.getElementById('excelPasteModal').classList.remove('hidden');
    document.getElementById('excelPasteModal').classList.add('flex');
}

function closeExcelPasteModal() { document.getElementById('excelPasteModal').classList.add('hidden'); document.getElementById('excelPasteModal').classList.remove('flex'); }

function addPasteRow() {
    const type = document.getElementById('paste_target_type').value;
    const tbody = document.getElementById('paste_grid_tbody');
    const tr = document.createElement('tr');
    
    if (type === 'po') {
        tr.innerHTML = `
            <td class="excel-cell"><input type="text" class="excel-input paste-cell uppercase font-bold text-amber-700" onpaste="handleGridPaste(event, this)"></td>
            <td class="excel-cell"><input type="text" class="excel-input uppercase font-bold text-blue-700"></td>
            <td class="excel-cell"><input type="number" class="excel-input text-center font-black text-lg" value="1" min="1"></td>
            <td class="excel-cell"><input type="text" class="excel-input text-xs text-slate-600"></td>
            <td class="excel-cell"><input type="text" class="excel-input uppercase font-mono text-center text-xs text-slate-500"></td>
            <td class="excel-cell text-center"><button tabindex="-1" type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        `;
    } else {
        tr.innerHTML = `
            <td class="excel-cell"><input type="text" class="excel-input paste-cell uppercase font-bold text-blue-700" onpaste="handleGridPaste(event, this)"></td>
            <td class="excel-cell"><input type="number" class="excel-input text-center font-black text-lg" value="1" min="1"></td>
            <td class="excel-cell"><input type="number" class="excel-input text-right font-mono" value="0" step="0.01"></td>
            <td class="excel-cell"><input type="text" class="excel-input uppercase font-mono text-center text-xs text-slate-500"></td>
            <td class="excel-cell text-center"><button tabindex="-1" type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        `;
    }
    tbody.appendChild(tr);
}

function handleGridPaste(e, cellInput) {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('Text');
    if (!pastedText) return;

    const rows = pastedText.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
    const tbody = document.getElementById('paste_grid_tbody');
    let currentRow = cellInput.closest('tr');
    
    rows.forEach((rowStr, i) => {
        const cols = rowStr.split('\t');
        if (!currentRow) { addPasteRow(); currentRow = tbody.lastElementChild; }
        
        const inputs = currentRow.querySelectorAll('.excel-input:not([readonly])');
        cols.forEach((colVal, j) => {
            if (inputs[j]) {
                inputs[j].value = colVal.trim();
                inputs[j].classList.add('bg-amber-50'); 
                setTimeout(() => inputs[j].classList.remove('bg-amber-50'), 1000);
            }
        });
        currentRow = currentRow.nextElementSibling;
    });
}

async function processExcelPasteData() {
    const type = document.getElementById('paste_target_type').value;
    const rows = document.querySelectorAll('#paste_grid_tbody tr');
    const payloadArr = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let tr of rows) {
        const inputs = tr.querySelectorAll('.excel-input:not([readonly])');
        
        if (type === 'po') {
            const plate = inputs[0].value.trim().toUpperCase();
            const partNo = inputs[1].value.trim().toUpperCase();
            const qty = parseInt(inputs[2].value) || 0;
            const note = inputs[3].value.trim() || null;
            const epc = inputs[4].value.trim().toUpperCase() || null;
            
            if (plate && partNo && qty > 0) {
                let partName = partNo;
                let partMain = null;
                const m = allMasterPartsCache.find(x => x.part_no && x.part_no.toUpperCase() === partNo);
                if (m) { partName = m.part_name; partMain = m.part_main_no; }
                
                payloadArr.push({
                    car_plate: plate, part_no: partNo, part_main_no: partMain, part_name: partName,
                    qty_ordered: qty, order_status: 'รอสั่งซื้อ', order_date: todayStr,
                    notes: note, epc_no: epc, branch_name: userBranch
                });
            }
        } else {
            const partNo = inputs[0].value.trim().toUpperCase();
            const qty = parseInt(inputs[1].value) || 0;
            const price = parseFloat(inputs[2].value) || 0;
            const epc = inputs[3].value.trim().toUpperCase() || null;
            
            if (partNo && qty > 0) {
                let partName = partNo;
                let partMain = null;
                const m = allMasterPartsCache.find(x => x.part_no && x.part_no.toUpperCase() === partNo);
                if (m) { partName = m.part_name; partMain = m.part_main_no; }
                
                payloadArr.push({
                    received_date: todayStr, epc_no: epc, part_no: partNo, part_main_no: partMain,
                    part_name: partName, qty: qty, unit_price: price, branch_name: userBranch
                });
            }
        }
    }

    if (payloadArr.length === 0) return alert('ไม่พบข้อมูลที่ถูกต้องสำหรับบันทึก กรุณาตรวจสอบข้อมูลอีกครั้งครับ');
    if (!confirm(`ยืนยันการบันทึกข้อมูลแบบกลุ่ม จำนวน ${payloadArr.length} รายการ?`)) return;

    try {
        const btn = document.getElementById('btn_submit_paste');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> บันทึก...'; btn.disabled = true;

        const endpoint = type === 'po' ? '/api/part-orders' : '/api/part-inbound';
        
        await Promise.all(payloadArr.map(item => fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item)
        })));

        showToast(`บันทึกข้อมูลสำเร็จ ${payloadArr.length} รายการ!`);
        closeExcelPasteModal();
        loadAllData();
    } catch(err) { showToast('บันทึกล้มเหลว', 'error'); }
}

// ==========================================
// Excel Filter Functions
// ==========================================
function openExcelFilter(e, colIndex, title, tableId) {
    e.stopPropagation();
    currentFilterCol = colIndex;
    document.getElementById('ef_col_name').innerText = title;
    document.getElementById('ef_search').value = '';
    
    document.getElementById('excelFilterModal').setAttribute('data-target-table', tableId);

    const tbody = document.getElementById(tableId).querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const uniqueValues = new Set();
    rows.forEach(row => {
        if(row.cells.length <= 1) return;
        uniqueValues.add(getCellValue(row.cells[colIndex]));
    });

    const sortedValues = [...uniqueValues].sort();
    const listDiv = document.getElementById('ef_checkbox_list');
    listDiv.innerHTML = '';
    
    const activeSet = activeFilters[`${tableId}_${colIndex}`];

    sortedValues.forEach(val => {
        const isChecked = activeSet ? activeSet.has(val) : true;
        listDiv.innerHTML += `
            <label class="flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer ef-item transition border-b border-slate-100">
                <input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] mt-0.5 cursor-pointer w-3.5 h-3.5 rounded border-slate-300">
                <span class="text-slate-800 font-medium truncate w-full text-xs" title="${val}">${val === '' ? '(ว่าง)' : val}</span>
            </label>
        `;
    });

    const allChecked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);
    document.getElementById('ef_select_all').checked = allChecked;

    const modal = document.getElementById('excelFilterModal');
    const rect = e.target.closest('th').getBoundingClientRect();
    
    modal.style.top = (rect.bottom + 8) + 'px';
    let leftPos = rect.left;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px';
    
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeExcelFilter() {
    document.getElementById('excelFilterModal').classList.add('hidden');
    document.getElementById('excelFilterModal').classList.remove('flex');
}

function searchExcelFilter() {
    const txt = document.getElementById('ef_search').value.toLowerCase();
    document.querySelectorAll('.ef-item').forEach(label => {
        const val = label.querySelector('.ef-check').value.toLowerCase();
        label.style.display = val.includes(txt) ? 'flex' : 'none';
    });
}

function toggleAllExcelFilters(checked) { 
    document.querySelectorAll('.ef-item:not([style*="display: none"]) .ef-check').forEach(cb => cb.checked = checked); 
}

function applyExcelFilter() {
    const modal = document.getElementById('excelFilterModal');
    const tableId = modal.getAttribute('data-target-table');
    const filterKey = `${tableId}_${currentFilterCol}`;
    
    const checks = document.querySelectorAll('.ef-check');
    const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    
    const table = document.getElementById(tableId);
    const ths = table.querySelectorAll('thead th');
    
    let thIcon = null;
    if(ths[currentFilterCol]) thIcon = ths[currentFilterCol].querySelector('.filter-icon');

    if (checkedVals.length === checks.length || checkedVals.length === 0) {
        delete activeFilters[filterKey];
        if(thIcon) thIcon.classList.remove('text-amber-400');
    } else {
        activeFilters[filterKey] = new Set(checkedVals);
        if(thIcon) thIcon.classList.add('text-amber-400');
    }
    
    closeExcelFilter(); 
    executeTableFilter(tableId);
}

function clearSpecificExcelFilter() {
    const tableId = document.getElementById('excelFilterModal').getAttribute('data-target-table');
    const filterKey = `${tableId}_${currentFilterCol}`;
    
    delete activeFilters[filterKey];
    
    const ths = document.getElementById(tableId).querySelectorAll('thead th');
    if(ths[currentFilterCol]) {
        const thIcon = ths[currentFilterCol].querySelector('.filter-icon');
        if(thIcon) thIcon.classList.remove('text-amber-400');
    }
    
    closeExcelFilter(); 
    executeTableFilter(tableId);
}

function clearAllFilters() {
    activeFilters = {}; 
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400'); });
    ['poTable', 'inTable', 'outTable', 'stockTable', 'masterTable'].forEach(tid => {
        if(document.getElementById(tid)) executeTableFilter(tid);
    });
}

function executeTableFilter(tableId) {
    const table = document.getElementById(tableId);
    if(!table) return;
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(tr => {
        if(tr.cells.length <= 1) return;
        
        let show = true;
        for (let key in activeFilters) {
            if (!key.startsWith(`${tableId}_`)) continue;
            
            const colIdx = parseInt(key.split('_')[1]);
            const cellVal = getCellValue(tr.cells[colIdx]);
            
            if (!activeFilters[key].has(cellVal)) {
                show = false;
                break;
            }
        }
        tr.style.display = show ? '' : 'none';
    });
}

function initResizableColumns(tableId) {
    const table = document.getElementById(tableId);
    if(!table) return;
    const cols = table.querySelectorAll('th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer') || col.querySelector('.resizer-po');
        if(!resizer) return;
        let x = 0; let w = 0;
        
        const mouseDownHandler = function(e) {
            e.stopPropagation(); e.preventDefault();
            x = e.clientX;
            w = parseInt(window.getComputedStyle(col).width, 10);
            resizer.classList.add('bg-amber-400');
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        };
        const mouseMoveHandler = function(e) {
            const dx = e.clientX - x;
            const newW = Math.max(40, w + dx);
            col.style.width = `${newW}px`; col.style.minWidth = `${newW}px`;
        };
        const mouseUpHandler = function() {
            resizer.classList.remove('bg-amber-400');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };
        resizer.addEventListener('mousedown', mouseDownHandler);
    });
}