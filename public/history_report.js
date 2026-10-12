// ==========================================
// 📜 RIZENIC - History Report Module
// ==========================================

const API_BASE_URL = window.location.origin;
let rawMasterData = [];
let allHistoryData = [];
let filteredHistoryData = [];

let activeFilters = {};
let currentFilterKey = -1;
let draggedColIdx = null;

// 📋 รายการคอลัมน์ของ rizenicreport
let historyColsDef = [
    { idx: 0, key: 'action', title: 'Action', width: 80, filter: false },
    { idx: 1, key: 'car_plate', title: 'ทะเบียนรถ', width: 110, filter: true },
    { idx: 2, key: 'contact_date', title: 'วันที่ติดต่อ', width: 110, filter: true },
    { idx: 3, key: 'arrived_date', title: 'วันที่รถเข้าจอด', width: 115, filter: true },
    { idx: 4, key: 'target_finish_date', title: 'วันกำหนดซ่อมเสร็จ', width: 125, filter: true },
    { idx: 5, key: 'repair_finish_date', title: 'วันที่ซ่อมเสร็จ', width: 115, filter: true },
    { idx: 6, key: 'delivery_date', title: 'วันที่ส่งมอบ', width: 110, filter: true },
    { idx: 7, key: 'car_brand', title: 'ยี่ห้อรถ', width: 110, filter: true },
    { idx: 8, key: 'car_model', title: 'รุ่นรถ', width: 110, filter: true },
    { idx: 9, key: 'car_color', title: 'สีรถ', width: 100, filter: true },
    { idx: 10, key: 'vin_no', title: 'เลขตัวถัง', width: 150, filter: true },
    { idx: 11, key: 'customer_name', title: 'ชื่อลูกค้า', width: 140, filter: true },
    { idx: 12, key: 'phone_number', title: 'เบอร์โทร', width: 110, filter: true },
    { idx: 13, key: 'customer_type', title: 'ประเภทลูกค้า', width: 120, filter: true },
    { idx: 14, key: 'payment_type', title: 'ประกันภัย/เงินสด', width: 140, filter: true },
    { idx: 15, key: 'claim_no', title: 'เลขที่เคลม', width: 130, filter: true },
    { idx: 16, key: 'damage_level', title: 'ระดับความเสียหาย', width: 120, filter: true },
    { idx: 17, key: 'main_part_name', title: 'ชิ้นส่วนหลัก', width: 220, filter: true },
    { idx: 18, key: 'sub_part_name', title: 'ชิ้นส่วนรอง', width: 220, filter: true },
    { idx: 19, key: 'cost_labor', title: 'ค่าแรง', width: 90, filter: true },
    { idx: 20, key: 'cost_part', title: 'ค่าอะไหล่', width: 90, filter: true },
    { idx: 21, key: 'cost_external', title: 'งานนอก', width: 90, filter: true },
    { idx: 22, key: 'job_status', title: 'สถานะงาน', width: 140, filter: true },
    { idx: 23, key: 'department_routing', title: 'ส่งต่อแผนก', width: 120, filter: true },
    { idx: 24, key: 'billing_date', title: 'วันที่ออกบิล', width: 110, filter: true },
    { idx: 25, key: 'qt_no', title: 'เลข QT', width: 120, filter: true },
    { idx: 26, key: 'so_no', title: 'เลข SO', width: 120, filter: true },
    { idx: 27, key: 'sa_owner', title: 'SA ผู้รับผิดชอบ', width: 120, filter: true },
    { idx: 28, key: 'branch_name', title: 'สาขา', width: 120, filter: true },
    { idx: 29, key: 'notes', title: 'หมายเหตุ', width: 180, filter: true }
];

let hiddenCols = new Set();

function formatToThaiDate(isoStr) {
    if (!isoStr) return '-';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    if(!toast) return;
    toast.className = `fixed bottom-5 right-5 font-bold px-5 py-2.5 rounded shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white text-xs`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${type==='error'?'fa-circle-xmark':'fa-circle-check'} text-base"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 2500);
}

