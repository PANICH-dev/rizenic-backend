const API_BASE_URL = window.location.origin;
let allJobsData = [];
let currentFilteredData = [];
let allPartOrders = [];
let allMasterParts = [];

let allCustomerTypes = [];
let allInsurances = [];
let allEmployees = [];
let allCarModels = []; 

let globalStatusOptionsHtml = '';
let globalStatuses = []; 

let userRole = '';
let userBranch = '';

let activeFilters = {}; 
let currentFilterKey = -1;
let draggedColIdx = null; 
let searchTimeout = null;

let activeJobIdForParts = null;
let activeFieldForParts = null; 
let selectedPartsSet = new Set();
let isBulkModalMode = false; 
let activeBulkRowId = null; 

// 🌟 Calendar Scope Variables 🌟
let currentSchedMonth = new Date().getMonth();
let currentSchedYear = new Date().getFullYear();
let allSchedJobs = [];
let allSchedQuotas = [];
let currentTargetField = 'all';
let currentTargetJobId = null;
let isBulkCalendarMode = false;
let currentTargetBulkRowId = null;

const excludedStatuses = [
    '13.วางบิลประกัน', '14.ชำระเงินสด', '15.วางบิล Tesla', 
    '16.วางบิล EV ME', '17.รอออกบิล', '18.ลูกค้ายกเลิก', 
    '19.ออกบิลแล้ว', '20.จอดซ่อม TC', '21.พักซ่อม'
];

let columnsDef = [
    { idx: 1, key: 'action', title: 'Action', width: 90 },
    { idx: 2, key: 'contact_date', title: 'เข้ามาติดต่อวันที่', width: 115 },
    { idx: 3, key: 'appointment_date', title: 'ลูกค้านัดหมาย', width: 115 },
    { idx: 4, key: 'car_plate', title: 'ทะเบียนรถ', width: 110 },
    { idx: 5, key: 'customer_type', title: 'ประเภทลูกค้า', width: 120 },
    { idx: 6, key: 'car_brand', title: 'ยี่ห้อรถ', width: 120 },
    { idx: 7, key: 'car_model', title: 'รุ่นรถ', width: 120 },
    { idx: 8, key: 'vin_no', title: 'เลขตัวถัง', width: 150 },
    { idx: 9, key: 'payment_type', title: 'ประกันภัย / เงินสด', width: 140 },
    { idx: 10, key: 'customer_name', title: 'ชื่อลูกค้า', width: 140 },
    { idx: 11, key: 'phone_number', title: 'เบอร์โทร', width: 115 },
    { idx: 12, key: 'damage_level', title: 'ระดับความเสียหาย', width: 120 },
    { idx: 13, key: 'main_part_name', title: 'ชิ้นส่วนอะไหล่ (หลัก)', width: 240 },
    { idx: 14, key: 'main_part_qty', title: 'จำนวนอะไหล่ (หลัก)', width: 130 },
    { idx: 15, key: 'sub_part_name', title: 'ชิ้นส่วนอะไหล่ (รอง)', width: 240 },
    { idx: 16, key: 'sub_part_qty', title: 'จำนวนอะไหล่ (รอง)', width: 130 },
    { idx: 17, key: 'cost_labor', title: 'ค่าแรง', width: 85 },
    { idx: 18, key: 'cost_part', title: 'ค่าอะไหล่', width: 85 },
    { idx: 19, key: 'cost_external', title: 'งานนอก', width: 85 },
    { idx: 20, key: 'target_finish_date', title: 'กำหนดซ่อมเสร็จ', width: 150 },
    { idx: 21, key: 'repair_finish_date', title: 'วันที่เสร็จจริง', width: 120 },
    { idx: 22, key: 'delivery_date', title: 'วันที่ส่งมอบ', width: 150 },
    { idx: 23, key: 'notes', title: 'หมายเหตุ', width: 180 },
    { idx: 24, key: 'job_status', title: 'สถานะงาน', width: 140 },
    { idx: 25, key: 'part_status', title: 'สถานะอะไหล่', width: 120 },
    { idx: 26, key: 'epc_no', title: 'EPC No.', width: 115 },
    { idx: 27, key: 'ordered_part_names', title: 'รายการอะไหล่ที่สั่ง', width: 240 },
    { idx: 28, key: 'order_part_date', title: 'วันที่สั่งอะไหล่', width: 115 },
    { idx: 29, key: 'est_part_date', title: 'วันที่คาดการณ์อะไหล่เข้า', width: 140 },
    { idx: 30, key: 'part_received_all_date', title: 'วันที่อะไหล่เข้าครบแล้ว', width: 140 },
    { idx: 31, key: 'billing_date', title: 'วันที่ออกบิล', width: 115 },
    { idx: 32, key: 'qt_no', title: 'เลขที่ใบเสนอราคา', width: 130 },
    { idx: 33, key: 'so_no', title: 'เลขที่ใบสั่งซ่อม', width: 120 },
    { idx: 34, key: 'ivn_no', title: 'เลข IVN.', width: 115 },
    { idx: 35, key: 'sa_owner', title: 'SA ที่รับผิดชอบ', width: 115 }
];

const defaultVisibleKeys = [
    'action', 'contact_date', 'car_plate', 'car_brand', 'car_model', 
    'customer_name', 'damage_level', 'job_status', 'sa_owner'
];

let hiddenCols = new Set(columnsDef.filter(c => !defaultVisibleKeys.includes(c.key)).map(c => c.idx));

function getSAsForCurrentBranch() {
    if (!allEmployees || allEmployees.length === 0) return [];
    return [...new Set(allEmployees.filter(e => {
        const isSameBranch = e.branch_name === userBranch;
        const role = (e.employee_role || '').toUpperCase();
        const isSA = role === 'SA' || role.includes('SERVICE ADVISOR') || role.includes('SERVICE');
        return isSameBranch && isSA;
    }).map(e => e.employee_name).filter(Boolean))].sort();
}

function formatToThaiDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    toast.className = `fixed bottom-5 right-5 font-bold px-5 py-2.5 rounded shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-emerald-600')} text-white text-xs`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${type==='error'?'fa-circle-xmark':(type==='info'?'fa-info-circle':'fa-circle-check')} text-base"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

async function loadUserColumnPreferences() {
    const empName = sessionStorage.getItem('emp_name'); if (!empName) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/user-preferences/${encodeURIComponent(empName)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.hidden_columns && typeof data.hidden_columns === 'object') {
                if (data.hidden_columns.hidden) hiddenCols = new Set(data.hidden_columns.hidden);
                if (data.hidden_columns.order && Array.isArray(data.hidden_columns.order)) {
                    const colMap = new Map(); columnsDef.forEach(c => colMap.set(c.key, c));
                    let newCols = [];
                    data.hidden_columns.order.forEach(k => { if(colMap.has(k)) { newCols.push(colMap.get(k)); colMap.delete(k); } });
                    colMap.forEach(c => newCols.push(c));
                    columnsDef.length = 0; columnsDef.push(...newCols);
                }
            }
        }
    } catch (err) {}
}

async function saveUserPreferences() {
    const empName = sessionStorage.getItem('emp_name'); if (!empName) return;
    try {
        await fetch(`${API_BASE_URL}/api/user-preferences`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emp_name: empName, hidden_columns: { hidden: Array.from(hiddenCols), order: columnsDef.map(c => c.key) } }) });
    } catch (err) {}
}

document.addEventListener('DOMContentLoaded', async () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    userRole = sessionStorage.getItem('emp_role'); userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name');
    document.getElementById('display_branch').innerText = userBranch;

    await loadUserColumnPreferences();
    initColumns();
    loadJobsData();

    const searchPlate = sessionStorage.getItem('search_plate');
    if(searchPlate) {
        document.getElementById('search_input').value = searchPlate;
        sessionStorage.removeItem('search_plate');
    }

    document.addEventListener('click', (e) => {
        const modal = document.getElementById('excelFilterModal');
        if (!modal.contains(e.target) && !e.target.closest('.filter-icon') && !modal.classList.contains('hidden')) closeExcelFilter();
    });
});

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

function initColumns() {
    const thead = document.getElementById('jobs_table_head'); let trHtml = '<tr>';
    columnsDef.forEach((col, renderIndex) => {
        let filterIcon = col.key !== 'action' ? `<i class="fa-solid fa-filter filter-icon" onclick="openExcelFilter(event, ${col.idx}, '${col.title}')"></i>` : '';
        trHtml += `<th class="group select-none" data-render-idx="${renderIndex + 1}" id="th_${col.idx}" style="width: ${col.width}px; min-width: ${col.width}px;"><div class="flex justify-between items-center w-full h-full px-1"><div class="cursor-pointer flex-1 overflow-hidden whitespace-nowrap text-ellipsis flex items-center justify-center" onclick="${col.key !== 'action' ? `sortTable(${col.idx})` : ''}"><span>${col.title}</span> <i class="fa-solid fa-sort sort-icon"></i></div>${filterIcon}</div><div class="resizer"></div></th>`;
    });
    thead.innerHTML = trHtml + '</tr>';

    const toggleContainer = document.getElementById('col_toggles_container'); let togglesHtml = '';
    columnsDef.forEach(col => {
        if(col.key === 'action') return; 
        togglesHtml += `<label draggable="true" ondragstart="handleDragStart(event, ${col.idx})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${col.idx})" ondragend="handleDragEnd(event)" class="flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded cursor-grab hover:bg-slate-50 transition"><i class="fa-solid fa-grip-vertical text-slate-400"></i><input type="checkbox" onchange="toggleColumnVisibility(${col.idx}, this.checked)" ${hiddenCols.has(col.idx) ? '' : 'checked'} class="accent-[#00320D] w-3.5 h-3.5"><span class="text-xs font-bold text-slate-700">${col.title}</span></label>`;
    });
    toggleContainer.innerHTML = togglesHtml;

    applyColumnStyles(); setTimeout(initResizableColumns, 300);
}

function handleDragStart(e, idx) { draggedColIdx = idx; e.target.style.opacity = '0.5'; }
function handleDragOver(e) { e.preventDefault(); }
function handleDrop(e, targetIdx) {
    e.preventDefault(); e.target.closest('label').style.opacity = '1';
    if (draggedColIdx === null || draggedColIdx === targetIdx) return;
    const srcPos = columnsDef.findIndex(c => c.idx === draggedColIdx);
    const tgtPos = columnsDef.findIndex(c => c.idx === targetIdx);
    const [movedCol] = columnsDef.splice(srcPos, 1); columnsDef.splice(tgtPos, 0, movedCol);
    saveUserPreferences(); initColumns(); applyFilters(); 
}
function handleDragEnd(e) { e.target.style.opacity = '1'; }
function toggleColManager() { document.getElementById('colManagerPanel').classList.toggle('hidden'); }
function toggleColumnVisibility(idx, isShow) { if (isShow) hiddenCols.delete(idx); else hiddenCols.add(idx); applyColumnStyles(); saveUserPreferences(); }

function applyColumnStyles() {
    const styleTag = document.getElementById('dynamic-col-styles'); let css = '';
    hiddenCols.forEach(idx => { const rIdx = columnsDef.findIndex(c => c.idx === idx) + 1; if(rIdx > 0) css += `#jobsTable th:nth-child(${rIdx}), #jobsTable td:nth-child(${rIdx}) { display: none !important; }\n`; });
    styleTag.innerHTML = css;
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#jobsTable th');
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

function openExcelFilter(e, colIndex, title) {
    e.stopPropagation(); currentFilterKey = colIndex; document.getElementById('ef_col_name').innerText = title; document.getElementById('ef_search').value = '';
    const uniqueValues = new Set();
    allJobsData.forEach(job => {
        const colDef = columnsDef.find(c => c.idx === colIndex); if(!colDef) return;
        let val = job[colDef.key]; 
        if(colDef.key.includes('date') && val) {
            val = formatToThaiDate(val);
        } else val = String(val || '').trim();
        uniqueValues.add(val);
    });
    const listDiv = document.getElementById('ef_checkbox_list'); listDiv.innerHTML = '';
    [...uniqueValues].sort().forEach(val => {
        const isChecked = activeFilters[colIndex] ? activeFilters[colIndex].has(val) : true;
        listDiv.innerHTML += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer ef-item transition"><input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] w-3.5 h-3.5 rounded"><span class="text-slate-700 text-xs font-medium w-full truncate" title="${val}">${val === '' ? '(ว่าง)' : val}</span></label>`;
    });
    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);
    const modal = document.getElementById('excelFilterModal'); const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px'; let leftPos = rect.left + window.scrollX; if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px'; modal.classList.remove('hidden'); modal.classList.add('flex');
}
function closeExcelFilter() { document.getElementById('excelFilterModal').classList.add('hidden'); document.getElementById('excelFilterModal').classList.remove('flex'); }
function searchExcelFilter() { const txt = document.getElementById('ef_search').value.toLowerCase(); document.querySelectorAll('.ef-item').forEach(l => l.style.display = l.querySelector('.ef-check').value.toLowerCase().includes(txt) ? 'flex' : 'none'); }
function toggleAllExcelFilters(c) { document.querySelectorAll('.ef-item:not([style*="display: none"]) .ef-check').forEach(cb => cb.checked = c); }
function applyExcelFilter() {
    const checks = document.querySelectorAll('.ef-check'); const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const thIcon = document.getElementById(`th_${currentFilterKey}`)?.querySelector('.filter-icon');
    if (checkedVals.length === checks.length || checkedVals.length === 0) { delete activeFilters[currentFilterKey]; if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-slate-300'); } } 
    else { activeFilters[currentFilterKey] = new Set(checkedVals); if(thIcon) { thIcon.classList.remove('text-slate-300'); thIcon.classList.add('text-amber-400'); } }
    closeExcelFilter(); applyFilters();
}
function clearSpecificExcelFilter() { if(activeFilters[currentFilterKey]) delete activeFilters[currentFilterKey]; const thIcon = document.getElementById(`th_${currentFilterKey}`)?.querySelector('.filter-icon'); if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-slate-300'); } closeExcelFilter(); applyFilters(); }

function getActiveJobsData() {
    return allJobsData.filter(job => {
        const st = job.job_status || '';
        if (excludedStatuses.some(ex => st.includes(ex) || st.startsWith(ex.substring(0, 2)))) return false;
        if (job.billing_date || job.department_routing === 'บัญชี') return false;
        return true;
    });
}

async function loadJobsData() {
    document.getElementById('jobs_table_body').innerHTML = `<tr><td colspan="40" class="text-center py-20 text-slate-400 font-bold bg-white"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-green-800"></i><br>กำลังโหลดข้อมูล...</td></tr>`;
    try {
        const results = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/statuses`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/part-orders`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/body-parts`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/reports`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/customer-types`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/insurances`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/employees`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/car-models`).then(res => res.json())
        ]);

        if (results[0].status === 'fulfilled') {
            globalStatuses = results[0].value;
            globalStatusOptionsHtml = globalStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }
        if (results[1].status === 'fulfilled') allPartOrders = results[1].value;
        if (results[2].status === 'fulfilled') allMasterParts = results[2].value;
        if (results[4].status === 'fulfilled') allCustomerTypes = results[4].value;
        if (results[5].status === 'fulfilled') allInsurances = results[5].value;
        if (results[6].status === 'fulfilled') allEmployees = results[6].value;
        if (results[7].status === 'fulfilled') allCarModels = results[7].value;

        if (results[3].status === 'fulfilled') {
            const data = results[3].value;
            allJobsData = (['BA','Manager','Admin','แอดมิน'].includes(userRole)) ? data : data.filter(d => d.branch_name === userBranch);
        }
        
        const dlBrands = document.getElementById('dl_car_brands');
        const uniqueBrands = [...new Set(allCarModels.map(c => c.car_brand).filter(Boolean))].sort();
        dlBrands.innerHTML = uniqueBrands.map(b => `<option value="${b}">`).join('');

        const dlModels = document.getElementById('dl_car_models');
        const uniqueModels = [...new Set(allCarModels.map(c => c.car_model).filter(Boolean))].sort();
        dlModels.innerHTML = uniqueModels.map(m => `<option value="${m}">`).join('');

        initColumns(); 
        buildBranchDropdown(); 
        buildSADropdown(); 
        applyFilters(); 
    } catch (error) {
        document.getElementById('jobs_table_body').innerHTML = `<tr><td colspan="40" class="text-center py-20 text-red-600 font-bold bg-white"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><br>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

function buildBranchDropdown() {
    const branchSelect = document.getElementById('branch_filter_select'); const savedValue = branchSelect.value;
    if (['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole)) {
        const activeData = getActiveJobsData();
        const uniqueBranches = [...new Set(activeData.map(j => j.branch_name).filter(Boolean))].sort();
        branchSelect.innerHTML = '<option value="ALL">-- ทุกสาขา --</option>' + uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');
        if(savedValue && savedValue !== 'ALL' && uniqueBranches.includes(savedValue)) branchSelect.value = savedValue;
    } else { branchSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`; branchSelect.disabled = true; }
}

