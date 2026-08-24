Chart.register(ChartDataLabels);

const API_BASE_URL = window.location.origin;
let originalRepairJobs = []; 
let allQuotas = []; 
let allPartOrders = []; 
let allBodyPartsMaster = []; 
let allPartStatusesCache = []; 

let currentYear = new Date().getFullYear(); 
let currentMonth = new Date().getMonth(); 
let chartInstance = null;
let currentBranch = 'สำนักงานใหญ่';
let selectedBranchFilter = 'ALL'; 

let activeFilters = {}; 
let activeKpiFilter = null; 
let draggedColIdx = null; 

let savedSortCol = null;
let savedSortDir = 'asc';
let kpiData = { arrived: [], repairing: [], done: [], delayed: [] };

const statusOptions = [
    "09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", "12.รอส่งมอบ", "21.พักซ่อม"
];

const stationLevels = ["ส่งจ๊อบ", "01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "07.QC", "08.แม็ก", "09.กระจก", "10.ฟิล์ม", "11.พักซ่อม", "12.รอส่งมอบ"];

const stationsTimeline = [
    { id: 'chk_kho', code: '01', name: 'เคาะ' }, { id: 'chk_pou', code: '02', name: 'โป๊ว' }, 
    { id: 'chk_puan', code: '03', name: 'เตรียมพื้น' }, { id: 'chk_pon', code: '04', name: 'พ่นสี' }, 
    { id: 'chk_prak', code: '05', name: 'ประกอบ' }, { id: 'chk_kat', code: '06', name: 'ขัดสี' }, 
    { id: 'chk_qc', code: '07', name: 'QC' }, { id: 'chk_mag', code: '08', name: 'แม็ก' }, 
    { id: 'chk_kraj', code: '09', name: 'กระจก' }, { id: 'chk_film', code: '10', name: 'ฟิล์ม' }, 
    { id: 'chk_pak', code: '11', name: 'พักซ่อม' }, { id: 'chk_ready', code: '12', name: 'รอส่งมอบ' }
];

let columnsDef = [
    { idx: 0, key: 'action', title: 'Action', w: 90, filter: false },
    { idx: 1, key: 'car_plate', title: 'ทะเบียน', w: 130, filter: true },
    { idx: 14, key: 'sa_owner', title: 'SA', w: 120, filter: true },
    { idx: 2, key: 'car_brand', title: 'ยี่ห้อ/รุ่น', w: 180, filter: true },
    { idx: 37, key: 'car_color', title: 'สีรถ', w: 110, filter: true },
    { idx: 3, key: 'arrived_date', title: 'รถเข้า', w: 120, filter: true, showCount: true },
    { idx: 4, key: 'target_finish_date', title: 'เป้าเสร็จ', w: 120, filter: true, showCount: true },
    { idx: 5, key: 'repair_finish_date', title: 'เสร็จจริง', w: 150, filter: true, showCount: true },
    { idx: 6, key: 'delivery_date', title: 'ส่งมอบ', w: 120, filter: true, showCount: true },
    { idx: 7, key: 'main_part_name', title: 'ชิ้นหลัก', w: 260, filter: true },
    { idx: 8, key: 'main_part_qty', title: 'จำนวน(หลัก)', w: 110, filter: true, showCount: true },
    { idx: 9, key: 'sub_part_name', title: 'ชิ้นรอง', w: 260, filter: true },
    { idx: 10, key: 'sub_part_qty', title: 'จำนวน(รอง)', w: 110, filter: true, showCount: true },
    { idx: 11, key: 'calculated_station', title: 'ความคืบหน้าสถานี', w: 170, filter: true },
    { idx: 12, key: 'job_status', title: 'สเตตัส', w: 180, filter: true },
    { idx: 15, key: 'department_routing', title: 'ส่งต่อแผนก', w: 130, filter: true },
    { idx: 13, key: 'repair_notes', title: 'หมายเหตุ', w: 220, filter: true }
];

let hiddenCols = new Set(); 
let isCalendarFilterActive = false; 

function formatThaiDate(dateStr) {
    if (!dateStr || dateStr === '' || dateStr === '-') return '-';
    const parts = dateStr.split('T')[0].split('-');
    if(parts.length !== 3) return dateStr;
    const y = parts[0]; const m = parts[1]; const d = parts[2];
    return `${d}/${m}/${y}`;
}

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    toast.className = `fixed bottom-5 right-5 font-bold px-6 py-3 rounded-xl shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600 text-white' : (type === 'info' ? 'bg-blue-600 text-white' : 'bg-[#00320D] text-white')}`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-xmark text-white' : (type === 'info' ? 'fa-circle-info text-white' : 'fa-circle-check text-amber-400')} text-xl"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 2500);
}

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
        return [];
    } catch (e) { return []; }
}