document.addEventListener('DOMContentLoaded', async () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'Staff';
    document.getElementById('display_branch').innerText = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

    // ตั้งค่าเริ่มต้นของปฏิทินย้อนหลัง 30 วัน จนถึงวันนี้
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const past30 = new Date();
    past30.setDate(past30.getDate() - 30);
    const pastStr = past30.toISOString().split('T')[0];

    document.getElementById('start_date').value = pastStr;
    document.getElementById('end_date').value = todayStr;

    initColumns();
    await loadBranchOptions();
    
    // 🌟 แสดงข้อความแจ้งเตือนให้กด "ดึงรายงาน" ก่อน (ไม่ดึงข้อมูลอัตโนมัติ)
    renderInitialState();

    document.addEventListener('click', (e) => {
        const modal = document.getElementById('excelFilterModal');
        if (modal && !modal.contains(e.target) && !e.target.closest('.filter-icon') && !modal.classList.contains('hidden')) {
            closeExcelFilter();
        }
    });
});

function renderInitialState() {
    const tbody = document.getElementById('history_table_body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="40" class="text-center py-20 text-slate-400 font-bold bg-white"><i class="fa-solid fa-file-invoice text-3xl mb-2 text-indigo-500 block"></i>กรุณาเลือกช่วงเวลา แล้วกดปุ่ม "ดึงรายงาน" เพื่อแสดงข้อมูล</td></tr>`;
    }
}

// ------------------------------------------
// 🛠️ 1. จัดการโครงสร้างคอลัมน์ & ยืด/หด/สลับ
// ------------------------------------------
function initColumns() {
    const thead = document.getElementById('history_table_head');
    let trHtml = '<tr>';
    
    historyColsDef.forEach((col, renderIndex) => {
        let filterIcon = col.filter ? `<i class="fa-solid fa-filter filter-icon" onclick="openExcelFilter(event, ${col.idx}, '${col.title}')"></i>` : '';
        trHtml += `
            <th class="group select-none" data-render-idx="${renderIndex + 1}" id="th_${col.idx}" style="width: ${col.width}px; min-width: ${col.width}px;">
                <div class="flex justify-between items-center w-full h-full px-1">
                    <div class="cursor-pointer flex-1 overflow-hidden whitespace-nowrap text-ellipsis flex items-center justify-center" onclick="${col.filter ? `sortTable(${col.idx})` : ''}">
                        <span>${col.title}</span> <i class="fa-solid fa-sort sort-icon"></i>
                    </div>
                    ${filterIcon}
                </div>
                <div class="resizer"></div>
            </th>`;
    });
    thead.innerHTML = trHtml + '</tr>';

    const toggleContainer = document.getElementById('col_toggles_container');
    let togglesHtml = '';
    historyColsDef.forEach(col => {
        if(col.key === 'action') return; 
        togglesHtml += `
            <label draggable="true" ondragstart="handleDragStart(event, ${col.idx})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${col.idx})" ondragend="handleDragEnd(event)" class="flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded cursor-grab hover:bg-slate-50 transition">
                <i class="fa-solid fa-grip-vertical text-slate-400"></i>
                <input type="checkbox" onchange="toggleColumnVisibility(${col.idx}, this.checked)" ${hiddenCols.has(col.idx) ? '' : 'checked'} class="accent-[#00320D] w-3.5 h-3.5">
                <span class="text-xs font-bold text-slate-700">${col.title}</span>
            </label>`;
    });
    toggleContainer.innerHTML = togglesHtml;

    applyColumnStyles();
    setTimeout(initResizableColumns, 300);
}

function handleDragStart(e, idx) { draggedColIdx = idx; e.target.style.opacity = '0.5'; }
function handleDragOver(e) { e.preventDefault(); }
function handleDrop(e, targetIdx) {
    e.preventDefault(); e.target.closest('label').style.opacity = '1';
    if (draggedColIdx === null || draggedColIdx === targetIdx) return;
    const srcPos = historyColsDef.findIndex(c => c.idx === draggedColIdx);
    const tgtPos = historyColsDef.findIndex(c => c.idx === targetIdx);
    const [movedCol] = historyColsDef.splice(srcPos, 1); historyColsDef.splice(tgtPos, 0, movedCol);
    initColumns(); applyHistoryFilters();
}
function handleDragEnd(e) { e.target.style.opacity = '1'; }

function toggleColManager() { document.getElementById('colManagerPanel').classList.toggle('hidden'); }

function toggleColumnVisibility(idx, isShow) {
    if (isShow) hiddenCols.delete(idx);
    else hiddenCols.add(idx);
    applyColumnStyles();
}

