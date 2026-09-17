// ========================================================
// 📦 PO TRACKING & EXCEL FILTER SYSTEM
// ========================================================

let activePOFilters = {};
let currentPOFilterKey = '';

function injectPOFilterModal() {
    if (document.getElementById('poExcelFilterModal')) return;
    const modalHtml = `
    <div id="poExcelFilterModal" class="hidden fixed bg-white border border-slate-300 shadow-2xl rounded-xl w-64 z-[9999] flex-col overflow-hidden text-xs">
        <div class="bg-[#00320D] text-white border-b border-green-800 px-3 py-2.5 flex justify-between items-center">
            <span class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-filter text-amber-400"></i> ตัวกรอง: <span id="po_ef_col_name" class="text-slate-200"></span></span>
            <button onclick="closePOExcelFilter()" class="text-slate-300 hover:text-red-400 transition"><i class="fa-solid fa-xmark text-base"></i></button>
        </div>
        <div class="p-2.5 pb-1">
            <div class="relative mb-2">
                <i class="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="text" id="po_ef_search" class="w-full border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-all bg-white" placeholder="ค้นหา..." onkeyup="searchPOExcelFilter()">
            </div>
            <label class="flex items-center gap-2 px-1.5 py-1 border-b border-slate-100 mb-1 cursor-pointer hover:bg-slate-50 rounded transition">
                <input type="checkbox" id="po_ef_select_all" checked onchange="toggleAllPOExcelFilters(this.checked)" class="w-3.5 h-3.5 accent-[#00320D] cursor-pointer rounded">
                <span class="font-bold text-slate-700 select-none">เลือกทั้งหมด</span>
            </label>
            <div id="po_ef_checkbox_list" class="max-h-44 overflow-y-auto space-y-0.5 custom-scrollbar pr-1"></div>
        </div>
        <div class="bg-slate-50 border-t border-slate-200 p-2 flex gap-2">
            <button onclick="applyPOExcelFilter()" class="flex-1 bg-[#00320D] text-white font-bold py-1.5 rounded-lg hover:bg-black transition shadow-sm flex justify-center items-center gap-1"><i class="fa-solid fa-check"></i> ตกลง</button>
            <button onclick="clearSpecificPOExcelFilter()" class="flex-1 bg-white text-slate-600 border border-slate-300 font-bold py-1.5 rounded-lg hover:bg-slate-100 transition shadow-sm flex justify-center items-center gap-1"><i class="fa-solid fa-eraser"></i> ล้าง</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('poExcelFilterModal');
        if (modal && !modal.contains(e.target) && !e.target.closest('.po-filter-icon') && !modal.classList.contains('hidden')) {
            closePOExcelFilter();
        }
    });
}

function renderPartsTracking() {
    injectPOFilterModal(); 

    const tbody = document.getElementById('parts_tracking_body');
    const thead = document.querySelector('#partsTrackingTable thead tr');
    
    if (thead && !thead.dataset.filtered) {
        thead.innerHTML = `
            <th class="w-10 px-3 py-3.5 text-center"></th>
            <th class="w-32 px-4 py-3.5 border-b border-blue-950 select-none" id="po_th_plate">
                <div class="flex justify-between items-center">
                    <span class="cursor-pointer flex-1" onclick="sortTable('partsTrackingTable', 1)">ทะเบียนรถ <i class="fa-solid fa-sort sort-icon"></i></span>
                    <i class="fa-solid fa-filter ml-2 cursor-pointer text-blue-300 hover:text-amber-400 po-filter-icon transition-colors" onclick="openPOExcelFilter(event, 'plate', 'ทะเบียนรถ')"></i>
                </div>
            </th>
            <th class="w-28 px-4 py-3.5 border-b border-blue-950 text-center select-none" id="po_th_parked">
                <div class="flex justify-between items-center">
                    <span class="cursor-pointer flex-1" onclick="sortTable('partsTrackingTable', 2)">สถานะจอด <i class="fa-solid fa-sort sort-icon"></i></span>
                    <i class="fa-solid fa-filter ml-2 cursor-pointer text-blue-300 hover:text-amber-400 po-filter-icon transition-colors" onclick="openPOExcelFilter(event, 'parked', 'สถานะจอด')"></i>
                </div>
            </th>
            <th class="w-32 px-4 py-3.5 border-b border-blue-950 select-none" id="po_th_sa">
                <div class="flex justify-between items-center">
                    <span class="cursor-pointer flex-1" onclick="sortTable('partsTrackingTable', 3)">SA <i class="fa-solid fa-sort sort-icon"></i></span>
                    <i class="fa-solid fa-filter ml-2 cursor-pointer text-blue-300 hover:text-amber-400 po-filter-icon transition-colors" onclick="openPOExcelFilter(event, 'sa', 'SA ผู้ดูแล')"></i>
                </div>
            </th>
            <th class="w-28 px-4 py-3.5 border-b border-blue-950 text-center">จำนวนรายการ</th>
            <th class="w-[450px] px-4 py-3.5 border-b border-blue-950 select-none" id="po_th_status">
                <div class="flex justify-between items-center">
                    <span>รายการสั่งซื้ออะไหล่ (PO) & สถานะคิว</span>
                    <i class="fa-solid fa-filter ml-2 cursor-pointer text-blue-300 hover:text-amber-400 po-filter-icon transition-colors" onclick="openPOExcelFilter(event, 'status', 'สถานะหลัก')"></i>
                </div>
            </th>
            <th class="w-28 px-4 py-3.5 border-b border-blue-950 text-center">จัดการ</th>
        `;
        thead.dataset.filtered = 'true';
    }

    if (!tbody) return;

    const pendingParts = filteredPartOrders.filter(o => o.order_status !== 'ยกเลิก');

    if (pendingParts.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 font-bold bg-slate-50"><i class="fa-solid fa-box-open text-3xl mb-3 block opacity-50"></i>ไม่มีประวัติใบสั่งอะไหล่ 🎉</td></tr>`; 
        return; 
    }

    const groupedParts = {};
    pendingParts.forEach(o => {
        const plate = o.car_plate || 'ไม่ระบุ';
        if (!groupedParts[plate]) {
            const jobMatch = allJobs.find(j => j.car_plate === plate);
            groupedParts[plate] = { saName: jobMatch ? (jobMatch.sa_owner || 'ไม่ระบุ') : 'ไม่ระบุ', isParked: jobMatch ? (jobMatch.is_parked || 'ไม่ระบุ') : 'ไม่ระบุ', items: [] };
        }
        groupedParts[plate].items.push(o);
    });

    const sortedPlates = Object.keys(groupedParts).sort();
    let html = '';
    let visibleCount = 0;

    sortedPlates.forEach((plate, index) => {
        const group = groupedParts[plate];
        const rowId = `part_group_${index}`;

        let worstStatus = 'มีของ/ครบ';
        const statuses = group.items.map(i => i.order_status || '');
        if (statuses.includes('รอสั่งซื้อ')) worstStatus = 'รอสั่งซื้อ';
        else if (statuses.includes('ติด Back Order')) worstStatus = 'ติด Back Order';
        else if (statuses.includes('รออะไหล่')) worstStatus = 'รออะไหล่';
        else if (statuses.includes('รออัปเดต')) worstStatus = 'รออัปเดต';
        else if (statuses.some(s => !s.includes('ครบ') && !s.includes('มีของ'))) {
            worstStatus = statuses.find(s => !s.includes('ครบ') && !s.includes('มีของ')) || 'รออะไหล่';
        }

        const pkFilterVal = group.isParked === 'จอดซ่อม' ? 'จอดซ่อม' : 'ไม่จอดซ่อม';

        if (activePOFilters['plate'] && !activePOFilters['plate'].has(plate)) return;
        if (activePOFilters['sa'] && !activePOFilters['sa'].has(group.saName)) return;
        if (activePOFilters['status'] && !activePOFilters['status'].has(worstStatus)) return;
        if (activePOFilters['parked'] && !activePOFilters['parked'].has(pkFilterVal)) return;

        visibleCount++;

        let mainBadgeClass = 'bg-amber-50 text-amber-700 border-amber-300';
        if (worstStatus === 'รอสั่งซื้อ' || worstStatus === 'รออะไหล่' || worstStatus === 'ติด Back Order') {
            mainBadgeClass = 'bg-red-50 text-red-700 border-red-300';
        } else if (worstStatus === 'มีของ/ครบ' || worstStatus.includes('ครบ')) {
            mainBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
        }
            
        const mainBadgeHtml = `<span class="inline-flex items-center px-3 py-1 rounded-md border text-xs font-black shadow-sm ${mainBadgeClass}">${worstStatus}</span>`;
        const parkedBadge = group.isParked === 'จอดซ่อม' ? 
            `<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-black text-[10px]"><i class="fa-solid fa-square-p text-amber-600"></i> จอดซ่อม</span>` : 
            `<span class="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded font-bold text-[10px]">ไม่จอดซ่อม</span>`;

        html += `
            <tr class="hover:bg-blue-50/80 transition-colors border-b border-slate-200 cursor-pointer font-medium" onclick="togglePartAccordion('${rowId}')">
                <td class="text-center px-3 py-3"><i id="icon_${rowId}" class="fa-solid fa-chevron-right text-slate-400 transition-transform duration-200"></i></td>
                <td class="font-black text-[#00320D] px-4 py-3"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-sm shadow-inner font-mono">${plate}</span></td>
                <td class="text-center px-2 py-3">${parkedBadge}</td>
                <td class="text-xs font-bold text-slate-600 px-4 py-3"><i class="fa-solid fa-user-tie text-blue-400 mr-1.5"></i>${group.saName}</td>
                <td class="text-center px-4 py-3"><span class="text-blue-700 font-black bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 text-xs shadow-sm">${group.items.length} รายการ</span></td>
                <td class="px-4 py-3 align-middle">${mainBadgeHtml}</td>
                <td class="text-center px-4 py-3" onclick="event.stopPropagation()"><button onclick="window.location.href='parts.html'" class="text-[11px] bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition font-bold shadow-sm whitespace-nowrap"><i class="fa-solid fa-boxes-stacked mr-1"></i>ไปคลัง</button></td>
            </tr>
        `;

        let subRowsHtml = group.items.map(item => {
            const st = item.order_status || 'รออัปเดต';
            let badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
            if (st === 'รอสั่งซื้อ' || st === 'รออะไหล่' || st === 'ติด Back Order') badgeClass = 'bg-red-100 text-red-800 border-red-300';
            else if (st.includes('ครบ') || st.includes('มีของ')) badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                    <td class="px-3 py-2 text-center font-mono font-bold text-purple-700 bg-purple-50/50">${item.epc_no || '-'}</td>
                    <td class="px-3 py-2 font-mono font-bold text-blue-700">${item.part_no || '-'}</td>
                    <td class="px-3 py-2 font-bold text-slate-700 max-w-[220px] truncate" title="${item.part_name || '-'}">${item.part_name || '-'}</td>
                    <td class="px-3 py-2 text-center font-black text-amber-700">${item.qty_ordered || 1}</td>
                    <td class="px-3 py-2 text-center font-mono text-slate-600 font-bold">${item.order_date ? item.order_date.split('T')[0] : '-'}</td>
                    <td class="px-3 py-2 text-center font-mono text-emerald-700 font-bold">${item.est_arrival_date ? item.est_arrival_date.split('T')[0] : '-'}</td>
                    <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] border font-bold ${badgeClass}">${st}</span></td>
                </tr>
            `;
        }).join('');

        html += `
            <tr id="${rowId}" class="hidden bg-slate-100/70">
                <td colspan="7" class="p-3">
                    <div class="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-inner">
                        <div class="bg-slate-200/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border-b border-slate-300 flex justify-between items-center">
                            <span><i class="fa-solid fa-list-check text-blue-600 mr-1.5"></i>ตารางตรวจสอบสั่งอะไหล่: ${plate}</span>
                            <span class="text-slate-500 font-mono font-normal">รวม ${group.items.length} ชิ้น</span>
                        </div>
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                                <tr><th class="px-3 py-2 text-center w-28">เลข EPC</th><th class="px-3 py-2 w-36">รหัสอะไหล่</th><th class="px-3 py-2">ชื่อรายการอะไหล่</th><th class="px-3 py-2 text-center w-16">จำนวน</th><th class="px-3 py-2 text-center w-28">วันที่สั่ง</th><th class="px-3 py-2 text-center w-28">กำหนดเข้า</th><th class="px-3 py-2 text-center w-32">สถานะ</th></tr>
                            </thead>
                            <tbody>${subRowsHtml}</tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    });

    if (visibleCount === 0) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400 font-bold bg-slate-50"><i class="fa-solid fa-filter-circle-xmark text-3xl mb-3 block opacity-50"></i>ไม่พบข้อมูลที่ตรงกับตัวกรอง</td></tr>`; 
    else tbody.innerHTML = html;
}

window.togglePartAccordion = function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if (el) {
        if (el.classList.contains('hidden')) { el.classList.remove('hidden'); if(icon) icon.classList.add('rotate-90'); } 
        else { el.classList.add('hidden'); if(icon) icon.classList.remove('rotate-90'); }
    }
};

function openPOExcelFilter(e, colKey, title) {
    e.stopPropagation();
    currentPOFilterKey = colKey;
    document.getElementById('po_ef_col_name').innerText = title;
    document.getElementById('po_ef_search').value = '';

    const uniqueValues = new Set();
    const pendingParts = filteredPartOrders.filter(o => o.order_status !== 'ยกเลิก');
    
    const groupedParts = {};
    pendingParts.forEach(o => {
        const plate = o.car_plate || 'ไม่ระบุ';
        if (!groupedParts[plate]) {
            const jobMatch = allJobs.find(j => j.car_plate === plate);
            groupedParts[plate] = { saName: jobMatch ? (jobMatch.sa_owner || 'ไม่ระบุ') : 'ไม่ระบุ', isParked: jobMatch ? (jobMatch.is_parked || 'ไม่ระบุ') : 'ไม่ระบุ', items: [] };
        }
        groupedParts[plate].items.push(o);
    });

    Object.keys(groupedParts).forEach(plate => {
        const group = groupedParts[plate];
        let worstStatus = 'มีของ/ครบ';
        const statuses = group.items.map(i => i.order_status || '');
        if (statuses.includes('รอสั่งซื้อ')) worstStatus = 'รอสั่งซื้อ';
        else if (statuses.includes('ติด Back Order')) worstStatus = 'ติด Back Order';
        else if (statuses.includes('รออะไหล่')) worstStatus = 'รออะไหล่';
        else if (statuses.includes('รออัปเดต')) worstStatus = 'รออัปเดต';
        else if (statuses.some(s => !s.includes('ครบ') && !s.includes('มีของ'))) worstStatus = statuses.find(s => !s.includes('ครบ') && !s.includes('มีของ')) || 'รออะไหล่';

        if (colKey === 'plate') uniqueValues.add(plate);
        else if (colKey === 'sa') uniqueValues.add(group.saName);
        else if (colKey === 'status') uniqueValues.add(worstStatus);
        else if (colKey === 'parked') uniqueValues.add(group.isParked === 'จอดซ่อม' ? 'จอดซ่อม' : 'ไม่จอดซ่อม');
    });

    const listDiv = document.getElementById('po_ef_checkbox_list');
    listDiv.innerHTML = '';
    
    [...uniqueValues].sort().forEach(val => {
        const isChecked = activePOFilters[colKey] ? activePOFilters[colKey].has(val) : true;
        listDiv.innerHTML += `<label class="flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer po-ef-item transition"><input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="po-ef-check accent-[#00320D] mt-0.5 cursor-pointer w-4 h-4"><span class="text-slate-700 font-medium truncate w-full text-sm" title="${val}">${val}</span></label>`;
    });
    
    const selAll = document.getElementById('po_ef_select_all');
    if(selAll) selAll.checked = Array.from(document.querySelectorAll('.po-ef-check')).every(cb => cb.checked);
    
    const modal = document.getElementById('poExcelFilterModal');
    const th = e.target.closest('th');
    if(th) {
        const rect = th.getBoundingClientRect();
        modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        let leftPos = rect.left + window.scrollX;
        if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
        modal.style.left = leftPos + 'px';
    } else {
        modal.style.top = '50%'; modal.style.left = '50%'; modal.style.transform = 'translate(-50%, -50%)';
    }
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closePOExcelFilter() {
    const modal = document.getElementById('poExcelFilterModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); modal.style.transform = 'none'; }
}

function searchPOExcelFilter() {
    const txt = document.getElementById('po_ef_search').value.toLowerCase();
    document.querySelectorAll('.po-ef-item').forEach(l => {
        l.style.display = l.querySelector('.po-ef-check').value.toLowerCase().includes(txt) ? 'flex' : 'none';
    });
}

function toggleAllPOExcelFilters(checked) {
    document.querySelectorAll('.po-ef-item:not([style*="display: none"]) .po-ef-check').forEach(cb => cb.checked = checked);
}

function applyPOExcelFilter() {
    const checks = document.querySelectorAll('.po-ef-check');
    const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const thIcon = document.querySelector(`#po_th_${currentPOFilterKey} .po-filter-icon`);
    
    if (checkedVals.length === checks.length || checkedVals.length === 0) {
        delete activePOFilters[currentPOFilterKey];
        if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-blue-300'); }
    } else {
        activePOFilters[currentPOFilterKey] = new Set(checkedVals);
        if(thIcon) { thIcon.classList.remove('text-blue-300'); thIcon.classList.add('text-amber-400'); }
    }
    closePOExcelFilter(); renderPartsTracking();
}

function clearSpecificPOExcelFilter() {
    delete activePOFilters[currentPOFilterKey];
    const thIcon = document.querySelector(`#po_th_${currentPOFilterKey} .po-filter-icon`);
    if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-blue-300'); }
    closePOExcelFilter(); renderPartsTracking();
}

window.filterPOTable = function(keyword) {
    const tbody = document.getElementById('parts_tracking_body');
    if (!tbody) return;
    const lowerKeyword = keyword.toLowerCase().trim();
    const mainRows = Array.from(tbody.querySelectorAll('tr[onclick^="togglePartAccordion"]'));
    
    mainRows.forEach(row => {
        const nextRow = row.nextElementSibling;
        let isMatch = false;

        if (lowerKeyword === '') { isMatch = true; } 
        else {
            const mainText = row.innerText.toLowerCase();
            if (mainText.includes(lowerKeyword)) { isMatch = true; } 
            else if (nextRow && nextRow.id.startsWith('part_group_')) {
                const subText = nextRow.innerText.toLowerCase();
                if (subText.includes(lowerKeyword)) isMatch = true;
            }
        }

        if (isMatch) row.style.display = '';
        else {
            row.style.display = 'none';
            if (nextRow && nextRow.id.startsWith('part_group_')) {
                nextRow.classList.add('hidden');
                const icon = row.querySelector('.fa-chevron-right');
                if(icon) icon.classList.remove('rotate-90');
            }
        }
    });
};