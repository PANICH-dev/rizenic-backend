let activePOFilters = {};
let currentPOFilterKey = '';

function getDashboardPOGroups() {
    const jobs = getSafeJobsData();
    const byId = new Map(jobs.map(j => [String(j.id), j]));
    const byPlate = new Map();
    jobs.forEach(j => {
        const plate = String(j.car_plate || '').trim();
        if (!byPlate.has(plate)) byPlate.set(plate, j);
    });
    const groups = {};
    const parts = Array.isArray(filteredPartOrders) ? filteredPartOrders : [];
    parts.forEach(o => {
        if (o.order_status === 'ยกเลิก') return;
        const jobId = String(o.job_id || o.report_id || '');
        const plate = String(o.car_plate || '').trim();
        const job = jobId ? byId.get(jobId) : byPlate.get(plate);
        if (!job || !(job.job_status || '').includes('สั่งอะไหล่')) return;
        const key = JSON.stringify([job.branch_name || '', String(job.car_plate || plate || job.id).trim()]);
        if (!groups[key]) groups[key] = {
            plate: String(job.car_plate || plate || 'ไม่ระบุ'),
            vin: String(job.vin_no || o.vin_no || '').trim(),
            saName: job.sa_owner || 'ไม่ระบุ', jobId: job.id,
            isParked: job.is_parked || 'ไม่ระบุ', items: []
        };
        groups[key].items.push(o);
    });
    return groups;
}

function getDashboardPOStatus(group) {
    const waiting = group.items.some(i => {
        const status = i.order_status || '';
        return status.includes('รอ') || status.includes('สั่ง') || status.includes('Back Order');
    });
    return waiting ? 'รออะไหล่' : 'ครบแล้ว';
}

function matchesDashboardPOFilters(group) {
    const values = {
        plate: group.plate, sa: group.saName,
        status: getDashboardPOStatus(group),
        parked: group.isParked === 'จอดซ่อม' ? 'จอดซ่อม' : 'ไม่จอดซ่อม'
    };
    return Object.entries(activePOFilters).every(([key, selected]) => selected.has(values[key]));
}

// ========================================================
// 📦 RIZENIC - PO TRACKING SIMPLE CATEGORY FILTER
// ========================================================

// 1. สร้าง Dropdown ตัวกรองหมวดหมู่ และ SA วางไว้เหนือตารางอัตโนมัติ
function injectPOCategoryDropdown() {
    if (document.getElementById('po_category_filter')) return;

    const table = document.getElementById('partsTrackingTable');
    if (!table) return;

    const filterWrap = document.createElement('div');
    filterWrap.className = 'flex items-center gap-2 mb-3 p-1';
    filterWrap.innerHTML = `
        <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i class="fa-solid fa-filter text-blue-600"></i> เลือกหมวดหมู่อะไหล่:
        </label>
        <select id="po_category_filter" onchange="renderPartsTracking()" 
                class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-black text-slate-700 outline-none focus:border-blue-500 shadow-sm cursor-pointer hover:border-slate-400 transition">
            <option value="ALL">📦 แสดงทั้งหมด</option>
            <option value="WAITING">⏳ รออะไหล่ (ยังไม่ครบ)</option>
            <option value="READY">✅ ครบแล้ว (พร้อมลุย)</option>
        </select>
        
        <!-- 🌟 เพิ่ม Dropdown ตัวกรอง SA 🌟 -->
        <select id="po_sa_filter" onchange="renderPartsTracking()" 
                class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-black text-slate-700 outline-none focus:border-blue-500 shadow-sm cursor-pointer hover:border-slate-400 transition ml-2">
            <option value="ALL">👤 SA (ทั้งหมด)</option>
        </select>
    `;

    table.parentElement.insertBefore(filterWrap, table);
}

