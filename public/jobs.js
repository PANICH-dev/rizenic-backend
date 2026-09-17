const API_BASE_URL = window.location.origin;
let masterJobsData = [];
let allJobsData = [];
let allPartOrders = [];
let allStatuses = []; // สำหรับเก็บสถานะอะไหล่ทั้งหมด
let allMasterPartsCache = []; // เก็บมาสเตอร์อะไหล่เพื่อ Autofill ชื่อ
let globalStatusOptionsHtml = '';
let userRole = '';
let userBranch = '';
let currentViewSA = ''; 
let selectedBranchFilter = 'ALL';

const activeProcessStatuses = [
    '01.ติดต่อสอบถาม', '02.รอเสนอประกัน', '03.รอประกันอนุมัติ', 
    '04.รอลูกค้าอนุมัติ (เงินสด)', '05.อนุมัติแล้ว', '06.สั่งอะไหล่', 
    '07.รอนัดหมายเข้าซ่อม', '08.นัดหมายแล้วรอเข้าซ่อม', '09.จอดรอเข้าซ่อม', 
    '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ'
];

function isTrue(val) { return val === 'TRUE' || val === '1' || val === true || val === 1; }

function computeHighestStationIFS(j) {
    if(isTrue(j.station_ready)) return "13.รอส่งมอบ";
    if(isTrue(j.station_pak)) return "12.พักซ่อม";
    if(isTrue(j.station_film)) return "11.ฟิล์ม";
    if(isTrue(j.station_kraj)) return "10.กระจก";
    if(isTrue(j.station_mag)) return "09.ซ่อมแม็ก";
    if(isTrue(j.station_qc)) return "08.เก็บงาน";
    if(isTrue(j.station_kat)) return "06.ขัดสี";
    if(isTrue(j.station_prak)) return "05.ประกอบ";
    if(isTrue(j.station_pon)) return "04.พ่นสี";
    if(isTrue(j.station_puan)) return "03.เตรียมพื้น";
    if(isTrue(j.station_pou)) return "02.โป๊ว";
    if(isTrue(j.station_kho)) return "01.เคาะ";
    return "รอรับรถ";
}