function applyColumnStyles() {
    const styleTag = document.getElementById('dynamic-col-styles'); let css = '';
    hiddenCols.forEach(idx => {
        const rIdx = historyColsDef.findIndex(c => c.idx === idx) + 1;
        if(rIdx > 0) css += `#historyTable th:nth-child(${rIdx}), #historyTable td:nth-child(${rIdx}) { display: none !important; }\n`;
    });
    styleTag.innerHTML = css;
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#historyTable th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer'); if(!resizer) return;
        let startX = 0; let startWidth = 0;
        
        const onMouseDown = (e) => { 
            e.stopPropagation(); e.preventDefault(); 
            startX = e.clientX; startWidth = col.offsetWidth; 
            resizer.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove); 
            document.addEventListener('mouseup', onMouseUp); 
        };
        const onMouseMove = (e) => { 
            const newWidth = Math.max(50, startWidth + (e.clientX - startX));
            col.style.width = `${newWidth}px`; 
            col.style.minWidth = `${newWidth}px`; 
        };
        const onMouseUp = () => { 
            resizer.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove); 
            document.removeEventListener('mouseup', onMouseUp); 
        };
        resizer.removeEventListener('mousedown', onMouseDown);
        resizer.addEventListener('mousedown', onMouseDown);
    });
}

// ------------------------------------------
// 🚀 2. โหลดข้อมูล & ตัวกรองวันที่ 1 ประเภท
// ------------------------------------------
async function loadBranchOptions() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/employees`);
        if (res.ok) {
            const employees = await res.json();
            const masterBranches = [...new Set(employees.map(e => e.branch_name).filter(Boolean))].sort();
            const branchSelect = document.getElementById('branch_filter');
            const userRole = sessionStorage.getItem('emp_role');
            const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);
            const userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

            let optionsHtml = isManager ? `<option value="ALL">-- ทุกสาขา --</option>` : '';
            masterBranches.forEach(b => { optionsHtml += `<option value="${b}">${b}</option>`; });
            branchSelect.innerHTML = optionsHtml;

            if (!isManager) {
                branchSelect.value = userBranch;
                branchSelect.disabled = true;
            }
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}

async function loadHistoryReportData() {
    const tbody = document.getElementById('history_table_body');
    tbody.innerHTML = `<tr><td colspan="40" class="text-center py-20 text-slate-400 font-bold bg-white"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-indigo-600 block"></i>กำลังดึงข้อมูลรายงานประวัติย้อนหลัง...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`);
        const data = await res.json();
        rawMasterData = Array.isArray(data) ? data : (data.data || []);

        applyDateRangeFilter();

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="40" class="text-center py-20 text-red-600 font-bold bg-white"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><br>เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</td></tr>`;
    }
}

// 🎯 กรองตามวันที่ 1 ประเภทที่เลือก + ปฏิทินช่วงเวลา
function applyDateRangeFilter() {
    const startDate = document.getElementById('start_date').value;
    const endDate = document.getElementById('end_date').value;
    const selectedDateType = document.querySelector('input[name="filter_date_type"]:checked')?.value || 'contact_date';
    const selectedBranch = document.getElementById('branch_filter').value;

    if (startDate && endDate && startDate > endDate) {
        alert('❌ "วันที่เริ่มต้น" ต้องไม่มากกว่า "วันที่สิ้นสุด" ครับ');
        return;
    }

    allHistoryData = rawMasterData.filter(job => {
        if (selectedBranch !== 'ALL' && job.branch_name !== selectedBranch) return false;

        const jobDateRaw = job[selectedDateType];
        if (!jobDateRaw) return false;

        const dateStr = String(jobDateRaw).split('T')[0];
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;

        return true;
    });

    applyHistoryFilters();
}

// 🎯 กรองคำค้นหา + ฟิลเตอร์หัวตาราง Excel
function applyHistoryFilters() {
    const searchTxt = document.getElementById('search_input').value.toLowerCase().trim();

    filteredHistoryData = allHistoryData.filter(job => {
        if (searchTxt) {
            const matchStr = Object.values(job).join(' ').toLowerCase();
            if (!matchStr.includes(searchTxt)) return false;
        }

        for (let colIdx in activeFilters) {
            const colDef = historyColsDef.find(c => c.idx === parseInt(colIdx));
            if (!colDef) continue;
            let rawVal = job[colDef.key];
            if (colDef.key.includes('date') && rawVal) {
                rawVal = formatToThaiDate(rawVal);
            } else {
                rawVal = String(rawVal || '').trim();
            }
            if (!activeFilters[colIdx].has(rawVal)) return false;
        }

        return true;
    });

    renderHistoryTable(filteredHistoryData);
    document.getElementById('row_count').innerText = filteredHistoryData.length;
}

function clearAllFilters() {
    activeFilters = {};
    document.getElementById('search_input').value = '';
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('active'); });
    applyHistoryFilters();
}

// ------------------------------------------
// 🔍 3. Excel Filter Modal (หัวตาราง)
// ------------------------------------------
function openExcelFilter(e, colIndex, title) {
    e.stopPropagation();
    currentFilterKey = colIndex;
    document.getElementById('ef_col_name').innerText = title;
    document.getElementById('ef_search').value = '';

    const uniqueValues = new Set();
    allHistoryData.forEach(job => {
        const colDef = historyColsDef.find(c => c.idx === colIndex); if(!colDef) return;
        let val = job[colDef.key];
        if(colDef.key.includes('date') && val) {
            val = formatToThaiDate(val);
        } else val = String(val || '').trim();
        uniqueValues.add(val);
    });

    const listDiv = document.getElementById('ef_checkbox_list');
    listDiv.innerHTML = '';
    
    [...uniqueValues].sort().forEach(val => {
        const isChecked = activeFilters[colIndex] ? activeFilters[colIndex].has(val) : true;
        listDiv.innerHTML += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer ef-item transition"><input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] w-3.5 h-3.5 rounded"><span class="text-slate-700 text-xs font-medium w-full truncate" title="${val}">${val === '' ? '(ว่าง)' : val}</span></label>`;
    });

    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);

    const modal = document.getElementById('excelFilterModal');
    const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    let leftPos = rect.left + window.scrollX;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeExcelFilter() {
    document.getElementById('excelFilterModal').classList.add('hidden');
    document.getElementById('excelFilterModal').classList.remove('flex');
}