// 🌟 ฟังก์ชันเติมชื่อ SA เข้า Dropdown อัตโนมัติ
function updatePOSAFilterDropdown(saList) {
    const saSelect = document.getElementById('po_sa_filter');
    if (!saSelect) return;
    
    const currentVal = saSelect.value;
    const sortedSAs = [...new Set(saList.filter(Boolean))].sort();
    
    let options = `<option value="ALL">👤 SA (ทั้งหมด)</option>`;
    sortedSAs.forEach(sa => {
        options += `<option value="${escapeDashboardHtml(sa)}" ${sa === currentVal ? 'selected' : ''}>${escapeDashboardHtml(sa)}</option>`;
    });
    
    saSelect.innerHTML = options;
}

// 2. เรนเดอร์ตารางและคัดกรองตามหมวดหมู่
function renderPartsTracking() {
    injectPOCategoryDropdown();

    const tbody = document.getElementById('parts_tracking_body');
    if (!tbody) return;

    const groupedParts = getDashboardPOGroups();
    const allSAsInPO = new Set(Object.values(groupedParts).map(group => group.saName));

    // อัปเดต Dropdown SA
    updatePOSAFilterDropdown(Array.from(allSAsInPO));

    const selectedFilter = document.getElementById('po_category_filter')?.value || 'ALL';
    const selectedSA = document.getElementById('po_sa_filter')?.value || 'ALL';
    const sortedPlates = Object.keys(groupedParts).sort((a, b) => groupedParts[a].plate.localeCompare(groupedParts[b].plate));

    let html = '';
    let visibleCount = 0;
    let readyCount = 0;
    let waitingCount = 0;

    sortedPlates.forEach((key, index) => {
        const group = groupedParts[key];
        const plate = group.plate;
        if (!matchesDashboardPOFilters(group)) return;
        const rowId = `part_group_${index}`;

        // 🌟 กรองตาม SA ที่เลือก
        if (selectedSA !== 'ALL' && group.saName !== selectedSA) return;

        // เช็กสถานะ: ถ้ารถคันนี้มีชิ้นใดชิ้นหนึ่งที่ "รอ/สั่ง/Back Order" = รออะไหล่
        const isWaiting = group.items.some(i => {
            const st = i.order_status || '';
            return st.includes('รอ') || st.includes('สั่ง') || st.includes('Back Order');
        });
        const isReady = !isWaiting && group.items.length > 0;

        // นับยอดรวมเพื่ออัปเดตกล่องตัวเลขด้านบน
        if (isReady) readyCount++;
        else waitingCount++;

        // กรองตาม Dropdown หมวดหมู่
        if (selectedFilter === 'WAITING' && !isWaiting) return;
        if (selectedFilter === 'READY' && !isReady) return;

        visibleCount++;

        // กำหนดป้ายสถานะ
        const badgeClass = isReady 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
            : 'bg-rose-50 text-rose-700 border-rose-300';
        const badgeText = isReady ? '✅ ครบแล้ว' : '⏳ รออะไหล่';

        html += `
            <tr class="po-row-main hover:bg-blue-50/80 transition-colors border-b border-slate-200 cursor-pointer font-medium" onclick="togglePartAccordion('${rowId}')">
                <td class="text-center px-3 py-3"><i id="icon_${rowId}" class="fa-solid fa-chevron-right text-slate-400 transition-transform duration-200"></i></td>
                <td class="font-black text-[#00320D] px-4 py-3"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-sm shadow-inner font-mono">${escapeDashboardHtml(plate)}</span><div class="mt-2 text-[10px] font-mono font-normal text-slate-500 whitespace-nowrap" title="VIN ${escapeDashboardHtml(group.vin || '-')}">VIN ${escapeDashboardHtml(group.vin || '-')}</div></td>
                <td class="text-xs font-bold text-slate-600 px-4 py-3"><i class="fa-solid fa-user-tie text-blue-400 mr-1.5"></i>${escapeDashboardHtml(group.saName)}</td>
                <td class="text-center px-4 py-3"><span class="text-blue-700 font-black bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 text-xs shadow-sm">${group.items.length} รายการ</span></td>
                <td class="px-4 py-3 align-middle"><span class="inline-flex items-center px-3 py-1 rounded-md border text-xs font-black shadow-sm ${badgeClass}">${badgeText}</span></td>
                <td class="text-center px-4 py-3" onclick="event.stopPropagation()">
                    <!-- 🌟 เปลี่ยนเป็นปุ่มเปิดบิล 🌟 -->
                    <button onclick="goToEditJob('${group.jobId}')" class="text-[11px] bg-[#00320D] border border-[#00320D] text-white px-3 py-1.5 rounded-lg hover:bg-black transition font-bold shadow-sm whitespace-nowrap w-full">
                        <i class="fa-solid fa-pen mr-1"></i> เปิดบิล
                    </button>
                </td>
            </tr>
        `;

        // ตารางรายการอะไหล่ย่อยเมื่อกดกางออก
        let subRowsHtml = group.items.map(item => {
            const st = item.order_status || 'รออัปเดต';
            const isSubComplete = st.includes('ครบ') || st.includes('มีของ') || st.includes('สต๊อค');
            const subBadge = isSubComplete 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                : 'bg-rose-100 text-rose-800 border-rose-300';

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                    <td class="px-3 py-2 text-center font-mono font-bold text-purple-700 bg-purple-50/50">${escapeDashboardHtml(item.epc_no || '-')}</td>
                    <td class="px-3 py-2 font-mono font-bold text-blue-700">${escapeDashboardHtml(item.part_no || '-')}</td>
                    <td class="px-3 py-2 font-bold text-slate-700 max-w-[220px] truncate" title="${escapeDashboardHtml(item.part_name || '-')}">${escapeDashboardHtml(item.part_name || '-')}</td>
                    <td class="px-3 py-2 text-center font-black text-amber-700">${item.qty_ordered || 1}</td>
                    <td class="px-3 py-2 text-center font-mono text-slate-600 font-bold">${item.order_date ? item.order_date.split('T')[0] : '-'}</td>
                    <td class="px-3 py-2 text-center font-mono text-emerald-700 font-bold">${item.est_arrival_date ? item.est_arrival_date.split('T')[0] : '-'}</td>
                    <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] border font-bold ${subBadge}">${escapeDashboardHtml(st)}</span></td>
                </tr>
            `;
        }).join('');

        html += `
            <tr id="${rowId}" class="po-row-sub hidden bg-slate-100/70">
                <td colspan="6" class="p-3">
                    <div class="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-inner">
                        <div class="bg-slate-200/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border-b border-slate-300 flex justify-between items-center">
                            <span><i class="fa-solid fa-list-check text-blue-600 mr-1.5"></i>ตารางตรวจสอบสั่งอะไหล่: ${escapeDashboardHtml(plate)}</span>
                            <span class="text-slate-500 font-mono font-normal">รวม ${group.items.length} ชิ้น</span>
                        </div>
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th class="px-3 py-2 text-center w-28">เลข EPC</th>
                                    <th class="px-3 py-2 w-36">รหัสอะไหล่</th>
                                    <th class="px-3 py-2">ชื่อรายการอะไหล่</th>
                                    <th class="px-3 py-2 text-center w-16">จำนวน</th>
                                    <th class="px-3 py-2 text-center w-28">วันที่สั่ง</th>
                                    <th class="px-3 py-2 text-center w-28">กำหนดเข้า</th>
                                    <th class="px-3 py-2 text-center w-32">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>${subRowsHtml}</tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    });

    // อัปเดตตัวเลขการ์ดสรุปด้านบน
    const elReady = document.getElementById('dash_po_ready');
    const elWaiting = document.getElementById('dash_po_waiting');
    if (elReady) elReady.innerText = `${readyCount}`;
    if (elWaiting) elWaiting.innerText = `${waitingCount}`;

    if (visibleCount === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-slate-400 font-bold bg-slate-50"><i class="fa-solid fa-filter-circle-xmark text-3xl mb-3 block opacity-50"></i>ไม่พบข้อมูลที่ตรงกับตัวกรอง</td></tr>`;
    } else {
        tbody.innerHTML = html;
    }
    const keyword = document.querySelector('input[onkeyup*="filterPOTable"]')?.value || '';
    window.filterPOTable(keyword);
}

// 3. ฟังก์ชันเปิด-ปิดแถวย่อย (Accordion)
window.togglePartAccordion = function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if (el) {
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            if (icon) icon.classList.add('rotate-90');
        } else {
            el.classList.add('hidden');
            if (icon) icon.classList.remove('rotate-90');
        }
    }
};