function getValidDateStr(val) {
    if (!val || String(val).trim() === '' || String(val) === 'null' || String(val) === 'undefined') return '';
    const str = String(val).split('T')[0];
    if (str.startsWith('1970') || str.startsWith('0000')) return '';
    return str;
}

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    const icon = type === 'error' ? 'fa-circle-xmark' : (type === 'info' ? 'fa-circle-info' : 'fa-circle-check');
    toast.className = `fixed bottom-5 right-5 font-bold px-6 py-3 rounded-xl shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${icon} text-xl"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 2500);
}

function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }
function goToEditJob(jobId) { sessionStorage.setItem('edit_job_id', jobId); window.location.href = 'index.html'; }

// =====================================
// INIT
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    userRole = sessionStorage.getItem('emp_role') || 'Admin';
    userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'Admin Test';
    document.getElementById('display_branch').innerText = userBranch;
    
    const today = new Date();
    document.getElementById('sa_cal_month').value = String(today.getMonth() + 1).padStart(2, '0');

    loadJobsData();
});

async function loadJobsData() {
    try {
        const results = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/statuses`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/part-orders`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/reports`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/employees`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/part-statuses`).then(res => res.json()),
            fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(userBranch)}`).then(res => res.json())
        ]);

        if (results[0].status === 'fulfilled') {
            globalStatusOptionsHtml = results[0].value.length > 0 ? results[0].value.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('') : `<option value="09.จอดรอเข้าซ่อม">09.จอดรอเข้าซ่อม</option>`;
        }
        if (results[1].status === 'fulfilled') allPartOrders = results[1].value;
        if (results[3].status === 'fulfilled') {
            const employees = results[3].value;
            let masterBranches = [...new Set(employees.map(e => e.branch_name).filter(Boolean))].sort();
            const branchSelect = document.getElementById('branch_filter');
            const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);
            let optionsHtml = isManager ? `<option value="ALL">🏢 รวมทุกสาขา</option>` : '';
            if(masterBranches.length === 0) masterBranches = [userBranch];
            masterBranches.forEach(b => { optionsHtml += `<option value="${b}">${b}</option>`; });
            
            if (branchSelect) {
                branchSelect.innerHTML = optionsHtml;
                if (isManager) { branchSelect.value = selectedBranchFilter; branchSelect.disabled = false; } 
                else { selectedBranchFilter = userBranch; branchSelect.value = userBranch; branchSelect.disabled = true; }
            }
        }
        if (results[4].status === 'fulfilled') allStatuses = results[4].value || [];
        if (results[5].status === 'fulfilled') allMasterPartsCache = results[5].value || [];

        if (results[2].status === 'fulfilled') {
            masterJobsData = results[2].value;
            filterDataByBranch();
        }
    } catch (error) { showToast('มีปัญหาในการโหลดข้อมูล', 'error'); }
}

function onBranchChange() {
    selectedBranchFilter = document.getElementById('branch_filter').value;
    filterDataByBranch();
}

function filterDataByBranch() {
    if (selectedBranchFilter === 'ALL') allJobsData = masterJobsData;
    else allJobsData = masterJobsData.filter(d => d.branch_name === selectedBranchFilter);
    
    const yearSelect = document.getElementById('sa_cal_year');
    const years = new Set([new Date().getFullYear()]);
    allJobsData.forEach(j => { if(j.arrived_date) { const y = new Date(j.arrived_date).getFullYear(); if(!isNaN(y)) years.add(y); } });
    let savedYear = yearSelect.value || new Date().getFullYear().toString();
    yearSelect.innerHTML = '';
    [...years].sort((a,b)=>b-a).forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);
    if(years.has(parseInt(savedYear))) yearSelect.value = savedYear;
    
    updateHeaderSummaryBadges(allJobsData);

    if(currentViewSA) openSADetail(currentViewSA); 
    else renderSAList();
}

function updateHeaderSummaryBadges(jobs) {
    const fMonth = document.getElementById('sa_cal_month')?.value || String(new Date().getMonth() + 1).padStart(2, '0');
    const fYear = document.getElementById('sa_cal_year')?.value || String(new Date().getFullYear());
    let waitBillCount = 0; let billedCount = 0; let mainP = 0; let subP = 0;

    jobs.forEach(job => {
        const st = job.job_status || "";
        if (st.includes('รอออกบิล')) waitBillCount++;
        const isBilledStatus = st.includes('ชำระเงินสด') || st.includes('ออกบิลแล้ว') || st.includes('วางบิล');
        if (isBilledStatus && getValidDateStr(job.billing_date)) {
            const d = new Date(job.billing_date);
            if (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear) {
                billedCount++;
                mainP += Number(job.main_part_qty) || 0;
                subP += Number(job.sub_part_qty) || 0;
            }
        }
    });

    if (document.getElementById('badge_wait_bill')) document.getElementById('badge_wait_bill').innerText = waitBillCount;
    if (document.getElementById('badge_billed')) document.getElementById('badge_billed').innerText = billedCount;
    if (document.getElementById('badge_main_parts')) document.getElementById('badge_main_parts').innerText = mainP;
    if (document.getElementById('badge_sub_parts')) document.getElementById('badge_sub_parts').innerText = subP;
}

function globalSearchCar() {
    const plate = document.getElementById('global_search_plate').value.trim().toLowerCase();
    if(!plate) return;
    const matchedJobs = masterJobsData.filter(j => j.car_plate && j.car_plate.toLowerCase().includes(plate));
    if(matchedJobs.length === 0) showToast('ไม่พบรถทะเบียน: ' + plate, 'error');
    else if (matchedJobs.length === 1) { showToast('🚀 กำลังพุ่งไป...', 'info'); setTimeout(() => goToEditJob(matchedJobs[0].id), 400); } 
    else {
        document.getElementById('modal_status_name').innerText = `ค้นหาทะเบียน: ${plate}`;
        renderJobTableInModal(matchedJobs, 'general');
        document.getElementById('jobListModal').classList.remove('hidden');
    }
}

/// =====================================
// View 1: SA Cards List
// =====================================
function renderSAList() {
    const container = document.getElementById('sa_cards_container');
    const saStats = {}; 
    const fMonth = document.getElementById('sa_cal_month')?.value || String(new Date().getMonth() + 1).padStart(2, '0');
    const fYear = document.getElementById('sa_cal_year')?.value || String(new Date().getFullYear());
    const todayStr = new Date().toISOString().split('T')[0];
    const arrivedPrefixes = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];
    const pendingStatuses = ['01.ติดต่อสอบถาม', '02.รอเสนอประกัน', '03.รอประกันอนุมัติ', '04.รอลูกค้าอนุมัติ', '05.อนุมัติแล้ว', '06.สั่งอะไหล่', '07.รอนัดหมายเข้าซ่อม', '08.นัดหมายแล้วรอเข้าซ่อม', '09.จอดรอเข้าซ่อม', '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ', '12.ส่งมอบ','21.พักซ่อม'];

    allJobsData.forEach(job => { 
        const sa = job.sa_owner || "ไม่ระบุ SA"; 
        const st = job.job_status || "";
        
        // กำหนดตัวแปรเก็บค่า (เพิ่มค่าแรงและค่าอะไหล่)
        if (!saStats[sa]) saStats[sa] = { pending: 0, waitBill: 0, billed: 0, ovApp: 0, ovTgt: 0, ovDel: 0, totalOverdue: 0, sumLabor: 0, sumParts: 0 };
        
        // 1. นับงานค้าง
        if (pendingStatuses.some(s => st.includes(s))) saStats[sa].pending++; 

        // 2. นับงานรอออกบิล
        if (st.includes('รอออกบิล')) {
            let jobDate = job.delivery_date || job.repair_finish_date || job.target_finish_date || job.arrived_date;
            if (jobDate) {
                const d = new Date(jobDate);
                if (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear) {
                    saStats[sa].waitBill++;
                }
            } else {
                saStats[sa].waitBill++; // ถ้ารถไม่มีวันที่ ให้นับรวมไปด้วย
            }
        }

        // 3. นับงานปิดบิล และบวกยอดเงิน
        const isBilled = st.includes('ชำระเงินสด') || st.includes('ออกบิลแล้ว') || st.includes('วางบิล');
        if (isBilled && getValidDateStr(job.billing_date)) {
            const d = new Date(job.billing_date);
            if (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear) {
                saStats[sa].billed++;
                saStats[sa].sumLabor += Number(job.cost_labor || job.labor_total || 0);
                saStats[sa].sumParts += Number(job.cost_part || job.part_total || 0);
            }
        }

        // 4. นับงานล่าช้า (Overdue)
        const isProcess = activeProcessStatuses.some(s => st.includes(s) || st.startsWith(s.substring(0, 2)));
        if (isProcess) {
            const appVal = getValidDateStr(job.arrived_date);
            const hasArrived = arrivedPrefixes.some(p => st.startsWith(p)) || job.is_parked === 'จอดซ่อม';
            if (appVal && appVal <= todayStr && !hasArrived) { saStats[sa].ovApp++; saStats[sa].totalOverdue++; }
            
            const tgtVal = getValidDateStr(job.target_finish_date);
            if (tgtVal && tgtVal < todayStr && !getValidDateStr(job.repair_finish_date)) { saStats[sa].ovTgt++; saStats[sa].totalOverdue++; }
            
            const delVal = getValidDateStr(job.delivery_date);
            if (delVal && delVal < todayStr && !st.includes('ส่งมอบ')) { saStats[sa].ovDel++; saStats[sa].totalOverdue++; }
        }
    });

    const sortedSAs = Object.keys(saStats).sort((a, b) => saStats[b].pending - saStats[a].pending);
    if(sortedSAs.length === 0) { container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 font-bold bg-white rounded-xl">ไม่มีงานค้างเลย 🎉</div>`; return; }

    const formatMoney = (val) => Number(val).toLocaleString('th-TH', {minimumFractionDigits: 0, maximumFractionDigits: 2});

    container.innerHTML = sortedSAs.map(sa => {
        const stats = saStats[sa];
        return `
        <div onclick="openSADetail('${sa}')" class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:border-amber-500 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
            <div class="absolute -right-4 -bottom-4 text-slate-100 text-6xl opacity-30 rotate-12 transition-transform group-hover:scale-110"><i class="fa-solid fa-user-tie"></i></div>
            <div class="flex items-center gap-4 mb-3 relative z-10">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0"><i class="fa-solid fa-user-tie"></i></div>
                <div class="truncate w-full">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Service Advisor</p>
                    <h3 class="text-base font-black text-[#00320D] leading-tight truncate w-full" title="${sa}">${sa}</h3>
                </div>
            </div>
            
            <div class="flex flex-col gap-1.5 relative z-10">
                <div class="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 flex justify-between items-center">
                    <span class="text-[11px] font-bold text-slate-600">งานค้างในระบบ</span>
                    <div class="text-right"><span class="text-lg font-black text-blue-600 leading-none">${stats.pending}</span> <span class="text-[10px] text-slate-500 font-bold">คัน</span></div>
                </div>

                ${stats.totalOverdue > 0 ? `<div class="flex justify-between gap-1">${stats.ovApp > 0 ? `<div class="bg-red-50 text-red-700 text-[9px] font-bold px-1.5 py-1 rounded shadow-xs border border-red-200 flex-1 text-center"><i class="fa-solid fa-triangle-exclamation animate-pulse"></i> เข้า <span class="font-black text-xs">${stats.ovApp}</span></div>` : ''}${stats.ovTgt > 0 ? `<div class="bg-amber-50 text-amber-800 text-[9px] font-bold px-1.5 py-1 rounded shadow-xs border border-amber-300 flex-1 text-center"><i class="fa-solid fa-clock"></i> เสร็จ <span class="font-black text-xs">${stats.ovTgt}</span></div>` : ''}${stats.ovDel > 0 ? `<div class="bg-purple-50 text-purple-800 text-[9px] font-bold px-1.5 py-1 rounded shadow-xs border border-purple-300 flex-1 text-center"><i class="fa-solid fa-key"></i> ส่ง <span class="font-black text-xs">${stats.ovDel}</span></div>` : ''}</div>` : `<div class="text-[9px] text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded border border-emerald-100 text-center"><i class="fa-solid fa-circle-check"></i> ไร้งาน Overdue</div>`}
                
                <!-- 🌟 กล่องสรุปการเงินและการปิดบิล (หน้าการ์ด SA) 🌟 -->
                <div class="mt-2 pt-2 border-t border-slate-100">
                    <div class="flex justify-between gap-1 mb-1">
                        <div class="bg-amber-50 rounded px-2 py-1 flex-1 text-center border border-amber-100 shadow-xs">
                            <p class="text-[9px] text-amber-700 font-bold">รอออกบิล</p>
                            <p class="text-xs font-black text-amber-600">${stats.waitBill}</p>
                        </div>
                        <div class="bg-emerald-50 rounded px-2 py-1 flex-1 text-center border border-emerald-100 shadow-xs">
                            <p class="text-[9px] text-emerald-700 font-bold">ปิดบิลแล้ว</p>
                            <p class="text-xs font-black text-emerald-600">${stats.billed}</p>
                        </div>
                    </div>
                    <div class="flex justify-between gap-1">
                        <div class="bg-slate-50 rounded px-2 py-1 flex-1 text-center border border-slate-200">
                            <p class="text-[8px] text-slate-500 font-bold">ค่าแรง</p>
                            <p class="text-[10px] font-black text-emerald-700">${formatMoney(stats.sumLabor)}</p>
                        </div>
                        <div class="bg-slate-50 rounded px-2 py-1 flex-1 text-center border border-slate-200">
                            <p class="text-[8px] text-slate-500 font-bold">ค่าอะไหล่</p>
                            <p class="text-[10px] font-black text-purple-600">${formatMoney(stats.sumParts)}</p>
                        </div>
                    </div>
                </div>
                <!-- 🌟 สิ้นสุดกล่องสรุปการเงิน 🌟 -->

            </div>
        </div>`
    }).join('');
}
function backToSAList() { 
    currentViewSA = ''; 
    document.getElementById('sa_detail_view').classList.add('hidden'); 
    document.getElementById('sa_list_view').classList.remove('hidden'); 
}

