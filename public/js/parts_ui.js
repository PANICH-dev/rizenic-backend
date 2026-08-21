// ==========================================
// 🎨 RIZENIC - Parts UI & Rendering (parts_ui.js)
// ==========================================

const fallbackStatuses = [
    {status_name: 'รอสั่งซื้อ'},
    {status_name: 'รออะไหล่'},
    {status_name: 'เข้าครบ'},
    {status_name: 'Back Order'}
];

let allPartStatusesCache = [];

async function fetchPartStatuses() {
    if(allPartStatusesCache.length > 0) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/part-statuses?_t=` + new Date().getTime());
        if (res.ok) allPartStatusesCache = await res.json();
    } catch(e) {}
}
fetchPartStatuses(); 

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

// ------------------------------------------
// 1. แจ้งเตือน SA (SA Alerts - ตารางหลัก)
// ------------------------------------------
function renderSAAlerts() {
    const tbody = document.getElementById('sa_alerts_body');
    const badge = document.getElementById('alert_count');
    if(!tbody) return;
    
    const jobsToDisplay = [];

    if (typeof allReports !== 'undefined') {
        allReports.forEach(job => {
            const st = job.job_status || '';
            const isPartsDept = job.department_routing === 'อะไหล่';
            const isWaitingParts = st.includes('สั่งอะไหล่') || st.includes('รอรถเข้าซ่อม') || st.includes('รออะไหล่');

            if (isPartsDept || isWaitingParts) {
                jobsToDisplay.push(job);
            }
        });
    }
    
    if (jobsToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-white"><i class="fa-solid fa-check-circle text-3xl mb-3 text-emerald-300 block"></i> ไม่มีรายการใบงานที่ต้องจัดการครับ! 🎉</td></tr>`;
        if(badge) badge.classList.add('hidden');
        return;
    }

    if(badge) {
        badge.innerText = jobsToDisplay.length;
        badge.classList.remove('hidden');
    }

    tbody.innerHTML = jobsToDisplay.map(job => {
        const jobId = job.report_id || job.id; 
        const plate = job.car_plate || 'ไม่ระบุทะเบียน';
        const arrDate = (job.arrived_date || job.contact_date) ? String(job.arrived_date || job.contact_date).split('T')[0] : '-';
        const customerName = job.customer_name || '-';
        const saOwner = job.sa_owner || 'ไม่ระบุ'; // 🌟 เพิ่มตัวแปร SA Owner
        
        // 🌟 ดึงอะไหล่ทั้งหมด
        const relatedParts = allPartOrders.filter(p => 
            (String(p.report_id) === String(jobId) || (!p.report_id && p.car_plate === plate))
        );

        const qtDisplay = job.qt_no || job.quotation_no || (relatedParts.length > 0 ? (relatedParts[0].qt_no || '-') : '-');
        const soDisplay = job.so_no || job.job_order_no || (relatedParts.length > 0 ? (relatedParts[0].so_no || '-') : '-');

        let itemsHtml = '';
        if (relatedParts.length === 0) {
            itemsHtml = `<span class="text-[11px] font-bold text-rose-500 animate-pulse block truncate"><i class="fa-solid fa-circle-exclamation"></i> ⚠️ ยังไม่มีรายการสั่งอะไหล่</span>`;
        } else {
            // 🌟 นำ ETA และ Received Date มาแสดงรวมในคอลัมน์นี้
            itemsHtml = relatedParts.map(p => {
                const isComplete = p.order_status && p.order_status.includes('ครบ');
                const color = isComplete ? 'text-emerald-600' : ((p.order_status === 'รอสั่งซื้อ' || p.order_status === 'รออัปเดต') ? 'text-red-600' : 'text-amber-600');
                const icon = isComplete ? '<i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i>' : '<i class="fa-solid fa-clock text-amber-500 text-sm"></i>';
                
                let partNoDisplay = (p.part_no && p.part_no !== 'AUTO-PART') ? `<span class="text-blue-600 font-mono">[${p.part_no}]</span> ` : '';
                
                let dateInfo = '';
                if (isComplete && (p.received_date || p.part_received_all_date)) {
                    dateInfo = `<span class="text-emerald-600 font-mono ml-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shadow-sm"><i class="fa-solid fa-box-open mr-1"></i>เข้า: ${String(p.received_date || p.part_received_all_date).split('T')[0]}</span>`;
                } else if (!isComplete && p.est_arrival_date) {
                    dateInfo = `<span class="text-amber-600 font-mono ml-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm"><i class="fa-solid fa-calendar-day mr-1"></i>ETA: ${String(p.est_arrival_date).split('T')[0]}</span>`;
                }

                return `
                    <div class="text-[11px] font-bold ${color} mb-1.5 flex items-start gap-2 p-1.5 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200" title="${p.part_name}">
                        <div class="mt-0.5 shrink-0">${icon}</div>
                        <div class="leading-tight w-full flex flex-wrap items-center gap-1">
                            <span>${partNoDisplay}${p.part_name}</span> 
                            <span class="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shadow-sm">${p.order_status || '-'}</span>
                            ${dateInfo}
                        </div>
                    </div>`;
            }).join('');
        }

        // เอา <td> ETA และ <td> เข้าครบ ออกจาก HTML นี้
        return `
            <tr class="hover:bg-amber-50/50 transition border-b border-slate-100">
                <td class="font-black text-amber-700 text-xs px-2 py-2">
                    <span class="bg-amber-50 px-2 py-1 rounded shadow-sm border border-amber-200 font-mono">${plate}</span>
                    <div class="text-[9px] text-slate-400 mt-1">ID: ${jobId}</div>
                </td>
                <td class="text-slate-500 font-mono font-bold text-center px-2 py-2 text-xs">${arrDate}</td>
                <td class="font-bold text-slate-600 text-xs px-2 py-2">${job.car_model || '-'}</td>
                
                <td class="font-bold text-slate-700 text-xs px-2 py-2 truncate max-w-[150px]" title="${customerName}">
                    ${customerName}
                    <div class="text-[10px] text-blue-600 mt-1 flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded-full inline-block border border-blue-100"><i class="fa-solid fa-user-tie"></i> ${saOwner}</div>
                </td>
                
                <td class="font-mono text-xs font-bold text-slate-700 px-2 py-2">${qtDisplay}</td>
                <td class="font-mono text-xs font-bold text-amber-700 px-2 py-2">${soDisplay}</td>
                <td class="font-mono text-xs font-bold text-blue-600 px-2 py-2">${job.epc_no || '-'}</td>
                
                <td class="px-2 py-2 max-h-[120px] overflow-y-auto block custom-scrollbar bg-slate-50/50 rounded-xl my-1 border border-slate-200 shadow-inner">${itemsHtml}</td>
                
                <td class="text-center px-2 py-2">
                    <button onclick="openAlertModal('${jobId}', '${plate}', '${job.epc_no || ''}')" class="bg-[#00320D] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm w-full">
                        <i class="fa-solid fa-table-cells"></i> โต๊ะคีย์
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ------------------------------------------
// โต๊ะคีย์ Modal (อัปเกรด ProMax: Paste & Filter)
// ------------------------------------------
function openAlertModal(jobId, plate, epcNo) {
    const mainJob = (typeof allReports !== 'undefined') ? allReports.find(j => String(j.id) === String(jobId) || j.report_id === jobId) : null;
    const defaultQt = mainJob ? (mainJob.qt_no || mainJob.quotation_no || '') : '';
    const defaultSo = mainJob ? (mainJob.so_no || mainJob.job_order_no || '') : '';

    const jobParts = allPartOrders.filter(p => 
        (String(p.report_id) === String(jobId) || (!p.report_id && p.car_plate === plate))
    );
    
    const container = document.getElementById('modal_dynamic_table_container');
    
    let html = `
        <div class="mb-4 bg-gradient-to-r from-emerald-50 to-white p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h4 class="font-black text-emerald-900 text-lg flex items-center gap-2">
                    <i class="fa-solid fa-file-excel text-emerald-600"></i> โต๊ะคีย์อะไหล่ ProMax: 
                    <span class="bg-white px-2 py-0.5 rounded shadow-sm font-mono border border-emerald-300 text-emerald-700">${plate}</span>
                </h4>
                <p class="text-[11px] font-bold text-slate-500 mt-1">
                    💡 <span class="text-emerald-600">Tip:</span> Copy จาก Excel ตามลำดับ <b>[EPC] > [Part No] > [จำนวน]</b> แล้วคลิกช่องซ้ายสุด กด <b>Ctrl+V</b> วางรวดเดียวได้เลย!
                </p>
            </div>
            <div class="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                <span class="text-[10px] font-bold text-slate-500 uppercase">ตั้งค่า EPC ด่วน:</span>
                <input type="text" id="mass_epc_update" class="px-2 py-1 border-b-2 border-slate-300 font-mono text-xs w-28 outline-none focus:border-emerald-500 uppercase bg-slate-50" placeholder="พิมพ์แล้ว Enter..." value="${epcNo !== 'undefined' ? epcNo : ''}" onkeyup="if(event.key==='Enter') document.querySelectorAll('.dyn-epc').forEach(el=>el.value=this.value)">
            </div>
        </div>
        <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200 custom-scrollbar">
            <table class="excel-table w-full modern-table" id="sa_modal_table">
                <thead class="bg-[#00320D] text-white sticky top-0 z-10 text-[11px]">
                    <tr>
                        <th class="w-28 px-2 py-2 relative"><div class="flex items-center justify-between"><span>EPC No</span><i class="fa-solid fa-filter filter-icon text-slate-400 hover:text-amber-400 cursor-pointer" onclick="openExcelFilter(event, 0, 'EPC No', 'sa_modal_table')"></i></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-36 px-2 py-2 relative"><div class="flex items-center justify-between"><span>หมายเลขอะไหล่</span><i class="fa-solid fa-filter filter-icon text-slate-400 hover:text-amber-400 cursor-pointer" onclick="openExcelFilter(event, 1, 'หมายเลขอะไหล่', 'sa_modal_table')"></i></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-20 text-center px-2 py-2 relative"><span>จำนวน</span><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-48 px-2 py-2 relative"><div class="flex items-center justify-between"><span>ชื่อชิ้นส่วน</span></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-28 px-2 py-2 relative"><div class="flex items-center justify-between"><span>MAIN No</span></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-28 px-2 py-2 relative"><div class="flex items-center justify-between"><span>QT</span><i class="fa-solid fa-filter filter-icon text-slate-400 hover:text-amber-400 cursor-pointer" onclick="openExcelFilter(event, 5, 'QT', 'sa_modal_table')"></i></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-28 px-2 py-2 relative"><div class="flex items-center justify-between"><span>SO</span><i class="fa-solid fa-filter filter-icon text-slate-400 hover:text-amber-400 cursor-pointer" onclick="openExcelFilter(event, 6, 'SO', 'sa_modal_table')"></i></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-32 text-center px-2 py-2 relative"><div class="flex items-center justify-center gap-2"><span>สถานะ</span><i class="fa-solid fa-filter filter-icon text-slate-400 hover:text-amber-400 cursor-pointer" onclick="openExcelFilter(event, 7, 'สถานะ', 'sa_modal_table')"></i></div><div class="resizer absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-amber-400"></div></th>
                        <th class="w-28 text-center px-2 py-2 relative">คาดการณ์ (ETA)</th>
                        <th class="w-28 text-center px-2 py-2 relative">เข้าครบ</th>
                        <th class="w-40 px-2 py-2 relative">หมายเหตุ</th>
                        <th class="w-10 text-center px-2 py-2 relative"><i class="fa-solid fa-trash text-slate-400"></i></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
    `;

    const safeStatusList = (allPartStatusesCache.length > 0) ? allPartStatusesCache : fallbackStatuses;
    const statusOptionsHtml = safeStatusList.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');

    jobParts.forEach(p => {
        let safeOpts = statusOptionsHtml;
        if (p.order_status && !safeOpts.includes(`value="${p.order_status}"`)) { safeOpts = `<option value="${p.order_status}">${p.order_status}</option>` + safeOpts; }
        safeOpts = safeOpts.replace(`value="${p.order_status || 'รอสั่งซื้อ'}"`, `value="${p.order_status || 'รอสั่งซื้อ'}" selected`);

        const receivedDateVal = p.received_date || p.part_received_all_date;
        const qtVal = p.qt_no || defaultQt;
        const soVal = p.so_no || defaultSo;

        html += `
            <tr class="hover:bg-amber-50/50 transition-colors" data-id="${p.order_id}" data-jobid="${jobId}" data-plate="${plate}">
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-epc font-mono uppercase text-center" value="${p.epc_no || epcNo || ''}" onpaste="handleModalGridPaste(event, this)"></td>
                <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" class="inline-edit-input dyn-partno font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30" value="${p.part_no || ''}" onchange="autoFillDynName(this)" onpaste="handleModalGridPaste(event, this)"></td>
                <td class="p-0 border border-slate-200"><input type="number" class="inline-edit-input dyn-qty text-center font-black text-amber-600 bg-amber-50" value="${p.qty_ordered || 1}" onpaste="handleModalGridPaste(event, this)"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-name font-bold" value="${p.part_name || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-main font-mono text-slate-500" value="${p.part_main_no || ''}"></td>
                
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-qt font-mono uppercase text-center" value="${qtVal}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-so font-mono uppercase text-center" value="${soVal}"></td>
                
                <td class="p-0 border border-slate-200"><select class="inline-edit-select dyn-status font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer">${safeOpts}</select></td>
                <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-eta font-mono text-center text-xs" value="${p.est_arrival_date ? String(p.est_arrival_date).split('T')[0] : ''}"></td>
                <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-rcv font-mono text-center text-xs" value="${receivedDateVal ? String(receivedDateVal).split('T')[0] : ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-notes text-xs" value="${p.notes || ''}"></td>
                <td class="p-0 border border-slate-200 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 py-1 transition"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    
    html += `
        <div class="mt-3 flex justify-between items-center">
            <button type="button" onclick="addNewAlertRow('${jobId}', '${plate}', '${epcNo}', '${defaultQt}', '${defaultSo}')" class="px-5 py-2.5 bg-white border border-emerald-300 text-emerald-700 font-bold rounded-lg hover:bg-emerald-50 text-xs shadow-sm transition flex items-center gap-2">
                <i class="fa-solid fa-plus"></i> กดเพิ่มแถว
            </button>
            <button type="button" onclick="clearSpecificExcelFilter()" class="text-xs font-bold text-slate-400 hover:text-red-500 transition"><i class="fa-solid fa-filter-circle-xmark"></i> ล้างตัวกรองทั้งหมด</button>
        </div>
    `;

    container.innerHTML = html;
    document.getElementById('alertModal').classList.remove('hidden');
    document.getElementById('alertModal').classList.add('flex');

    if(typeof initResizableColumns === 'function') initResizableColumns('sa_modal_table');
}

window.addNewAlertRow = function(jobId, plate, epcNo, defaultQt = '', defaultSo = '') {
    const tbody = document.querySelector('#modal_dynamic_table_container tbody');
    const safeStatusList = (allPartStatusesCache.length > 0) ? allPartStatusesCache : fallbackStatuses;
    const statusOptionsHtml = safeStatusList.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
    let safeOpts = statusOptionsHtml.replace(`value="รอสั่งซื้อ"`, `value="รอสั่งซื้อ" selected`);
    
    const tr = document.createElement('tr');
    tr.className = "hover:bg-amber-50/50 transition-colors";
    tr.setAttribute('data-id', 'new');
    tr.setAttribute('data-jobid', jobId);
    tr.setAttribute('data-plate', plate);
    tr.innerHTML = `
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-epc font-mono uppercase text-center" value="${epcNo !== 'undefined' ? epcNo : ''}" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" class="inline-edit-input dyn-partno font-mono uppercase text-center font-bold text-blue-700 bg-blue-50/30" onchange="autoFillDynName(this)" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="p-0 border border-slate-200"><input type="number" class="inline-edit-input dyn-qty text-center font-black text-amber-600 bg-amber-50" value="1" min="1" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-name font-bold"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-main font-mono text-slate-500"></td>
        
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-qt font-mono uppercase text-center" value="${defaultQt}"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-so font-mono uppercase text-center" value="${defaultSo}"></td>
        
        <td class="p-0 border border-slate-200"><select class="inline-edit-select dyn-status font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer">${safeOpts}</select></td>
        <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-eta font-mono text-center text-xs"></td>
        <td class="p-0 border border-slate-200"><input type="date" class="inline-edit-input dyn-rcv font-mono text-center text-xs"></td>
        <td class="p-0 border border-slate-200"><input type="text" class="inline-edit-input dyn-notes text-xs"></td>
        <td class="p-0 border border-slate-200 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 py-1 transition"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
};

window.handleModalGridPaste = function(e, cellInput) {
    e.preventDefault(); 
    const clipboardData = e.clipboardData || window.clipboardData; 
    const pastedText = clipboardData.getData('Text'); 
    if (!pastedText) return;
    
    const rows = pastedText.split(/\r\n|\n|\r/).filter(row => row.trim() !== ''); 
    const tbody = cellInput.closest('tbody'); 
    let currentRow = cellInput.closest('tr');
    
    const allTds = Array.from(currentRow.children);
    const startColIndex = allTds.indexOf(cellInput.closest('td'));

    const jobId = currentRow.getAttribute('data-jobid') || '';
    const plate = currentRow.getAttribute('data-plate') || '';
    const epcNo = currentRow.querySelector('.dyn-epc').value || '';

    rows.forEach((rowStr) => {
        const cols = rowStr.split('\t'); 
        if (!currentRow) { 
            addNewAlertRow(jobId, plate, epcNo); 
            currentRow = tbody.lastElementChild; 
        }
        
        const inputs = Array.from(currentRow.querySelectorAll('td')).map(td => td.querySelector('input, select'));
        
        cols.forEach((colVal, j) => { 
            const targetInput = inputs[startColIndex + j];
            if (targetInput && !targetInput.readOnly) { 
                targetInput.value = colVal.trim(); 
                targetInput.classList.add('bg-emerald-100', 'transition-colors'); 
                setTimeout(() => targetInput.classList.remove('bg-emerald-100'), 800); 
                
                if (targetInput.classList.contains('dyn-partno')) {
                    autoFillDynName(targetInput);
                }
            } 
        });
        currentRow = currentRow.nextElementSibling;
    });
};

function autoFillDynName(inputEl) {
    const pNo = inputEl.value.trim().toUpperCase(); if (!pNo) return;
    const tr = inputEl.closest('tr');
    const matched = allMasterPartsCache.find(x => x.part_no && x.part_no.toUpperCase() === pNo);
    if(matched) {
        tr.querySelector('.dyn-name').value = matched.part_name || '';
        tr.querySelector('.dyn-main').value = matched.part_main_no || '';
    }
}

function closeAlertModal() { document.getElementById('alertModal').classList.add('hidden'); document.getElementById('alertModal').classList.remove('flex'); }

// 🌟 บังคับรีเฟรชหน้าต่างเพื่อให้ข้อมูลอัปเดตชัวร์ 100% 🌟
async function saveSAAlertUpdate(e) {
    e.preventDefault();
    const rows = document.querySelectorAll('#modal_dynamic_table_container tbody tr');
    const updates = [];

    rows.forEach(tr => {
        if(tr.style.display === 'none') return;

        const isNew = tr.getAttribute('data-id') === 'new';
        const partName = tr.querySelector('.dyn-name').value.trim();
        const partNo = tr.querySelector('.dyn-partno').value.trim();

        if (isNew && !partName && !partNo) return;
        
        const rawRcv = tr.querySelector('.dyn-rcv').value;
        const rawEta = tr.querySelector('.dyn-eta').value;

        updates.push({
            id: tr.getAttribute('data-id'),
            report_id: tr.getAttribute('data-jobid') || null,
            car_plate: tr.getAttribute('data-plate') || '',
            epc_no: tr.querySelector('.dyn-epc').value.trim() || null,
            part_no: partNo || (isNew ? 'AUTO-PART' : null),
            part_main_no: tr.querySelector('.dyn-main').value.trim() || null,
            part_name: partName || (isNew ? 'อะไหล่ทั่วไป' : null),
            qty_ordered: parseInt(tr.querySelector('.dyn-qty').value) || 1,
            qt_no: tr.querySelector('.dyn-qt').value.trim() || null,
            so_no: tr.querySelector('.dyn-so').value.trim() || null,
            order_status: tr.querySelector('.dyn-status').value,
            est_arrival_date: rawEta ? rawEta : null,
            received_date: rawRcv ? rawRcv : null,
            notes: tr.querySelector('.dyn-notes').value.trim() || null
        });
    });

    if (updates.length === 0) return closeAlertModal();

    const btn = e.target.querySelector('button[type="submit"]');
    const originalBtnHtml = btn.innerHTML;

    try {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; 
        btn.disabled = true;

        await Promise.all(updates.map(u => {
            if (u.id === 'new') {
                const todayStr = new Date().toISOString().split('T')[0];
                return fetch(`${API_BASE_URL}/api/part-orders`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        report_id: u.report_id, car_plate: u.car_plate, part_no: u.part_no, 
                        part_main_no: u.part_main_no, part_name: u.part_name, qty_ordered: u.qty_ordered, 
                        qt_no: u.qt_no, so_no: u.so_no, order_status: u.order_status, 
                        order_date: todayStr, epc_no: u.epc_no, notes: u.notes, branch_name: userBranch
                    })
                });
            } else {
                const promises = [];
                ['epc_no', 'part_no', 'part_main_no', 'part_name', 'qty_ordered', 'qt_no', 'so_no', 'order_status', 'est_arrival_date', 'received_date', 'notes'].forEach(field => {
                    let valToSend = u[field];
                    if(valToSend === '') valToSend = null;
                    promises.push(fetch(`${API_BASE_URL}/api/part-orders/${u.id}/fast`, {
                        method: 'PUT', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ field, value: valToSend })
                    }));
                });
                return Promise.all(promises);
            }
        }));

        showToast('อัปเดตข้อมูลอะไหล่เรียบร้อย!', 'success');
        closeAlertModal();
        
        // 🌟 บังคับรอเซิร์ฟเวอร์เคลียร์ Transaction ให้เสร็จ แล้วรีเฟรช 🌟
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.reload(); 

    } catch(err) {
        showToast('เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่', 'error');
        btn.innerHTML = originalBtnHtml || '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูลส่งให้ SA';
        btn.disabled = false;
    }
}

// ------------------------------------------
// 2. ข้อมูลมาสเตอร์ (Master Data)
// ------------------------------------------
function renderMasterTable() {
    const tbody = document.getElementById('master_table_body'); if(!tbody) return;
    if (allMasterPartsCache.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีข้อมูลมาสเตอร์อะไหล่</td></tr>`; return; }
    
    tbody.innerHTML = allMasterPartsCache.map(m => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="font-mono text-blue-700 font-bold px-4 py-2.5">${m.part_no}</td>
            <td class="font-bold text-slate-800 px-4 py-2.5">${m.part_name}</td>
            <td class="font-mono text-slate-500 px-4 py-2.5">${m.part_main_no || '-'}</td>
            <td class="text-slate-600 text-xs font-bold px-4 py-2.5">${m.car_model || '-'}</td>
            <td class="px-4 py-2.5"><span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm">${m.part_category || 'อะไหล่ทั่วไป'}</span></td>
            <td class="text-right font-mono font-bold text-slate-700 px-4 py-2.5">${parseFloat(m.unit_price || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}</td>
            <td class="text-center font-bold text-slate-600 px-4 py-2.5">${m.location || '-'}</td>
            <td class="text-center px-4 py-2.5"><button onclick="editMaster('${m.part_no}')" class="text-blue-500 hover:text-blue-700 px-2 transition"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteMaster('${m.part_id}')" class="text-slate-300 hover:text-red-500 px-2 transition"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function searchMasterTable() { filterTableByText('master_table_body', event.target.value); }

function openMasterModal() {
    document.getElementById('edit_master_id').value = ''; document.getElementById('master_part_no').value = '';
    document.getElementById('master_part_name').value = ''; document.getElementById('master_part_main').value = '';
    document.getElementById('master_category').value = 'อะไหล่หลัก'; document.getElementById('master_price').value = '0.00';
    document.getElementById('master_location').value = ''; document.getElementById('master_safety').value = '0';
    renderCarModelsCheckbox(''); document.getElementById('masterModal').classList.remove('hidden'); document.getElementById('masterModal').classList.add('flex');
}

function closeMasterModal() { document.getElementById('masterModal').classList.add('hidden'); document.getElementById('masterModal').classList.remove('flex'); }

async function editMaster(partNo) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(partNo)}?branch=${encodeURIComponent(userBranch)}`);
        if(res.ok) {
            const data = await res.json(); const m = Array.isArray(data) ? data[0] : (data.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : data);
            if(m) {
                document.getElementById('edit_master_id').value = m.part_id; document.getElementById('master_part_no').value = m.part_no;
                document.getElementById('master_part_name').value = m.part_name; document.getElementById('master_part_main').value = m.part_main_no || '';
                document.getElementById('master_category').value = m.part_category || 'อะไหล่หลัก'; document.getElementById('master_price').value = parseFloat(m.unit_price || 0).toFixed(2);
                document.getElementById('master_location').value = m.location || ''; document.getElementById('master_safety').value = m.safety_stock || '0';
                renderCarModelsCheckbox(m.car_model || '');
                document.getElementById('masterModal').classList.remove('hidden'); document.getElementById('masterModal').classList.add('flex');
            }
        }
    } catch(e) { showToast('ดึงข้อมูลผิดพลาด', 'error'); }
}

async function saveMasterPart() {
    const id = document.getElementById('edit_master_id').value; const pNo = document.getElementById('master_part_no').value.trim().toUpperCase(); const pName = document.getElementById('master_part_name').value.trim();
    if(!pNo || !pName) return alert('กรุณากรอกบาร์โค้ดและชื่อชิ้นส่วนให้ครบถ้วน');
    const chks = document.querySelectorAll('.master-car-chk:checked'); const models = Array.from(chks).map(c => c.value).join(', ');

    const payload = {
        part_no: pNo, part_main_no: document.getElementById('master_part_main').value.trim().toUpperCase() || null,
        part_name: pName, car_model: models || null, part_category: document.getElementById('master_category').value,
        unit_price: parseFloat(document.getElementById('master_price').value) || 0, location: document.getElementById('master_location').value.trim() || null,
        safety_stock: parseInt(document.getElementById('master_safety').value) || 0, branch_name: userBranch
    };

    try {
        const url = id ? `${API_BASE_URL}/api/parts/${id}` : `${API_BASE_URL}/api/parts`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { showToast('บันทึกมาสเตอร์สำเร็จ!'); closeMasterModal(); window.location.reload(); } else throw new Error();
    } catch(e) { showToast('บันทึกล้มเหลว', 'error'); }
}

async function deleteMaster(id) {
    if(!confirm('🚨 ยืนยันการลบข้อมูลมาสเตอร์นี้?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('ลบมาสเตอร์สำเร็จ'); window.location.reload(); } else throw new Error();
    } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
}

function renderCarModelsCheckbox(selectedStr) {
    const container = document.getElementById('master_car_models_container'); if(!container) return;
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