// 🌟 ฟังก์ชันโหลดหน้า Edit Job 🌟
window.goToEditJob = window.goToEditJob || function(jobId) {
    if(!jobId) {
        alert('ไม่พบข้อมูล Job ID ของรถคันนี้');
        return;
    }
    sessionStorage.setItem('edit_job_id', jobId);
    window.location.href = 'index.html';
};

// 4. ช่องค้นหาข้อความแบบ Real-time
window.filterPOTable = function(keyword) {
    const tbody = document.getElementById('parts_tracking_body');
    if (!tbody) return;
    const lowerKeyword = (keyword || '').toLowerCase().trim();
    const mainRows = Array.from(tbody.querySelectorAll('.po-row-main'));

    mainRows.forEach(row => {
        const nextRow = row.nextElementSibling;
        let isMatch = false;

        if (lowerKeyword === '') {
            isMatch = true;
        } else {
            const mainText = row.innerText.toLowerCase();
            const subText = (nextRow && nextRow.classList.contains('po-row-sub')) ? nextRow.innerText.toLowerCase() : '';
            if (mainText.includes(lowerKeyword) || subText.includes(lowerKeyword)) {
                isMatch = true;
            }
        }

        if (isMatch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
            if (nextRow && nextRow.classList.contains('po-row-sub')) {
                nextRow.classList.add('hidden');
                const icon = row.querySelector('.fa-chevron-right');
                if (icon) icon.classList.remove('rotate-90');
            }
        }
    });
};

// 6. หน้าต่าง Excel Filter สำหรับหัวคอลัมน์
function injectPOFilterModal() {
    if (document.getElementById('poExcelFilterModal')) return;
    const modalHtml = `
    <div id="poExcelFilterModal" class="hidden fixed bg-white border border-slate-300 shadow-2xl rounded-xl w-64 z-[99999] flex-col overflow-hidden text-xs">
        <div class="bg-[#00320D] text-white border-b border-green-800 px-3 py-2.5 flex justify-between items-center">
            <span class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-filter text-amber-400"></i> ตัวกรอง: <span id="po_ef_col_name" class="text-slate-200"></span></span>
            <button onclick="closePOExcelFilter()" class="text-slate-300 hover:text-red-400 transition"><i class="fa-solid fa-xmark text-base"></i></button>
        </div>
        <div class="p-2.5 pb-1">
            <div class="relative mb-2">
                <i class="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="text" id="po_ef_search" class="w-full border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none focus:border-amber-500 transition-all bg-white" placeholder="ค้นหา..." oninput="searchPOExcelFilter()">
            </div>
            <label class="flex items-center gap-2 px-1.5 py-1 border-b border-slate-100 mb-1 cursor-pointer hover:bg-slate-50 rounded transition">
                <input type="checkbox" id="po_ef_select_all" checked onchange="toggleAllPOExcelFilters(this.checked)" class="w-3.5 h-3.5 accent-[#00320D] cursor-pointer rounded">
                <span class="font-bold text-slate-700 select-none">เลือกทั้งหมด</span>
            </label>
            <div id="po_ef_checkbox_list" class="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar pr-1"></div>
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

window.openPOExcelFilter = function(e, colKey, title) {
    const evt = e || window.event;
    if (evt) {
        if (typeof evt.stopPropagation === 'function') evt.stopPropagation();
        if (typeof evt.preventDefault === 'function') evt.preventDefault();
        evt.cancelBubble = true;
    }

    injectPOFilterModal();
    currentPOFilterKey = colKey;

    const titleEl = document.getElementById('po_ef_col_name');
    if (titleEl) titleEl.innerText = title;

    const searchInput = document.getElementById('po_ef_search');
    if (searchInput) searchInput.value = '';

    const uniqueValues = new Set();
    const groupedParts = getDashboardPOGroups();
    Object.values(groupedParts).forEach(group => {
        const values = {
            plate: group.plate, sa: group.saName,
            status: getDashboardPOStatus(group),
            parked: group.isParked === 'จอดซ่อม' ? 'จอดซ่อม' : 'ไม่จอดซ่อม'
        };
        if (values[colKey] !== undefined) uniqueValues.add(values[colKey]);
    });

    const listDiv = document.getElementById('po_ef_checkbox_list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    [...uniqueValues].sort().forEach(val => {
        const isChecked = activePOFilters[colKey] ? activePOFilters[colKey].has(val) : true;
        listDiv.innerHTML += `
            <label class="flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer po-ef-item transition">
                <input type="checkbox" value="${escapeDashboardHtml(val)}" ${isChecked ? 'checked' : ''} class="po-ef-check accent-[#00320D] mt-0.5 cursor-pointer w-4 h-4">
                <span class="text-slate-700 font-medium truncate w-full text-sm" title="${escapeDashboardHtml(val)}">${escapeDashboardHtml(val)}</span>
            </label>`;
    });
    
    const selAll = document.getElementById('po_ef_select_all');
    const allChecks = Array.from(document.querySelectorAll('.po-ef-check'));
    if (selAll) selAll.checked = allChecks.length > 0 && allChecks.every(cb => cb.checked);
    
    const modal = document.getElementById('poExcelFilterModal');
    if (!modal) return;

    const targetEl = evt ? (evt.target || evt.srcElement) : null;
    const th = targetEl ? targetEl.closest('th') : document.getElementById(`po_th_${colKey}`);

    if (th) {
        const rect = th.getBoundingClientRect();
        let topPos = rect.bottom + 8;
        if (topPos + 320 > window.innerHeight) topPos = Math.max(10, rect.top - 320);
        let leftPos = rect.left;
        if (leftPos + 270 > window.innerWidth) leftPos = window.innerWidth - 280;
        if (leftPos < 10) leftPos = 10;

        modal.style.top = topPos + 'px';
        modal.style.left = leftPos + 'px';
        modal.style.transform = 'none';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closePOExcelFilter = function() {
    const modal = document.getElementById('poExcelFilterModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
};

window.searchPOExcelFilter = function() {
    const txt = (document.getElementById('po_ef_search')?.value || '').toLowerCase();
    document.querySelectorAll('.po-ef-item').forEach(l => {
        const chk = l.querySelector('.po-ef-check');
        const val = (chk ? chk.value : '').toLowerCase();
        l.style.display = val.includes(txt) ? 'flex' : 'none';
    });
};

window.toggleAllPOExcelFilters = function(checked) {
    document.querySelectorAll('.po-ef-item:not([style*="display: none"]) .po-ef-check').forEach(cb => cb.checked = checked);
};

window.applyPOExcelFilter = function() {
    const checks = document.querySelectorAll('.po-ef-check');
    const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const thIcon = document.querySelector(`#po_th_${currentPOFilterKey} .po-filter-icon`);
    
    if (checkedVals.length === checks.length) {
        delete activePOFilters[currentPOFilterKey];
        if (thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-blue-300'); }
    } else {
        activePOFilters[currentPOFilterKey] = new Set(checkedVals);
        if (thIcon) { thIcon.classList.remove('text-blue-300'); thIcon.classList.add('text-amber-400'); }
    }
    closePOExcelFilter(); 
    renderPartsTracking();
};

window.clearSpecificPOExcelFilter = function() {
    delete activePOFilters[currentPOFilterKey];
    const thIcon = document.querySelector(`#po_th_${currentPOFilterKey} .po-filter-icon`);
    if (thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-blue-300'); }
    closePOExcelFilter(); 
    renderPartsTracking();
};

// 7. กำหนดให้เปิดให้ไฟล์อื่นมองเห็น
document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.querySelector('input[onkeyup*="filterPOTable"]');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => window.filterPOTable(e.target.value));
    }
});