// =====================================
// View 2: SA Details (Stats, Calendar, Parked, PO)
// =====================================
function openSADetail(saName) {
    currentViewSA = saName; 
    document.getElementById('sa_list_view').classList.add('hidden'); 
    document.getElementById('sa_detail_view').classList.remove('hidden'); 
    document.getElementById('current_sa_name').innerText = saName;

    const saJobs = allJobsData.filter(j => (j.sa_owner || "ไม่ระบุ SA") === saName);
    
    refreshSADashboardFilter(); // Calendar, Statuses, Overdue
    renderSAParkedCars(saJobs); 
    renderSAPOTracking(saJobs); 
}

// ---- Overdue ----
function refreshSADashboardFilter() {
    if(!currentViewSA) return;
    const saJobs = allJobsData.filter(j => (j.sa_owner || "ไม่ระบุ SA") === currentViewSA);
    calculateSAOverdues(saJobs);
    renderSACalendar(saJobs);
    renderSAStatuses(saJobs); 
}

function calculateSAOverdues(jobs) {
    const todayStr = new Date().toISOString().split('T')[0];
    let ovApp = 0, ovTgt = 0, ovDel = 0;
    const arrivedPrefixes = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];

    jobs.forEach(j => {
        const st = j.job_status || '';
        if (activeProcessStatuses.some(status => st.includes(status) || st.startsWith(status.substring(0, 2)))) {
            const appVal = getValidDateStr(j.arrived_date);
            const hasArrived = arrivedPrefixes.some(p => st.startsWith(p)) || j.is_parked === 'จอดซ่อม';
            if (appVal && appVal <= todayStr && !hasArrived) ovApp++;

            const tgtVal = getValidDateStr(j.target_finish_date);
            if (tgtVal && tgtVal < todayStr && !getValidDateStr(j.repair_finish_date)) ovTgt++;

            const delVal = getValidDateStr(j.delivery_date);
            if (delVal && delVal < todayStr && !st.includes('ส่งมอบ')) ovDel++;
        }
    });

    const setBtn = (id, count, color) => {
        const btn = document.getElementById(id);
        document.getElementById(id.replace('btn_', '') + '_count').innerText = count;
        if(count > 0) btn.className = `px-2.5 py-1 bg-${color}-100 border-2 border-${color}-500 rounded-lg text-xs font-bold text-${color}-700 transition flex items-center gap-1 shadow-md animate-pulse`;
        else btn.className = `px-2.5 py-1 bg-white border border-${color}-300 hover:bg-${color}-100 rounded-lg text-xs font-bold text-${color}-700 transition flex items-center gap-1 shadow-sm`;
    };

    setBtn('btn_ov_app', ovApp, 'red');
    setBtn('btn_ov_tgt', ovTgt, 'amber');
    setBtn('btn_ov_del', ovDel, 'purple');
}

function openSAOverdueModal(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    const saJobs = allJobsData.filter(j => (j.sa_owner || "ไม่ระบุ SA") === currentViewSA);
    const arrivedPrefixes = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];

    const jobsToShow = saJobs.filter(j => {
        const st = j.job_status || '';
        if (!activeProcessStatuses.some(status => st.includes(status) || st.startsWith(status.substring(0, 2)))) return false;

        if (type === 'appointment') {
            const appVal = getValidDateStr(j.arrived_date);
            const hasArrived = arrivedPrefixes.some(p => st.startsWith(p)) || j.is_parked === 'จอดซ่อม';
            return appVal && appVal <= todayStr && !hasArrived;
        } else if (type === 'target') {
            const tgtVal = getValidDateStr(j.target_finish_date);
            return tgtVal && tgtVal < todayStr && !getValidDateStr(j.repair_finish_date);
        } else if (type === 'delivery') {
            const delVal = getValidDateStr(j.delivery_date);
            return delVal && delVal < todayStr && !st.includes('ส่งมอบ');
        }
    });

    const titles = { 'appointment': 'เลยกำหนดรถเข้าจอด', 'target': 'เลยเป้าซ่อมเสร็จ', 'delivery': 'เลยกำหนดส่งมอบ' };
    document.getElementById('modal_status_name').innerText = `🚨 OVERDUE: ${titles[type]}`;
    renderJobTableInModal(jobsToShow, 'overdue');
    document.getElementById('jobListModal').classList.remove('hidden');
}

// ---- Calendar ----
function renderSACalendar(jobs) {
    const m = parseInt(document.getElementById('sa_cal_month').value) - 1; 
    const y = parseInt(document.getElementById('sa_cal_year').value); 
    const grid = document.getElementById('sa_calendar_grid'); grid.innerHTML = '';
    if(isNaN(m) || isNaN(y)) return;

    const firstDay = new Date(y, m, 1).getDay(); 
    const totalDays = new Date(y, m + 1, 0).getDate();
    for(let i = 0; i < firstDay; i++) { grid.innerHTML += `<div class="bg-slate-50/50 rounded-xl border border-transparent"></div>`; }
    const todayStr = new Date().toISOString().split('T')[0];

    for(let day = 1; day <= totalDays; day++) {
        const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const arrC = jobs.filter(j => getValidDateStr(j.arrived_date) === dateStr).length;
        const tgtC = jobs.filter(j => getValidDateStr(j.target_finish_date) === dateStr).length;
        const delC = jobs.filter(j => getValidDateStr(j.delivery_date) === dateStr).length;
        
        let barBlock = `<div class="flex items-center justify-center h-[40px] w-full mt-auto"><span class="text-[10px] font-bold text-slate-300">ว่าง</span></div>`;
        if(arrC > 0 || tgtC > 0 || delC > 0) {
            barBlock = `<div class="flex flex-col gap-1 w-full mt-auto">`;
            if(arrC > 0) barBlock += `<div onclick="openSAJobListModalCalendar('${dateStr}', 'arrived')" class="flex justify-between items-center px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] font-bold text-blue-700 cursor-pointer hover:bg-blue-100 transition shadow-sm"><span>🚗 เข้า</span> <span class="bg-blue-200 px-1.5 rounded-sm">${arrC}</span></div>`;
            if(tgtC > 0) barBlock += `<div onclick="openSAJobListModalCalendar('${dateStr}', 'target')" class="flex justify-between items-center px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-amber-700 cursor-pointer hover:bg-amber-100 transition shadow-sm"><span>🛠️ เป้า</span> <span class="bg-amber-200 px-1.5 rounded-sm">${tgtC}</span></div>`;
            if(delC > 0) barBlock += `<div onclick="openSAJobListModalCalendar('${dateStr}', 'delivery')" class="flex justify-between items-center px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-bold text-emerald-700 cursor-pointer hover:bg-emerald-100 transition shadow-sm"><span>🤝 ส่ง</span> <span class="bg-emerald-200 px-1.5 rounded-sm">${delC}</span></div>`;
            barBlock += `</div>`;
        }
        grid.innerHTML += `<div class="calendar-cell ${dateStr === todayStr ? 'today' : ''}"><span class="calendar-day-label">${day}</span><div class="flex-1 flex flex-col justify-end w-full">${barBlock}</div></div>`;
    }
}

function openSAJobListModalCalendar(dateStr, type) {
    const saJobs = allJobsData.filter(j => (j.sa_owner || "ไม่ระบุ SA") === currentViewSA);
    let typeLabel = ""; let jobsToShow = [];
    if(type === 'arrived') { typeLabel = "รถเข้าจอด"; jobsToShow = saJobs.filter(j => getValidDateStr(j.arrived_date) === dateStr); }
    else if(type === 'target') { typeLabel = "เป้าซ่อมเสร็จ"; jobsToShow = saJobs.filter(j => getValidDateStr(j.target_finish_date) === dateStr); }
    else if(type === 'delivery') { typeLabel = "นัดส่งมอบ"; jobsToShow = saJobs.filter(j => getValidDateStr(j.delivery_date) === dateStr); }

    document.getElementById('modal_status_name').innerText = `วันที่ ${new Date(dateStr).toLocaleDateString('th-TH')} (${typeLabel})`;
    renderJobTableInModal(jobsToShow, 'general'); 
    document.getElementById('jobListModal').classList.remove('hidden');
}

/// ---- Statuses & Finance Summary ----
function updateBilledCount(jobs) {
    const fMonth = document.getElementById('sa_cal_month').value;
    const fYear = document.getElementById('sa_cal_year').value;
    let billedCount = 0; let waitBillCount = 0;
    let sumMain = 0; let sumSub = 0; let sumLabor = 0; let sumParts = 0; let sumOutsource = 0;
    
    jobs.forEach(job => {
        const st = job.job_status || "";
        if (st.includes('รอออกบิล')) {
            let jobDate = job.delivery_date || job.repair_finish_date || job.target_finish_date || job.arrived_date;
            if (jobDate) {
                const d = new Date(jobDate);
                if (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear) waitBillCount++;
            }
        }
        
        const isBilled = st.includes('ชำระเงินสด') || st.includes('ออกบิลแล้ว') || st.includes('วางบิล');
        if (isBilled && getValidDateStr(job.billing_date)) {
            const d = new Date(job.billing_date);
            if (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear) {
                billedCount++;
                sumMain += Number(job.main_part_qty) || 0;
                sumSub += Number(job.sub_part_qty) || 0;
                sumLabor += Number(job.cost_labor || 0);
                sumParts += Number(job.cost_part || 0);
                sumOutsource += Number(job.cost_external || 0);
            }
        }
    });
    
    document.getElementById('sa_waitbill_count').innerText = waitBillCount;
    document.getElementById('sa_billed_count').innerText = billedCount;
    document.getElementById('waitbill_month_label').innerText = `(เดือน ${fMonth}/${fYear})`;
    document.getElementById('billed_month_label').innerText = `(เดือน ${fMonth}/${fYear})`;

    const formatMoney = (val) => val.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    if(document.getElementById('sum_main_parts')) document.getElementById('sum_main_parts').innerText = sumMain;
    if(document.getElementById('sum_sub_parts')) document.getElementById('sum_sub_parts').innerText = sumSub;
    if(document.getElementById('sum_labor')) document.getElementById('sum_labor').innerText = formatMoney(sumLabor);
    if(document.getElementById('sum_parts')) document.getElementById('sum_parts').innerText = formatMoney(sumParts);
    if(document.getElementById('sum_outsource')) document.getElementById('sum_outsource').innerText = formatMoney(sumOutsource);
}
function renderSAStatuses(jobs) {
    const statusCounts = {}; 
    jobs.forEach(job => { 
        const st = job.job_status || "ไม่ระบุสถานะ"; 
        const isBilled = getValidDateStr(job.billing_date) || st.includes('ออกบิล') || st.includes('ชำระเงินสด') || st.includes('วางบิล') || job.department_routing === 'บัญชี';
        if (!isBilled) statusCounts[st] = (statusCounts[st] || 0) + 1; 
    });
    
    updateBilledCount(jobs);
    const grid = document.getElementById('sa_status_grid'); 
    const sortedStatuses = Object.keys(statusCounts).sort();
    if(sortedStatuses.length === 0) { grid.innerHTML = `<div class="col-span-full text-center py-4 text-slate-400 font-bold">ไม่มีงานค้าง 🎉</div>`; return; }

    grid.innerHTML = sortedStatuses.map(st => `<div onclick="openSAFilteredModal('${st}')" class="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex justify-between items-center cursor-pointer hover:border-purple-400 hover:shadow-sm transition group"><span class="text-[10px] font-bold text-slate-600 group-hover:text-purple-700 truncate w-3/4">${st.replace(/[0-9.]/g, '')}</span><span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-black shadow-inner">${statusCounts[st]}</span></div>`).join('');
}

function openSAFilteredModal(statusType) {
    const saJobs = allJobsData.filter(j => (j.sa_owner || "ไม่ระบุ SA") === currentViewSA);
    const fMonth = document.getElementById('sa_cal_month').value;
    const fYear = document.getElementById('sa_cal_year').value;
    let jobsToShow = []; let vType = 'general';

    if (statusType === 'Billed') { 
        jobsToShow = saJobs.filter(job => {
            const st = job.job_status || "";
            const isBilled = st.includes('ชำระเงินสด') || st.includes('ออกบิล') || st.includes('วางบิล');
            if (isBilled && getValidDateStr(job.billing_date)) {
                const d = new Date(job.billing_date);
                return (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear);
            } return false;
        });
        document.getElementById('modal_status_name').innerText = `งานปิดบิลแล้ว`; vType = 'finance';
    } else if (statusType === 'WaitBill') {
        jobsToShow = saJobs.filter(job => {
            if ((job.job_status || "").includes('รอออกบิล')) {
                let jobDate = job.delivery_date || job.repair_finish_date || job.target_finish_date || job.arrived_date;
                if (jobDate) {
                    const d = new Date(jobDate);
                    return (String(d.getMonth() + 1).padStart(2, '0') === fMonth && String(d.getFullYear()) === fYear);
                }
            } return false;
        });
        document.getElementById('modal_status_name').innerText = `งานรอปิดบิล`; vType = 'finance';
    } else { 
        jobsToShow = saJobs.filter(j => j.job_status === statusType); 
        document.getElementById('modal_status_name').innerText = `สถานะ: ${statusType}`; 
    }
    renderJobTableInModal(jobsToShow, vType); 
    document.getElementById('jobListModal').classList.remove('hidden');
}

// ---- Parked Cars ----
function renderSAParkedCars(jobs) {
    const tbody = document.getElementById('sa_parked_body'); 
    const parkedCars = jobs.filter(j => j.is_parked === 'จอดซ่อม' && !(j.job_status||'').includes('ปิดงาน')); 

    if(parkedCars.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีรถจอดซ่อมในศูนย์</td></tr>`; 
        return; 
    }

    tbody.innerHTML = parkedCars.map(j => `
        <tr class="hover:bg-amber-50/50 transition-colors">
            <td class="font-black text-amber-600 text-center px-2 py-2">${j.car_plate || '-'}</td>
            <td class="font-bold text-slate-800 text-[11px] px-2">${j.car_brand} ${j.car_model || ''}</td>
            <td class="truncate max-w-[120px] font-medium text-xs px-2" title="${j.customer_name}">${j.customer_name || '-'}</td>
            <td class="font-bold text-xs px-2"><span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm">${j.job_status || '-'}</span></td>
            <td class="font-bold text-orange-600 text-xs px-2"><i class="fa-solid fa-wrench"></i> ${j.department_routing || 'รอระบุ'}</td>
            <td class="text-[10px] text-blue-700 font-bold leading-tight px-2 py-1">
                <span class="text-blue-900 font-black">M:</span> ${j.main_part_name||'-'}<br>
                <span class="text-amber-900 font-black">S:</span> ${j.sub_part_name||'-'}
            </td>
        </tr>
    `).join('');
}


// =====================================
// 🌟 THE NEW PO TRACKING FOR SA (Accordian + Dynamic Editor) 🌟
// =====================================
function renderSAPOTracking(saJobs) {
    const tbody = document.getElementById('sa_po_body');
    
    // ดึงเฉพาะรถที่มีอะไหล่ (จากตาราง allPartOrders) และไม่ถูกยกเลิก 
    // หรือรถที่มีสถานะ 'สั่งอะไหล่' ค้างอยู่
    const relevantJobs = saJobs.filter(job => {
        const hasPO = allPartOrders.some(po => po.car_plate === job.car_plate && po.order_status !== 'ยกเลิก');
        return hasPO || (job.job_status || '').includes('สั่งอะไหล่');
    });

    if (relevantJobs.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีรายการสั่งซื้ออะไหล่</td></tr>`; return; 
    }

    relevantJobs.sort((a,b) => new Date(b.arrived_date || b.contact_date || 0) - new Date(a.arrived_date || a.contact_date || 0));

    let finalHtml = '';

    relevantJobs.forEach((job, index) => {
        const jobPOs = allPartOrders.filter(po => po.car_plate === job.car_plate && po.order_status !== 'ยกเลิก');
        const rowId = `part_group_${index}`;

        // หา Worst Status ของคันนั้นๆ (รอสั่ง > รอของ > เข้าครบ)
        let worstStatus = 'อะไหล่มาครบแล้ว';
        const statuses = jobPOs.map(i => i.order_status || '');
        if (jobPOs.length === 0) worstStatus = 'รอสั่งซื้อ';
        else if (statuses.includes('รอสั่งซื้อ')) worstStatus = 'รอสั่งซื้อ';
        else if (statuses.includes('ติด Back Order')) worstStatus = 'ติด Back Order';
        else if (statuses.includes('รออะไหล่')) worstStatus = 'รออะไหล่';
        else if (statuses.some(s => !s.includes('ครบ') && !s.includes('มีของ'))) {
            worstStatus = statuses.find(s => !s.includes('ครบ') && !s.includes('มีของ')) || 'รออะไหล่';
        }

        let mainBadgeClass = 'bg-amber-50 text-amber-700 border-amber-300';
        if (worstStatus === 'รอสั่งซื้อ' || worstStatus === 'รออะไหล่' || worstStatus === 'ติด Back Order') {
            mainBadgeClass = 'bg-red-50 text-red-700 border-red-300';
        } else if (worstStatus.includes('ครบ') || worstStatus.includes('มีของ')) {
            mainBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
        }

        const arrDate = job.arrived_date ? job.arrived_date.split('T')[0] : (job.contact_date ? job.contact_date.split('T')[0] : '-');

        // Main Row (คลิกแล้วจะ Dropdown ลงมา)
        finalHtml += `
            <tr class="hover:bg-amber-50/80 transition-colors border-b border-slate-200 cursor-pointer font-medium" onclick="togglePartAccordion('${rowId}')">
                <td class="text-center px-3 py-3 font-black text-amber-800"><span class="bg-amber-100 border border-amber-300 rounded px-2 py-1 shadow-sm">${job.car_plate || '-'}</span></td>
                <td class="text-center font-bold text-slate-700 px-3 py-3 font-mono">${arrDate}</td>
                <td class="text-center font-bold text-slate-700 px-3 py-3">${job.car_model || '-'}</td>
                <td class="text-center font-bold text-slate-600 px-3 py-3 font-mono text-[11px]">${job.vin_no || '-'}</td>
                <td class="px-4 py-3"><div class="font-bold text-slate-800 text-xs truncate max-w-[140px]">${job.customer_name || '-'}</div></td>
                <td class="text-center font-mono font-bold text-slate-600 px-3 py-3 text-[11px]">${job.qt_no || '-'}</td>
                <td class="text-center font-mono font-bold text-slate-600 px-3 py-3 text-[11px]">${job.so_no || '-'}</td>
                <td class="px-4 py-3 align-middle"><span class="inline-flex items-center px-3 py-1 rounded-md border text-xs font-black shadow-sm ${mainBadgeClass}">${worstStatus}</span> <span class="text-[10px] text-slate-500 font-bold ml-2">(${jobPOs.length} ชิ้น)</span> <i id="icon_${rowId}" class="fa-solid fa-chevron-right text-slate-400 transition-transform duration-200 ml-2"></i></td>
                <td class="text-center px-3 py-3" onclick="event.stopPropagation()">
                    <button onclick="openSAKeyDeskModal('${job.id}')" class="bg-[#00320D] text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-table-cells"></i> โต๊ะคีย์</button>
                </td>
            </tr>
        `;

        // Sub Row (Accordion Content)
        let subRowsHtml = '';
        if (jobPOs.length === 0) {
            subRowsHtml = `<tr><td colspan="7" class="text-center py-4 text-rose-500 font-bold text-xs"><i class="fa-solid fa-circle-exclamation"></i> ยังไม่มีการคีย์รายการอะไหล่เข้าระบบ (กรุณากด 'โต๊ะคีย์' เพื่อเพิ่มข้อมูล)</td></tr>`;
        } else {
            subRowsHtml = jobPOs.map(item => {
                const st = item.order_status || 'รออัปเดต';
                let badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
                if (st === 'รอสั่งซื้อ' || st === 'รออะไหล่' || st === 'ติด Back Order') badgeClass = 'bg-red-100 text-red-800 border-red-300';
                else if (st.includes('ครบ') || st.includes('มีของ')) badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';

                const orderDate = item.order_date ? item.order_date.split('T')[0] : '-';
                const estDate = item.est_arrival_date ? item.est_arrival_date.split('T')[0] : '-';

                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                        <td class="px-3 py-2 text-center font-mono font-bold text-purple-700 bg-purple-50/50">${item.epc_no || '-'}</td>
                        <td class="px-3 py-2 font-mono font-bold text-blue-700">${item.part_no || '-'}</td>
                        <td class="px-3 py-2 font-bold text-slate-700 max-w-[220px] truncate" title="${item.part_name || '-'}">${item.part_name || '-'}</td>
                        <td class="px-3 py-2 text-center font-black text-amber-700">${item.qty_ordered || 1}</td>
                        <td class="px-3 py-2 text-center font-mono text-slate-600 font-bold">${orderDate}</td>
                        <td class="px-3 py-2 text-center font-mono text-emerald-700 font-bold">${estDate}</td>
                        <td class="px-3 py-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] border font-bold ${badgeClass}">${st}</span></td>
                    </tr>
                `;
            }).join('');
        }

        finalHtml += `
            <tr id="${rowId}" class="hidden bg-slate-100/70">
                <td colspan="9" class="p-3">
                    <div class="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-inner w-full max-w-[1000px] ml-auto">
                        <div class="bg-slate-200/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 border-b border-slate-300 flex justify-between items-center">
                            <span><i class="fa-solid fa-list-check text-blue-600 mr-1.5"></i>ตารางตรวจสอบสั่งอะไหล่: ${job.car_plate}</span>
                        </div>
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th class="px-3 py-2 text-center w-28">เลข EPC</th><th class="px-3 py-2 w-36">รหัสอะไหล่</th><th class="px-3 py-2">ชื่อรายการอะไหล่</th><th class="px-3 py-2 text-center w-16">จำนวน</th><th class="px-3 py-2 text-center w-28">วันที่สั่ง</th><th class="px-3 py-2 text-center w-28">กำหนดเข้า</th><th class="px-3 py-2 text-center w-32">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody>${subRowsHtml}</tbody>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = finalHtml;
    setTimeout(initResizableGreenGridColumns, 300);
}

window.filterPOTable = function(keyword) {
    const tbody = document.getElementById('sa_po_body');
    if (!tbody) return;
    const lowerKeyword = keyword.toLowerCase().trim();
    const mainRows = Array.from(tbody.querySelectorAll('tr[onclick^="togglePartAccordion"]'));
    
    mainRows.forEach(row => {
        const nextRow = row.nextElementSibling;
        let isMatch = false;

        if (lowerKeyword === '') isMatch = true;
        else {
            const mainText = row.innerText.toLowerCase();
            if (mainText.includes(lowerKeyword)) isMatch = true;
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

// =====================================
// View 3: Key Desk ProMax Modal
// =====================================
function openSAKeyDeskModal(jobId) {
    currentKeyDeskJobId = jobId;
    const job = masterJobsData.find(j => j.id == jobId);
    if(!job) return;

    document.getElementById('kd_plate').innerText = job.car_plate || '-';
    const jobPOs = allPartOrders.filter(po => po.car_plate === job.car_plate && po.order_status !== 'ยกเลิก');
    keyDeskRows = JSON.parse(JSON.stringify(jobPOs)); 

    if(keyDeskRows.length === 0) addSAKeyDeskRow(job);
    else renderSAKeyDeskTable();

    document.getElementById('saKeyDeskModal').classList.remove('hidden');
}

function addSAKeyDeskRow(jobObj = null) {
    let job = jobObj;
    if(!job) job = masterJobsData.find(j => j.id == currentKeyDeskJobId);
    
    keyDeskRows.push({
        order_id: 'new_' + Date.now(),
        epc_no: '', part_no: '', qty_ordered: 1, part_name: '', part_main_no: '', part_type: 'อะไหล่รอง',
        qt_no: job?.qt_no || '', so_no: job?.so_no || '', order_status: 'รอสั่งซื้อ', est_arrival_date: '',
        is_new: true, car_plate: job?.car_plate, vin_no: job?.vin_no, car_model: job?.car_model, sa_owner: job?.sa_owner, job_id: job?.id
    });
    renderSAKeyDeskTable();
}

window.autoFillSAKeyDeskName = function(inputEl) {
    const pNo = inputEl.value.trim().toUpperCase();
    if (!pNo) return;
    const tr = inputEl.closest('tr');
    const matched = allMasterPartsCache.find(x => x.part_no && x.part_no.toUpperCase() === pNo);
    
    if(matched) {
        tr.querySelector('[data-field="part_name"]').value = matched.part_name || '';
        tr.querySelector('[data-field="part_main_no"]').value = matched.part_main_no || '';
        
        const rowId = tr.dataset.id;
        const r = keyDeskRows.find(x => x.order_id == rowId);
        if (r) {
            r.part_name = matched.part_name;
            r.part_main_no = matched.part_main_no;
        }
    }
};

function removeSAKeyDeskRow(id) {
    if(String(id).startsWith('new_')) keyDeskRows = keyDeskRows.filter(r => r.order_id !== id);
    else { const row = keyDeskRows.find(r => r.order_id === id); if(row) row._delete = true; }
    renderSAKeyDeskTable();
}

function renderSAKeyDeskTable() {
    const tbody = document.getElementById('kd_tbody');
    let html = '';
    
    const statusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
    const typeOpts = ['อะไหล่หลัก', 'อะไหล่รอง', 'อะไหล่สิ้นเปลือง'];

    keyDeskRows.filter(r => !r._delete).forEach((row) => {
        let stOptsHtml = statusOptionsHtml;
        if(row.order_status && !stOptsHtml.includes(`value="${row.order_status}"`)) stOptsHtml = `<option value="${row.order_status}">${row.order_status}</option>` + stOptsHtml;
        stOptsHtml = stOptsHtml.replace(`value="${row.order_status || 'รอสั่งซื้อ'}"`, `value="${row.order_status || 'รอสั่งซื้อ'}" selected`);

        let tpOptsHtml = typeOpts.map(t => `<option value="${t}" ${row.part_type===t?'selected':''}>${t}</option>`).join('');
        const etaVal = row.est_arrival_date ? String(row.est_arrival_date).split('T')[0] : '';

        html += `
            <tr class="hover:bg-slate-50 transition-colors" data-id="${row.order_id}">
                <td class="p-0 border border-slate-200"><input type="text" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-mono uppercase outline-none focus:bg-amber-50" data-field="epc_no" value="${row.epc_no || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" list="master_parts_datalist" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-mono font-bold text-blue-700 uppercase outline-none focus:bg-amber-50" data-field="part_no" value="${row.part_no || ''}" onchange="autoFillSAKeyDeskName(this)"></td>
                <td class="p-0 border border-slate-200"><input type="number" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-black text-amber-700 outline-none focus:bg-amber-50" data-field="qty_ordered" value="${row.qty_ordered || 1}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="kd-input w-full p-2.5 border-0 bg-transparent text-xs font-bold outline-none focus:bg-amber-50" data-field="part_name" value="${row.part_name || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-mono outline-none focus:bg-amber-50" data-field="part_main_no" value="${row.part_main_no || ''}"></td>
                <td class="p-0 border border-slate-200"><select class="kd-input w-full p-2.5 border-0 bg-transparent text-[11px] font-bold outline-none cursor-pointer focus:bg-amber-50" data-field="part_type">${tpOptsHtml}</select></td>
                <td class="p-0 border border-slate-200"><input type="text" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-mono outline-none focus:bg-amber-50" data-field="qt_no" value="${row.qt_no || ''}"></td>
                <td class="p-0 border border-slate-200"><input type="text" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-mono outline-none focus:bg-amber-50" data-field="so_no" value="${row.so_no || ''}"></td>
                <td class="p-0 border border-slate-200"><select class="kd-input w-full p-2.5 border-0 bg-transparent text-[11px] font-bold outline-none cursor-pointer focus:bg-amber-50 text-[#00320D]" data-field="order_status">${stOptsHtml}</select></td>
                <td class="p-0 border border-slate-200"><input type="date" class="kd-input w-full p-2.5 border-0 bg-transparent text-center text-xs font-mono outline-none focus:bg-amber-50" data-field="est_arrival_date" value="${etaVal}"></td>
                <td class="p-0 text-center border border-slate-200"><button onclick="removeSAKeyDeskRow('${row.order_id}')" class="text-red-400 hover:text-red-600 transition bg-white border border-slate-200 shadow-sm rounded p-1.5"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    document.querySelectorAll('.kd-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const tr = e.target.closest('tr');
            const rowId = tr.dataset.id;
            const field = e.target.dataset.field;
            const r = keyDeskRows.find(x => x.order_id == rowId);
            if(r) r[field] = e.target.value;
        });
    });
}

async function saveSAKeyDesk() {
    const btn = document.getElementById('btn_save_kd');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

    try {
        const toDelete = keyDeskRows.filter(r => r._delete && !r.is_new);
        for(const row of toDelete) await fetch(`${API_BASE_URL}/api/part-orders/${row.order_id}`, { method: 'DELETE' });

        const toSave = keyDeskRows.filter(r => !r._delete);
        for(const row of toSave) {
            if(!row.part_name && !row.part_no) continue; 
            const payload = { ...row };
            const today = new Date().toISOString().split('T')[0];
            if(row.is_new) {
                payload.order_date = payload.order_date || today;
                payload.branch_name = userBranch;
                await fetch(`${API_BASE_URL}/api/part-orders`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            } else {
                await fetch(`${API_BASE_URL}/api/part-orders/${row.order_id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            }
        }
        showToast('บันทึกข้อมูลสำเร็จ!', 'success');
        closeModal('saKeyDeskModal');
        await loadJobsData(); 
    } catch(e) {
        showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูล';
        btn.disabled = false;
    }
}

// ---- Modal general tables ----
function renderJobTableInModal(jobs, viewType = 'general') {
    const thead = document.querySelector('#jobListModal thead tr');
    const tbody = document.getElementById('modal_job_table');
    if (jobs.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-500 font-bold">ไม่มีข้อมูล</td></tr>`; return; }

    if (viewType === 'finance') {
        thead.innerHTML = `<th class="px-4 py-2 font-bold text-left">ทะเบียนรถ</th><th class="px-4 py-2 font-bold text-left">ลูกค้า / ยี่ห้อรถ</th><th class="px-4 py-2 font-bold text-center">จำนวนชิ้น(หลัก/รอง)</th><th class="px-4 py-2 font-bold text-right">ค่าแรง</th><th class="px-4 py-2 font-bold text-right">ค่าอะไหล่</th><th class="px-4 py-2 font-bold text-right">งานนอก</th><th class="px-4 py-2 font-bold text-center">จัดการ</th>`;
    } else if (viewType === 'overdue') {
        thead.innerHTML = `<th class="px-4 py-2 font-bold text-left">ทะเบียนรถ</th><th class="px-4 py-2 font-bold text-left">ลูกค้า / SA</th><th class="px-4 py-2 font-bold text-left">วันที่รถเข้าจอดอู่</th><th class="px-4 py-2 font-bold text-left">เป้าซ่อมเสร็จ</th><th class="px-4 py-2 font-bold text-left">กำหนดส่งมอบ</th><th class="px-4 py-2 font-bold text-center">จัดการ</th>`;
    } else {
        thead.innerHTML = `<th class="px-4 py-2 font-bold text-left">ทะเบียนรถ</th><th class="px-4 py-2 font-bold text-left">ยี่ห้อ/รุ่น</th><th class="px-4 py-2 font-bold text-left">ลูกค้า / SA</th><th class="px-4 py-2 font-bold text-left">ความเสียหาย</th><th class="px-4 py-2 font-bold text-left">อัปเดตสถานะ (ERP)</th><th class="px-4 py-2 font-bold text-center">จัดการ</th>`;
    }

    let safeOptsGlobal = globalStatusOptionsHtml;
    
    tbody.innerHTML = jobs.map(j => {
        const formatMoney = (val) => Number(val || 0).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const mainQty = Number(j.main_part_qty) || (j.main_part_name ? j.main_part_name.split(',').filter(Boolean).length : 0);
        const subQty = Number(j.sub_part_qty) || (j.sub_part_name ? j.sub_part_name.split(',').filter(Boolean).length : 0);
        const formatDt = (d) => { const validStr = getValidDateStr(d); return validStr ? new Date(validStr).toLocaleDateString('th-TH') : '-'; };

        if (viewType === 'finance') {
            return `<tr class="hover:bg-emerald-50/50 transition cursor-pointer border-b border-slate-100" onclick="goToEditJob('${j.id}')">
                <td class="px-4 py-3 font-bold text-[#00320D]"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td>
                <td class="px-4 py-3 font-bold text-slate-800 text-[11px] leading-tight">${j.customer_name || '-'}<br><span class="text-slate-500 font-medium">${j.car_brand} ${j.car_model || ''}</span></td>
                <td class="px-4 py-3 text-center text-xs font-bold text-slate-700"><span class="text-blue-600">${mainQty}</span> / <span class="text-amber-600">${subQty}</span></td>
                <td class="px-4 py-3 text-right text-xs font-mono font-bold text-emerald-600">${formatMoney(j.cost_labor || j.labor_total || 0)}</td>
                <td class="px-4 py-3 text-right text-xs font-mono font-bold text-purple-600">${formatMoney(j.cost_part || j.part_total || 0)}</td>
                <td class="px-4 py-3 text-right text-xs font-mono font-bold text-orange-600">${formatMoney(j.cost_external || j.outsource_total || 0)}</td>
                <td class="px-4 py-3 text-center"><button onclick="event.stopPropagation(); goToEditJob('${j.id}')" class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> เปิด</button></td>
            </tr>`;
        } else if (viewType === 'overdue') {
            return `<tr class="hover:bg-red-50 transition cursor-pointer border-b border-slate-100" onclick="goToEditJob('${j.id}')">
                <td class="px-4 py-3 font-bold text-[#00320D]"><span class="bg-red-100 border border-red-300 text-red-700 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td>
                <td class="px-4 py-3 text-[11px] leading-tight"><div class="font-bold text-slate-700">${j.customer_name || '-'}</div><div class="text-amber-600 font-bold mt-0.5">${j.sa_owner || '-'}</div></td>
                <td class="px-4 py-3 text-xs font-mono font-bold text-blue-600">${formatDt(j.arrived_date)}</td>
                <td class="px-4 py-3 text-xs font-mono font-bold text-amber-600">${formatDt(j.target_finish_date)}</td>
                <td class="px-4 py-3 text-xs font-mono font-bold text-purple-600">${formatDt(j.delivery_date)}</td>
                <td class="px-4 py-3 text-center"><button onclick="event.stopPropagation(); goToEditJob('${j.id}')" class="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-triangle-exclamation"></i> เคลียร์ด่วน</button></td>
            </tr>`;
        } else {
            const damageColor = j.damage_level === 'หนัก' ? 'text-red-600' : (j.damage_level === 'กลาง' ? 'text-amber-500' : 'text-emerald-600');
            let safeStatus = j.job_status || ''; 
            let safeOptions = safeOptsGlobal;
            if(!safeOptions.includes(`value="${safeStatus}"`)) { safeOptions = `<option value="${safeStatus}">${safeStatus}</option>` + safeOptions; } 
            safeOptions = safeOptions.replace(`value="${safeStatus}"`, `value="${safeStatus}" selected`); 

            return `<tr class="hover:bg-emerald-50/50 transition cursor-pointer border-b border-slate-100" onclick="goToEditJob('${j.id}')"><td class="px-4 py-3 font-bold text-[#00320D]"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td><td class="px-4 py-3 font-bold text-slate-800 text-[11px] leading-tight">${j.car_brand} <br><span class="text-slate-500 font-medium">${j.car_model || ''}</span></td><td class="px-4 py-3 text-[11px] leading-tight"><div class="font-bold text-slate-700 truncate max-w-[150px]" title="${j.customer_name}">${j.customer_name || '-'}</div><div class="text-[10px] text-amber-600 font-bold mt-0.5"><i class="fa-solid fa-user-tie"></i> ${j.sa_owner || '-'}</div></td><td class="px-4 py-3 text-xs font-bold ${damageColor}">${j.damage_level || '-'}</td><td class="px-4 py-3 text-[10px] font-bold text-slate-700"><select onclick="event.stopPropagation()" onchange="fastUpdateJob('${j.id}', 'job_status', this.value)" class="bg-slate-50 border border-slate-300 rounded px-2 py-1 outline-none focus:border-amber-500 w-full cursor-pointer font-bold text-[#00320D]">${safeOptions}</select></td><td class="px-4 py-3 text-center"><button onclick="event.stopPropagation(); goToEditJob('${j.id}')" class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> เปิด</button></td></tr>`;
        }
    }).join('');
}

function initResizableGreenGridColumns() {
    const cols = document.querySelectorAll('.excel-table-green th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer-green'); if(!resizer) return;
        let startX = 0; let startWidth = 0;
        const onMouseDown = (e) => { e.stopPropagation(); e.preventDefault(); startX = e.clientX; startWidth = col.offsetWidth; resizer.classList.add('resizing'); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); };
        const onMouseMove = (e) => { const newWidth = Math.max(40, startWidth + (e.clientX - startX)); col.style.width = `${newWidth}px`; col.style.minWidth = `${newWidth}px`; };
        const onMouseUp = () => { resizer.classList.remove('resizing'); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
        resizer.removeEventListener('mousedown', onMouseDown); resizer.addEventListener('mousedown', onMouseDown);
    });
}