function searchExcelFilter() {
    const txt = document.getElementById('ef_search').value.toLowerCase();
    document.querySelectorAll('.ef-item').forEach(l => l.style.display = l.querySelector('.ef-check').value.toLowerCase().includes(txt) ? 'flex' : 'none');
}

function toggleAllExcelFilters(c) {
    document.querySelectorAll('.ef-item:not([style*="display: none"]) .ef-check').forEach(cb => cb.checked = c);
}

function applyExcelFilter() {
    const checks = document.querySelectorAll('.ef-check');
    const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const thIcon = document.getElementById(`th_${currentFilterKey}`)?.querySelector('.filter-icon');

    if (checkedVals.length === checks.length || checkedVals.length === 0) {
        delete activeFilters[currentFilterKey];
        if(thIcon) thIcon.classList.remove('active');
    } else {
        activeFilters[currentFilterKey] = new Set(checkedVals);
        if(thIcon) thIcon.classList.add('active');
    }
    closeExcelFilter();
    applyHistoryFilters();
}

function clearSpecificExcelFilter() {
    if(activeFilters[currentFilterKey]) delete activeFilters[currentFilterKey];
    const thIcon = document.getElementById(`th_${currentFilterKey}`)?.querySelector('.filter-icon');
    if(thIcon) thIcon.classList.remove('active');
    closeExcelFilter();
    applyHistoryFilters();
}

