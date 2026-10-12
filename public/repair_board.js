// ==========================================
// 📋 กระดานคิวรถซ่อม & ระบบหลัก (Core System)
// ==========================================

Chart.register(ChartDataLabels);

const API_BASE_URL = window.location.origin;
let originalRepairJobs = []; 
let allQuotas = []; 
let allPartOrders = []; 
let allBodyPartsMaster = []; 

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
    { idx: 16, key: 'vin_no', title: 'เลขตัวถัง/เครื่อง', w: 180, filter: true },
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
    if(!toast) return;
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
                    const colMap = new Map(); 
                    columnsDef.forEach(c => colMap.set(c.key, c));
                    
                    let newCols = [];
                    data.hidden_columns.order.forEach(k => { 
                        if(colMap.has(k)) { 
                            newCols.push(colMap.get(k)); 
                            colMap.delete(k);
                        } 
                    });
                    
                    colMap.forEach(c => newCols.push(c));
                    
                    columnsDef.length = 0; 
                    columnsDef.push(...newCols);
                }
                if (data.hidden_columns.sort) {
                    savedSortCol = data.hidden_columns.sort.col;
                    savedSortDir = data.hidden_columns.sort.dir;
                }
            }
        }
    } catch (err) { console.error("Error loading preferences:", err); }
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
        } catch (e) { console.error('โหลดข้อมูลสาขาไม่สำเร็จ', e); }

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
    if(typeof renderCalendar === 'function') renderCalendar();
    runTableFilters();
    showToast(`สลับการแสดงผลเป็น: ${newBranchVal === 'ALL' ? 'ทุกสาขา' : newBranchVal}`, 'info');
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById('btn-' + tabId).classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    if(tabId === 'tab-summary' && typeof renderPieChartAndList === 'function') renderPieChartAndList();
    if(tabId === 'tab-calendar' && typeof renderCalendar === 'function') renderCalendar();
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
        // 🌟 แก้ไข: เพิ่มเงื่อนไขตรวจสอบรหัสสถานะ 11/12 จากฝั่ง ERP ร่วมด้วย
        else if (j.department_routing === 'ซ่อม' && (j.calculated_station === '12.รอส่งมอบ' || st.includes('11.รถซ่อมเสร็จรอส่งมอบ') || st.includes('12.รอส่งมอบ'))) {
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
            const isDoneStation = job.calculated_station === '12.รอส่งมอบ';
            const isDoneStatus = job.job_status && (job.job_status.includes('11.รถซ่อมเสร็จรอส่งมอบ') || job.job_status.includes('12.รอส่งมอบ'));

            if (activeKpiFilter === 'repairing') {
                if (isDoneStation || isDoneStatus) return false;
            }
            // 🌟 แก้ไข: ให้การกรอง KPI 'done' รองรับทั้ง station 12 และ job_status 11/12
            if (activeKpiFilter === 'done') {
                if (!isDoneStation && !isDoneStatus) return false;
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
            if(['arrived_date', 'appointment_date', 'target_finish_date', 'repair_finish_date', 'delivery_date'].includes(key)) { 
                let rawVal = job[key];
                if (key === 'arrived_date' && !rawVal) rawVal = job.appointment_date;
                val = rawVal ? String(rawVal).split('T')[0] : ''; 
            } 
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

async function fetchJobList() {
    try {
        document.getElementById('repair_list_body').innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-12 text-slate-400 font-mono text-sm"><i class="fa-solid fa-circle-notch fa-spin text-[#00320D] text-lg mr-2"></i> กำลังโหลดข้อมูล...</td></tr>`;
        const nocache = `?_t=${new Date().getTime()}`;
        
        const [resReports, resQuotas, resParts, resBodyParts] = await Promise.all([
            safeFetch(`${API_BASE_URL}/api/reports${nocache}`), 
            safeFetch(`${API_BASE_URL}/api/quotas${nocache}`), 
            safeFetch(`${API_BASE_URL}/api/part-orders${nocache}`),
            safeFetch(`${API_BASE_URL}/api/body-parts${nocache}`)
        ]);
        
        allQuotas = Array.isArray(resQuotas) ? resQuotas : (resQuotas.data || []); 
        allPartOrders = Array.isArray(resParts) ? resParts : (resParts.data || []); 
        allBodyPartsMaster = Array.isArray(resBodyParts) ? resBodyParts : (resBodyParts.data || []); 

        const rawReports = Array.isArray(resReports) ? resReports : (resReports.data || []);

        originalRepairJobs = rawReports.filter(j => {
            const st = j.job_status || '';
            const isNotCancelled = !st.includes('ยกเลิก');
            const isNotDelivered = !st.includes('ส่งมอบแล้ว') && st !== '12.ส่งมอบ';
            return isNotCancelled && isNotDelivered;
        }).map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));

        updateKPIs();
        if(typeof renderCalendar === 'function') renderCalendar(); 
        runTableFilters();
    } catch (err) { console.error("โหลดข้อมูลพัง:", err); }
}

async function fastUpdateField(id, field, value) {
    const isDate = field.includes('date');
    if (isDate) {
        const today = getTodayString();
        if (value && value < today && field === 'repair_finish_date') {
            showToast('ไม่อนุญาตให้ใส่วันที่เสร็จจริงย้อนหลังครับ!', 'error'); runTableFilters(); return;
        }
    }
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${id}/fast-date`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value }) });
        if(res.ok) {
            const jobIndex = originalRepairJobs.findIndex(j => String(j.id) === String(id));
            if(jobIndex > -1) { 
                originalRepairJobs[jobIndex][field] = (isDate && value) ? value + 'T00:00:00.000Z' : value; 
                showToast('บันทึกข้อมูลเรียบร้อย!'); 
                if(isDate || field === 'job_status' || field === 'department_routing') updateKPIs(); 
                runTableFilters(); 
            }
        } else throw new Error();
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); }
}

async function fastUpdateStationDropdown(id, selectedLevel) {
    const job = originalRepairJobs.find(j => String(j.id) === String(id));
    if (!job) return;
    const selectedIdx = stationLevels.indexOf(selectedLevel);
    
    const payload = {
        ...job, 
        station_kho: selectedIdx >= 1, station_pou: selectedIdx >= 2, station_puan: selectedIdx >= 3,
        station_pon: selectedIdx >= 4, station_prak: selectedIdx >= 5, station_kat: selectedIdx >= 6,
        station_qc: selectedIdx >= 7, station_mag: selectedIdx >= 8, station_kraj: selectedIdx >= 9,
        station_film: selectedIdx >= 10, station_pak: selectedIdx >= 11, station_ready: selectedIdx >= 12,
        target_finish_date: job.target_finish_date || null, repair_finish_date: job.repair_finish_date || null,
        delivery_date: job.delivery_date || null, job_status: job.job_status,
        department_routing: job.department_routing, repair_notes: job.repair_notes
    };
    
    delete payload.calculated_station; 

    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${id}/station`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        if(res.ok) {
            showToast('อัปเดตความคืบหน้าสถานีเรียบร้อย!');
            Object.assign(job, payload);
            job.calculated_station = computeHighestStationIFS(job);
            updateKPIs(); 
            runTableFilters();
        } else throw new Error();
    } catch(e) { showToast('อัปเดตไม่สำเร็จ', 'error'); }
}