async function loadUserColumnPreferences() {
    const empName = sessionStorage.getItem('emp_name'); 
    if (!empName) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/user-preferences/${encodeURIComponent(empName)}_repair`);
        if (res.ok) {
            const data = await res.json();
            if (data.hidden_columns && typeof data.hidden_columns === 'object') {
                if (data.hidden_columns.hidden) hiddenCols = new Set(data.hidden_columns.hidden);
                if (data.hidden_columns.order && Array.isArray(data.hidden_columns.order)) {
                    const colMap = new Map(); columnsDef.forEach(c => colMap.set(c.key, c));
                    let newCols = [];
                    data.hidden_columns.order.forEach(k => { 
                        if(colMap.has(k)) { newCols.push(colMap.get(k)); colMap.delete(k); } 
                    });
                    colMap.forEach(c => newCols.push(c));
                    columnsDef.length = 0; columnsDef.push(...newCols);
                }
                if (data.hidden_columns.sort) {
                    savedSortCol = data.hidden_columns.sort.col;
                    savedSortDir = data.hidden_columns.sort.dir;
                }
            }
        }
    } catch (err) {}
}

async function saveUserPreferences() {
    const empName = sessionStorage.getItem('emp_name'); 
    if (!empName) return;
    try {
        await fetch(`${API_BASE_URL}/api/user-preferences`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                emp_name: empName + '_repair', 
                hidden_columns: { 
                    hidden: Array.from(hiddenCols), 
                    order: columnsDef.map(c => c.key),
                    sort: { col: savedSortCol, dir: savedSortDir }
                } 
            }) 
        });
    } catch (err) {}
}

document.addEventListener('DOMContentLoaded', async () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    
    const allowedPages = (sessionStorage.getItem('accessible_pages') || '').split(',');
    if (!allowedPages.includes('repair')) { 
        alert('⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าสถานีช่างครับ!');
        window.location.href = allowedPages.length > 0 ? allowedPages[0] + '.html' : 'index.html'; return; 
    }

    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'ช่างซ่อม';
    
    currentBranch = sessionStorage.getItem('branch_name') || sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    document.getElementById('display_branch').innerText = currentBranch;
    
    const userRole = sessionStorage.getItem('emp_role') || '';
    const isManager = ['BA', 'Manager', 'Admin', 'แอดมิน'].includes(userRole);
    const branchSelectEl = document.getElementById('branchSelect');

    if (branchSelectEl) {
        try {
            const empRes = await fetch(`${API_BASE_URL}/api/employees`);
            if (empRes.ok) {
                const employees = await empRes.json();
                const masterBranches = [...new Set(employees.map(e => e.branch_name).filter(Boolean))].sort();
                
                let optionsHtml = isManager ? `<option value="ALL">🏢 รวมทุกสาขา (ภาพรวม)</option>` : '';
                masterBranches.forEach(b => {
                    optionsHtml += `<option value="${b}">${b}</option>`;
                });
                branchSelectEl.innerHTML = optionsHtml;
            }
        } catch (e) {
            console.error('โหลดข้อมูลสาขาไม่สำเร็จ', e);
        }

        if (isManager) {
            selectedBranchFilter = 'ALL';
            branchSelectEl.value = 'ALL';
            branchSelectEl.disabled = false;
        } else {
            selectedBranchFilter = currentBranch;
            if(!Array.from(branchSelectEl.options).some(opt => opt.value === currentBranch)) {
                branchSelectEl.add(new Option(currentBranch, currentBranch));
            }
            branchSelectEl.value = currentBranch;
            branchSelectEl.disabled = true; 
        }
    }
    
    document.getElementById('m_repair_date').setAttribute('min', getTodayString());

    await loadUserColumnPreferences(); 
    buildTableHeaders(); renderHideColumnMenu(); fetchJobList();
    renderTimelineModal();
});

function onBranchChange(newBranchVal) {
    selectedBranchFilter = newBranchVal;
    updateKPIs();
    renderCalendar();
    runTableFilters();
    showToast(`สลับการแสดงผลเป็น: ${newBranchVal === 'ALL' ? 'ทุกสาขา' : newBranchVal}`, 'info');
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById('btn-' + tabId).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    if(tabId === 'tab-summary') renderPieChartAndList();
    if(tabId === 'tab-calendar') renderCalendar();
}

function buildTableHeaders() {
    const tr = document.getElementById('repair_head_row'); let html = '';
    columnsDef.forEach((col, renderIndex) => {
        let filterIcon = col.filter ? `<i class="fa-solid fa-filter filter-icon" onclick="openExcelFilter(event, ${col.idx}, '${col.title}')"></i>` : '';
        let countBadge = col.showCount ? `<span id="hdr_cnt_${col.key}" class="text-[12px] text-amber-300 font-bold ml-1 bg-[#002209] px-2 py-0.5 rounded shadow-sm inline-block min-w-[20px] text-center">0</span>` : '';
        let sortIconClass = "fa-sort";
        if (savedSortCol === col.idx) {
            sortIconClass = savedSortDir === 'asc' ? 'fa-sort-up ml-1 text-amber-400 opacity-100' : 'fa-sort-down ml-1 text-amber-400 opacity-100';
        }

        html += `
            <th class="group select-none" data-render-idx="${renderIndex + 1}" id="th_${col.idx}" style="width: ${col.w}px; min-width: ${col.w}px;">
                <div class="flex justify-between items-center w-full h-full">
                    <div class="cursor-pointer flex-1 overflow-hidden whitespace-nowrap text-ellipsis flex items-center" onclick="${col.filter ? `sortTable(${col.idx})` : ''}">
                        ${col.title} ${countBadge} <i class="fa-solid ${sortIconClass} sort-icon"></i>
                    </div>
                    ${filterIcon}
                </div>
                <div class="resizer"></div>
            </th>`;
    });
    tr.innerHTML = html;
    setTimeout(initResizableColumns, 300);
    updateColumnStyles();
}

function handleDragStart(e, idx) { draggedColIdx = idx; e.target.style.opacity = '0.5'; }
function handleDragOver(e) { e.preventDefault(); }
function handleDrop(e, targetIdx) {
    e.preventDefault(); e.target.closest('label').style.opacity = '1';
    if (draggedColIdx === null || draggedColIdx === targetIdx) return;
    const srcPos = columnsDef.findIndex(c => c.idx === draggedColIdx);
    const tgtPos = columnsDef.findIndex(c => c.idx === targetIdx);
    const [movedCol] = columnsDef.splice(srcPos, 1); columnsDef.splice(tgtPos, 0, movedCol);
    saveUserPreferences(); buildTableHeaders(); runTableFilters(); renderHideColumnMenu();
}
function handleDragEnd(e) { e.target.style.opacity = '1'; }

function renderHideColumnMenu() {
    const menu = document.getElementById('hide_col_menu');
    menu.innerHTML = columnsDef.map((col, idx) => `
        <label draggable="true" ondragstart="handleDragStart(event, ${col.idx})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${col.idx})" ondragend="handleDragEnd(event)" class="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-grab transition border border-transparent hover:border-slate-200">
            <i class="fa-solid fa-grip-vertical text-slate-400"></i>
            <input type="checkbox" ${hiddenCols.has(col.idx) ? '' : 'checked'} onchange="toggleColumnVisibility(${col.idx}, this.checked)" class="accent-[#00320D] w-4 h-4 cursor-pointer">
            <span class="text-sm font-bold text-slate-700 select-none">${col.title}</span>
        </label>
    `).join('');
}

function toggleColumnVisibility(idx, isVisible) {
    if (isVisible) hiddenCols.delete(idx); else hiddenCols.add(idx);
    updateColumnStyles();
    saveUserPreferences();
}

function updateColumnStyles() {
    let styleStr = '';
    hiddenCols.forEach(idx => { 
        const rIdx = columnsDef.findIndex(c => c.idx === idx) + 1;
        if(rIdx > 0) {
            styleStr += `#repairTable th:nth-child(${rIdx}), #repairTable td:nth-child(${rIdx}) { display: none !important; }\n`; 
        }
    });
    document.getElementById('dynamic-col-styles').innerHTML = styleStr;
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#repairTable th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer'); if(!resizer) return;
        let startX = 0, startWidth = 0;
        
        const onMouseDown = function(e) {
            e.preventDefault(); e.stopPropagation();
            startX = e.clientX; startWidth = col.offsetWidth;
            resizer.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
        
        const onMouseMove = function(e) {
            const newWidth = Math.max(45, startWidth + (e.clientX - startX));
            col.style.width = `${newWidth}px`; col.style.minWidth = `${newWidth}px`; col.style.maxWidth = `${newWidth}px`;
        };
        
        const onMouseUp = function() {
            resizer.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        resizer.addEventListener('mousedown', onMouseDown);
    });
}

function isTrue(val) { 
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase(); return strVal === "TRUE" || strVal === "1" || val === true || val === 1; 
}

function computeHighestStationIFS(j) {
    if(isTrue(j.station_ready)) return "12.รอส่งมอบ"; if(isTrue(j.station_pak)) return "11.พักซ่อม"; if(isTrue(j.station_film)) return "10.ฟิล์ม";
    if(isTrue(j.station_kraj)) return "09.กระจก"; if(isTrue(j.station_mag)) return "08.แม็ก"; if(isTrue(j.station_qc)) return "07.QC";
    if(isTrue(j.station_kat)) return "06.ขัดสี"; if(isTrue(j.station_prak)) return "05.ประกอบ"; if(isTrue(j.station_pon)) return "04.พ่นสี";
    if(isTrue(j.station_puan)) return "03.เตรียมพื้น"; if(isTrue(j.station_pou)) return "02.โป๊ว"; if(isTrue(j.station_kho)) return "01.เคาะ";
    return "ส่งจ๊อบ"; 
}

function checkOverdue(job) {
    if (!job.target_finish_date) return false; if (job.repair_finish_date) return false; 
    const targetDate = new Date(job.target_finish_date); const today = new Date();
    targetDate.setHours(0,0,0,0); today.setHours(0,0,0,0); return targetDate < today; 
}

function isJobDone(status) {
    if (!status) return false;
    const prefixes = ['11', '12', '13', '14', '15', '16', '17', '19', '20', '21'];
    return prefixes.some(p => status.startsWith(p));
}

function updateKPIs() {
    kpiData = { arrived: [], repairing: [], done: [], delayed: [] };
    
    originalRepairJobs.forEach(j => {
        if (selectedBranchFilter !== 'ALL' && j.branch_name !== selectedBranchFilter) return;

        const st = j.job_status || '';
        if (st.includes('ยกเลิก')) return; 
        
        if (st.includes('จอดรอเข้าซ่อม') || st.includes('พักซ่อม')) {
            kpiData.arrived.push(j);
        }
        else if (j.department_routing === 'ซ่อม' && j.calculated_station === '12.รอส่งมอบ') {
            kpiData.done.push(j);
        } 
        else if (j.department_routing === 'ซ่อม') {
            kpiData.repairing.push(j);
        }

        if (j.department_routing === 'ซ่อม' && checkOverdue(j)) {
            kpiData.delayed.push(j);
        }
    });

    document.getElementById('kpi_arrived').innerText = kpiData.arrived.length;
    document.getElementById('kpi_repairing').innerText = kpiData.repairing.length;
    document.getElementById('kpi_done').innerText = kpiData.done.length;
    document.getElementById('kpi_delay').innerText = kpiData.delayed.length;
}

function runTableFilters() {
    const searchTxt = (document.getElementById('global_search_input')?.value || '').toLowerCase();
    
    const filteredData = originalRepairJobs.filter(job => {
        if (selectedBranchFilter !== 'ALL' && job.branch_name !== selectedBranchFilter) return false;
        if (!isCalendarFilterActive && job.department_routing !== 'ซ่อม') return false;

        if (activeKpiFilter) {
            if (activeKpiFilter === 'repairing') {
                if (job.calculated_station === '12.รอส่งมอบ') return false;
            }
            if (activeKpiFilter === 'done') {
                if (job.calculated_station !== '12.รอส่งมอบ') return false;
            }
            if (activeKpiFilter === 'delayed') {
                if (!checkOverdue(job)) return false;
            }
        }

        if (searchTxt) { const rowContent = Object.values(job).join(' ').toLowerCase(); if (!rowContent.includes(searchTxt)) return false; }
        
        for (let colIdx in activeFilters) {
            const colDef = columnsDef.find(c => c.idx == colIdx);
            if(!colDef) continue;
            const key = colDef.key; let val = '';
            if(['arrived_date', 'target_finish_date', 'repair_finish_date', 'delivery_date'].includes(key)) { val = job[key] ? String(job[key]).split('T')[0] : ''; } 
            else if (key === 'car_brand') { val = `${job.car_brand || ''} ${job.car_model || ''}`.trim(); } 
            else if (key === 'main_part_qty') { val = String(Number(job.main_part_qty) || (job.main_part_name ? job.main_part_name.split(',').filter(Boolean).length : 0)); }
            else if (key === 'sub_part_qty') { val = String(Number(job.sub_part_qty) || (job.sub_part_name ? job.sub_part_name.split(',').filter(Boolean).length : 0)); }
            else { val = String(job[key] || '').trim(); }
            if (!activeFilters[colIdx].has(val)) return false;
        }
        return true;
    });
    
    renderRepairListTable(filteredData);
}

function filterBoardByKpi(type) {
    switchTab('tab-board');
    activeFilters = {}; 
    activeKpiFilter = type; 
    isCalendarFilterActive = false; 
    document.getElementById('global_search_input').value = '';
    document.querySelectorAll('.filter-icon').forEach(icon => icon.classList.remove('active'));
    runTableFilters(); 
}

function clearAllFilters() {
    activeFilters = {}; 
    activeKpiFilter = null; 
    isCalendarFilterActive = false; 
    document.getElementById('global_search_input').value = '';
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('active'); });
    runTableFilters();
}

function openKpiModal(type) {
    let list = []; let title = ''; let icon = ''; let headerColorClass = ''; let bgColorClass = ''; let borderColorClass = '';
    
    if(type === 'arrived') { list = kpiData.arrived; title = 'รถเข้าจอด (รอซ่อม)'; icon = 'fa-car-side'; headerColorClass = 'text-blue-600'; bgColorClass = 'bg-blue-50'; borderColorClass = 'border-blue-200'; }
    
    if(list.length === 0) return alert(`🔍 ไม่มีข้อมูลในหมวด "${title}" ครับ`);
    
    document.getElementById('dayListDateTitle').innerHTML = `<span class="${headerColorClass}"><i class="fa-solid ${icon}"></i> ${title} (${list.length} คัน)</span>`;
    
    let html = `<div class="${bgColorClass} border ${borderColorClass} rounded-xl overflow-hidden mb-4 shadow-sm transition-all duration-300"><div class="p-4 space-y-3">`;
    list.forEach(j => html += generateMiniCardHTML(j, type));
    html += `</div></div>`;

    document.getElementById('dayListContent').innerHTML = html;
    document.getElementById('dayListModal').classList.remove('hidden');
}

function openDayListForTarget(dateStr) {
    const targetJobs = originalRepairJobs.filter(j => 
        (selectedBranchFilter === 'ALL' || j.branch_name === selectedBranchFilter) &&
        j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr
    );
    
    const doneJobs = targetJobs.filter(j => isJobDone(j.job_status));
    const pendingJobs = targetJobs.filter(j => !isJobDone(j.job_status));

    const title = `เป้าซ่อมเสร็จ วันที่ ${formatThaiDate(dateStr)}`;
    document.getElementById('dayListDateTitle').innerHTML = `<span class="text-[#00320D]"><i class="fa-solid fa-bullseye text-amber-500"></i> ${title} <span class="text-emerald-600 font-mono ml-2">(เสร็จแล้ว ${doneJobs.length}/${targetJobs.length} คัน)</span></span>`;
    
    let html = '';
    
    if (pendingJobs.length > 0) {
        html += `<h3 class="text-sm font-black text-amber-600 mb-2 border-b border-amber-200 pb-2"><i class="fa-solid fa-spinner fa-spin"></i> กำลังดำเนินการซ่อม (${pendingJobs.length} คัน)</h3>`;
        html += `<div class="bg-amber-50/50 border border-amber-200 rounded-xl overflow-hidden mb-6 shadow-sm"><div class="p-4 space-y-3">`;
        pendingJobs.forEach(j => html += generateMiniCardHTML(j, 'target'));
        html += `</div></div>`;
    }

    if (doneJobs.length > 0) {
        html += `<h3 class="text-sm font-black text-emerald-600 mb-2 border-b border-emerald-200 pb-2"><i class="fa-solid fa-check-double"></i> ซ่อมเสร็จแล้ว (${doneJobs.length} คัน)</h3>`;
        html += `<div class="bg-emerald-50/50 border border-emerald-200 rounded-xl overflow-hidden mb-6 shadow-sm"><div class="p-4 space-y-3">`;
        doneJobs.forEach(j => html += generateMiniCardHTML(j, 'target_done'));
        html += `</div></div>`;
    }

    if (targetJobs.length === 0) {
        html = `<div class="text-center py-10 text-slate-400 font-bold">ไม่มีเป้าซ่อมเสร็จในวันนี้</div>`;
    }

    document.getElementById('dayListContent').innerHTML = html;
    document.getElementById('dayListModal').classList.remove('hidden');
}

function renderPieChartAndList() {
    const counters = { "เคาะ":0, "โป๊ว":0, "เตรียมพื้น":0, "พ่นสี":0, "ประกอบ":0, "ขัดสี":0, "QC":0, "แม็ก":0, "กระจก":0, "ฟิล์ม":0, "พักซ่อม":0, "รอส่งมอบ":0 };
    const stationJobs = {}; 
    Object.keys(counters).forEach(k => stationJobs[k] = []); 

    originalRepairJobs.forEach(j => {
        if (selectedBranchFilter !== 'ALL' && j.branch_name !== selectedBranchFilter) return;

        const st = j.job_status || '';
        if(st.includes('ยกเลิก')) return; 
        if(j.department_routing !== 'ซ่อม') return;

        const fullStation = computeHighestStationIFS(j);
        let key = "ส่งจ๊อบ"; 

        if(fullStation.includes("รอส่งมอบ")) key = "รอส่งมอบ";
        else if(fullStation.includes("เคาะ")) key = "เคาะ"; 
        else if(fullStation.includes("โป๊ว")) key = "โป๊ว"; 
        else if(fullStation.includes("เตรียมพื้น")) key = "เตรียมพื้น"; 
        else if(fullStation.includes("พ่นสี")) key = "พ่นสี"; 
        else if(fullStation.includes("ประกอบ")) key = "ประกอบ"; 
        else if(fullStation.includes("ขัดสี")) key = "ขัดสี"; 
        else if(fullStation.includes("QC")) key = "QC"; 
        else if(fullStation.includes("แม็ก")) key = "แม็ก"; 
        else if(fullStation.includes("กระจก")) key = "กระจก"; 
        else if(fullStation.includes("ฟิล์ม")) key = "ฟิล์ม"; 
        else if(fullStation.includes("พักซ่อม")) key = "พักซ่อม"; 
        
        if(key !== "ส่งจ๊อบ" && counters[key] !== undefined) { 
            counters[key]++; 
            stationJobs[key].push(j); 
        }
    });

    if(chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('stationPieChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counters).filter(k => counters[k] > 0), 
            datasets: [{ 
                data: Object.values(counters).filter(v => v > 0), 
                backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6b7280'],
                borderWidth: 1, borderColor: '#ffffff', hoverOffset: 12
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'right', labels: { color: '#475569', font: { family: 'Kanit', size: 13 } } },
                datalabels: { color: '#ffffff', font: { family: 'Kanit', weight: 'bold', size: 13 }, textAlign: 'center', formatter: (val, context) => { return val > 0 ? context.chart.data.labels[context.dataIndex] + '\n' + val + ' คัน' : ''; } }
            }, 
            cutout: '55%',
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const labelName = chartInstance.data.labels[index];
                    switchTab('tab-board');
                    
                    let filterVal = labelName;
                    if(labelName === 'รอส่งมอบ') filterVal = '12.รอส่งมอบ';
                    else if(labelName === 'พักซ่อม') filterVal = '11.พักซ่อม';
                    else if(labelName === 'ฟิล์ม') filterVal = '10.ฟิล์ม';
                    else if(labelName === 'กระจก') filterVal = '09.กระจก';
                    else if(labelName === 'แม็ก') filterVal = '08.แม็ก';
                    else if(labelName === 'QC') filterVal = '07.QC';
                    else if(labelName === 'ขัดสี') filterVal = '06.ขัดสี';
                    else if(labelName === 'ประกอบ') filterVal = '05.ประกอบ';
                    else if(labelName === 'พ่นสี') filterVal = '04.พ่นสี';
                    else if(labelName === 'เตรียมพื้น') filterVal = '03.เตรียมพื้น';
                    else if(labelName === 'โป๊ว') filterVal = '02.โป๊ว';
                    else if(labelName === 'เคาะ') filterVal = '01.เคาะ';

                    document.getElementById('global_search_input').value = filterVal;
                    runTableFilters();
                }
            }
        }
    });

    const breakdownDiv = document.getElementById('station_breakdown_list'); let listHTML = '';
    Object.keys(stationJobs).forEach(stationKey => {
        if(stationJobs[stationKey].length > 0) {
            stationJobs[stationKey].sort((a, b) => {
                let dateA = a.target_finish_date ? new Date(a.target_finish_date).getTime() : Infinity; 
                let dateB = b.target_finish_date ? new Date(b.target_finish_date).getTime() : Infinity;
                return dateA - dateB;
            });

            const safeKeyId = stationKey.replace(/[\s\.\/]/g, '_');
            listHTML += `
                <div class="mb-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-300">
                    <div onclick="document.getElementById('collapse_${safeKeyId}').classList.toggle('hidden'); this.querySelector('.fa-chevron-down').classList.toggle('rotate-180');" class="bg-slate-50 hover:bg-slate-100 px-5 py-4 flex justify-between items-center border-b border-slate-200 cursor-pointer select-none transition-colors">
                        <h4 class="font-bold text-[#00320D] text-base flex items-center gap-2"><i class="fa-solid fa-layer-group text-amber-500"></i> สถานี: ${stationKey}</h4>
                        <div class="flex items-center gap-3">
                            <span class="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">${stationJobs[stationKey].length} คัน</span>
                            <i class="fa-solid fa-chevron-down text-slate-400 transition-transform duration-300"></i>
                        </div>
                    </div>
                    <div id="collapse_${safeKeyId}" class="divide-y divide-slate-100 hidden">
            `;
            stationJobs[stationKey].forEach(j => {
                const target = j.target_finish_date ? formatThaiDate(j.target_finish_date) : 'ยังไม่ระบุ'; 
                const actual = j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '';
                const isOverdue = checkOverdue(j);
                listHTML += `
                    <div class="px-5 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center hover:bg-amber-50/40 transition gap-4 ${isOverdue ? 'bg-red-50/50' : ''}">
                        <div>
                            <span class="text-slate-800 font-mono font-bold px-2 py-1 rounded text-sm mr-2 border shadow-sm ${isOverdue ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-slate-300'}">${isOverdue ? '<i class="fa-solid fa-circle-exclamation text-red-500 mr-1"></i>' : ''}${j.car_plate || '-'}</span>
                            <span class="text-slate-600 text-sm font-semibold">${j.car_brand} ${j.car_model || ''}</span>
                        </div>
                        <div class="flex items-center gap-6 w-full lg:w-auto justify-between lg:justify-end">
                            <div class="text-right"><div class="text-[11px] text-slate-500 mb-0.5">เป้าซ่อมเสร็จ</div><div class="text-sm font-mono font-bold ${isOverdue ? 'text-red-500' : (target === 'ยังไม่ระบุ' ? 'text-slate-400' : 'text-blue-600')}">${target}</div></div>
                            <div class="text-right flex items-center gap-3">
                                <div class="text-right hidden sm:block">
                                    <div class="text-[11px] text-[#00320D] mb-0.5 font-bold"><i class="fa-solid fa-pen text-[9px] text-amber-500"></i> เสร็จจริง</div>
                                    <input type="date" min="${getTodayString()}" value="${actual}" onchange="fastUpdateField('${j.id}', 'repair_finish_date', this.value); setTimeout(renderPieChartAndList, 800);" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-[#00320D] font-bold outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 hover:bg-slate-50 transition cursor-pointer w-[130px] shadow-sm">
                                </div>
                                <button onclick="openModal('${j.id}')" class="ml-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-[#00320D] text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-pen-to-square"></i> อัปเดต</button>
                            </div>
                        </div>
                    </div>`;
            });
            listHTML += `</div></div>`;
        }
    });
    breakdownDiv.innerHTML = listHTML || '<div class="text-center py-10 text-slate-500 text-base font-bold">🎉 ไม่มีรถค้างในสถานีเลยครับ!</div>';
}

let mainPartsList = [];
let subPartsList = [];

function renderTimelineModal() {
    const container = document.getElementById('timeline_station_container');
    container.innerHTML = stationsTimeline.map((st, i) => `
        <label class="timeline-step group">
            <input type="checkbox" id="${st.id}">
            <div class="timeline-content group-hover:border-amber-400">
                <span>${st.code}.</span> <span>${st.name}</span>
            </div>
        </label>
        ${i < stationsTimeline.length - 1 ? '<i class="fa-solid fa-angle-right timeline-arrow"></i>' : ''}
    `).join('');
}

function renderBodyPartsUI() {
    const mainContainer = document.getElementById('body_parts_main'); 
    const subContainer = document.getElementById('body_parts_sub');
    
    if (mainPartsList.length === 0) {
        mainContainer.innerHTML = `<span class="text-sm text-slate-400 font-mono italic px-2 py-1">ไม่มีชิ้นส่วนที่เลือก</span>`;
    } else {
        mainContainer.innerHTML = mainPartsList.map(part => `
            <span class="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                ${part} 
                <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 transition-colors" onclick="removePart('main', '${part.replace(/'/g, "\\'")}')"></i>
            </span>
        `).join('');
    }

    if (subPartsList.length === 0) {
        subContainer.innerHTML = `<span class="text-sm text-slate-400 font-mono italic px-2 py-1">ไม่มีชิ้นส่วนที่เลือก</span>`;
    } else {
        subContainer.innerHTML = subPartsList.map(part => `
            <span class="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                ${part} 
                <i class="fa-solid fa-xmark cursor-pointer hover:text-red-500 transition-colors" onclick="removePart('sub', '${part.replace(/'/g, "\\'")}')"></i>
            </span>
        `).join('');
    }

    document.getElementById('m_count_main').innerText = mainPartsList.length;
    document.getElementById('m_count_sub').innerText = subPartsList.length;
    
    document.getElementById('m_main_parts').value = mainPartsList.join(', ');
    document.getElementById('m_sub_parts').value = subPartsList.join(', ');

    const allMainFromDB = [...new Set(allBodyPartsMaster.filter(p => (p.category === 'อะไหล่หลัก' || p.category === 'ชิ้นส่วนหลัก') && p.part_name).map(p => p.part_name.trim()))].sort();
    const allSubFromDB = [...new Set(allBodyPartsMaster.filter(p => (p.category === 'อะไหล่รอง' || p.category === 'ชิ้นส่วนรอง') && p.part_name).map(p => p.part_name.trim()))].sort();

    const selectMain = document.getElementById('select_add_main');
    const selectSub = document.getElementById('select_add_sub');
    
    selectMain.innerHTML = '<option value="">+ เลือกเพิ่ม/ลบ ชิ้นส่วนหลัก (จากระบบ)...</option>' + allMainFromDB.map(p => {
        const isSel = mainPartsList.includes(p);
        return `<option value="${p}">${isSel ? '✓ ' : ''}${p}${isSel ? ' (เลือกอยู่แล้ว)' : ''}</option>`;
    }).join('');

    selectSub.innerHTML = '<option value="">+ เลือกเพิ่ม/ลบ ชิ้นส่วนรอง (จากระบบ)...</option>' + allSubFromDB.map(p => {
        const isSel = subPartsList.includes(p);
        return `<option value="${p}">${isSel ? '✓ ' : ''}${p}${isSel ? ' (เลือกอยู่แล้ว)' : ''}</option>`;
    }).join('');
}

function removePart(type, partName) {
    if(type === 'main') { mainPartsList = mainPartsList.filter(p => p !== partName); } 
    else { subPartsList = subPartsList.filter(p => p !== partName); }
    renderBodyPartsUI();
}

function addPartFromDropdown(selectElem, type) {
    const val = selectElem.value;
    if (!val) return;
    const list = type === 'main' ? mainPartsList : subPartsList;
    const idx = list.indexOf(val);
    if (idx > -1) {
        list.splice(idx, 1);
        showToast(`ยกเลิก "${val}" แล้ว`, 'info');
    } else {
        list.push(val);
        showToast(`เพิ่ม "${val}" เรียบร้อย`, 'success');
    }
    selectElem.value = '';
    renderBodyPartsUI();
}

function handleCustomPartInput(e, type) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = e.target;
        const val = input.value.trim();
        if (val) {
            if (type === 'main' && !mainPartsList.includes(val)) mainPartsList.push(val);
            if (type === 'sub' && !subPartsList.includes(val)) subPartsList.push(val);
            input.value = ''; 
            renderBodyPartsUI();
        }
    }
}

async function openModal(jobId) {
    try {
        const job = originalRepairJobs.find(j => String(j.id) === String(jobId));
        if (!job) return;

        document.getElementById('m_job_id').value = job.id;
        document.getElementById('m_plate').innerText = job.car_plate || '-';
        document.getElementById('m_car').innerText = `${job.car_brand} ${job.car_model || ''}`;
        document.getElementById('m_sa_owner').innerText = job.sa_owner || 'ไม่ระบุ';
        
        const qtListDiv = document.getElementById('m_qt_list'); qtListDiv.innerHTML = '';
        const soListDiv = document.getElementById('m_so_list'); soListDiv.innerHTML = '';
        if(job.qt_no && job.qt_no.trim() !== '') { job.qt_no.split(',').forEach(v => { if(v.trim()) qtListDiv.innerHTML += `<span class="bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-mono shadow-sm">${v.trim()}</span>`; }); } else { qtListDiv.innerHTML = `<span class="text-slate-400 text-[11px] italic">- ไม่มี -</span>`; }
        if(job.so_no && job.so_no.trim() !== '') { job.so_no.split(',').forEach(v => { if(v.trim()) soListDiv.innerHTML += `<span class="bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded text-[11px] font-mono shadow-sm">${v.trim()}</span>`; }); } else { soListDiv.innerHTML = `<span class="text-slate-400 text-[11px] italic">- ไม่มี -</span>`; }

        mainPartsList = job.main_part_name ? job.main_part_name.split(',').map(s => s.trim()).filter(Boolean) : [];
        subPartsList = job.sub_part_name ? job.sub_part_name.split(',').map(s => s.trim()).filter(Boolean) : [];
        renderBodyPartsUI();

        const carParts = allPartOrders.filter(po => {
            if (po.order_status === 'ยกเลิก') return false;
            if (po.job_id) return String(po.job_id) === String(job.id); 
            if (po.car_plate !== job.car_plate) return false;
            if (job.qt_no && po.qt_no && job.qt_no.includes(po.qt_no)) return true;
            if (job.so_no && po.so_no && job.so_no.includes(po.so_no)) return true;
            return (!po.qt_no && !po.so_no);
        });

        // 🌟 2. เรนเดอร์ตารางอะไหล่ (Read-Only) เอาไว้ดูอย่างเดียว 🌟
        const partsListEl = document.getElementById('m_parts_list');
        if(partsListEl) {
            if(carParts.length > 0) {
                let html = `
                    <div class="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200 custom-scrollbar">
                        <table class="excel-table w-full modern-table text-[11px]" id="repair_parts_table" style="min-width: 800px;">
                            <thead class="bg-[#00320D] text-white sticky top-0 z-10 text-[11px]">
                                <tr>
                                    <th class="w-24 px-2 py-1.5 border-r border-green-800 text-center">EPC No</th>
                                    <th class="w-28 px-2 py-1.5 border-r border-green-800 text-center">หมายเลขอะไหล่</th>
                                    <th class="w-16 text-center px-2 py-1.5 border-r border-green-800">จำนวน</th>
                                    <th class="w-40 px-2 py-1.5 border-r border-green-800">ชื่อชิ้นส่วน</th>
                                    <th class="w-24 px-2 py-1.5 border-r border-green-800 text-center">MAIN No</th>
                                    <th class="w-20 px-2 py-1.5 border-r border-green-800 text-center">QT</th>
                                    <th class="w-20 px-2 py-1.5 border-r border-green-800 text-center">SO</th>
                                    <th class="w-28 text-center px-2 py-1.5 border-r border-green-800">สถานะ</th>
                                    <th class="w-24 text-center px-2 py-1.5 border-r border-green-800">ETA</th>
                                    <th class="w-24 text-center px-2 py-1.5">เข้าครบ</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200">
                `;

                const defaultQt = job.qt_no || '';
                const defaultSo = job.so_no || '';

                carParts.forEach(p => {
                    const receivedDateVal = p.received_date || p.part_received_all_date;
                    const qtVal = p.qt_no || defaultQt;
                    const soVal = p.so_no || defaultSo;
                    
                    let isComplete = p.order_status && p.order_status.includes('ครบ');
                    let statusColor = isComplete ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : (p.order_status && (p.order_status.includes('รอ') || p.order_status.includes('Back')) ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200');

                    html += `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="px-2 py-2 border-r border-slate-200 font-mono text-center text-slate-500">${p.epc_no || '-'}</td>
                            <td class="px-2 py-2 border-r border-slate-200 font-mono text-blue-700 font-bold text-center">${p.part_no || '-'}</td>
                            <td class="px-2 py-2 border-r border-slate-200 text-center font-black text-amber-600 bg-amber-50/30">${p.qty_ordered || 1}</td>
                            <td class="px-2 py-2 border-r border-slate-200 font-bold text-slate-700">${p.part_name || '-'}</td>
                            <td class="px-2 py-2 border-r border-slate-200 font-mono text-slate-500 text-center">${p.part_main_no || '-'}</td>
                            <td class="px-2 py-2 border-r border-slate-200 font-mono text-center text-slate-500">${qtVal || '-'}</td>
                            <td class="px-2 py-2 border-r border-slate-200 font-mono text-center text-slate-500">${soVal || '-'}</td>
                            <td class="px-2 py-2 border-r border-slate-200 text-center">
                                <span class="px-2 py-0.5 rounded font-bold text-[10px] shadow-sm border ${statusColor}">${p.order_status || 'รอสั่งซื้อ'}</span>
                            </td>
                            <td class="px-2 py-2 border-r border-slate-200 font-mono text-center text-slate-600">${p.est_arrival_date ? String(p.est_arrival_date).split('T')[0] : '-'}</td>
                            <td class="px-2 py-2 font-mono text-center text-emerald-600 font-bold">${receivedDateVal ? String(receivedDateVal).split('T')[0] : '-'}</td>
                        </tr>
                    `;
                });

                html += `</tbody></table></div>`;
                partsListEl.innerHTML = html;
            } else {
                partsListEl.innerHTML = '<div class="text-sm text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">- ไม่มีการสั่งเบิกอะไหล่ -</div>';
            }
        }
        
        stationsTimeline.forEach(st => document.getElementById(st.id).checked = isTrue(job[`station_${st.id.replace('chk_', '')}`]));
        
        document.getElementById('txt_target_date').innerText = job.target_finish_date ? formatThaiDate(job.target_finish_date) : '-';
        document.getElementById('m_target_date').value = job.target_finish_date ? job.target_finish_date.split('T')[0] : '';
        
        document.getElementById('m_repair_date').value = job.repair_finish_date ? job.repair_finish_date.split('T')[0] : '';
        
        document.getElementById('txt_delivery_date').innerText = job.delivery_date ? formatThaiDate(job.delivery_date) : '-';
        document.getElementById('m_delivery_date').value = job.delivery_date ? job.delivery_date.split('T')[0] : '';

        document.getElementById('m_job_status').value = job.job_status || '10.กำลังซ่อม';
        document.getElementById('m_dept_routing').value = job.department_routing || 'ซ่อม';
        document.getElementById('m_repair_notes').value = job.repair_notes || '';

        document.getElementById('stationModal').classList.remove('hidden');
    } catch(e) { console.log(e); }
}

function validateRepairDate(input) {
    const today = getTodayString();
    if (input.value && input.value < today) {
        alert('❌ ไม่อนุญาตให้ใส่วันที่เสร็จจริงย้อนหลังได้ครับ!');
        input.value = '';
    }
}

function closeModal() { document.getElementById('stationModal').classList.add('hidden'); }

async function submitRepairStation() {
    const mainInputVal = document.getElementById('input_custom_main').value.trim();
    if(mainInputVal && !mainPartsList.includes(mainInputVal)) mainPartsList.push(mainInputVal);
    document.getElementById('input_custom_main').value = '';

    const subInputVal = document.getElementById('input_custom_sub').value.trim();
    if(subInputVal && !subPartsList.includes(subInputVal)) subPartsList.push(subInputVal);
    document.getElementById('input_custom_sub').value = '';

    const finalMainPartsStr = mainPartsList.join(', ');
    const finalSubPartsStr = subPartsList.join(', ');

    const id = document.getElementById('m_job_id').value;
    const repairDateInput = document.getElementById('m_repair_date').value;
    const targetDateInput = document.getElementById('m_target_date').value;
    const deliveryDateInput = document.getElementById('m_delivery_date').value;
    
    const today = getTodayString();
    if (repairDateInput && repairDateInput < today) {
        alert('❌ ไม่สามารถใส่วันที่เสร็จจริงย้อนหลังได้ครับ!');
        return;
    }

    const existingJob = originalRepairJobs.find(j => String(j.id) === String(id)) || {};

    const fullPayload = {
        ...existingJob,
        station_kho: document.getElementById('chk_kho').checked,
        station_pou: document.getElementById('chk_pou').checked,
        station_puan: document.getElementById('chk_puan').checked,
        station_pon: document.getElementById('chk_pon').checked,
        station_prak: document.getElementById('chk_prak').checked,
        station_kat: document.getElementById('chk_kat').checked,
        station_qc: document.getElementById('chk_qc').checked,
        station_mag: document.getElementById('chk_mag').checked,
        station_kraj: document.getElementById('chk_kraj').checked,
        station_film: document.getElementById('chk_film').checked,
        station_pak: document.getElementById('chk_pak').checked,
        station_ready: document.getElementById('chk_ready').checked,
        
        target_finish_date: targetDateInput || null,
        repair_finish_date: repairDateInput || null,
        delivery_date: deliveryDateInput || null,
        
        job_status: document.getElementById('m_job_status').value,
        department_routing: document.getElementById('m_dept_routing').value,
        repair_notes: document.getElementById('m_repair_notes').value,

        main_part_name: finalMainPartsStr,
        sub_part_name: finalSubPartsStr,
        main_part_qty: mainPartsList.length,
        sub_part_qty: subPartsList.length
    };
    delete fullPayload.calculated_station;

    try {
        const btnSubmit = document.querySelector('#stationModal button.bg-amber-400');
        const oldHtml = btnSubmit ? btnSubmit.innerHTML : '';
        if(btnSubmit) { btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; btnSubmit.disabled = true; }

        const res = await fetch(`${API_BASE_URL}/api/report/${id}`, {
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(fullPayload)
        });
        
        if (!res.ok) throw new Error('บันทึกข้อมูลหลักไม่สำเร็จ');

        const job = originalRepairJobs.find(j => String(j.id) === String(id));
        if(job) {
            Object.assign(job, fullPayload);
            job.calculated_station = computeHighestStationIFS(job);
        }

        showToast('บันทึกข้อมูลและอัปเดตสถานะเรียบร้อยแล้ว!', 'success');
        closeModal();
        updateKPIs();
        runTableFilters();
        
        if(btnSubmit) { btnSubmit.innerHTML = oldHtml; btnSubmit.disabled = false; }
    } catch(e) { 
        console.error("Save failed:", e);
        showToast(e.message || 'บันทึกข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง', 'error'); 
        const btnSubmit = document.querySelector('#stationModal button.bg-amber-400');
        if(btnSubmit) { btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> บันทึกข้อมูล'; btnSubmit.disabled = false; }
    }
}