// ------------------------------------------
// ↕️ 4. การจัดเรียงข้อมูล (Sorting Asc / Desc)
// ------------------------------------------
function sortTable(colIndex) {
    const table = document.getElementById('historyTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => { icon.className = "fa-solid fa-sort sort-icon"; });
    
    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc';
    dir = dir === 'asc' ? 'desc' : 'asc';
    table.setAttribute(`data-dir-${colIndex}`, dir);

    const clickedTh = Array.from(table.querySelectorAll('th')).find(th => th.id === `th_${colIndex}`);
    if (clickedTh) {
        const clickedIcon = clickedTh.querySelector('.sort-icon');
        if (clickedIcon) clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-amber-400 opacity-100" : "fa-solid fa-sort-up ml-1 text-amber-400 opacity-100";
    }

    const thIndex = Array.from(table.querySelectorAll('th')).findIndex(th => th.id === `th_${colIndex}`);

    rows.sort((a, b) => {
        let valA = a.cells[thIndex] ? a.cells[thIndex].innerText.trim() : '';
        let valB = b.cells[thIndex] ? b.cells[thIndex].innerText.trim() : '';

        // จัดเรียงวันที่ DD/MM/YYYY
        let dateMatchA = valA.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        let dateMatchB = valB.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if(dateMatchA && dateMatchB) {
            let dateA = new Date(dateMatchA[3], dateMatchA[2]-1, dateMatchA[1]);
            let dateB = new Date(dateMatchB[3], dateMatchB[2]-1, dateMatchB[1]);
            return dir === 'asc' ? dateA - dateB : dateB - dateA;
        }

        // จัดเรียงตัวเลข
        let numA = parseFloat(valA.replace(/,/g, ''));
        let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;

        // จัดเรียงข้อความภาษาไทย
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });

    rows.forEach(row => tbody.appendChild(row));
}

// ------------------------------------------
// 🖼️ 5. วาดตารางแสดงผล (Render Table)
// ------------------------------------------
function renderHistoryTable(data) {
    const tbody = document.getElementById('history_table_body');
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="40" class="text-center py-16 text-slate-400 font-bold bg-white">ไม่พบรายงานประวัติย้อนหลังตามเงื่อนไขที่เลือก</td></tr>`;
        return;
    }

    let html = '';
    data.forEach((job, idx) => {
        let trHtml = `<tr class="${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-amber-50/60 transition">`;

        historyColsDef.forEach(col => {
            let val = job[col.key] || '-';

            if (col.key === 'action') {
                val = `<div class="text-center"><button onclick="sessionStorage.setItem('edit_job_id', '${job.id}'); window.location.href='index.html';" class="bg-[#00320D] text-white px-2.5 py-0.5 rounded text-[10px] font-bold hover:bg-black transition shadow-xs"><i class="fa-solid fa-pen"></i> เปิด</button></div>`;
            } else if (col.key.includes('date') && job[col.key]) {
                val = `<div class="text-center font-mono font-bold text-slate-700">${formatToThaiDate(job[col.key])}</div>`;
            } else if (col.key === 'car_plate') {
                val = `<div class="text-center font-black text-indigo-900">${job.car_plate || '-'}</div>`;
            } else if (col.key === 'car_brand') {
                val = `<div class="font-bold text-slate-800">${job.car_brand || ''} <span class="text-slate-500 font-normal">${job.car_model || ''}</span></div>`;
            } else if (col.key === 'main_part_name' || col.key === 'sub_part_name') {
                const badgeClass = col.key === 'main_part_name' ? 'part-badge-main' : 'part-badge-sub';
                val = job[col.key] ? `<div class="px-2 py-1 flex flex-wrap gap-1">${String(job[col.key]).split(',').map(p => `<span class="${badgeClass}">${p.trim()}</span>`).join('')}</div>` : '-';
            } else if (col.key === 'cost_labor' || col.key === 'cost_part' || col.key === 'cost_external') {
                const num = Number(val) || 0;
                val = `<div class="text-right font-mono font-bold">${num.toLocaleString('th-TH', {minimumFractionDigits: 0})}</div>`;
            } else {
                val = `<div class="px-2 py-1 truncate" title="${val}">${val}</div>`;
            }

            trHtml += `<td class="p-0">${val}</td>`;
        });

        html += trHtml + '</tr>';
    });

    tbody.innerHTML = html;
}

// ------------------------------------------
// 📥 6. ดาวน์โหลด Excel
// ------------------------------------------
function exportHistoryExcel() {
    if (!filteredHistoryData || filteredHistoryData.length === 0) {
        showToast('⚠️ กรุณากดปุ่ม "ดึงรายงาน" เพื่อโหลดข้อมูลก่อนดาวน์โหลด Excel ครับ', 'error');
        return;
    }

    const exportData = [];
    const exportCols = historyColsDef.filter(c => c.key !== 'action');

    exportData.push(exportCols.map(col => col.title));

    filteredHistoryData.forEach(job => {
        const row = exportCols.map(colDef => {
            let val = job[colDef.key];
            if (colDef.key.includes('date') && val) val = formatToThaiDate(val);
            return val || '';
        });
        exportData.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "History_Report");
    XLSX.writeFile(wb, `Rizenic_History_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว!');
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }