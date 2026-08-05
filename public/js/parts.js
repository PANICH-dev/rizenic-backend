// public/js/parts.js

const API_BASE_URL = window.location.origin;
let currentBranch = 'สำนักงานใหญ่';
let allInbounds = [], allGlobalParts = [], allGlobalJobs = [], allOutbounds = [], allPOStatuses = [];
let allMasterPartsData = [], allCarModelsFromDB = [];
let hideCompletedPO = true;

const cleanStr = (val) => String(val || '').trim().toUpperCase();

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    toast.className = `fixed bottom-5 right-5 text-white font-bold px-6 py-3 rounded-xl shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'} text-xl"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 2500);
}

function getTodayString() {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { 
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('main-app').classList.remove('flex');
        return; 
    }
    
    const allowedPages = (sessionStorage.getItem('accessible_pages') || '').split(',');
    if (!allowedPages.includes('parts')) { alert('⛔ คุณไม่มีสิทธิ์เข้าถึงหน้านี้ครับ!'); window.location.href = 'index.html'; return; }

    enterApp();

    // 🌟 Listener สำหรับดักจับการวาง (Paste) แบบตาราง Grid Excel
    const pasteBody = document.getElementById('paste_grid_tbody');
    if (pasteBody) {
        pasteBody.addEventListener('paste', function(e) {
            e.preventDefault();
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedData = clipboardData.getData('Text');
            if (!pastedData) return;
            
            const target = e.target;
            if (!target.classList.contains('paste-cell')) return;
            
            let startRow = parseInt(target.getAttribute('data-row')) || 0;
            let startCol = parseInt(target.getAttribute('data-col')) || 0;
            
            const rows = pastedData.split(/\r\n|\n|\r/).filter(row => row.trim() !== ''); 
            const numCols = document.getElementById('paste_grid_thead').querySelectorAll('th').length - 1;
            
            while (startRow + rows.length > pasteBody.children.length) { addPasteRow(); }
            
            rows.forEach((row, i) => {
                const cols = row.split('\t');
                cols.forEach((colData, j) => {
                    if (startCol + j < numCols) {
                        const input = pasteBody.querySelector(`input[data-row="${startRow + i}"][data-col="${startCol + j}"]`);
                        if (input && !input.readOnly) { 
                            let valToSet = colData.trim();
                            
                            // 🌟 แปลง format Excel (DD/MM/YYYY) เป็น (YYYY-MM-DD)
                            if (input.type === 'date') {
                                const dParts = valToSet.split(/[\/\-]/);
                                if(dParts.length === 3) {
                                    let d = dParts[0].padStart(2, '0');
                                    let m = dParts[1].padStart(2, '0');
                                    let y = dParts[2];
                                    if(y.length === 2) y = '20' + y;
                                    valToSet = `${y}-${m}-${d}`;
                                }
                            }
                            input.value = valToSet; 
                        }
                    }
                });
                
                const currentTr = pasteBody.querySelector(`input[data-row="${startRow + i}"]`).closest('tr');
                if(currentTr) autoFillGridRow(currentTr);
            });
        });
    }
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
            
            const accessiblePages = data.employee.accessible_pages || '';
            sessionStorage.setItem('accessible_pages', accessiblePages);
            const pagesArray = accessiblePages.split(',').filter(Boolean);

            if (pagesArray.length === 0) {
                alert('⛔ ไอดีของคุณยังไม่มีสิทธิ์เข้าหน้าใดเลย กรุณาติดต่อแอดมินครับ!');
                sessionStorage.clear(); return;
            }

            if (pagesArray.includes('parts')) { 
                enterApp(); 
            } else { 
                window.location.href = pagesArray[0] + '.html'; 
            }
        } else alert('❌ ' + data.error);
    } catch (err) { alert('❌ ระบบขัดข้อง'); }
}

function enterApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('main-app').classList.add('flex');
    
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'Staff';
    currentBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    document.getElementById('display_branch').innerText = currentBranch;
    
    loadAllData();
}

function logout() { sessionStorage.clear(); window.location.reload(); }

function switchTab(tabId) {
    document.querySelectorAll('.parts-tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    const tabIds = ['btn-tab-alert', 'btn-tab-po', 'btn-tab-inbound', 'btn-tab-outbound', 'btn-tab-stock', 'btn-tab-master'];
    tabIds.forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.className = "px-6 py-3.5 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-[#00320D] hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap rounded-t-xl transition-all";
    });
    document.getElementById('btn-' + tabId).classList.add('border-[#00320D]', 'text-[#00320D]', 'bg-green-50/80');
}

// ================= API Fast Updates =================
async function fastUpdatePO(id, field, value) {
    try { 
        const res = await fetch(`${API_BASE_URL}/api/part-orders/${id}/fast`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ field, value }) }); 
        if(!res.ok) throw new Error(); showToast('อัปเดตเรียบร้อย!'); 
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); loadAllData(); }
}
async function fastUpdateInbound(id, field, value) {
    try { 
        const res = await fetch(`${API_BASE_URL}/api/part-inbound/${id}/fast`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ field, value }) }); 
        if(!res.ok) throw new Error(); showToast('อัปเดตเรียบร้อย!'); 
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); loadAllData(); }
}
async function fastUpdateOutbound(id, field, value) {
    try { 
        const res = await fetch(`${API_BASE_URL}/api/part-outbound/${id}/fast`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ field, value }) }); 
        if(!res.ok) throw new Error(); showToast('อัปเดตเรียบร้อย!'); await loadAllData(); 
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); loadAllData(); }
}

// ================= Data Loaders =================
async function loadAllData() {
    try { 
        const nocache = `?_t=${new Date().getTime()}`;
        const [resIn, resOut, resJobs, resParts, resStatuses] = await Promise.all([
            fetch(`${API_BASE_URL}/api/part-inbound${nocache}`, { cache: 'no-store' }),
            fetch(`${API_BASE_URL}/api/part-outbound${nocache}`, { cache: 'no-store' }),
            fetch(`${API_BASE_URL}/api/reports${nocache}`, { cache: 'no-store' }),
            fetch(`${API_BASE_URL}/api/part-orders${nocache}`, { cache: 'no-store' }),
            fetch(`${API_BASE_URL}/api/part-statuses${nocache}`)
        ]);
        
        if(resIn.ok) allInbounds = await resIn.json(); 
        if(resOut.ok) allOutbounds = await resOut.json(); 
        if(resJobs.ok) allGlobalJobs = await resJobs.json();
        if(resParts.ok) allGlobalParts = await resParts.json();
        
        if(resStatuses.ok) {
            const statusData = await resStatuses.json();
            allPOStatuses = statusData.map(s => s.status_name || s);
        }
        if(!allPOStatuses || allPOStatuses.length === 0) {
            allPOStatuses = ['รออะไหล่', 'รอสั่งซื้อ', '06.สั่งอะไหล่', 'สั่งซื้อแล้ว', 'รออะไหล่', 'ติด Back Order', 'อะไหล่มาครบแล้ว', 'ตัดสต๊อก (มีของ)', 'ยกเลิก'];
        }

    } catch(e) { console.error("API Error", e); }
    loadSAOrders(); loadPOTracking(); loadInbound(); loadOutbound(); loadStockInHouse(); loadMasterParts(); loadCarModelsGrid();
}

function filterTableByText(tbodyId, text) {
    const q = text.toLowerCase().trim();
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    rows.forEach(row => {
        if (row.cells.length === 1 && row.cells[0].colSpan > 1) return;
        const rowText = row.innerText.toLowerCase();
        row.style.display = rowText.includes(q) ? '' : 'none';
    });
}

// ================= 1. SA ALERTS =================
function loadSAOrders() {
    try {
        const tbody = document.getElementById('sa_alerts_body');
        const jobsRoutedToParts = allGlobalJobs.filter(j => {
            const isBranchMatch = (j.branch_name === currentBranch || !j.branch_name || currentBranch === 'สำนักงานใหญ่');
            const isRoutingParts = j.department_routing === 'อะไหล่';
            const isStatusOrdering = j.job_status && (j.job_status.includes('สั่งอะไหล่') || j.job_status.includes('06.'));
            return isBranchMatch && (isRoutingParts || isStatusOrdering);
        });

        document.getElementById('alert_count').innerText = jobsRoutedToParts.length;
        document.getElementById('alert_count').className = jobsRoutedToParts.length > 0 ? "bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm" : "hidden";
        
        if(jobsRoutedToParts.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 font-bold">✅ ไม่มีคิวรถในแผนกอะไหล่ขณะนี้</td></tr>`; return; }

        tbody.innerHTML = jobsRoutedToParts.map(job => {
            const carPartsItems = (allGlobalParts || []).filter(p => cleanStr(p.car_plate) === cleanStr(job.car_plate));
            const displayEpc = [...new Set(carPartsItems.map(p => p.epc_no).filter(Boolean))].join(', ') || (job.epc_no || '-');
            const arrivedDate = job.arrived_date ? String(job.arrived_date).split('T')[0] : '-'; 

            let partsPreviewHTML = '<div class="flex flex-col gap-1 p-1">';
            if(carPartsItems.length === 0) partsPreviewHTML += `<span class="text-slate-400 italic">⚠️ ไม่มีรายการอะไหล่</span>`;
            else { carPartsItems.forEach(p => { partsPreviewHTML += `<div class="text-[11px] font-medium"><span class="font-mono text-blue-700 font-bold">${p.part_no}</span> | ${p.part_name} (x${p.qty_ordered}) [${p.order_status||'รออะไหล่'}]</div>`; }); }
            partsPreviewHTML += '</div>';

            return `
            <tr>
                <td class="px-2 font-black text-amber-700 bg-amber-50/50 text-center">${job.car_plate}</td>
                <td class="px-3 font-mono text-center">${arrivedDate}</td>
                <td class="px-3 font-medium">${job.car_brand} ${job.car_model || ''}</td>
                <td class="px-3 truncate">${job.customer_name || '-'}</td>
                <td class="px-3 font-mono text-amber-700 font-bold">${displayEpc}</td>
                <td class="whitespace-normal p-1">${partsPreviewHTML}</td>
                <td class="text-center p-1"><button onclick="openCarPartsDetailsModal('${job.car_plate}', '${job.epc_no||'-'}')" class="bg-[#00320D] text-white font-black px-3 py-1.5 rounded-lg text-xs shadow hover:bg-black transition"><i class="fa-solid fa-folder-open text-amber-400"></i> เปิดโต๊ะคีย์</button></td>
            </tr>`;
        }).join('');
    } catch(e){}
}

function openCarPartsDetailsModal(carPlate, epcNo) {
    document.getElementById('modal_job_id').value = carPlate; 
    document.getElementById('modal_epc').value = epcNo !== '-' ? epcNo : '';
    const container = document.getElementById('modal_dynamic_table_container');
    const carParts = (allGlobalParts || []).filter(p => cleanStr(p.car_plate) === cleanStr(carPlate));
    
    let html = `
    <div class="overflow-x-auto border border-slate-300 shadow-sm rounded-xl bg-white min-h-[150px]">
        <table class="excel-grid-table w-full" id="dynamic_po_table">
            <thead class="sticky top-0 z-10 shadow-sm">
                <tr>
                    <th class="excel-grid-th text-center bg-[#00320D] text-white" style="width:50px;">#</th>
                    <th class="excel-grid-th bg-[#00320D] text-white" style="width:130px;">EPC No</th>
                    <th class="excel-grid-th bg-[#00320D] text-white" style="width:150px;">บาร์โค้ด (Part 2)</th>
                    <th class="excel-grid-th bg-[#00320D] text-white" style="width:130px;">MAIN No.</th>
                    <th class="excel-grid-th bg-[#00320D] text-white" style="width:250px;">ชื่อชิ้นส่วน</th>
                    <th class="excel-grid-th text-center bg-[#00320D] text-white" style="width:90px;">ยอดสั่ง</th>
                    <th class="excel-grid-th bg-[#00320D] text-white" style="width:180px;">สถานะมาร์คของ</th>
                    <th class="excel-grid-th text-center bg-[#00320D] text-white" style="width:130px;">คาดการณ์ (ETA)</th>
                    <th class="excel-grid-th bg-[#00320D] text-white" style="width:200px;">หมายเหตุ</th>
                    <th class="excel-grid-th bg-[#00320D] text-white text-center" style="width:80px;">จัดการ</th>
                </tr>
            </thead>
            <tbody id="dynamic_po_tbody">`;

    if(carParts.length > 0) {
        carParts.forEach((p, idx) => {
            const orderId = p.order_id || p.id;
            let currentStatus = p.order_status || 'รออะไหล่'; 
            
            let dropdownHtml = allPOStatuses.map(s => {
                return `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${s}</option>`;
            }).join('');
            
            if(!dropdownHtml.includes('ตัดสต๊อก')) {
                dropdownHtml += `<option value="ตัดสต๊อก (มีของ)" ${currentStatus === 'ตัดสต๊อก (มีของ)' ? 'selected' : ''}>✔️ ตัดสต๊อก (มีของ)</option>`;
            }
            if(!dropdownHtml.includes('selected')) dropdownHtml = `<option value="${currentStatus}" selected>${currentStatus}</option>` + dropdownHtml;

            html += `
            <tr data-id="${orderId}" class="hover:bg-amber-50/50 transition-colors group">
                <td class="excel-cell text-center font-black text-slate-400 bg-slate-50">${idx + 1}</td>
                <td class="excel-cell"><input type="text" class="excel-input font-mono text-amber-700 font-bold po-epc" value="${p.epc_no || ''}"></td>
                <td class="excel-cell"><input type="text" list="master_parts_datalist" class="excel-input font-mono font-bold text-blue-700 po-partno" value="${p.part_no || ''}" onchange="fetchMasterPartInline(this)" onblur="fetchMasterPartInline(this)"></td>
                <td class="excel-cell"><input type="text" class="excel-input font-mono text-slate-500 po-main" value="${p.part_main_no || ''}"></td>
                <td class="excel-cell"><input type="text" class="excel-input font-medium po-partname" value="${p.part_name || ''}"></td>
                <td class="excel-cell"><input type="number" class="excel-input text-center font-black text-lg text-emerald-700 bg-emerald-50 focus:bg-white po-qty" value="${p.qty_ordered || 1}"></td>
                <td class="excel-cell"><select class="excel-select font-bold text-blue-900 bg-blue-50 focus:bg-white po-status">${dropdownHtml}</select></td>
                <td class="excel-cell"><input type="date" class="excel-input text-center font-mono text-slate-600 po-eta" value="${p.est_arrival_date ? String(p.est_arrival_date).split('T')[0] : ''}"></td>
                <td class="excel-cell"><input type="text" class="excel-input text-slate-500 po-note w-full" value="${p.notes || ''}"></td>
                <td class="excel-cell text-center"><button type="button" onclick="deletePOItem('${orderId}')" class="text-red-400 hover:text-red-600 px-3 transition"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
    } else { html += `<tr id="empty_po_row"><td colspan="10" class="text-center py-10 text-slate-400 font-bold bg-slate-50">ยังไม่มีรายการสั่งซื้อสำหรับรถคันนี้ กดเพิ่มรายการด้านล่างได้เลยครับ</td></tr>`; }

    html += `</tbody></table></div>`;
    html += `<div class="mt-4 flex flex-wrap gap-3"><button type="button" onclick="addNewPORow('${carPlate}')" class="px-5 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition shadow-sm flex items-center gap-2"><i class="fa-solid fa-plus"></i> เพิ่มรายการอะไหล่ให้รถคันนี้</button></div>`;
    
    container.innerHTML = html;
    document.getElementById('alertModal').classList.replace('hidden', 'flex');
}

function addNewPORow(carPlate) {
    const tbody = document.getElementById('dynamic_po_tbody'); if(!tbody) return;
    const emptyRow = document.getElementById('empty_po_row'); if(emptyRow) emptyRow.closest('tr').remove();
    
    const epcNo = document.getElementById('modal_epc').value || '';
    let dropdownHtml = allPOStatuses.map(s => `<option value="${s}" ${s === 'รออะไหล่' ? 'selected' : ''}>${s}</option>`).join('');
    if(!dropdownHtml.includes('ตัดสต๊อก')) dropdownHtml += `<option value="ตัดสต๊อก (มีของ)">✔️ ตัดสต๊อก (มีของ)</option>`;
    if(!dropdownHtml.includes('selected')) dropdownHtml = `<option value="รออะไหล่" selected>รออะไหล่</option>` + dropdownHtml;
    
    const tr = document.createElement('tr'); tr.className = "hover:bg-amber-50/50 transition-colors group bg-blue-50/30";
    tr.innerHTML = `
        <td class="excel-cell text-center font-black text-blue-500 bg-blue-50">NEW</td>
        <td class="excel-cell"><input type="text" class="excel-input font-mono text-amber-700 font-bold po-epc" value="${epcNo}"></td>
        <td class="excel-cell"><input type="text" list="master_parts_datalist" class="excel-input font-mono font-bold text-blue-700 po-partno" value="" onchange="fetchMasterPartInline(this)" onblur="fetchMasterPartInline(this)" placeholder="บาร์โค้ด..."></td>
        <td class="excel-cell"><input type="text" class="excel-input font-mono text-slate-500 po-main" value=""></td>
        <td class="excel-cell"><input type="text" class="excel-input font-medium po-partname" value=""></td>
        <td class="excel-cell"><input type="number" class="excel-input text-center font-black text-lg text-emerald-700 bg-emerald-50 focus:bg-white po-qty" value="1"></td>
        <td class="excel-cell"><select class="excel-select font-bold text-blue-900 bg-blue-50 focus:bg-white po-status">${dropdownHtml}</select></td>
        <td class="excel-cell"><input type="date" class="excel-input text-center font-mono text-slate-600 po-eta"></td>
        <td class="excel-cell"><input type="text" class="excel-input text-slate-500 po-note w-full" placeholder="ระบุหมายเหตุ..."></td>
        <td class="excel-cell text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-red-400 hover:text-red-600 px-3 transition"><i class="fa-solid fa-xmark text-lg"></i></button></td>
    `;
    tbody.appendChild(tr);
}

async function fetchMasterPartInline(inputElem) {
    const n = inputElem.value.trim(); if(!n) return;
    try {
        const tr = inputElem.closest('tr');
        const mainInp = tr.querySelector('.po-main'); 
        const nameInp = tr.querySelector('.po-partname');
        const noteInp = tr.querySelector('.po-note');
        
        // 🌟 1. ดึงข้อมูลจาก Local Master Data ทันทีที่เลือก Dropdown (เร็วขึ้น 10 เท่า)
        let data = allMasterPartsData.find(m => cleanStr(m.part_no) === cleanStr(n));
        
        // 🌟 2. ถ้าพิมพ์ของใหม่ที่ยังไม่เคยมีในเครื่อง ค่อยวิ่งไปหาจาก Database
        if (!data) {
            const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(n)}`); 
            if(res.ok) data = await res.json();
        }

        if(data && data.part_name) {
            if(mainInp && !mainInp.value) mainInp.value = data.part_main_no || '-';
            if(nameInp && !nameInp.value) nameInp.value = data.part_name || '-';
            
            // ระบบคำนวณและแจ้งเตือนจำนวนสต๊อกในหมายเหตุ
            const branchIn = allInbounds.filter(i => i.branch_name === currentBranch && cleanStr(i.part_no) === cleanStr(n));
            const branchOut = allOutbounds.filter(o => o.branch_name === currentBranch && cleanStr(o.part_no) === cleanStr(n));
            
            const tIn = branchIn.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
            const tOutIssued = branchOut.filter(o => o.job_status !== 'รอเข้าซ่อม').reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
            const tOutBooked = branchOut.filter(o => o.job_status === 'รอเข้าซ่อม').reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
            
            const availableStock = tIn - tOutIssued - tOutBooked;
            
            if(noteInp) {
                if (availableStock > 0) {
                    noteInp.value = `📦 มีพร้อมใช้ในคลัง ${availableStock} ชิ้น`;
                    noteInp.classList.add('text-emerald-700', 'font-black', 'bg-emerald-100');
                } else {
                    if(noteInp.value.includes('มีพร้อมใช้ในคลัง')) noteInp.value = '';
                    noteInp.classList.remove('text-emerald-700', 'font-black', 'bg-emerald-100');
                }
            }
        }
    } catch(e) {}
}

async function saveSAAlertUpdate(e) {
    e.preventDefault(); 
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML; 
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; 
    submitBtn.disabled = true;

    setTimeout(async () => {
        try {
            const carPlate = document.getElementById('modal_job_id').value;
            const rows = document.querySelectorAll('#modal_dynamic_table_container tbody tr');
            
            const job = allGlobalJobs.find(j => cleanStr(j.car_plate) === cleanStr(carPlate)) || {};
            const qtNo = (job.qt_no || '').split(',')[0].trim() || null;
            const soNo = (job.so_no || '').split(',')[0].trim() || null;
            const vinNo = job.vin_no || null;
            const carModel = job.car_model || null;

            const tasks = Array.from(rows).map(async (row) => {
                const orderId = String(row.getAttribute('data-id') || '');
                
                const pNoInp = row.querySelector('.po-partno');
                const pNameInp = row.querySelector('.po-partname');
                const epcInp = row.querySelector('.po-epc');
                const mainInp = row.querySelector('.po-main');
                const qtyInp = row.querySelector('.po-qty');
                const statusInp = row.querySelector('.po-status');
                const etaInp = row.querySelector('.po-eta');
                const noteInp = row.querySelector('.po-note');

                const partNo = pNoInp ? pNoInp.value.trim() : '';
                const partName = pNameInp ? pNameInp.value.trim() : '';
                
                if(!partNo && !partName) return Promise.resolve(); 

                const epcNo = epcInp ? epcInp.value.trim() : null; 
                const mainNo = mainInp ? mainInp.value.trim() : null;
                const qty = parseInt(qtyInp?.value, 10) || 1; 
                const status = statusInp?.value || 'รออะไหล่';
                
                let eta = etaInp?.value;
                eta = (eta && eta.trim() !== '') ? eta.trim() : null; 
                
                const notes = noteInp?.value || null;
                const isStocked = status === 'ตัดสต๊อก (มีของ)';

                const isValidId = orderId && !['NEW', 'undefined', 'null', ''].includes(orderId);

                if(isValidId) {
                    const p = allGlobalParts.find(x => String(x.id || x.order_id) === orderId) || {};
                    
                    const rcvDate = p.received_date ? String(p.received_date).split('T')[0] : null;
                    const ordDate = p.order_date ? String(p.order_date).split('T')[0] : null;

                    const updatePayload = {
                        epc_no: epcNo, part_no: partNo || '-', part_main_no: mainNo, 
                        part_name: partName || '-', qty_ordered: qty, order_status: status, 
                        est_arrival_date: eta, notes: notes, received_date: rcvDate,
                        qt_no: p.qt_no || qtNo, so_no: p.so_no || soNo, order_date: ordDate,
                        car_plate: p.car_plate || carPlate || null, vin_no: p.vin_no || vinNo,
                        car_model: p.car_model || carModel, part_type: p.part_type || 'อะไหล่หลัก'
                    };

                    await fetch(`${API_BASE_URL}/api/part-orders/${orderId}`, {
                        method: 'PUT', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(updatePayload)
                    }).then(async res => { 
                        if(!res.ok) {
                            const errDetails = await res.text();
                            throw new Error(`PUT Error: ${errDetails}`);
                        }
                    });

                    const matchingOutbound = allOutbounds.find(o => cleanStr(o.car_plate) === cleanStr(carPlate) && cleanStr(o.part_no) === cleanStr(partNo) && o.job_status === 'รอเข้าซ่อม');
                    if (matchingOutbound) {
                        await fetch(`${API_BASE_URL}/api/part-outbound/${matchingOutbound.outbound_id || matchingOutbound.id}/fast`, {
                            method: 'PUT', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ field: 'qty', value: qty })
                        }).catch(() => console.warn('Update Outbound Qty fail'));
                    }

                } else {
                    if (!isStocked) {
                        await fetch(`${API_BASE_URL}/api/part-orders`, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                qt_no: qtNo, so_no: soNo, epc_no: epcNo, order_date: getTodayString(), 
                                est_arrival_date: eta, car_plate: carPlate || null, vin_no: vinNo, 
                                car_model: carModel, part_main_no: mainNo, part_no: partNo || '-', 
                                part_name: partName || '-', qty_ordered: qty, part_type: 'อะไหล่หลัก', 
                                notes: notes, branch_name: currentBranch, order_status: status
                            })
                        }).then(async res => { 
                            if(!res.ok) {
                                const errDetails = await res.text();
                                throw new Error(`POST PO Error: ${errDetails}`);
                            }
                        });
                    }
                    
                    await fetch(`${API_BASE_URL}/api/part-outbound`, {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            issue_date: getTodayString(), part_no: partNo || '-', part_main_no: mainNo, 
                            part_name: partName || '-', qty: qty, car_plate: carPlate || null, 
                            qt_no: qtNo, so_no: soNo, unit_price: 0, car_model: carModel, 
                            job_status: isStocked ? 'เบิกอะไหล่' : 'รอเข้าซ่อม', 
                            part_type: 'อะไหล่หลัก', branch_name: currentBranch
                        })
                    }).then(async res => { 
                        if(!res.ok) {
                            const errDetails = await res.text();
                            throw new Error(`POST Outbound Error: ${errDetails}`);
                        }
                    });
                }
            }); 

            const validTasks = tasks.filter(t => t !== undefined);

            if(validTasks.length === 0) { 
                showToast('ไม่มีข้อมูลให้บันทึก', 'success'); 
                submitBtn.innerHTML = originalText; 
                submitBtn.disabled = false; 
                return; 
            }

            const results = await Promise.allSettled(validTasks);
            const failed = results.filter(r => r.status === 'rejected');

            await loadAllData(); 
            closeAlertModal();

            if (failed.length === validTasks.length) {
                const failReason = failed[0].reason?.message || 'Unknown Error';
                showToast(`บันทึกพลาด! สาเหตุ: ${failReason.substring(0, 50)}`, 'error');
            } else if (failed.length > 0) {
                showToast('บันทึกสำเร็จบางส่วน มีบางรายการผิดพลาด', 'error');
            } else {
                showToast('บันทึกโต๊ะคีย์เรียบร้อย!');
            }

        } catch(err) { 
            console.error("Save Alert Error:", err);
            showToast(`พังร้ายแรง: ${err.message}`, 'error'); 
        } finally { 
            submitBtn.innerHTML = originalText; 
            submitBtn.disabled = false; 
        }
    }, 16);
}

function closeAlertModal() {
    const modal = document.getElementById('alertModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function deletePOItem(id) {
    if(confirm('🚨 ลบรายการสั่งซื้อนี้?')) {
        try { await fetch(`${API_BASE_URL}/api/part-orders/${id}`, { method: 'DELETE' }); showToast('ลบสำเร็จ'); closeAlertModal(); loadAllData(); } catch(e){}
    }
}

// ================= Excel Paste =================
function openExcelPasteModal(targetType) {
    document.getElementById('paste_target_type').value = targetType;
    const thead = document.getElementById('paste_grid_thead');
    const tbody = document.getElementById('paste_grid_tbody');
    
    let cols = [];
    if (targetType === 'po') {
        cols = ['ทะเบียนรถ', 'EPC No *', 'บาร์โค้ด', 'ยอดสั่ง *', 'คาดการณ์เข้า', 'ชื่ออะไหล่ (Auto)', 'MAIN No (Auto)'];
        document.getElementById('paste_modal_title').innerHTML = '<i class="fa-solid fa-bolt text-amber-500"></i> แอดใบสั่งซื้อศูนย์หลายรายการด่วน (Excel Paste)';
    } else {
        cols = ['วันที่รับ', 'EPC No *', 'บาร์โค้ด', 'จำนวน *', 'ชื่ออะไหล่ (Auto)', 'MAIN No (Auto)'];
        document.getElementById('paste_modal_title').innerHTML = '<i class="fa-solid fa-bolt text-emerald-500"></i> รับเข้าคลังแบบด่วน (Excel Paste)';
    }
    
    thead.innerHTML = `<tr><th class="excel-grid-th bg-[#00320D] text-white w-10 text-center">#</th>` + 
                      cols.map(c => `<th class="excel-grid-th bg-[#00320D] text-white text-center">${c}</th>`).join('') + `</tr>`;
    
    tbody.innerHTML = '';
    for(let r=0; r<10; r++) { addPasteRow(); }
    
    document.getElementById('excelPasteModal').classList.replace('hidden', 'flex');
}

function closeExcelPasteModal() { document.getElementById('excelPasteModal').classList.replace('flex', 'hidden'); }

// 🎯 กำหนดให้ช่องวันที่เป็น type="date"
function addPasteRow() {
    const targetType = document.getElementById('paste_target_type').value;
    const tbody = document.getElementById('paste_grid_tbody');
    const colsCount = document.getElementById('paste_grid_thead').querySelectorAll('th').length - 1; 
    const rIdx = tbody.children.length;
    
    let tr = document.createElement('tr');
    tr.innerHTML = `<td class="excel-cell text-center font-bold text-slate-400 bg-slate-50">${rIdx + 1}</td>`;
    for(let c=0; c<colsCount; c++) {
        const isReadonly = (targetType === 'po' && (c === 5 || c === 6)) || (targetType === 'inbound' && (c === 4 || c === 5));
        
        let inputType = "text";
        let defaultVal = "";
        if (targetType === 'po' && c === 4) inputType = "date"; 
        if (targetType === 'inbound' && c === 0) { 
            inputType = "date"; 
            defaultVal = getTodayString(); 
        }
        
        tr.innerHTML += `<td class="excel-cell"><input type="${inputType}" value="${defaultVal}" class="excel-input paste-cell w-full ${isReadonly ? 'bg-slate-100 text-slate-500 font-bold text-center' : ''}" data-row="${rIdx}" data-col="${c}" ${isReadonly ? 'readonly tabindex="-1"' : ''} onblur="autoFillGridRow(this.closest('tr'))"></td>`;
    }
    tbody.appendChild(tr);
}

// 🎯 ดึงข้อมูลจาก Master Data API แบบ Real-time
async function autoFillGridRow(tr) {
    const targetType = document.getElementById('paste_target_type').value;
    const inputs = tr.querySelectorAll('input');
    if(inputs.length < 4) return;
    
    const epcIdx = 1; 
    const pNoIdx = 2; 
    const nameIdx = targetType === 'po' ? 5 : 4;
    const mainIdx = targetType === 'po' ? 6 : 5; 
    
    let epc = inputs[epcIdx].value.trim();
    let pNo = inputs[pNoIdx].value.trim();
    
    if(!epc && !pNo) return;

    let foundPart = null;
    if (pNo) foundPart = allMasterPartsData.find(m => cleanStr(m.part_no) === cleanStr(pNo));
    if (!foundPart && (epc || pNo)) {
        foundPart = allGlobalParts.find(g => (pNo && cleanStr(g.part_no) === cleanStr(pNo)) || (epc && cleanStr(g.epc_no) === cleanStr(epc)));
    }
    
    if (!foundPart && pNo) {
        try {
            if (inputs[nameIdx]) inputs[nameIdx].value = 'กำลังค้นหา...';
            const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(pNo)}`);
            if (res.ok) {
                const resData = await res.json();
                const data = Array.isArray(resData) ? resData[0] : (resData.data ? (Array.isArray(resData.data) ? resData.data[0] : resData.data) : resData);
                if (data && (data.part_name || data.part_no)) {
                    foundPart = data;
                    allMasterPartsData.push(foundPart); 
                }
            }
        } catch(e) {}
    }
    
    if (foundPart) {
        if (!pNo && foundPart.part_no) inputs[pNoIdx].value = foundPart.part_no;
        if (!epc && foundPart.epc_no) inputs[epcIdx].value = foundPart.epc_no;
        if (inputs[nameIdx]) inputs[nameIdx].value = foundPart.part_name || '-';
        if (inputs[mainIdx]) inputs[mainIdx].value = foundPart.part_main_no || '-';
    } else {
        if (inputs[nameIdx] && inputs[nameIdx].value === 'กำลังค้นหา...') {
            inputs[nameIdx].value = 'ไม่พบในระบบ'; 
        }
    }
}

function processExcelPasteData() {
    const targetType = document.getElementById('paste_target_type').value;
    const tbody = document.getElementById('paste_grid_tbody');
    const trs = tbody.querySelectorAll('tr');
    let promises = [];
    
    const btn = document.getElementById('btn_submit_paste');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    setTimeout(async () => {
        trs.forEach(tr => {
            const inputs = tr.querySelectorAll('input');
            if(inputs.length === 0) return;
            
            if (targetType === 'po') {
                const plate = inputs[0].value.trim() || '-';
                const epc = inputs[1].value.trim();
                const pNo = inputs[2].value.trim();
                const qty = parseInt(inputs[3].value.trim());
                const eta = inputs[4].value.trim() || null;
                let pName = inputs[5].value.trim();
                let mainInp = inputs[6] ? inputs[6].value.trim() : null;
                
                if (pNo || epc) {
                    if(!mainInp || mainInp === '-') {
                        const mPart = allMasterPartsData.find(m => cleanStr(m.part_no) === cleanStr(pNo));
                        if(mPart) mainInp = mPart.part_main_no;
                        else {
                            const gPart = allGlobalParts.find(g => cleanStr(g.part_no) === cleanStr(pNo) || (epc && cleanStr(g.epc_no) === cleanStr(epc)));
                            if(gPart) mainInp = gPart.part_main_no;
                        }
                    }

                    promises.push(fetch(`${API_BASE_URL}/api/part-orders`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            car_plate: plate, part_no: pNo || '-', epc_no: epc || null, part_main_no: mainInp || null,
                            part_name: pName || '-', qty_ordered: isNaN(qty) ? 1 : qty, est_arrival_date: eta,
                            branch_name: currentBranch, order_status: 'รออะไหล่', order_date: getTodayString() 
                        })
                    }));
                }
            } else {
                const rDate = inputs[0].value.trim() || getTodayString();
                const epc = inputs[1].value.trim();
                const pNo = inputs[2].value.trim();
                const qty = parseInt(inputs[3].value.trim());
                let pName = inputs[4].value.trim();
                let mainInp = inputs[5] ? inputs[5].value.trim() : null;
                
                if (pNo || epc) {
                    let model = null; let price = 0;
                    const mPart = allMasterPartsData.find(m => cleanStr(m.part_no) === cleanStr(pNo));
                    if(mPart) { if(!mainInp || mainInp==='-') mainInp = mPart.part_main_no; model = mPart.car_model; price = mPart.unit_price; }
                    else {
                        const gPart = allGlobalParts.find(g => cleanStr(g.part_no) === cleanStr(pNo) || (epc && cleanStr(g.epc_no) === cleanStr(epc)));
                        if(gPart) { if(!mainInp || mainInp==='-') mainInp = gPart.part_main_no; model = gPart.car_model; price = gPart.unit_price; }
                    }

                    promises.push(fetch(`${API_BASE_URL}/api/part-inbound`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            received_date: rDate, epc_no: epc || null, part_no: pNo || '-', part_main_no: mainInp || null,
                            part_name: pName || '-', car_model: model, qty: isNaN(qty) ? 1 : qty, unit_price: price, branch_name: currentBranch
                        })
                    }));
                }
            }
        });

        if (promises.length === 0) {
            alert('⚠️ ไม่พบข้อมูลที่ต้องการบันทึก!');
            btn.innerHTML = oldHtml; btn.disabled = false; return;
        }

        try {
            await Promise.all(promises);
            showToast(`นำเข้าสำเร็จ ${promises.length} รายการ!`);
            closeExcelPasteModal();
            requestAnimationFrame(() => loadAllData());
        } catch(e) { showToast('นำเข้าข้อมูลบางรายการขัดข้อง', 'error'); } 
        finally { btn.innerHTML = oldHtml; btn.disabled = false; }
    }, 10);
}

// ================= PO Tracking & Others =================
function loadPOTracking() {
    try {
        const tbody = document.getElementById('po_table_body');
        const myPOs = (allGlobalParts || []).filter(o => o.branch_name === currentBranch || !o.branch_name || currentBranch === 'สำนักงานใหญ่');
        if (myPOs.length === 0) { tbody.innerHTML = `<tr><td colspan="13" class="text-center py-10 text-slate-400">ไม่มีประวัติใบสั่งซื้อ</td></tr>`; return; }

        let html = '';
        myPOs.forEach(o => {
            const orderId = o.order_id || o.id;
            let currentStatus = o.order_status || 'รออะไหล่'; 
            let dropdownHtml = allPOStatuses.map(s => `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${s}</option>`).join('');
            if(!dropdownHtml.includes('selected')) dropdownHtml = `<option value="${currentStatus}" selected>${currentStatus}</option>` + dropdownHtml;

            const inbounds = allInbounds.filter(i => cleanStr(i.part_no) === cleanStr(o.part_no) && (cleanStr(i.epc_no) === cleanStr(o.epc_no) || !i.epc_no || !o.epc_no));
            const rcvQty = inbounds.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
            const isAllReceived = rcvQty >= (parseInt(o.qty_ordered) || 1);
            if (hideCompletedPO && isAllReceived) return;

            html += `
            <tr>
                <td class="font-mono p-1 text-center"><input type="text" value="${o.epc_no || ''}" onchange="fastUpdatePO('${orderId}', 'epc_no', this.value)" class="inline-edit-input font-bold text-amber-700 text-center"></td>
                <td class="font-mono p-1"><input type="text" value="${o.part_no || ''}" onchange="fastUpdatePO('${orderId}', 'part_no', this.value)" class="inline-edit-input font-bold text-blue-600"></td>
                <td class="px-2 text-center font-black text-rose-600">${o.car_plate || '-'}</td>
                <td class="p-1"><select onchange="fastUpdatePO('${orderId}', 'order_status', this.value)" class="inline-edit-select bg-slate-50 w-full">${dropdownHtml}</select></td>
                <td class="text-center p-1"><input type="number" value="${o.qty_ordered}" onchange="fastUpdatePO('${orderId}', 'qty_ordered', this.value)" class="inline-edit-input font-black text-center w-full"></td>
                <td class="text-center font-black text-emerald-600">${rcvQty}</td>
                <td class="p-1"><input type="text" value="${o.part_name || ''}" onchange="fastUpdatePO('${orderId}', 'part_name', this.value)" class="inline-edit-input font-bold w-full"></td>
                <td class="font-mono text-center text-slate-500 px-2">${o.order_date ? String(o.order_date).split('T')[0] : '-'}</td>
                <td class="font-mono p-1"><input type="date" value="${o.est_arrival_date ? String(o.est_arrival_date).split('T')[0] : ''}" onchange="fastUpdatePO('${orderId}', 'est_arrival_date', this.value)" class="inline-edit-input text-center"></td>
                <td class="font-mono p-1"><input type="date" value="${o.part_received_all_date ? String(o.part_received_all_date).split('T')[0] : ''}" onchange="fastUpdatePO('${orderId}', 'part_received_all_date', this.value)" class="inline-edit-input text-center"></td>
                <td class="p-1"><input type="text" value="${o.notes || ''}" onchange="fastUpdatePO('${orderId}', 'notes', this.value)" class="inline-edit-input w-full" placeholder="-"></td>
                <td class="font-mono p-1"><input type="text" value="${o.part_main_no || ''}" onchange="fastUpdatePO('${orderId}', 'part_main_no', this.value)" class="inline-edit-input font-bold text-slate-500 w-full"></td>
                <td class="text-center py-1"><button onclick="deleteRow('/api/part-orders/${orderId}')" class="text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch(e){}
}

function toggleCompletedPO() { hideCompletedPO = !hideCompletedPO; loadPOTracking(); }

function openPOModal() {
    document.getElementById('poForm').reset();
    document.getElementById('edit_po_id').value = '';
    document.getElementById('po_date').value = getTodayString();
    document.getElementById('po_bo').innerHTML = allPOStatuses.map(s => `<option value="${s}" ${s === 'รออะไหล่' ? 'selected' : ''}>${s}</option>`).join('');
    document.getElementById('poModal').classList.replace('hidden', 'flex');
}
function closePOModal() { document.getElementById('poModal').classList.replace('flex', 'hidden'); }
async function submitPO(e) {
    e.preventDefault();
    const payload = {
        qt_no: document.getElementById('po_qt').value, so_no: document.getElementById('po_so').value, epc_no: document.getElementById('po_epc').value, 
        order_date: document.getElementById('po_date').value, est_arrival_date: document.getElementById('po_est').value || null, part_received_all_date: document.getElementById('po_rcv_all_date').value || null,
        order_status: document.getElementById('po_bo').value || 'รออะไหล่', car_plate: document.getElementById('po_plate').value.toUpperCase(), part_no: document.getElementById('po_part_no').value.toUpperCase(), 
        qty_ordered: parseInt(document.getElementById('po_qty').value) || 1, notes: document.getElementById('po_note').value, part_main_no: document.getElementById('po_part_main').value,
        part_name: document.getElementById('po_part_name').value, part_type: document.getElementById('po_type').value || 'อะไหล่หลัก', car_model: document.getElementById('po_model').value, 
        vin_no: document.getElementById('po_vin').value, branch_name: currentBranch
    };
    const id = document.getElementById('edit_po_id').value;
    const method = id ? 'PUT' : 'POST'; const url = id ? `${API_BASE_URL}/api/part-orders/${id}` : `${API_BASE_URL}/api/part-orders`;
    try {
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(!res.ok) throw new Error(); showToast('บันทึก PO สำเร็จ!'); closePOModal(); loadAllData();
    } catch(err) { showToast('เกิดข้อผิดพลาด', 'error'); }
}
async function fetchMasterPart(p) {
    const input = document.getElementById(`${p}_part_no`); if(!input) return;
    const n = input.value.trim(); if(!n) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(n)}`); const d = await res.json();
        if(d && d.part_name) {
            if(document.getElementById(`${p}_part_main`)) document.getElementById(`${p}_part_main`).value = d.part_main_no || '-';
            if(document.getElementById(`${p}_part_name`)) document.getElementById(`${p}_part_name`).value = d.part_name || '-';
            if(document.getElementById(`${p}_model`)) document.getElementById(`${p}_model`).value = d.car_model || '-';
            if(document.getElementById(`${p}_type`)) document.getElementById(`${p}_type`).value = d.part_category || 'อะไหล่หลัก';
            if(document.getElementById(`${p}_price`)) document.getElementById(`${p}_price`).value = d.unit_price || 0;
            if(typeof calcEditInTotal === 'function') calcEditInTotal();
        }
    } catch(e) {}
}

function loadInbound() {
    try {
        const tbody = document.getElementById('inbound_table_body');
        tbody.innerHTML = allInbounds.filter(d => d.branch_name === currentBranch).slice(0, 50).map(d => `
            <tr>
                <td class="font-mono p-1"><input type="date" value="${d.received_date ? String(d.received_date).split('T')[0] : ''}" onchange="fastUpdateInbound('${d.inbound_id}', 'received_date', this.value)" class="inline-edit-input text-center"></td>
                <td class="font-mono p-1"><input type="text" value="${d.epc_no||''}" onchange="fastUpdateInbound('${d.inbound_id}', 'epc_no', this.value)" class="inline-edit-input text-center text-amber-700 font-bold"></td>
                <td class="font-mono p-1"><input type="text" value="${d.part_no||''}" onchange="fastUpdateInbound('${d.inbound_id}', 'part_no', this.value)" class="inline-edit-input font-bold text-emerald-600"></td>
                <td class="font-mono p-1"><input type="text" value="${d.part_main_no||''}" onchange="fastUpdateInbound('${d.inbound_id}', 'part_main_no', this.value)" class="inline-edit-input text-slate-500 text-xs"></td>
                <td class="p-1"><input type="text" value="${d.part_name||''}" onchange="fastUpdateInbound('${d.inbound_id}', 'part_name', this.value)" class="inline-edit-input font-bold"></td>
                <td class="p-1"><input type="number" value="${d.qty||1}" onchange="fastUpdateInbound('${d.inbound_id}', 'qty', this.value)" class="inline-edit-input font-black text-emerald-600 bg-emerald-50 text-center"></td>
                <td class="p-1"><input type="number" value="${parseFloat(d.unit_price||0).toFixed(2)}" onchange="fastUpdateInbound('${d.inbound_id}', 'unit_price', this.value)" class="inline-edit-input text-right font-mono"></td>
                <td class="text-center py-1"><button onclick="openEditInboundModal('${d.id||d.inbound_id}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded mr-1"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRow('/api/part-inbound/${d.inbound_id}')" class="text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`).join('');
    } catch(e){}
}

function openInboundModal() {
    const tbody = document.getElementById('multi_inbound_body'); tbody.innerHTML = '';
    const pendingPOs = allGlobalParts.filter(po => {
        if(po.branch_name !== currentBranch || po.order_status === 'ยกเลิก' || po.order_status === 'ตัดสต๊อก (มีของ)') return false;
        const inbounds = allInbounds.filter(i => cleanStr(i.part_no) === cleanStr(po.part_no) && cleanStr(i.epc_no) === cleanStr(po.epc_no));
        return inbounds.reduce((s, item) => s + (parseInt(item.qty) || 0), 0) < (parseInt(po.qty_ordered) || 0);
    });
    if(pendingPOs.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 font-bold bg-slate-50">ไม่มีค้างรับ 🎉</td></tr>`; } 
    else {
        let html = ''; const tStr = getTodayString();
        pendingPOs.forEach(po => {
            const rcvQty = allInbounds.filter(i => cleanStr(i.part_no) === cleanStr(po.part_no) && cleanStr(i.epc_no) === cleanStr(po.epc_no)).reduce((s, item) => s + (parseInt(item.qty) || 0), 0);
            const remaining = (parseInt(po.qty_ordered) || 0) - rcvQty;
            html += `<tr class="inbound-row hover:bg-emerald-50 transition border-b border-slate-100" onclick="toggleRowCheckbox(this)">
                <td class="text-center p-2"><input type="checkbox" onclick="event.stopPropagation()" class="inbound-chk w-5 h-5 accent-emerald-500 rounded" value="${po.id || po.order_id}" onchange="updateInboundCount()"></td>
                <td class="p-2 text-center" onclick="event.stopPropagation()"><input type="date" onclick="event.stopPropagation()" class="inbound-date minimal-input py-1 px-2 h-8 text-[11px] font-mono text-center" value="${tStr}" required></td>
                <td class="font-bold text-center"><span class="bg-slate-100 px-2 py-1 rounded text-[10px]">${po.car_plate || '-'}</span></td>
                <td class="font-mono text-amber-700 text-xs text-center">${po.epc_no || '-'}</td>
                <td class="font-mono font-bold text-blue-700 text-xs text-center">${po.part_no || '-'}</td>
                <td class="font-bold text-slate-700 truncate text-[11px]">${po.part_name || '-'}</td>
                <td class="text-center font-black text-rose-500">${remaining}</td>
                <td class="text-center p-1" onclick="event.stopPropagation()"><input type="number" onclick="event.stopPropagation()" class="inbound-qty minimal-input text-center font-black text-emerald-700 py-1 px-2 h-8 w-20" max="${remaining}" min="1" value="${remaining}"><input type="hidden" class="inbound-epc" value="${po.epc_no || ''}"><input type="hidden" class="inbound-part" value="${po.part_no || ''}"><input type="hidden" class="inbound-main" value="${po.part_main_no || ''}"><input type="hidden" class="inbound-name" value="${po.part_name || ''}"><input type="hidden" class="inbound-model" value="${po.car_model || ''}"><input type="hidden" class="inbound-price" value="${po.unit_price || 0}"></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }
    document.getElementById('multi_inbound_search').value = ''; document.getElementById('chk_all_inbound').checked = false; updateInboundCount();
    document.getElementById('inboundModal').classList.replace('hidden', 'flex');
}
function closeInboundModal() { document.getElementById('inboundModal').classList.replace('flex','hidden'); }
function filterMultiInboundTable() { const txt = document.getElementById('multi_inbound_search').value.toLowerCase(); document.querySelectorAll('#multi_inbound_body tr.inbound-row').forEach(row => { row.style.display = row.innerText.toLowerCase().includes(txt) ? '' : 'none'; }); }
function toggleAllInbound(checked) { document.querySelectorAll('#multi_inbound_body tr.inbound-row:not([style*="display: none"]) .inbound-chk').forEach(chk => chk.checked = checked); updateInboundCount(); }
function toggleRowCheckbox(row) { const chk = row.querySelector('.inbound-chk'); chk.checked = !chk.checked; updateInboundCount(); }
function updateInboundCount() { document.getElementById('multi_inbound_count').innerText = document.querySelectorAll('.inbound-chk:checked').length; }
async function submitMultiInbound(e) {
    e.preventDefault(); const rows = document.querySelectorAll('.inbound-row'); let promises = [];
    rows.forEach(row => {
        if(row.querySelector('.inbound-chk').checked) {
            promises.push(fetch(`${API_BASE_URL}/api/part-inbound`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ received_date: row.querySelector('.inbound-date').value, epc_no: row.querySelector('.inbound-epc').value, part_no: row.querySelector('.inbound-part').value, part_main_no: row.querySelector('.inbound-main').value, part_name: row.querySelector('.inbound-name').value, car_model: row.querySelector('.inbound-model').value, qty: parseInt(row.querySelector('.inbound-qty').value) || 1, unit_price: parseFloat(row.querySelector('.inbound-price').value) || 0, branch_name: currentBranch })
            }));
        }
    });
    if(promises.length === 0) return alert('เลือกอย่างน้อย 1 รายการ');
    const btn = document.getElementById('btn_submit_inbound'); const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try { await Promise.all(promises); showToast('รับเข้าคลังสำเร็จ!'); closeInboundModal(); loadAllData(); } catch(err) { showToast('เกิดข้อผิดพลาด', 'error'); } finally { btn.innerHTML = oldHtml; btn.disabled = false; }
}
function openManualInboundModal() { document.getElementById('editInboundForm').reset(); document.getElementById('edit_inbound_id').value = ''; document.getElementById('edit_in_date').value = getTodayString(); document.getElementById('editInboundModal').classList.replace('hidden','flex'); }
function closeEditInboundModal() { document.getElementById('editInboundModal').classList.replace('flex','hidden'); }
async function autoFillInboundFromEPC(epcNo) {
    if(!epcNo) return; const po = allGlobalParts.find(p => cleanStr(p.epc_no) === cleanStr(epcNo));
    if(po) {
        document.getElementById('edit_in_part_no').value = po.part_no || ''; document.getElementById('edit_in_part_main').value = po.part_main_no || '';
        document.getElementById('edit_in_part_name').value = po.part_name || ''; document.getElementById('edit_in_model').value = po.car_model || ''; document.getElementById('edit_in_price').value = po.unit_price || 0;
        calcEditInTotal();
    }
}
function openEditInboundModal(id) {
    const p = allInbounds.find(x => String(x.id || x.inbound_id) === String(id)); if(!p) return;
    document.getElementById('edit_inbound_id').value = id; document.getElementById('edit_in_date').value = p.received_date ? String(p.received_date).split('T')[0] : '';
    document.getElementById('edit_in_epc').value = p.epc_no || ''; document.getElementById('edit_in_part_no').value = p.part_no || ''; document.getElementById('edit_in_qty').value = p.qty || 1; document.getElementById('edit_in_price').value = p.unit_price || 0;
    document.getElementById('edit_in_part_main').value = p.part_main_no || ''; document.getElementById('edit_in_part_name').value = p.part_name || ''; document.getElementById('edit_in_model').value = p.car_model || '';
    document.getElementById('editInboundModal').classList.replace('hidden', 'flex');
}
function calcEditInTotal() { document.getElementById('edit_in_total').value = ((parseFloat(document.getElementById('edit_in_price').value) || 0) * (parseInt(document.getElementById('edit_in_qty').value) || 0)).toFixed(2); }
async function submitEditInbound(e) {
    e.preventDefault(); const id = document.getElementById('edit_inbound_id').value;
    const method = id ? 'PUT' : 'POST'; const url = id ? `${API_BASE_URL}/api/part-inbound/${id}` : `${API_BASE_URL}/api/part-inbound`;
    const payload = {
        received_date: document.getElementById('edit_in_date').value, epc_no: document.getElementById('edit_in_epc').value, part_no: document.getElementById('edit_in_part_no').value,
        part_main_no: document.getElementById('edit_in_part_main').value, part_name: document.getElementById('edit_in_part_name').value, car_model: document.getElementById('edit_in_model').value,
        qty: parseInt(document.getElementById('edit_in_qty').value), unit_price: parseFloat(document.getElementById('edit_in_price').value), branch_name: currentBranch
    };
    try { const res = await fetch(url, { method: method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); if(!res.ok) throw new Error(); showToast(id ? 'แก้ไขสำเร็จ!' : 'บันทึกสำเร็จ!'); closeEditInboundModal(); loadAllData(); } catch(e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}

function loadOutbound() {
    try {
        const tbody = document.getElementById('outbound_table_body');
        const filteredOutb = allOutbounds.filter(d => d.branch_name === currentBranch);
        if(filteredOutb.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-slate-400">ไม่มีประวัติการเบิก/จอง</td></tr>`; return; }

        tbody.innerHTML = filteredOutb.map((d, index) => {
            const outId = d.outbound_id || d.id; const isBook = d.job_status === 'รอเข้าซ่อม'; const badgeColor = isBook ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700';
            return `
            <tr>
                <td class="text-center bg-slate-50 font-bold px-2">${index + 1}</td>
                <td class="font-mono p-1"><input type="date" value="${d.issue_date ? String(d.issue_date).split('T')[0] : ''}" onchange="fastUpdateOutbound('${outId}', 'issue_date', this.value)" class="inline-edit-input text-center"></td>
                <td class="text-center p-1"><select onchange="fastUpdateOutbound('${outId}', 'job_status', this.value)" class="inline-edit-select ${badgeColor} w-full font-black text-center"><option value="รอเข้าซ่อม" ${isBook ? 'selected' : ''}>⏳ จองอะไหล่</option><option value="เบิกอะไหล่" ${!isBook ? 'selected' : ''}>📦 ตัดสต๊อกจริง</option></select></td>
                <td class="font-mono p-1"><input type="text" value="${d.part_no||''}" onchange="fastUpdateOutbound('${outId}', 'part_no', this.value)" class="inline-edit-input font-bold text-blue-700 text-center"></td>
                <td class="font-mono p-1"><input type="text" value="${d.part_main_no||''}" onchange="fastUpdateOutbound('${outId}', 'part_main_no', this.value)" class="inline-edit-input text-slate-500 text-xs text-center"></td>
                <td class="text-center p-1"><input type="number" value="${d.qty||1}" onchange="fastUpdateOutbound('${outId}', 'qty', this.value)" class="inline-edit-input font-black text-center bg-slate-50"></td>
                <td class="p-1"><input type="text" value="${d.car_plate||''}" onchange="fastUpdateOutbound('${outId}', 'car_plate', this.value)" class="inline-edit-input font-bold text-rose-600 text-center uppercase"></td>
                <td class="font-mono p-1"><input type="text" value="${d.qt_no||''}" onchange="fastUpdateOutbound('${outId}', 'qt_no', this.value)" class="inline-edit-input text-xs text-center uppercase"></td>
                <td class="font-mono p-1"><input type="text" value="${d.so_no||''}" onchange="fastUpdateOutbound('${outId}', 'so_no', this.value)" class="inline-edit-input text-xs text-center uppercase"></td>
                <td class="p-1"><input type="text" value="${d.part_name||''}" onchange="fastUpdateOutbound('${outId}', 'part_name', this.value)" class="inline-edit-input font-bold"></td>
                <td class="text-center py-1"><button onclick="openOutboundModal('${outId}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRow('/api/part-outbound/${outId}')" class="text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        }).join('');
    } catch(e){}
}
function openOutboundModal(id = null) {
    document.getElementById('outboundForm').reset();
    if(id) {
        const p = allOutbounds.find(x => String(x.id || x.outbound_id) === String(id));
        if(p) {
            document.getElementById('out_date').value = p.issue_date ? String(p.issue_date).split('T')[0] : ''; document.getElementById('out_part_no').value = p.part_no || '';
            document.getElementById('out_qty').value = p.qty || 1; document.getElementById('out_plate').value = p.car_plate || ''; document.getElementById('out_qt').value = p.qt_no || '';
            document.getElementById('out_so').value = p.so_no || ''; document.getElementById('out_part_main').value = p.part_main_no || ''; document.getElementById('out_part_name').value = p.part_name || '';
            document.getElementById('out_price').value = p.unit_price || 0; document.getElementById('out_model').value = p.car_model || ''; document.getElementById('out_job_status').value = p.job_status || 'รอเข้าซ่อม';
            document.getElementById('edit_outbound_id').value = id;
        }
    } else { document.getElementById('edit_outbound_id').value = ''; }
    document.getElementById('outboundModal').classList.replace('hidden', 'flex');
}
function closeOutboundModal() { document.getElementById('outboundModal').classList.replace('flex', 'hidden'); }
async function submitOutbound(e) {
    e.preventDefault(); const editId = document.getElementById('edit_outbound_id').value;
    const method = editId ? 'PUT' : 'POST'; const url = editId ? `${API_BASE_URL}/api/part-outbound/${editId}` : `${API_BASE_URL}/api/part-outbound`;
    const payload = {
        issue_date: document.getElementById('out_date').value, part_no: document.getElementById('out_part_no').value, qty: parseInt(document.getElementById('out_qty').value),
        car_plate: document.getElementById('out_plate').value.toUpperCase().trim(), qt_no: document.getElementById('out_qt').value, so_no: document.getElementById('out_so').value,
        part_main_no: document.getElementById('out_part_main').value, part_name: document.getElementById('out_part_name').value, unit_price: parseFloat(document.getElementById('out_price').value) || 0,
        car_model: document.getElementById('out_model').value, job_status: document.getElementById('out_job_status').value, part_type: document.getElementById('out_type').value, branch_name: currentBranch
    };
    try { const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); if(!res.ok) throw new Error(); showToast('บันทึกสำเร็จ!'); closeOutboundModal(); loadAllData(); } catch(e) { showToast('เกิดข้อผิดพลาด', 'error'); }
}
async function fetchJobDataByPlate(p) { 
    const pl = cleanStr(document.getElementById(`${p}_plate`).value); if(!pl) return; 
    const job = allGlobalJobs.find(j => cleanStr(j.car_plate) === pl); 
    if(job) { 
        if(document.getElementById(`${p}_vin`)) document.getElementById(`${p}_vin`).value = job.vin_no || '-'; 
        if(document.getElementById(`${p}_model`)) document.getElementById(`${p}_model`).value = job.car_model || '-'; 
        if(document.getElementById(`${p}_qt`)) document.getElementById(`${p}_qt`).value = (job.qt_no || '').split(',')[0].trim(); 
        if(document.getElementById(`${p}_so`)) document.getElementById(`${p}_so`).value = (job.so_no || '').split(',')[0].trim(); 
    } 
}

// ================= 5. STOCK =================
async function loadStockInHouse() {
    try {
        if(allMasterPartsData.length === 0) { const resM = await fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(currentBranch)}`); if(resM.ok) allMasterPartsData = await resM.json(); }
        fetch(`${API_BASE_URL}/api/parts-inventory?branch=${encodeURIComponent(currentBranch)}`).then(res => res.json()).then(data => {
            let groupedData = {};
            data.forEach(item => {
                const rawMain = item.part_main_no ? item.part_main_no.trim() : ''; const rawPart = item.part_no ? item.part_no.trim() : '';
                const groupKey = (rawMain !== '' && rawMain !== '-') ? rawMain : rawPart; 
                if (!groupedData[groupKey]) { groupedData[groupKey] = { part_main_no: rawMain, part_nos: new Set(), part_names: new Set(), car_models: new Set(), tIn: 0, tOut: 0, tBook: 0 }; }
                if(rawPart) groupedData[groupKey].part_nos.add(rawPart); if(item.part_name) groupedData[groupKey].part_names.add(item.part_name); if(item.car_model) groupedData[groupKey].car_models.add(item.car_model);
                groupedData[groupKey].tIn += parseInt(item.total_inbound) || 0; groupedData[groupKey].tOut += parseInt(item.total_issued) || 0; groupedData[groupKey].tBook += parseInt(item.total_booked) || 0;
            });
            const activeStock = Object.values(groupedData).map(s => {
                const physicalStock = s.tIn - s.tOut; const availableStock = physicalStock - s.tBook;
                const firstPartNo = Array.from(s.part_nos)[0]; const masterInfo = allMasterPartsData.find(m => m.part_main_no === s.part_main_no || m.part_no === firstPartNo) || {};
                return { 
                    part_main_no: s.part_main_no || '-', part_no: Array.from(s.part_nos).join(', ') || '-', part_name: Array.from(s.part_names).join(', ') || '-',
                    car_model: Array.from(s.car_models).join(', ') || masterInfo.car_model || '-', location: masterInfo.location || '-', unit_price: masterInfo.unit_price || 0,
                    part_category: masterInfo.part_category || '-', physicalStock, totalBooked: s.tBook, availableStock 
                };
            }).filter(s => s.physicalStock > 0);

            if (activeStock.length === 0) { document.getElementById('stock_table_body').innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400">ไม่มีรายการสต๊อกคงเหลือ</td></tr>`; return; }
            document.getElementById('stock_table_body').innerHTML = activeStock.map(s => `<tr><td class="font-mono font-bold text-amber-700 bg-amber-50/30 px-2 text-center border-r border-slate-300">${s.part_main_no}</td><td class="font-mono text-blue-600 px-2 text-[10px] truncate max-w-[150px]" title="${s.part_no}">${s.part_no}</td><td class="font-bold text-[#00320D] px-2 truncate max-w-[200px]" title="${s.part_name}">${s.part_name}</td><td class="text-center font-black text-slate-600 bg-slate-50 px-2 border-l border-slate-300">${s.physicalStock}</td><td class="text-center font-black text-amber-600 bg-amber-50/30 px-2">${s.totalBooked}</td><td class="text-center font-black text-emerald-600 bg-emerald-50/50 px-2 border-r border-slate-300">${s.availableStock}</td><td class="text-center font-mono text-xs px-2">${s.location}</td><td class="text-slate-500 text-[10px] px-2 truncate max-w-[150px]">${s.car_model}</td><td class="text-right font-mono font-bold text-emerald-700 px-2">${parseFloat(s.unit_price).toFixed(2)}</td><td class="text-center text-[10px] font-bold text-slate-500 uppercase px-2"><span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">${s.part_category}</span></td></tr>`).join('');
        });
    } catch(e) {}
}
function searchStockTable() {
    const input = document.getElementById("stock_search_input").value.toLowerCase(); const trs = document.getElementById("stock_table_body").getElementsByTagName("tr");
    for (let i = 0; i < trs.length; i++) { if(trs[i].cells.length === 1) continue; const rowText = trs[i].textContent.toLowerCase(); trs[i].style.display = rowText.includes(input) ? "" : "none"; }
}

// ================= 6. MASTER PARTS =================
function loadMasterParts() {
    try {
        fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(currentBranch)}`).then(res => res.json()).then(data => {
            allMasterPartsData = data;
            document.getElementById('master_table_body').innerHTML = data.map(p => `<tr><td class="font-mono font-bold text-blue-600 px-2">${p.part_no}</td><td class="font-bold px-2 truncate">${p.part_name}</td><td class="font-mono text-slate-400 text-xs px-2">${p.part_main_no||'-'}</td><td class="text-xs text-slate-600 font-bold px-2 truncate" title="${p.car_model}">${p.car_model||'-'}</td><td class="text-[10px] font-bold text-slate-500 uppercase px-2"><span class="bg-slate-100 px-1.5 py-0.5 rounded border">${p.part_category||'-'}</span></td><td class="font-mono text-right font-bold text-emerald-700 px-2">${parseFloat(p.unit_price||0).toFixed(2)}</td><td class="font-mono text-xs text-center px-2">${p.location||'-'}</td><td class="text-center flex justify-center gap-1 py-1"><button onclick="openMasterModal('${p.part_no}')" class="text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded"><i class="fa-solid fa-pen"></i></button><button onclick="deleteRow('/api/parts/${p.part_id}')" class="text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
            
            // 🌟 สร้าง Datalist (Dropdown อัจฉริยะ) ฝังไว้ในระบบ
            let dl = document.getElementById('master_parts_datalist');
            if(!dl) {
                dl = document.createElement('datalist');
                dl.id = 'master_parts_datalist';
                document.body.appendChild(dl);
            }
            dl.innerHTML = data.map(p => `<option value="${p.part_no}">${p.part_name}</option>`).join('');
            
            // 🌟 ผูก Dropdown ให้กับช่องกรอกอะไหล่ในทุกๆ หน้าต่างอัตโนมัติ (ไม่ต้องไปแก้ HTML)
            ['po_part_no', 'out_part_no', 'edit_in_part_no', 'master_part_no'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.setAttribute('list', 'master_parts_datalist');
            });
        });
    } catch(e){}
}
async function loadCarModelsGrid() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/car-models`); if (!res.ok) throw new Error(); allCarModelsFromDB = await res.json();
        const grouped = {}; allCarModelsFromDB.forEach(item => { const brand = item.car_brand || 'ทั่วไป'; if (!grouped[brand]) grouped[brand] = []; grouped[brand].push(item.car_model); });
        const container = document.getElementById('master_car_models_container'); let html = '';
        for (const [brand, models] of Object.entries(grouped)) {
            html += `<div class="mb-3"><p class="text-[11px] font-black text-slate-500 uppercase border-b border-slate-200 pb-1 mb-2">${brand}</p><div class="grid grid-cols-2 gap-2">${models.map(m => `<label class="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition border border-transparent hover:border-slate-200"><input type="checkbox" value="${m}" data-brand="${brand}" class="master-car-model-checkbox accent-[#00320D] w-4 h-4 cursor-pointer"><span class="text-xs font-bold text-slate-700">${m}</span></label>`).join('')}</div></div>`;
        }
        container.innerHTML = html || '<p class="text-xs text-slate-400">ยังไม่มีข้อมูล</p>';
    } catch (e) {}
}
function openMasterModal(partNo = null) {
    document.getElementById('master_part_main').value = ''; document.getElementById('master_part_no').value = '';
    document.getElementById('master_part_name').value = ''; document.getElementById('master_location').value = '';
    document.getElementById('master_price').value = '0.00'; document.getElementById('master_safety').value = '0';
    document.querySelectorAll('.master-car-model-checkbox').forEach(cb => cb.checked = false);
    if(partNo) {
        const part = allMasterPartsData.find(p => cleanStr(p.part_no) === cleanStr(partNo));
        if(part) {
            document.getElementById('master_part_no').value = part.part_no; document.getElementById('master_part_name').value = part.part_name;
            document.getElementById('master_part_main').value = part.part_main_no || ''; document.getElementById('master_category').value = part.part_category || 'อะไหล่หลัก';
            document.getElementById('master_price').value = part.unit_price || 0; document.getElementById('master_location').value = part.location || '';
            document.getElementById('master_safety').value = part.safety_stock || 0; document.getElementById('edit_master_id').value = part.part_id;
            if(part.car_model) { const savedModels = part.car_model.split(',').map(m => m.trim()); document.querySelectorAll('.master-car-model-checkbox').forEach(cb => { if(savedModels.includes(cb.value)) cb.checked = true; }); }
        }
    } else { document.getElementById('edit_master_id').value = ''; document.querySelectorAll('.master-car-model-checkbox').forEach(cb => { const brand = cb.getAttribute('data-brand') || ''; if(brand && brand.toUpperCase() === 'TESLA') cb.checked = true; }); }
    document.getElementById('masterModal').classList.replace('hidden', 'flex');
}
function closeMasterModal() { document.getElementById('masterModal').classList.replace('flex', 'hidden'); }
async function saveMasterPart() {
    const checkedModels = Array.from(document.querySelectorAll('.master-car-model-checkbox:checked')).map(cb => cb.value);
    const editId = document.getElementById('edit_master_id').value; const method = editId ? 'PUT' : 'POST'; const url = editId ? `${API_BASE_URL}/api/parts/${editId}` : `${API_BASE_URL}/api/parts`;
    const payload = { 
        part_main_no: document.getElementById('master_part_main').value, part_no: document.getElementById('master_part_no').value, part_category: document.getElementById('master_category').value, part_name: document.getElementById('master_part_name').value,
        car_model: checkedModels.join(', ') || null, location: document.getElementById('master_location').value, safety_stock: parseInt(document.getElementById('master_safety').value) || 0, unit_price: parseFloat(document.getElementById('master_price').value) || 0.00, branch_name: currentBranch 
    };
    try { const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); if(!res.ok) throw new Error(); showToast('บันทึกมาสเตอร์สำเร็จ!'); closeMasterModal(); loadAllData(); } catch(e) { showToast('บันทึกไม่สำเร็จ', 'error'); }
}

async function deleteRow(endpoint) {
    if(confirm('🚨 ยืนยันการลบข้อมูลรายการนี้แบบถาวร?')) {
        try { const res = await fetch(API_BASE_URL + endpoint, { method: 'DELETE' }); if(!res.ok) throw new Error(); showToast('ลบข้อมูลเรียบร้อย'); loadAllData(); } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
    }
}

// ================= EXCEL FILTER LOGIC (สำหรับทุกตาราง) =================
let activeFilters = {};
let currentFilterKey = -1;
let currentTableId = '';

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

function openExcelFilter(e, colIndex, title, tableId) {
    e.stopPropagation();
    currentFilterKey = colIndex;
    currentTableId = tableId;
    
    document.getElementById('ef_col_name').innerText = title;
    document.getElementById('ef_search').value = '';

    const table = document.getElementById(tableId);
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const uniqueValues = new Set();
    rows.forEach(row => {
        if(row.cells.length === 1) return; // ข้ามแถวแจ้งเตือน
        uniqueValues.add(getCellValue(row.cells[colIndex]));
    });

    const sortedValues = [...uniqueValues].sort();
    const listDiv = document.getElementById('ef_checkbox_list');
    listDiv.innerHTML = '';
    
    if(!activeFilters[tableId]) activeFilters[tableId] = {};
    const activeSet = activeFilters[tableId][colIndex];

    sortedValues.forEach(val => {
        const isChecked = activeSet ? activeSet.has(val) : true;
        listDiv.innerHTML += `
            <label class="flex items-start gap-2 hover:bg-slate-200 p-1.5 rounded cursor-pointer ef-item transition">
                <input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] mt-0.5 cursor-pointer">
                <span class="text-slate-800 font-medium truncate w-full" title="${val}">${val === '' ? '(ว่าง)' : val}</span>
            </label>
        `;
    });

    const allChecks = document.querySelectorAll('.ef-check');
    document.getElementById('ef_select_all').checked = allChecks.length > 0 && Array.from(allChecks).every(cb => cb.checked);

    const modal = document.getElementById('excelFilterModal');
    const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    
    let leftPos = rect.left + window.scrollX;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px';
    
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeExcelFilter() {
    const modal = document.getElementById('excelFilterModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
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
    const checks = document.querySelectorAll('.ef-check');
    const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    
    if (!activeFilters[currentTableId]) activeFilters[currentTableId] = {};
    const table = document.getElementById(currentTableId);
    if (!table) return closeExcelFilter();
    
    const thIcon = table.querySelectorAll('th')[currentFilterKey]?.querySelector('.filter-icon');

    if (checkedVals.length === checks.length || checkedVals.length === 0) {
        delete activeFilters[currentTableId][currentFilterKey];
        if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-slate-400'); }
    } else {
        activeFilters[currentTableId][currentFilterKey] = new Set(checkedVals);
        if(thIcon) { thIcon.classList.remove('text-slate-400'); thIcon.classList.add('text-amber-400'); }
    }
    
    closeExcelFilter(); executeTableFilter();
}

function clearSpecificExcelFilter() {
    if (activeFilters[currentTableId]) delete activeFilters[currentTableId][currentFilterKey];
    const table = document.getElementById(currentTableId);
    if(table) {
        const thIcon = table.querySelectorAll('th')[currentFilterKey]?.querySelector('.filter-icon');
        if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-slate-400'); }
    }
    closeExcelFilter(); executeTableFilter();
}

function executeTableFilter() {
    const table = document.getElementById(currentTableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    const tableFilters = activeFilters[currentTableId] || {};

    rows.forEach(row => {
        if(row.cells.length === 1) return; 
        
        let isMatch = true;
        for (let colIdx in tableFilters) {
            let cellText = getCellValue(row.cells[colIdx]);
            if (!tableFilters[colIdx].has(cellText)) { isMatch = false; break; }
        }
        row.style.display = isMatch ? '' : 'none';
    });
}

// 🎯 ปิด Modal เวลากดพื้นที่ว่างนอกกรอบ
document.addEventListener('click', function(event) {
    const modal = document.getElementById('excelFilterModal');
    if (modal && !modal.classList.contains('hidden') && !modal.contains(event.target) && !event.target.classList.contains('filter-icon')) {
        closeExcelFilter();
    }
});