function buildSADropdown() {
    const saSelect = document.getElementById('sa_filter_select'); 
    const savedValue = saSelect.value; 
    
    const branchSAs = getSAsForCurrentBranch();
    saSelect.innerHTML = '<option value="">-- แสดง SA ทั้งหมด --</option>' + branchSAs.map(sa => `<option value="${sa}">${sa}</option>`).join('');
    if(savedValue && branchSAs.includes(savedValue)) saSelect.value = savedValue;
}

function goToEditJob(jobId) { sessionStorage.setItem('edit_job_id', jobId); window.location.href = 'index.html'; }

async function autoMapRouting(jobId, newStatus) {
    const mapping = globalStatuses.find(s => s.status_name === newStatus);
    if(mapping && mapping.department) {
        const newDept = mapping.department;
        const row = document.getElementById(`row_${jobId}`);
        if(row) {
            const routingSelect = row.querySelector('.routing-select');
            if(routingSelect) routingSelect.value = newDept;
        }
        await fastUpdateJob(jobId, 'department_routing', newDept, true);
    }
}

async function checkQuotaForInlineEdit(jobId, branch, dateVal, type, reqCount) {
    try {
        if (!dateVal) return true;
        const cleanDate = String(dateVal).split('T')[0];

        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        const allJobs = await resJobs.json();
        const allQuotas = await resQuotas.json();

        const branchQuotas = allQuotas.filter(q => q.branch_name === branch);
        const specialQuota = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === cleanDate);
        const defaultQuota = branchQuotas.find(q => q.quota_type === 'default');

        if (type === 'arrived_date') {
            const maxCars = specialQuota && specialQuota.quota_cars !== undefined ? parseInt(specialQuota.quota_cars||0) : (defaultQuota ? parseInt(defaultQuota.quota_cars||0) : 0);
            if (maxCars > 0) {
                const jobsInDay = allJobs.filter(j => j.branch_name === branch && j.arrived_date && j.arrived_date.split('T')[0] === cleanDate && String(j.id) !== String(jobId));
                if (jobsInDay.length + 1 > maxCars) {
                    return `โควต้ารถเข้าจอดในวันที่ ${formatToThaiDate(cleanDate)} เต็มแล้ว! (รับได้สูงสุด ${maxCars} คัน)`;
                }
            }
        } else if (type === 'target_finish_date') {
            const maxMain = specialQuota ? parseInt(specialQuota.quota_main_parts||0) : (defaultQuota ? parseInt(defaultQuota.quota_main_parts||0) : 0);
            const maxSub = specialQuota ? parseInt(specialQuota.quota_sub_parts||0) : (defaultQuota ? parseInt(defaultQuota.quota_sub_parts||0) : 0);
            
            const jobsInDay = allJobs.filter(j => j.branch_name === branch && j.target_finish_date && j.target_finish_date.split('T')[0] === cleanDate && String(j.id) !== String(jobId));
            
            let usedMain = 0; let usedSub = 0;
            jobsInDay.forEach(j => {
                usedMain += parseInt(j.main_part_qty) || 0;
                usedSub += parseInt(j.sub_part_qty) || 0;
            });

            if (maxMain > 0 && (usedMain + reqCount.main) > maxMain) {
                return `กำลังการผลิตชิ้นส่วนหลักในวันที่ ${formatToThaiDate(cleanDate)} เต็มแล้ว! (เหลือ ${Math.max(0, maxMain - usedMain)} ชิ้น)`;
            }
            if (maxSub > 0 && (usedSub + reqCount.sub) > maxSub) {
                return `กำลังการผลิตชิ้นส่วนรองในวันที่ ${formatToThaiDate(cleanDate)} เต็มแล้ว! (เหลือ ${Math.max(0, maxSub - usedSub)} ชิ้น)`;
            }
        }
        return true;
    } catch(e) {
        return true;
    }
}

async function fastUpdateJob(jobId, field, value, silent = false) {
    let formattedValue = value;
    if (field.includes('date') || ['appointment_date', 'repair_finish_date', 'target_finish_date', 'delivery_date', 'contact_date', 'arrived_date'].includes(field)) {
        if (value === '' || value === undefined || value === null) formattedValue = null;
        else formattedValue = String(value).split('T')[0];
    }

    const job = allJobsData.find(j => String(j.id) === String(jobId));
    if (!job) return;

    if (formattedValue && (field === 'arrived_date' || field === 'target_finish_date')) {
        const reqCount = { 
            main: parseInt(job.main_part_qty) || 0, 
            sub: parseInt(job.sub_part_qty) || 0 
        };
        
        if (!silent) showToast('กำลังตรวจสอบโควต้า...', 'info');
        const quotaCheck = await checkQuotaForInlineEdit(jobId, job.branch_name, formattedValue, field, reqCount);
        
        if (quotaCheck !== true) {
            alert('❌ ไม่สามารถอัปเดตได้:\n\n' + quotaCheck);
            applyFilters(); 
            return;
        }
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${jobId}/fast-date`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: field, value: formattedValue })
        });

        if (res.ok) {
            const jobIndex = allJobsData.findIndex(j => String(j.id) === String(jobId));
            if (jobIndex > -1) allJobsData[jobIndex][field] = formattedValue;
            
            if(!silent) showToast('บันทึกข้อมูลเรียบร้อย!');
            if(field === 'job_status') await autoMapRouting(jobId, value);
            if(!silent) applyFilters();
        } else throw new Error('บันทึกไม่สำเร็จ');
    } catch (err) {
        if(!silent) showToast('บันทึกไม่สำเร็จ!', 'error'); 
    }
}

async function deleteJobRow(jobId, carPlate) {
    if (!confirm(`🚨 ยืนยันการลบใบงานรถทะเบียน [ ${carPlate} ] ?\n(ข้อมูลจะถูกลบออกจากฐานข้อมูลถาวร)`)) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${jobId}`, { method: 'DELETE' });
        
        if (res.ok) { 
            allJobsData = allJobsData.filter(j => String(j.id) !== String(jobId));
            const rowToRemove = document.getElementById(`row_${jobId}`);
            if (rowToRemove) rowToRemove.remove();
            const currentRowCount = document.querySelectorAll('#jobs_table_body tr[id^="row_"]').length;
            document.getElementById('row_count').innerText = currentRowCount;
            showToast(`✅ ลบรายการทะเบียน ${carPlate} สำเร็จ`);
        } else {
            const errData = await res.json();
            showToast('ไม่สามารถลบได้: ' + (errData.error || 'Unknown Error'), 'error'); 
        }
    } catch (e) { 
        showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error'); 
    }
}

function openMultiPartsModal(jobId, fieldName, currentVal, isBulk = false, rowId = null) {
    isBulkModalMode = isBulk;
    activeBulkRowId = rowId;
    activeJobIdForParts = jobId; 
    activeFieldForParts = fieldName;
    
    document.getElementById('modal_parts_field_title').innerText = fieldName === 'main_part_name' ? 'อะไหล่หลัก' : 'อะไหล่รอง';
    selectedPartsSet.clear();
    if (currentVal && typeof currentVal === 'string') {
        currentVal.split(',').forEach(p => { const trimmed = p.trim(); if(trimmed) selectedPartsSet.add(trimmed); });
    }
    renderPartsModalCheckboxes();
    document.getElementById('parts_modal_search').value = '';
    document.getElementById('parts_custom_add').value = '';
    document.getElementById('partsSelectModal').classList.replace('hidden', 'flex');
}

function closePartsSelectModal() { document.getElementById('partsSelectModal').classList.replace('flex', 'hidden'); }

function renderPartsModalCheckboxes() {
    const container = document.getElementById('parts_modal_checkbox_container'); let html = '';
    const masterList = allMasterParts.map(p => p.part_name);
    const combinedList = Array.from(new Set([...masterList, ...Array.from(selectedPartsSet)])).sort();

    combinedList.forEach(partName => {
        const isChecked = selectedPartsSet.has(partName);
        html += `
            <label class="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer border border-slate-200 rounded part-item-row transition">
                <input type="checkbox" value="${partName}" ${isChecked ? 'checked' : ''} onchange="togglePartModalItem('${partName}', this.checked)" class="w-4 h-4 accent-[#00320D] rounded cursor-pointer">
                <span class="text-xs font-medium text-slate-800 flex-1">${partName}</span>
            </label>
        `;
    });
    container.innerHTML = html || '<div class="text-center py-4 text-slate-400 text-xs">ไม่พบรายการอะไหล่</div>';
    updateSelectedPartsCount();
}

function togglePartModalItem(partName, isChecked) {
    if (isChecked) selectedPartsSet.add(partName); else selectedPartsSet.delete(partName);
    updateSelectedPartsCount();
}

function addCustomPartToSelection() {
    const customInput = document.getElementById('parts_custom_add'); const val = customInput.value.trim();
    if (val) { selectedPartsSet.add(val); customInput.value = ''; renderPartsModalCheckboxes(); showToast(`เพิ่ม '${val}' แล้ว`); }
}

function filterPartsModalList() {
    const txt = document.getElementById('parts_modal_search').value.toLowerCase();
    document.querySelectorAll('#parts_modal_checkbox_container .part-item-row').forEach(row => { row.style.display = row.innerText.toLowerCase().includes(txt) ? 'flex' : 'none'; });
}

function updateSelectedPartsCount() { document.getElementById('parts_modal_selected_count').innerText = selectedPartsSet.size; }

async function confirmPartsSelection() {
    const partsArray = Array.from(selectedPartsSet);
    const joinedPartsStr = partsArray.join(', ');
    const partsCount = partsArray.length;
    
    if (isBulkModalMode) {
        const qtyFieldKey = activeFieldForParts === 'main_part_name' ? 'main_part_qty' : 'sub_part_qty';
        const inputName = document.querySelector(`.bulk-row[data-row-id="${activeBulkRowId}"] .bulk-input-${activeFieldForParts}`);
        const inputQty = document.querySelector(`.bulk-row[data-row-id="${activeBulkRowId}"] .bulk-input-${qtyFieldKey}`);
        
        if(inputName) inputName.value = joinedPartsStr;
        if(inputQty) inputQty.value = partsCount;
    } else {
        const qtyField = activeFieldForParts === 'main_part_name' ? 'main_part_qty' : 'sub_part_qty';
        await fastUpdateJob(activeJobIdForParts, activeFieldForParts, joinedPartsStr, true);
        await fastUpdateJob(activeJobIdForParts, qtyField, partsCount, false);
    }
    
    closePartsSelectModal();
}

function clearAllFilters() {
    activeFilters = {}; document.getElementById('search_input').value = ''; document.getElementById('sa_filter_select').value = ''; 
    if (['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole)) document.getElementById('branch_filter_select').value = 'ALL'; 
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400'); icon.classList.add('text-slate-300'); });
    applyFilters();
}

function debounceSearch() { clearTimeout(searchTimeout); searchTimeout = setTimeout(applyFilters, 300); }

function applyFilters() {
    const searchTxt = document.getElementById('search_input').value.toLowerCase();
    const saSelectedTxt = document.getElementById('sa_filter_select').value; 
    const branchSelectedTxt = document.getElementById('branch_filter_select').value; 
    
    const activeData = getActiveJobsData();
    
    const filteredData = activeData.filter(job => {
        if (searchTxt) { const matchStr = Object.values(job).join(' ').toLowerCase(); if(!matchStr.includes(searchTxt)) return false; }
        if (saSelectedTxt && job.sa_owner !== saSelectedTxt) return false;
        if (branchSelectedTxt && branchSelectedTxt !== 'ALL' && job.branch_name !== branchSelectedTxt) return false;
        
        for (let key in activeFilters) {
            const colDef = columnsDef.find(c => c.idx === parseInt(key)); if(!colDef) continue;
            let rawVal = job[colDef.key] || ''; 
            
            if (colDef.key.includes('date') && rawVal) {
                rawVal = formatToThaiDate(rawVal);
            } else {
                rawVal = String(rawVal).trim();
            }
            if (!activeFilters[key].has(rawVal)) return false;
        }
        return true;
    });

    currentFilteredData = filteredData;
    renderTable(filteredData); 
    document.getElementById('row_count').innerText = filteredData.length;
}

function exportToExcel() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        showToast('ไม่มีข้อมูลในตารางให้โหลดครับ!', 'error');
        return;
    }

    const exportData = [];
    const exportCols = columnsDef.filter(c => c.key !== 'action');
    
    const headers = exportCols.map(col => col.title);
    exportData.push(headers);
    
    currentFilteredData.forEach(job => {
        const row = exportCols.map(colDef => {
            let val = job[colDef.key];
            if (colDef.key.includes('date') && val) {
                val = formatToThaiDate(val);
            }
            return val || '';
        });
        exportData.push(row);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    const colWidths = exportCols.map(c => ({ wpx: c.width || 120 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Jobs_Data");
    
    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `Rizenic_Jobs_${userBranch}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showToast('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว!');
}

function sortTable(colIndex) {
    const table = document.getElementById('jobsTable'); const tbody = table.querySelector('tbody'); const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;
    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => { icon.className = "fa-solid fa-sort sort-icon"; });
    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc'; table.setAttribute(`data-dir-${colIndex}`, dir === 'asc' ? 'desc' : 'asc');
    const clickedTh = Array.from(table.querySelectorAll('th')).find(th => th.id === `th_${colIndex}`);
    if (clickedTh) { const clickedIcon = clickedTh.querySelector('.sort-icon'); if (clickedIcon) clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-amber-400 opacity-100" : "fa-solid fa-sort-up ml-1 text-amber-400 opacity-100"; }
    const thIndex = Array.from(table.querySelectorAll('th')).findIndex(th => th.id === `th_${colIndex}`);

    rows.sort((a, b) => {
        let valA = getCellValue(a.cells[thIndex]); let valB = getCellValue(b.cells[thIndex]);
        let isDateA = valA.match(/^\d{4}-\d{2}-\d{2}$/); let isDateB = valB.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isDateA && isDateB) { let dateA = new Date(valA); let dateB = new Date(valB); if (!isNaN(dateA) && !isNaN(dateB)) return dir === 'asc' ? dateA - dateB : dateB - dateA; }
        let numA = parseFloat(valA.replace(/,/g, '')); let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });
    rows.forEach(row => tbody.appendChild(row));
}

function formatPartsText(partStr, type) {
    if(!partStr || partStr.trim() === '') return '<span class="text-slate-400 font-normal px-2">-</span>';
    return `<div class="px-2 py-1 flex flex-wrap gap-1 items-center whitespace-normal leading-normal">
        ${partStr.split(',').map(p => p.trim()).filter(Boolean).map(p => `<span class="${type === 'main' ? 'part-badge-main' : 'part-badge-sub'}">${p}</span>`).join('')}
    </div>`;
}

function renderTable(data) {
    const tbody = document.getElementById('jobs_table_body'); 
    if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="40" class="text-center py-16 text-slate-400 font-bold bg-white">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`; return; }

    let safeOptsGlobal = globalStatusOptionsHtml;
    let allRowsHtml = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    const branchSAs = getSAsForCurrentBranch();

    const activePartOrders = (allPartOrders || []).filter(p => p.order_status !== 'ยกเลิก');
    const partsByJobId = {};
    const partsByPlate = {};
    
    activePartOrders.forEach(p => {
        if (p.job_id) {
            if(!partsByJobId[p.job_id]) partsByJobId[p.job_id] = [];
            partsByJobId[p.job_id].push(p);
        }
        if (p.car_plate) {
            const plate = p.car_plate.trim().toUpperCase();
            if(!partsByPlate[plate]) partsByPlate[plate] = [];
            partsByPlate[plate].push(p);
        }
    });

    data.forEach(job => {
        let carParts = [];
        if (job.id && partsByJobId[job.id]) {
            carParts = partsByJobId[job.id];
        } else if (job.car_plate) {
            const plate = job.car_plate.trim().toUpperCase();
            const plateParts = partsByPlate[plate] || [];
            
            carParts = plateParts.filter(p => {
                if (job.qt_no && p.qt_no && job.qt_no.includes(p.qt_no)) return true;
                if (job.so_no && p.so_no && job.so_no.includes(p.so_no)) return true;
                return (!p.qt_no && !p.so_no);
            });
        }
        
        let rowHtml = `<tr id="row_${job.id}" ondblclick="goToEditJob('${job.id}')" title="ดับเบิ้ลคลิกเพื่อเปิดใบงานนี้">`;
        
        columnsDef.forEach(col => {
            let cellData = ''; let cellClass = '';
            switch(col.key) {
                case 'action': 
                    cellData = `<div class="flex items-center justify-center gap-1 w-full h-full p-0.5">
                        <button onclick="event.stopPropagation(); goToEditJob('${job.id}')" class="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded transition flex items-center justify-center w-6 h-6 shadow-2xs" title="อัปเดต/แก้ไข">
                            <i class="fa-solid fa-pen-to-square text-[11px]"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deleteJobRow('${job.id}', '${job.car_plate || '-'}')" class="bg-red-500 hover:bg-red-600 text-white p-1 rounded transition flex items-center justify-center w-6 h-6 shadow-2xs" title="ลบใบงาน">
                            <i class="fa-solid fa-trash-can text-[11px]"></i>
                        </button>
                    </div>`; 
                    break;
                
                case 'car_plate': 
                    const isUrgent = job.damage_level === 'หนัก';
                    const alertIcon = isUrgent ? '<i class="fa-solid fa-circle-exclamation text-red-500 mr-1"></i>' : '';
                    cellData = `<div class="px-2 py-1 text-center font-bold text-blue-800">${alertIcon}${job.car_plate || '-'}</div>`; 
                    break;
                    
                case 'car_brand':
                    cellData = `<div class="px-2 py-1 text-left font-bold text-slate-800">${job.car_brand || '-'}</div>`; break;
                case 'car_model':
                    cellData = `<div class="px-2 py-1 text-left font-medium text-slate-600">${job.car_model || '-'}</div>`; break;

                case 'main_part_name':
                    cellData = `<div onclick="event.stopPropagation(); openMultiPartsModal('${job.id}', 'main_part_name', '${(job.main_part_name||'').replace(/'/g, "\\'")}')" class="w-full h-full text-left cursor-pointer group">
                        ${formatPartsText(job.main_part_name, 'main')}
                    </div>`; break;
                case 'sub_part_name':
                    cellData = `<div onclick="event.stopPropagation(); openMultiPartsModal('${job.id}', 'sub_part_name', '${(job.sub_part_name||'').replace(/'/g, "\\'")}')" class="w-full h-full text-left cursor-pointer group">
                        ${formatPartsText(job.sub_part_name, 'sub')}
                    </div>`; break;

                case 'main_part_qty': 
                    cellData = `<div class="text-center font-black text-blue-600 text-xs">${job.main_part_qty || 0}</div>`; break;
                case 'sub_part_qty': 
                    cellData = `<div class="text-center font-black text-amber-600 text-xs">${job.sub_part_qty || 0}</div>`; break;

                case 'contact_date': case 'appointment_date': case 'target_finish_date': case 'repair_finish_date': case 'delivery_date': case 'order_part_date': case 'est_part_date': case 'part_received_all_date': case 'billing_date':
                    let colorClass = 'text-slate-700';
                    if (col.key === 'target_finish_date') colorClass = 'text-amber-600 font-bold';
                    if (col.key === 'repair_finish_date') colorClass = 'text-[#00320D] font-bold';
                    if (col.key === 'delivery_date') colorClass = 'text-emerald-600 font-bold';
                    
                    if (['arrived_date', 'target_finish_date', 'delivery_date'].includes(col.key)) {
                        cellData = `<div class="flex items-center justify-between w-full h-full bg-white">
                            <input type="date" id="date_${job.id}_${col.key}" value="${job[col.key] ? String(job[col.key]).split('T')[0] : ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input font-mono text-center ${colorClass}" style="width:calc(100% - 26px);">
                            <button type="button" onclick="event.stopPropagation(); openScheduleCalendar('${job.id}', '${col.key}')" class="text-blue-500 hover:text-blue-700 flex items-center justify-center w-[26px] h-[26px] border-l border-slate-200 bg-slate-50 transition-colors cursor-pointer"><i class="fa-solid fa-calendar-check text-[11px]"></i></button>
                        </div>`;
                    } else {
                        cellData = `<input type="date" value="${job[col.key] ? String(job[col.key]).split('T')[0] : ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input font-mono text-center ${colorClass}">`; 
                    }
                    break;

                case 'vin_no': case 'customer_name': case 'phone_number': case 'notes': case 'qt_no': case 'so_no': case 'ivn_no': case 'epc_no': case 'part_status':
                    cellData = `<input type="text" value="${job[col.key] || ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input text-slate-700" placeholder="-">`; break;
                
                case 'customer_type':
                    let ctOpts = allCustomerTypes.map(c => `<option value="${c.type_name}" ${job.customer_type === c.type_name ? 'selected' : ''}>${c.type_name}</option>`).join('');
                    if(job.customer_type && !allCustomerTypes.find(c => c.type_name === job.customer_type)) ctOpts += `<option value="${job.customer_type}" selected>${job.customer_type}</option>`;
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'customer_type', this.value)" class="inline-edit-select"><option value="">- เลือก -</option>${ctOpts}</select>`; break;
                
                case 'payment_type':
                    let ptOpts = allInsurances.map(i => `<option value="${i.insurance_name}" ${job.payment_type === i.insurance_name ? 'selected' : ''}>${i.insurance_name}</option>`).join('');
                    if(job.payment_type && !allInsurances.find(i => i.insurance_name === job.payment_type)) ptOpts += `<option value="${job.payment_type}" selected>${job.payment_type}</option>`;
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'payment_type', this.value)" class="inline-edit-select"><option value="">- เลือก -</option>${ptOpts}</select>`; break;

                case 'damage_level':
                    let dmgOpts = ['เบา', 'กลาง', 'หนัก'].map(d => `<option value="${d}" ${job.damage_level === d ? 'selected' : ''}>${d}</option>`).join('');
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'damage_level', this.value)" class="inline-edit-select ${job.damage_level === 'หนัก' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}"><option value="">- เลือก -</option>${dmgOpts}</select>`; break;
                
                case 'job_status': 
                    let sOpts = safeOptsGlobal; if(!sOpts.includes(`value="${job.job_status||''}"`)) sOpts = `<option value="${job.job_status||''}">${job.job_status||''}</option>` + sOpts; sOpts = sOpts.replace(`value="${job.job_status||''}"`, `value="${job.job_status||''}" selected`); 
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'job_status', this.value)" class="inline-edit-select text-blue-700 font-bold">${sOpts}</select>`; break;
                
                case 'cost_labor': case 'cost_part': case 'cost_external':
                    cellData = `<input type="number" value="${job[col.key] || ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input text-right" placeholder="0">`; break;
                
                case 'ordered_part_names':
                    let partsHTML = '<div class="px-2 py-1.5 flex flex-col w-full whitespace-normal min-h-[20px]">';
                    if(carParts.length === 0) { partsHTML += '<span class="text-slate-400 italic text-[10px]">- ไม่มีรายการ -</span>'; } 
                    else { carParts.forEach(p => { let isC = (p.order_status||'').includes('ครบ') || (p.order_status||'').includes('มีของ'); partsHTML += `<span class="text-[10px] font-bold ${isC ? 'text-emerald-600' : ((p.order_status||'').includes('รอ') ? 'text-red-500' : 'text-amber-500')} leading-tight" title="${p.part_name}">• ${p.part_name} [${p.order_status||'รอสั่ง'}]</span>`; }); }
                    cellData = partsHTML + '</div>'; break;
                
                case 'sa_owner': 
                    let saOptsHtml = '<option value="">- ระบุ SA -</option>';
                    if (branchSAs.length > 0) {
                        saOptsHtml += branchSAs.map(sa => `<option value="${sa}" ${job.sa_owner === sa ? 'selected' : ''}>${sa}</option>`).join('');
                        if(job.sa_owner && !branchSAs.includes(job.sa_owner)) {
                            saOptsHtml += `<option value="${job.sa_owner}" selected>${job.sa_owner}</option>`;
                        }
                    } else {
                        saOptsHtml += `<option value="${job.sa_owner||''}" selected>${job.sa_owner||''}</option>`;
                    }
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'sa_owner', this.value)" class="inline-edit-select text-slate-700 font-bold">${saOptsHtml}</select>`;
                    break;

                default: cellData = `<div class="px-3 py-2 truncate" title="${job[col.key]}">${job[col.key] || '-'}</div>`; break;
            }
            rowHtml += `<td class="${cellClass} p-0">${cellData}</td>`;
        });
        allRowsHtml += rowHtml + '</tr>';
    });
    tbody.innerHTML = allRowsHtml; 
}

function openBulkModal() {
    const pdiCols = columnsDef.filter(c => c.key !== 'action'); 
    let thHtml = '<th class="w-10 min-w-[40px] text-center bg-[#00320D] text-white border-b border-[#1e3a1e] sticky left-0 z-20">#</th>';
    pdiCols.forEach(c => thHtml += `<th class="min-w-[150px] px-2 bg-[#00320D] text-white border-b border-[#1e3a1e]">${c.title} <button type="button" onclick="copyDown('${c.key}')" class="text-amber-400 hover:text-white ml-1 transition" title="คัดลอกลงด้านล่าง"><i class="fa-solid fa-arrow-down"></i></button></th>`);
    document.getElementById('bulk_table_head_tr').innerHTML = thHtml; 
    document.getElementById('bulk_table_body').innerHTML = ''; 
    
    for(let i=0; i<10; i++) addBulkRow(); 
    document.getElementById('bulkModal').classList.replace('hidden', 'flex');
}

function closeBulkModal() { document.getElementById('bulkModal').classList.replace('flex', 'hidden'); }

let bulkRowCounter = 0;
function addBulkRow(rowData = null) {
    const tbody = document.getElementById('bulk_table_body'); 
    bulkRowCounter++;
    const rowId = `bulk_row_${bulkRowCounter}`;
    const tr = document.createElement('tr'); 
    tr.className = `bulk-row hover:bg-amber-50/30 transition-colors`;
    tr.setAttribute('data-row-id', rowId);
    
    let tdHtml = `<td class="text-center text-xs text-slate-400 font-mono bg-slate-50 border-r border-slate-200 p-0 sticky left-0 z-10">${tbody.children.length + 1}</td>`;
    
    let saOptions = '<option value="">-- ระบุ SA --</option>';
    const branchSAs = getSAsForCurrentBranch();
    if (branchSAs.length > 0) {
        saOptions += branchSAs.map(sa => `<option value="${sa}">${sa}</option>`).join('');
    }

    let custTypeOptions = '<option value="">-- เลือก --</option>';
    allCustomerTypes.forEach(c => custTypeOptions += `<option value="${c.type_name}">${c.type_name}</option>`);

    let paymentOptions = '<option value="">-- เลือก --</option>';
    allInsurances.forEach(i => paymentOptions += `<option value="${i.insurance_name}">${i.insurance_name}</option>`);

    let statusOptions = '<option value="">-- เลือก --</option>';
    globalStatuses.forEach(s => statusOptions += `<option value="${s.status_name}">${s.status_name}</option>`);

    let branchOptions = '<option value="">-- เลือก --</option>';
    if (['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole)) {
        const branches = ['สำนักงานใหญ่', 'สาขารามอินทรา', 'สาขาบางนา']; 
        branches.forEach(b => branchOptions += `<option value="${b}">${b}</option>`);
    } else {
        branchOptions = `<option value="${userBranch}" selected>${userBranch}</option>`;
    }

    columnsDef.filter(c => c.key !== 'action').forEach(c => {
        const val = rowData ? (rowData[c.title] || '') : '';
        
        if (c.key.includes('date')) {
            if (['arrived_date', 'target_finish_date', 'delivery_date'].includes(c.key)) {
                tdHtml += `<td class="p-0 border-r border-slate-200"><div class="flex items-center justify-between w-full h-full bg-white">
                    <input type="date" id="bulk_date_${rowId}_${c.key}" class="bulk-input bulk-input-${c.key} text-center font-mono" style="width:calc(100% - 24px);" value="${val ? new Date(val).toISOString().split('T')[0] : ''}">
                    <button type="button" onclick="openScheduleCalendarBulk('${rowId}', '${c.key}')" class="text-blue-500 hover:text-blue-700 flex items-center justify-center w-6 h-full border-l border-slate-200 bg-slate-50 transition-colors"><i class="fa-solid fa-calendar-check text-[10px]"></i></button>
                </div></td>`;
            } else {
                tdHtml += `<td class="p-0 border-r border-slate-200"><input type="date" class="bulk-input bulk-input-${c.key} text-center font-mono" value="${val ? new Date(val).toISOString().split('T')[0] : ''}"></td>`;
            }
        } 
        else if (c.key === 'sa_owner') {
            let currentSaOpts = saOptions;
            if(val && !branchSAs.includes(val)) {
                currentSaOpts += `<option value="${val}" selected>${val}</option>`;
            } else if (val) {
                currentSaOpts = currentSaOpts.replace(`value="${val}"`, `value="${val}" selected`);
            }
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} font-bold text-blue-700 cursor-pointer">${currentSaOpts}</select></td>`;
        }
        else if (c.key === 'customer_type') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer">${custTypeOptions}</select></td>`;
        }
        else if (c.key === 'payment_type') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer">${paymentOptions}</select></td>`;
        }
        else if (c.key === 'job_status') {
            let opts = statusOptions.replace(`value="09.จอดรอเข้าซ่อม"`, `value="09.จอดรอเข้าซ่อม" selected`);
            if(val) opts = statusOptions.replace(`value="${val}"`, `value="${val}" selected`);
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} font-bold text-blue-700 cursor-pointer">${opts}</select></td>`;
        }
        else if (c.key === 'branch_name') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer">${branchOptions}</select></td>`;
        }
        else if (c.key === 'damage_level') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer font-bold"><option value="เบา" ${val==='เบา'?'selected':''}>เบา</option><option value="กลาง" ${val==='กลาง'?'selected':''}>กลาง</option><option value="หนัก" ${val==='หนัก'?'selected':''}>หนัก</option></select></td>`;
        }
        else if (c.key === 'car_brand') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" list="dl_car_brands" class="bulk-input bulk-input-${c.key} font-bold text-slate-800" placeholder="${c.title}" value="${val}"></td>`;
        }
        else if (c.key === 'car_model') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" list="dl_car_models" class="bulk-input bulk-input-${c.key} text-slate-700 font-medium" placeholder="${c.title}" value="${val}"></td>`;
        }
        else if (c.key === 'main_part_name' || c.key === 'sub_part_name') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" readonly onclick="openMultiPartsModal(null, '${c.key}', this.value, true, '${rowId}')" class="bulk-input bulk-input-${c.key} cursor-pointer bg-slate-50 text-blue-700 font-bold hover:bg-slate-100" placeholder="คลิกเพื่อเลือกชิ้นส่วน..." value="${val}"></td>`;
        }
        else if (c.key === 'main_part_qty' || c.key === 'sub_part_qty') {
            tdHtml += `<td class="p-0 border-r border-slate-200 bg-slate-100"><input type="text" readonly class="bulk-input bulk-input-${c.key} text-center font-black text-slate-500 pointer-events-none" placeholder="0" value="${val}"></td>`;
        }
        else {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" class="bulk-input bulk-input-${c.key} ${c.key==='car_plate'?'font-black text-blue-700 uppercase bg-amber-50/30':''}" placeholder="${c.title}" value="${val}"></td>`;
        }
    });
    tr.innerHTML = tdHtml; tbody.appendChild(tr);

    if(!rowData) {
        const saInp = tr.querySelector('.bulk-input-sa_owner');
        const empName = sessionStorage.getItem('emp_name');
        if(saInp && empName && branchSAs.includes(empName)) {
            saInp.value = empName;
        }
        const branchInp = tr.querySelector('.bulk-input-branch_name');
        if(branchInp && userRole !== 'Manager' && userRole !== 'Admin') branchInp.value = userBranch;
    }
}

function downloadExcelTemplate() {
    let row = {}; columnsDef.filter(c => c.key !== 'action').forEach(c => { row[c.title] = ''; });
    row['ทะเบียนรถ'] = 'กข 1234'; row['ยี่ห้อรถ'] = 'Tesla'; row['รุ่นรถ'] = 'Model 3'; row['สถานะงาน'] = '09.จอดรอเข้าซ่อม';
    const ws = XLSX.utils.json_to_sheet([row]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "PDI_Full_Template"); XLSX.writeFile(wb, "RIZENIC_PDI_Full_Template.xlsx");
}

function handleExcelUpload(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonData = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).SheetNames[0]], {raw: false});
            if(jsonData.length > 0) { document.getElementById('bulk_table_body').innerHTML = ''; jsonData.forEach(row => addBulkRow(row)); alert(`✅ โหลดข้อมูลสำเร็จ ${jsonData.length} คัน`); }
        } catch(err) { alert('❌ รูปแบบไฟล์ไม่ถูกต้อง'); } document.getElementById('excel_upload').value = '';
    }; reader.readAsArrayBuffer(file);
}

function copyDown(fieldKey) {
    const inputs = document.querySelectorAll(`.bulk-input-${fieldKey}`); if(inputs.length === 0) return; const topValue = inputs[0].value; 
    for(let i = 1; i < inputs.length; i++) { inputs[i].value = topValue; inputs[i].classList.add('bg-green-100', 'transition-colors'); setTimeout(() => inputs[i].classList.remove('bg-green-100'), 500); }
}

async function saveBulkData() {
    const rows = document.querySelectorAll('.bulk-row'); let promises = []; const pdiCols = columnsDef.filter(c => c.key !== 'action');
    
    const btn = document.getElementById('btn_save_bulk'); 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบข้อมูล...'; 
    btn.disabled = true;
    
    try {
        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        const allJobs = await resJobs.json();
        const allQuotas = await resQuotas.json();

        let hasError = false;

        rows.forEach(row => {
            if (hasError) return;
            const plateInput = row.querySelector('.bulk-input-car_plate'); if(!plateInput || !plateInput.value.trim()) return; 
            let payload = {};
            pdiCols.forEach(c => { const inp = row.querySelector(`.bulk-input-${c.key}`); if (inp && inp.value !== '') { payload[c.key] = inp.value; } });
            
            if (!payload.branch_name) payload.branch_name = userBranch;
            if (!payload.job_status) payload.job_status = '09.จอดรอเข้าซ่อม'; 
            if (!payload.damage_level) payload.damage_level = 'เบา'; 
            
            payload.main_part_qty = parseInt(payload.main_part_qty) || 0;
            payload.sub_part_qty = parseInt(payload.sub_part_qty) || 0;

            if (payload.arrived_date) {
                const dateVal = String(payload.arrived_date).split('T')[0];
                const branchQuotas = allQuotas.filter(q => q.branch_name === payload.branch_name);
                const specialQ = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === dateVal);
                const defaultQ = branchQuotas.find(q => q.quota_type === 'default');
                const maxCars = specialQ && specialQ.quota_cars !== undefined ? parseInt(specialQ.quota_cars) : (defaultQ ? parseInt(defaultQ.quota_cars) : 0);
                if (maxCars > 0) {
                    const jobsInDay = allJobs.filter(j => j.branch_name === payload.branch_name && j.arrived_date && j.arrived_date.split('T')[0] === dateVal);
                    if (jobsInDay.length + 1 > maxCars) {
                        alert(`❌ ทะเบียน ${payload.car_plate}: โควต้ารถเข้าจอดในวันที่ ${formatToThaiDate(dateVal)} เต็มแล้ว!`);
                        hasError = true; return;
                    }
                }
            }
            
            if (payload.target_finish_date) {
                const dateVal = String(payload.target_finish_date).split('T')[0];
                const branchQuotas = allQuotas.filter(q => q.branch_name === payload.branch_name);
                const specialQ = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === dateVal);
                const defaultQ = branchQuotas.find(q => q.quota_type === 'default');
                const maxMain = specialQ ? parseInt(specialQ.quota_main_parts||0) : (defaultQ ? parseInt(defaultQ.quota_main_parts||0) : 0);
                const maxSub = specialQ ? parseInt(specialQ.quota_sub_parts||0) : (defaultQ ? parseInt(defaultQ.quota_sub_parts||0) : 0);

                const jobsInDay = allJobs.filter(j => j.branch_name === payload.branch_name && j.target_finish_date && j.target_finish_date.split('T')[0] === dateVal);
                let usedMain = 0; let usedSub = 0;
                jobsInDay.forEach(j => { usedMain += parseInt(j.main_part_qty)||0; usedSub += parseInt(j.sub_part_qty)||0; });

                if (maxMain > 0 && (usedMain + payload.main_part_qty) > maxMain) {
                    alert(`❌ ทะเบียน ${payload.car_plate}: กำลังผลิตชิ้นส่วนหลักวันที่ ${formatToThaiDate(dateVal)} เต็มแล้ว!`); hasError = true; return;
                }
                if (maxSub > 0 && (usedSub + payload.sub_part_qty) > maxSub) {
                    alert(`❌ ทะเบียน ${payload.car_plate}: กำลังผลิตชิ้นส่วนรองวันที่ ${formatToThaiDate(dateVal)} เต็มแล้ว!`); hasError = true; return;
                }
            }

            promises.push(fetch(`${API_BASE_URL}/api/report`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }));
        });
        
        if (hasError) {
            btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลเข้าฐานข้อมูล'; btn.disabled = false;
            return;
        }

        if(promises.length === 0) {
            alert('⚠️ กรุณากรอกข้อมูลอย่างน้อย 1 คัน (ต้องระบุทะเบียนรถ)'); 
            btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลเข้าฐานข้อมูล'; btn.disabled = false;
            return;
        }
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...';
        await Promise.all(promises); 
        alert(`🎉 นำเข้าสำเร็จ ${promises.length} คัน!`); 
        closeBulkModal(); 
        loadJobsData(); 
    } catch(e) { 
        alert('❌ เกิดข้อผิดพลาด'); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลเข้าฐานข้อมูล'; 
        btn.disabled = false; 
    }
}

async function openScheduleCalendar(jobId, field) {
    currentTargetJobId = jobId;
    currentTargetField = field;
    isBulkCalendarMode = false;
    await _openScheduleCalendar(field, jobId);
}

async function openScheduleCalendarBulk(rowId, field) {
    currentTargetBulkRowId = rowId;
    currentTargetField = field;
    isBulkCalendarMode = true;
    await _openScheduleCalendar(field, null);
}

async function _openScheduleCalendar(field, jobId) {
    const modalEl = document.getElementById('scheduleCalendarModal');
    const loadingEl = document.getElementById('calendar_loading');
    const titleEl = document.getElementById('modal_dynamic_title');

    if (modalEl) modalEl.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');

    const titles = {
        'arrived_date': 'เช็คโควต้า: รถเข้าจอดอู่ (คัน)',
        'target_finish_date': 'เช็คโควต้า: เป้าซ่อมเสร็จ & ชิ้นงานทำสี',
        'delivery_date': 'เช็คโควต้า: ส่งมอบรถลูกค้า (คัน)',
        'all': 'ตารางตรวจสอบโควต้า (ภาพรวม)'
    };
    if (titleEl) titleEl.innerText = titles[field] || 'ตารางโควต้า';

    try {
        const b = userBranch || 'สำนักงานใหญ่';

        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        
        const rawJobs = await resJobs.json();
        allSchedJobs = Array.isArray(rawJobs) ? rawJobs.filter(j => j.branch_name === b && String(j.id) !== String(jobId)) : [];
        
        const rawQuotas = await resQuotas.json();
        allSchedQuotas = Array.isArray(rawQuotas) ? rawQuotas.filter(q => q.branch_name === b) : [];
        
        renderSchedCalendar();
    } catch (e) { 
        console.error(e); 
        alert('ไม่สามารถดึงข้อมูลตารางโควต้าได้');
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function changeSchedMonth(direction) {
    currentSchedMonth += direction;
    if (currentSchedMonth > 11) { currentSchedMonth = 0; currentSchedYear++; }
    if (currentSchedMonth < 0) { currentSchedMonth = 11; currentSchedYear--; }
    renderSchedCalendar();
}

function renderSchedCalendar() {
    const grid = document.getElementById('sched_calendar_grid'); 
    if (!grid) return;
    grid.innerHTML = ''; 
    
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const monthTitleEl = document.getElementById('sched_month_title');
    if (monthTitleEl) monthTitleEl.innerText = `${monthNames[currentSchedMonth]} ${currentSchedYear}`;

    const firstDay = new Date(currentSchedYear, currentSchedMonth, 1).getDay();
    const totalDays = new Date(currentSchedYear, currentSchedMonth + 1, 0).getDate();

    const defaultQuota = allSchedQuotas.find(q => q.quota_type === 'default');

    const dailyData = {};
    const specialQuotasMap = {};

    allSchedQuotas.forEach(q => {
        if(q.quota_type === 'special' && q.quota_date) {
            specialQuotasMap[q.quota_date.split('T')[0]] = q;
        }
    });

    allSchedJobs.forEach(j => {
        const arrD = j.arrived_date ? String(j.arrived_date).split('T')[0] : null;
        const tgtD = j.target_finish_date ? String(j.target_finish_date).split('T')[0] : null;
        const delD = j.delivery_date ? String(j.delivery_date).split('T')[0] : null;

        if (arrD) { if(!dailyData[arrD]) dailyData[arrD] = {a:0, t:0, d:0, m:0, s:0}; dailyData[arrD].a++; }
        if (tgtD) { 
            if(!dailyData[tgtD]) dailyData[tgtD] = {a:0, t:0, d:0, m:0, s:0}; 
            dailyData[tgtD].t++; 
            dailyData[tgtD].m += parseInt(j.main_part_qty) || 0; 
            dailyData[tgtD].s += parseInt(j.sub_part_qty) || 0; 
        }
        if (delD) { if(!dailyData[delD]) dailyData[delD] = {a:0, t:0, d:0, m:0, s:0}; dailyData[delD].d++; }
    });

    let htmlBuffer = '';
    for(let i = 0; i < firstDay; i++) { htmlBuffer += `<div class="bg-transparent rounded-xl"></div>`; }

    const getQVal = (sq, fieldArr) => {
        for (let f of fieldArr) {
            if (sq && sq[f] !== undefined && sq[f] !== null && sq[f] !== '') return parseInt(sq[f]) || 0;
            if (defaultQuota && defaultQuota[f] !== undefined && defaultQuota[f] !== null && defaultQuota[f] !== '') return parseInt(defaultQuota[f]) || 0;
        }
        return 0;
    };

    for(let day = 1; day <= totalDays; day++) {
        const dateStr = `${currentSchedYear}-${String(currentSchedMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        const dData = dailyData[dateStr] || {a:0, t:0, d:0, m:0, s:0};
        const arrCount = dData.a;
        const tarCount = dData.t;
        const delCount = dData.d;
        const mainPartsSum = dData.m;
        const subPartsSum = dData.s;

        const specialQuota = specialQuotasMap[dateStr];
        
        const maxArrived = getQVal(specialQuota, ['quota_arrived', 'quota_cars']);
        const maxTarget = getQVal(specialQuota, ['quota_target', 'quota_cars']);
        const maxDelivery = getQVal(specialQuota, ['quota_delivery', 'quota_cars']);
        const maxMain = getQVal(specialQuota, ['quota_main_parts']);
        const maxSub = getQVal(specialQuota, ['quota_sub_parts']);

        const isArriveFull = maxArrived > 0 && arrCount >= maxArrived;
        const isTargetCarFull = maxTarget > 0 && tarCount >= maxTarget;
        const isTargetMainFull = maxMain > 0 && mainPartsSum >= maxMain;
        const isTargetSubFull = maxSub > 0 && subPartsSum >= maxSub;
        const isTargetOverallFull = isTargetCarFull || isTargetMainFull || isTargetSubFull;
        const isDeliveryFull = maxDelivery > 0 && delCount >= maxDelivery;
        const allFull = isArriveFull && isTargetOverallFull && isDeliveryFull;

        let quotaHTML = `<div class="mt-auto w-full pt-1 flex flex-col gap-1.5">`;
        let isCurrentFieldFull = false;
        let cellClass = 'sched-cell transition-all ';
        let clickAction = '';
        let lockIcon = '';

        if (currentTargetField === 'arrived_date') {
            isCurrentFieldFull = isArriveFull;
            let pct = maxArrived > 0 ? Math.min((arrCount / maxArrived) * 100, 100) : 0;
            let color = pct >= 100 ? 'bg-rose-500' : 'bg-emerald-500';
            quotaHTML += `
                <div class="flex justify-between text-[10px] font-black ${pct>=100?'text-rose-600':'text-emerald-700'} mb-1">
                    <span>รถเข้าจอด</span> <span>${arrCount}/${maxArrived > 0 ? maxArrived : '∞'} คัน</span>
                </div>
                ${maxArrived > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full"><div class="h-full ${color} rounded-full" style="width:${pct}%"></div></div>` : ''}
            `;
        } 
        else if (currentTargetField === 'target_finish_date') {
            isCurrentFieldFull = isTargetOverallFull;
            let pctT = maxTarget > 0 ? Math.min((tarCount / maxTarget) * 100, 100) : 0;
            let pctM = maxMain > 0 ? Math.min((mainPartsSum / maxMain) * 100, 100) : 0;
            let pctS = maxSub > 0 ? Math.min((subPartsSum / maxSub) * 100, 100) : 0;
            
            quotaHTML += `
                <div>
                    <div class="flex justify-between text-[9px] font-black ${pctT>=100?'text-rose-600':'text-amber-800'} mb-0.5">
                        <span>เป้าเสร็จ</span> <span>${tarCount}/${maxTarget > 0 ? maxTarget : '∞'} คัน</span>
                    </div>
                    ${maxTarget > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full mb-1"><div class="h-full ${pctT>=100?'bg-rose-500':'bg-amber-500'} rounded-full" style="width:${pctT}%"></div></div>` : ''}
                </div>
                <div>
                    <div class="flex justify-between text-[9px] font-black ${pctM>=100?'text-rose-600':'text-blue-700'} mb-0.5">
                        <span>ชิ้นหลัก</span> <span>${mainPartsSum}/${maxMain > 0 ? maxMain : '∞'} ชิ้น</span>
                    </div>
                    ${maxMain > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full mb-1"><div class="h-full ${pctM>=100?'bg-rose-500':'bg-blue-500'} rounded-full" style="width:${pctM}%"></div></div>` : ''}
                </div>
                <div>
                    <div class="flex justify-between text-[9px] font-black ${pctS>=100?'text-rose-600':'text-amber-700'} mb-0.5">
                        <span>ชิ้นรอง</span> <span>${subPartsSum}/${maxSub > 0 ? maxSub : '∞'} ชิ้น</span>
                    </div>
                    ${maxSub > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full"><div class="h-full ${pctS>=100?'bg-rose-500':'bg-amber-500'} rounded-full" style="width:${pctS}%"></div></div>` : ''}
                </div>
            `;
        } 
        else if (currentTargetField === 'delivery_date') {
            isCurrentFieldFull = isDeliveryFull;
            let pct = maxDelivery > 0 ? Math.min((delCount / maxDelivery) * 100, 100) : 0;
            let color = pct >= 100 ? 'bg-rose-500' : 'bg-indigo-500';
            quotaHTML += `
                <div class="flex justify-between text-[10px] font-black ${pct>=100?'text-rose-600':'text-indigo-700'} mb-1">
                    <span>ส่งมอบรถ</span> <span>${delCount}/${maxDelivery > 0 ? maxDelivery : '∞'} คัน</span>
                </div>
                ${maxDelivery > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full"><div class="h-full ${color} rounded-full" style="width:${pct}%"></div></div>` : ''}
            `;
        } 
        else {
            isCurrentFieldFull = allFull;
            quotaHTML += `
                <div class="text-[9px] font-bold ${isArriveFull?'text-rose-600':'text-emerald-700'} flex justify-between"><span>เข้า</span><span>${arrCount}/${maxArrived > 0 ? maxArrived : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isTargetCarFull?'text-rose-600':'text-amber-700'} flex justify-between"><span>เป้า</span><span>${tarCount}/${maxTarget > 0 ? maxTarget : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isTargetMainFull?'text-rose-600':'text-blue-700'} flex justify-between"><span>หลัก</span><span>${mainPartsSum}/${maxMain > 0 ? maxMain : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isTargetSubFull?'text-rose-600':'text-amber-700'} flex justify-between"><span>รอง</span><span>${subPartsSum}/${maxSub > 0 ? maxSub : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isDeliveryFull?'text-rose-600':'text-indigo-700'} flex justify-between"><span>ส่ง</span><span>${delCount}/${maxDelivery > 0 ? maxDelivery : '∞'}</span></div>
            `;
        }
        quotaHTML += `</div>`;

        if (isCurrentFieldFull) {
            cellClass += 'bg-slate-50 border-rose-200 opacity-60 cursor-not-allowed grayscale';
            clickAction = `onclick="alert('❌ โควต้าของวันที่นี้เต็มแล้ว ไม่สามารถเลือกได้ครับ!')"`;
            lockIcon = '<i class="fa-solid fa-lock text-rose-500 text-[10px]" title="คิวเต็มแล้ว"></i>';
        } else {
            cellClass += 'hover:border-blue-500 cursor-pointer hover:shadow-md hover:-translate-y-1 bg-white';
            if (currentTargetField !== 'all') {
                clickAction = `onclick="applySelectedDateToFieldDirect('${dateStr}')"`;
            }
        }

        htmlBuffer += `
            <div class="${cellClass}" ${clickAction}>
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-xs font-black ${isCurrentFieldFull ? 'text-rose-500' : 'text-slate-400'} font-mono">${day}</span>
                    ${lockIcon}
                </div>
                ${quotaHTML}
            </div>
        `;
    }

    grid.innerHTML = htmlBuffer;
}

function applySelectedDateToFieldDirect(dateStr) {
    closeModal('scheduleCalendarModal');
    
    let inputField;
    if (isBulkCalendarMode) {
        inputField = document.getElementById(`bulk_date_${currentTargetBulkRowId}_${currentTargetField}`);
    } else {
        inputField = document.getElementById(`date_${currentTargetJobId}_${currentTargetField}`);
    }

    if (inputField) {
        inputField.value = dateStr;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        inputField.classList.add('bg-emerald-100');
        setTimeout(() => inputField.classList.remove('bg-emerald-100'), 1000);
        
        if (!isBulkCalendarMode) {
            fastUpdateJob(currentTargetJobId, currentTargetField, dateStr);
        }
    }
}

function closeModal(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden'); 
}