function renderAllTags(partsStr, bgClass, textClass, borderClass) {
    if(!partsStr || !partsStr.trim()) return '<div class="px-3 py-2 text-[#94a3b8] text-[13px]">-</div>';
    const parts = partsStr.split(',').map(s => s.trim()).filter(Boolean);
    if(parts.length === 0) return '<div class="px-3 py-2 text-[#94a3b8] text-[13px]">-</div>';
    let html = `<div class="flex flex-wrap gap-1 p-2 max-w-full">`;
    parts.forEach(p => { html += `<span class="${bgClass} ${textClass} ${borderClass} px-2.5 py-1 rounded border text-[12px] font-bold shadow-sm inline-block leading-tight">${p}</span>`; });
    html += `</div>`; return html;
}

function renderRepairListTable(data) {
    const tbody = document.getElementById('repair_list_body');
    if(!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="p-12 text-center text-slate-400 font-bold bg-white text-base">📭 ไม่พบข้อมูลรถที่ตรงตามเงื่อนไข</td></tr>`; return; }

    let cArr = 0, cTar = 0, cRep = 0, cDel = 0, sumMain = 0, sumSub = 0;
    let allRowsHtml = '';

    data.forEach(j => {
        const arrDateStr = (j.arrived_date || j.appointment_date) ? String(j.arrived_date || j.appointment_date).split('T')[0] : '';
        const targetDateStr = j.target_finish_date ? j.target_finish_date.split('T')[0] : '';
        const finishDateStr = j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '';
        const deliveryDateStr = j.delivery_date ? j.delivery_date.split('T')[0] : '';
        const isOverdue = checkOverdue(j);
        
        if(arrDateStr) cArr++;
        if(targetDateStr) cTar++;
        if(finishDateStr) cRep++;
        if(deliveryDateStr) cDel++;
        let mQty = Number(j.main_part_qty) || (j.main_part_name ? j.main_part_name.split(',').filter(Boolean).length : 0);
        let sQty = Number(j.sub_part_qty) || (j.sub_part_name ? j.sub_part_name.split(',').filter(Boolean).length : 0);
        sumMain += mQty; sumSub += sQty;

        let rowHtml = `<tr>`;
        columnsDef.forEach(col => {
            let cellData = ''; 
            switch(col.key) {
                case 'action': 
                    cellData = `<div class="text-center px-1 py-1.5"><button onclick="openModal('${j.id}')" class="action-btn group"><i class="fa-solid fa-pen"></i><span class="action-btn-text hidden">อัปเดต</span></button></div>`; 
                    break;
                case 'car_plate': 
                    cellData = `<div class="font-mono text-base font-black px-3 py-2 truncate ${isOverdue ? 'text-rose-600' : 'text-[#00320D]'}">${isOverdue ? '<i class="fa-solid fa-circle-exclamation mr-1 animate-pulse"></i>' : ''}${j.car_plate || '-'}</div>`; 
                    break;
                case 'vin_no': 
                    cellData = `<div class="font-mono text-sm font-bold text-emerald-600 px-3 py-2 truncate" title="${j.vin_no || ''}">${j.vin_no || '-'}</div>`; 
                    break;
                case 'sa_owner': 
                    cellData = `<div class="px-3 py-2 font-bold text-slate-700 text-sm truncate" title="${j.sa_owner || ''}"><i class="fa-solid fa-user-tie text-amber-500 mr-1"></i> ${j.sa_owner || '-'}</div>`; 
                    break;
                case 'car_brand': 
                    cellData = `<div class="font-bold text-[#00320D] truncate text-[14px] px-3 py-2" title="${j.car_brand || ''} ${j.car_model || ''}">${j.car_brand || '-'} <span class="text-slate-400 font-medium">${j.car_model || ''}</span></div>`; 
                    break;
                case 'car_color': 
                    cellData = `<div class="px-2 py-1.5 w-full"><input type="text" value="${j.car_color || ''}" placeholder="-" onchange="fastUpdateField('${j.id}', 'car_color', this.value)" class="inline-edit-input text-left w-full text-base font-bold"></div>`; 
                    break;
                case 'arrived_date':
                case 'appointment_date': 
                    cellData = `<div class="text-slate-500 text-[14px] font-mono font-bold text-center px-2 py-2">${formatThaiDate(j.arrived_date || j.appointment_date)}</div>`; 
                    break;
                case 'target_finish_date': 
                    cellData = `<div class="${isOverdue ? 'text-rose-600' : 'text-amber-600'} text-[14px] font-mono font-bold text-center px-2 py-2">${formatThaiDate(j.target_finish_date)}</div>`; 
                    break;
                case 'repair_finish_date': 
                    let displayValue = finishDateStr ? formatThaiDate(finishDateStr) : '';
                    cellData = `<div class="text-center px-2 py-1.5 relative group">
                        <div class="absolute inset-0 flex items-center justify-center font-mono text-base text-[#00320D] font-bold bg-white z-10 pointer-events-none group-hover:hidden group-focus-within:hidden">${displayValue}</div>
                        <input type="date" value="${finishDateStr}" onchange="fastUpdateField('${j.id}', 'repair_finish_date', this.value)" class="inline-edit-input w-full font-mono text-base text-[#00320D] font-bold relative z-0">
                    </div>`; 
                    break;
                case 'delivery_date': 
                    cellData = `<div class="text-emerald-600 text-[14px] font-mono font-bold text-center px-2 py-2">${formatThaiDate(j.delivery_date)}</div>`; 
                    break;
                case 'main_part_name': 
                    cellData = `<div onclick="event.stopPropagation(); openModal('${j.id}')" class="w-full h-full text-left cursor-pointer group">${renderAllTags(j.main_part_name, 'bg-blue-50', 'text-blue-700', 'border-blue-200')}</div>`; 
                    break;
                case 'main_part_qty': 
                    cellData = `<div class="text-center font-black text-lg text-blue-600 py-2">${mQty}</div>`; 
                    break;
                case 'sub_part_name': 
                    cellData = `<div onclick="event.stopPropagation(); openModal('${j.id}')" class="w-full h-full text-left cursor-pointer group">${renderAllTags(j.sub_part_name, 'bg-amber-50', 'text-amber-700', 'border-amber-200')}</div>`; 
                    break;
                case 'sub_part_qty': 
                    cellData = `<div class="text-center font-black text-lg text-amber-600 py-2">${sQty}</div>`; 
                    break;
                case 'calculated_station': 
                    const stationOptionsHtml = stationLevels.map(st => `<option value="${st}" ${j.calculated_station === st ? 'selected' : ''}>${st}</option>`).join('');
                    cellData = `<div class="px-2 py-1.5"><select onchange="fastUpdateStationDropdown('${j.id}', this.value)" class="inline-edit-select text-amber-700 font-bold bg-amber-50 hover:bg-amber-100 border-amber-300 text-sm">${stationOptionsHtml}</select></div>`; 
                    break;
                case 'job_status': 
                    let safeOpts = statusOptions.map(st => `<option value="${st}" ${j.job_status === st ? 'selected' : ''}>${st}</option>`).join('');
                    if(j.job_status && !statusOptions.includes(j.job_status)) {
                        safeOpts = `<option value="${j.job_status}" selected>${j.job_status}</option>` + safeOpts;
                    } else if (!j.job_status) {
                        safeOpts = `<option value="" selected>- เลือกรหัสสถานะ -</option>` + safeOpts;
                    }
                    cellData = `<div class="px-2 py-1.5"><select onchange="fastUpdateField('${j.id}', 'job_status', this.value)" class="inline-edit-select text-[#00320D] font-bold text-sm">${safeOpts}</select></div>`; 
                    break;
                case 'department_routing': 
                    const routingOptions = ['ซ่อม', 'บริการ', 'อะไหล่', 'บัญชี', 'รอดำเนินการ'];
                    let routingHtml = routingOptions.map(r => `<option value="${r}" ${j.department_routing === r ? 'selected' : ''}>${r}</option>`).join('');
                    cellData = `<div class="px-2 py-1.5"><select onchange="fastUpdateField('${j.id}', 'department_routing', this.value)" class="inline-edit-select text-indigo-700 font-bold bg-indigo-50 border-indigo-200 hover:bg-indigo-100 text-sm">${routingHtml}</select></div>`; 
                    break;
                case 'repair_notes': 
                    cellData = `<div class="px-2 py-1.5 w-full"><input type="text" value="${j.repair_notes || ''}" placeholder="-" onchange="fastUpdateField('${j.id}', 'repair_notes', this.value)" class="inline-edit-input text-left w-full text-base"></div>`;
                    break;
            }
            rowHtml += `<td>${cellData}</td>`;
        });
        rowHtml += '</tr>'; 
        allRowsHtml += rowHtml;
    });
    tbody.innerHTML = allRowsHtml;
    
    document.getElementById('table_row_count').innerText = data.length;

    if(document.getElementById('hdr_cnt_arrived_date')) document.getElementById('hdr_cnt_arrived_date').innerText = cArr;
    if(document.getElementById('hdr_cnt_appointment_date')) document.getElementById('hdr_cnt_appointment_date').innerText = cArr;
    if(document.getElementById('hdr_cnt_target_finish_date')) document.getElementById('hdr_cnt_target_finish_date').innerText = cTar;
    if(document.getElementById('hdr_cnt_repair_finish_date')) document.getElementById('hdr_cnt_repair_finish_date').innerText = cRep;
    if(document.getElementById('hdr_cnt_delivery_date')) document.getElementById('hdr_cnt_delivery_date').innerText = cDel;
    if(document.getElementById('hdr_cnt_main_part_qty')) document.getElementById('hdr_cnt_main_part_qty').innerText = sumMain;
    if(document.getElementById('hdr_cnt_sub_part_qty')) document.getElementById('hdr_cnt_sub_part_qty').innerText = sumSub;

    if(savedSortCol !== null) { sortTableDirectly(savedSortCol, savedSortDir); }
}

function openExcelFilter(e, colIndex, title) {
    e.stopPropagation(); currentFilterCol = colIndex; document.getElementById('ef_col_name').innerText = title; document.getElementById('ef_search').value = '';
    const uniqueValues = new Set();
    originalRepairJobs.forEach(job => {
        if (selectedBranchFilter !== 'ALL' && job.branch_name !== selectedBranchFilter) return;

        let val = ''; const key = columnsDef.find(c => c.idx === colIndex).key;
        if(['arrived_date', 'appointment_date', 'target_finish_date', 'repair_finish_date', 'delivery_date'].includes(key)) { 
            let rawVal = job[key];
            if (key === 'arrived_date' && !rawVal) rawVal = job.appointment_date;
            val = rawVal ? String(rawVal).split('T')[0] : ''; 
        } 
        else if (key === 'car_brand') { val = `${job.car_brand || ''} ${job.car_model || ''}`.trim(); } 
        else if (key === 'main_part_qty') { val = String(Number(job.main_part_qty) || (job.main_part_name ? job.main_part_name.split(',').filter(Boolean).length : 0)); }
        else if (key === 'sub_part_qty') { val = String(Number(job.sub_part_qty) || (job.sub_part_name ? job.sub_part_name.split(',').filter(Boolean).length : 0)); }
        else { val = String(job[key] || '').trim(); }
        uniqueValues.add(val);
    });
    const sortedValues = [...uniqueValues].sort(); const listDiv = document.getElementById('ef_checkbox_list'); listDiv.innerHTML = ''; const activeSet = activeFilters[colIndex];
    sortedValues.forEach(val => {
        const isChecked = activeSet ? activeSet.has(val) : true;
        const displayVal = val.match(/^\d{4}-\d{2}-\d{2}$/) ? formatThaiDate(val) : (val === '' ? '(ว่าง)' : val);
        listDiv.innerHTML += `<label class="flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer ef-item transition"><input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] mt-0.5 cursor-pointer w-4 h-4"><span class="text-slate-700 font-medium truncate w-full text-sm" title="${displayVal}">${displayVal}</span></label>`;
    });
    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);
    const modal = document.getElementById('excelFilterModal'); const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px'; let leftPos = rect.left + window.scrollX;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270; modal.style.left = leftPos + 'px';
    modal.classList.remove('hidden'); modal.classList.add('flex');
}

function closeExcelFilter() { const modal = document.getElementById('excelFilterModal'); modal.classList.add('hidden'); modal.classList.remove('flex'); }
function searchExcelFilter() { const txt = document.getElementById('ef_search').value.toLowerCase(); document.querySelectorAll('.ef-item').forEach(l => { l.style.display = l.querySelector('.ef-check').value.toLowerCase().includes(txt) ? 'flex' : 'none'; }); }
function toggleAllExcelFilters(c) { document.querySelectorAll('.ef-item:not([style*="display: none"]) .ef-check').forEach(cb => cb.checked = c); }

function applyExcelFilter() {
    const checks = document.querySelectorAll('.ef-check'); const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const thIcon = document.getElementById(`th_${currentFilterCol}`)?.querySelector('.filter-icon');
    if (checkedVals.length === checks.length || checkedVals.length === 0) { delete activeFilters[currentFilterCol]; if(thIcon) { thIcon.classList.remove('active'); } } 
    else { activeFilters[currentFilterCol] = new Set(checkedVals); if(thIcon) { thIcon.classList.add('active'); } }
    closeExcelFilter(); runTableFilters();
}

function clearSpecificExcelFilter() {
    if(activeFilters[currentFilterCol]) delete activeFilters[currentFilterCol];
    const thIcon = document.getElementById(`th_${currentFilterCol}`)?.querySelector('.filter-icon');
    if(thIcon) { thIcon.classList.remove('active'); }
    closeExcelFilter(); runTableFilters();
}

function sortTable(colIndex) {
    const table = document.getElementById('repairTable');
    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc'; 
    dir = dir === 'asc' ? 'desc' : 'asc';
    table.setAttribute(`data-dir-${colIndex}`, dir);

    savedSortCol = colIndex; savedSortDir = dir;
    saveUserPreferences();
    
    sortTableDirectly(colIndex, dir);
}

function sortTableDirectly(colIndex, dir) {
    const tbody = document.getElementById('repair_list_body'); const rows = Array.from(tbody.querySelectorAll('tr')); if (rows.length <= 1) return;
    const table = document.getElementById('repairTable'); 
    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => { icon.className = "fa-solid fa-sort sort-icon"; });
    
    const clickedTh = document.getElementById(`th_${colIndex}`);
    if(clickedTh) {
        const clickedIcon = clickedTh.querySelector('.sort-icon');
        if(clickedIcon) clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-amber-400 opacity-100" : "fa-solid fa-sort-up ml-1 text-amber-400 opacity-100";
    }
    const thIndex = Array.from(table.querySelectorAll('th')).findIndex(th => th.id === `th_${colIndex}`);
    rows.sort((a, b) => {
        let valA = getCellValue(a.cells[thIndex]); let valB = getCellValue(b.cells[thIndex]);
        let dateMatchA = valA.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        let dateMatchB = valB.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if(dateMatchA && dateMatchB) {
            let dateA = new Date(dateMatchA[3], dateMatchA[2]-1, dateMatchA[1]);
            let dateB = new Date(dateMatchB[3], dateMatchB[2]-1, dateMatchB[1]);
            return dir === 'asc' ? dateA - dateB : dateB - dateA;
        }
        let isDateA = valA.match(/^\d{4}-\d{2}-\d{2}$/); let isDateB = valB.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isDateA && isDateB) { let dateA = new Date(valA); let dateB = new Date(valB); if (!isNaN(dateA) && !isNaN(dateB)) return dir === 'asc' ? dateA - dateB : dateB - dateA; }
        let numA = parseFloat(valA.replace(/,/g, '')); let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });
    rows.forEach(row => tbody.appendChild(row));
}

let mainPartsList = [];
let subPartsList = [];

function renderTimelineModal() {
    const container = document.getElementById('timeline_station_container');
    if(!container) return;
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
    if(!mainContainer || !subContainer) return;

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
        document.getElementById('m_vin').innerHTML = job.vin_no ? `<i class="fa-solid fa-barcode mr-1"></i> ${job.vin_no}` : '';
        
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