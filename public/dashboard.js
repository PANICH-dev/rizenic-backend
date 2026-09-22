// =====================================
// 1. GLOBAL VARIABLES & CORE SETUP
// =====================================
const API_BASE_URL = window.location.origin;
let allJobs = []; 
let filteredJobs = []; 
let allPartOrders = [];
let filteredPartOrders = [];
let allStatuses = [];
let allQuotas = []; 
let globalStatusOptionsHtml = ''; 

let statusChartInstance = null;
let insuranceChartInstance = null;
let financeChartInstance = null;
let paymentChartInstance = null; 
let dailyLineChartInstance = null;
let damageChartInstance = null;
let partsStatusChartInstance = null;
let mechanicChartInstance = null;

let userRole = '';
let userBranch = '';

const activeProcessStatuses = [
    '01.ติดต่อสอบถาม', '02.รอเสนอประกัน', '03.รอประกันอนุมัติ', 
    '04.รอลูกค้าอนุมัติ', '05.อนุมัติแล้ว', '06.สั่งอะไหล่', 
    '07.รอนัดหมายเข้าซ่อม', '08.นัดหมายแล้วรอเข้าซ่อม', '09.จอดรอเข้าซ่อม', 
    '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ'
];

const stationLevels = ["ส่งจ๊อบ", "01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "07.QC", "08.แม็ก", "09.กระจก", "10.ฟิล์ม", "11.พักซ่อม", "12.รอส่งมอบ"];

// =====================================
// 2. HELPER FUNCTIONS
// =====================================
function isTrue(val) {
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase();
    return strVal === 'TRUE' || strVal === '1' || val === true || val === 1;
}

function isSameBranch(jobBranch, selectedBranch) {
    if (!selectedBranch || selectedBranch === 'all') return true;
    if (!jobBranch) return false;
    const jb = String(jobBranch).trim().toLowerCase();
    const sb = String(selectedBranch).trim().toLowerCase();
    if (jb === sb) return true;
    if ((sb.includes('navamin') || sb.includes('นวมินทร์')) && (jb.includes('navamin') || jb.includes('นวมินทร์'))) return true;
    if ((sb.includes('rangsit') || sb.includes('รังสิต')) && (jb.includes('rangsit') || jb.includes('รังสิต'))) return true;
    return false;
}

function getFirstDayOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function getLastDayOfMonth() {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
}

function isDateInRange(dateStr, start, end) {
    if(!dateStr || String(dateStr).trim() === '') return false;
    const dStr = dateStr.split('T')[0];
    if(start && dStr < start) return false;
    if(end && dStr > end) return false;
    return true;
}

function closeModal(modalId) { 
    const el = document.getElementById(modalId);
    if(el) el.classList.add('hidden'); 
}

function logout() { 
    sessionStorage.clear(); 
    window.location.href = 'index.html'; 
}

function computeHighestStationIFS(j) {
    if(isTrue(j.station_ready)) return "12.รอส่งมอบ";
    if(isTrue(j.station_pak)) return "11.พักซ่อม";
    if(isTrue(j.station_film)) return "10.ฟิล์ม";
    if(isTrue(j.station_kraj)) return "09.กระจก";
    if(isTrue(j.station_mag)) return "08.แม็ก";
    if(isTrue(j.station_qc)) return "07.QC";
    if(isTrue(j.station_kat)) return "06.ขัดสี";
    if(isTrue(j.station_prak)) return "05.ประกอบ";
    if(isTrue(j.station_pon)) return "04.พ่นสี";
    if(isTrue(j.station_puan)) return "03.เตรียมพื้น";
    if(isTrue(j.station_pou)) return "02.โป๊ว";
    if(isTrue(j.station_kho)) return "01.เคาะ";
    return "ส่งจ๊อบ"; 
}

// =====================================
// 3. INIT & DATA FETCHING
// =====================================
document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html'; return;
    }
    
    userRole = sessionStorage.getItem('emp_role') || '';
    userBranch = sessionStorage.getItem('branch_name') || sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

    const rStr = String(userRole).toLowerCase();
    const navAdmin = document.getElementById('nav_admin');
    
    if (navAdmin) {
        if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
            navAdmin.classList.remove('hidden');
        } else {
            navAdmin.classList.add('hidden');
        }
    }

    if(document.getElementById('display_emp_name')) document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'ไม่ระบุชื่อ';
    if(document.getElementById('display_branch')) document.getElementById('display_branch').innerText = userBranch;
    
    const today = new Date();
    if(document.getElementById('current_date_display')) {
        document.getElementById('current_date_display').innerText = today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    if(document.getElementById('dash_start_date')) document.getElementById('dash_start_date').value = getFirstDayOfMonth();
    if(document.getElementById('dash_end_date')) document.getElementById('dash_end_date').value = getLastDayOfMonth();
    if(document.getElementById('report_start_date')) document.getElementById('report_start_date').value = getFirstDayOfMonth();
    if(document.getElementById('report_end_date')) document.getElementById('report_end_date').value = getLastDayOfMonth();

    setupBranchDropdown();
    fetchDashboardData();
});

function setupBranchDropdown() {
    const filterSelect = document.getElementById('branchFilter');
    if (!filterSelect) return;
    
    const rStr = String(userRole).toLowerCase();
    if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
        filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>`;
        filterSelect.disabled = false;
    } else {
        filterSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`;
        filterSelect.disabled = true;
    }
}

async function fetchDashboardData() {
    try {
        const resJobs = await fetch(`${API_BASE_URL}/api/reports`);
        if (resJobs.ok) {
            const rawJobs = await resJobs.json();
            const jobsArray = Array.isArray(rawJobs) ? rawJobs : (rawJobs.data || []);
            allJobs = jobsArray.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
        }

        const resParts = await fetch(`${API_BASE_URL}/api/part-orders`).catch(() => null);
        if (resParts && resParts.ok) { 
            const rawParts = await resParts.json(); 
            allPartOrders = Array.isArray(rawParts) ? rawParts : (rawParts.data || []);
        }

        const statRes = await fetch(`${API_BASE_URL}/api/statuses`).catch(() => null);
        if (statRes && statRes.ok) { 
            const rawStat = await statRes.json();
            allStatuses = Array.isArray(rawStat) ? rawStat : (rawStat.data || []);
            globalStatusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }

        const rStr = String(userRole).toLowerCase();
        if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
            const uniqueBranches = [...new Set(allJobs.map(j => j.branch_name).filter(b => b))];
            const filterSelect = document.getElementById('branchFilter');
            if (filterSelect) {
                const savedVal = filterSelect.value;
                filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>`;
                uniqueBranches.forEach(b => filterSelect.innerHTML += `<option value="${b}">${b}</option>`);
                if(savedVal && (savedVal === 'all' || uniqueBranches.includes(savedVal))) filterSelect.value = savedVal;
            }
        }
    } catch (err) { 
        console.error("โหลดข้อมูลแดชบอร์ดพัง:", err); 
    } finally {
        applyFilters(); 
    }
}

function applyFilters() {
    const filterSelect = document.getElementById('branchFilter');
    const selectedBranch = filterSelect ? filterSelect.value : 'all';
    
    const startDate = document.getElementById('dash_start_date')?.value || getFirstDayOfMonth();
    const endDate = document.getElementById('dash_end_date')?.value || getLastDayOfMonth();
    
    const chartBranchLabel = document.getElementById('chartBranchLabel');
    if (chartBranchLabel) {
        chartBranchLabel.innerText = selectedBranch === 'all' ? 'ทุกสาขา' : selectedBranch;
    }

    if (selectedBranch === 'all') {
        filteredJobs = [...allJobs];
        filteredPartOrders = [...allPartOrders];
    } else {
        filteredJobs = allJobs.filter(j => isSameBranch(j.branch_name, selectedBranch));
        filteredPartOrders = allPartOrders.filter(o => isSameBranch(o.branch_name, selectedBranch));
    }

    if(typeof renderERPStatuses === 'function') renderERPStatuses(filteredJobs);
    if(typeof renderStationSummary === 'function') renderStationSummary(filteredJobs);
    if(typeof renderPartsTracking === 'function') renderPartsTracking(filteredPartOrders);

    if(typeof renderKPIs === 'function') renderKPIs(startDate, endDate);
    if(typeof renderDailyReport === 'function') renderDailyReport(); 
    if(typeof renderDailyLineChart === 'function') renderDailyLineChart(startDate, endDate); 
    if(typeof renderStatusChart === 'function') renderStatusChart();
    if(typeof renderInsuranceChart === 'function') renderInsuranceChart();
    if(typeof renderDamageChart === 'function') renderDamageChart(startDate, endDate);   
    if(typeof renderPaymentChart === 'function') renderPaymentChart(startDate, endDate);   
    if(typeof renderPartsStatusChart === 'function') renderPartsStatusChart();                 
    if(typeof renderMechanicChart === 'function') renderMechanicChart();                    
    if(typeof renderFinanceChart === 'function') renderFinanceChart(startDate, endDate);
    
    if(typeof renderSASection === 'function') renderSASection();
    if(typeof renderStationTable === 'function') renderStationTable(); 
    if(typeof renderParkedCars === 'function') renderParkedCars();
    if(typeof renderCalendarByRange === 'function') renderCalendarByRange(startDate, endDate);
}

// 🎯 กล่อง ERP: เรียงลำดับตามที่กำหนด (01 - 23)
function renderERPStatuses(jobs) {
    const statusCounts = {};
    jobs.forEach(job => {
        const st = job.job_status || "ไม่ระบุสถานะ";
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const grid = document.getElementById('erp_status_grid');
    if(!grid) return;

    // 🌟 ลำดับที่นายต้องการแบบเป๊ะๆ 🌟
    const exactOrder = [
        "01", "02", "03", "04", "05", "06", "07", "08", "09", "23", 
        "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", 
        "20", "21", "22"
    ];

    const getSortIndex = (st) => {
        const prefix = st.substring(0, 2);
        const idx = exactOrder.indexOf(prefix);
        return idx !== -1 ? idx : 999;
    };

    // 🌟 เรียงลำดับตาม exactOrder
    const sortedStatuses = Object.entries(statusCounts).sort((a, b) => getSortIndex(a[0]) - getSortIndex(b[0]));

    if(sortedStatuses.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-6 font-bold">ไม่มีงานค้าง</div>`;
        return;
    }

    grid.innerHTML = sortedStatuses.map(([st, count]) => {
        const cleanStatus = st.replace(/^[0-9.]+\s*/, '');
        
        let bgClass = "bg-white border-slate-200";
        let textClass = "text-blue-700";
        let iconClass = "text-slate-300";
        let pulse = "";

        if (count >= 10) {
            bgClass = "bg-rose-50 border-rose-300"; 
            textClass = "text-rose-700";
            iconClass = "text-rose-500";
            pulse = "animate-pulse";
        } else if (count >= 5) {
            bgClass = "bg-orange-50 border-orange-300"; 
            textClass = "text-orange-700";
            iconClass = "text-orange-500";
        }

        return `
        <div onclick="openStatusModal('${st}')" class="${bgClass} border shadow-sm rounded-lg p-3 flex flex-col justify-between hover:shadow-md transition cursor-pointer transform hover:-translate-y-1">
            <span class="text-[10px] sm:text-xs font-bold text-slate-600 truncate mb-2" title="${st}">${cleanStatus}</span>
            <div class="flex justify-between items-end">
                <i class="fa-solid fa-car-side ${iconClass} text-lg"></i>
                <span class="text-xl sm:text-2xl font-black ${textClass} leading-none ${pulse}">${count}</span>
            </div>
        </div>`;
    }).join('');
}

function renderStationSummary(jobs) {
    const repairingJobs = jobs.filter(job => (job.job_status || '').includes('กำลังซ่อม'));
    const stationCounts = {
        '01.เคาะ': 0, '02.โป๊ว': 0, '03.เตรียมพื้น': 0, '04.พ่นสี': 0, 
        '05.ประกอบ': 0, '06.ขัดสี': 0, '07.QC': 0, '08.แม็ก': 0, 
        '09.กระจก': 0, '10.ฟิล์ม': 0, '11.พักซ่อม': 0, '12.รอส่งมอบ': 0
    };

    repairingJobs.forEach(job => {
        const st = job.calculated_station || '';
        if (stationCounts[st] !== undefined) stationCounts[st]++;
    });

    for (const [station, count] of Object.entries(stationCounts)) {
        const prefix = station.substring(0, 2); 
        const el = document.getElementById(`stat_${prefix}`);
        if(el) {
            el.innerText = count;
            if(count >= 10) el.classList.add('text-red-500', 'animate-pulse');
            else el.classList.remove('text-red-500', 'animate-pulse');
        }
    }
}

function renderPartsTracking(partOrders) {
    const carStatusMap = {};

    partOrders.forEach(po => {
        const st = po.order_status || '';
        if (st === 'ยกเลิก') return;

        const plate = (po.car_plate || 'ไม่ระบุ').trim();
        if (!carStatusMap[plate]) {
            carStatusMap[plate] = { statuses: [] };
        }
        carStatusMap[plate].statuses.push(st);
    });

    let readyCarsCount = 0;   
    let waitingCarsCount = 0; 

    Object.values(carStatusMap).forEach(car => {
        const isWaiting = car.statuses.some(st => st.includes('รอ') || st.includes('สั่ง') || st.includes('Back Order'));
        
        if (isWaiting) {
            waitingCarsCount++; 
        } else if (car.statuses.length > 0) {
            readyCarsCount++; 
        }
    });

    const elReady = document.getElementById('dash_po_ready');
    const elWaiting = document.getElementById('dash_po_waiting');

    if(elReady) elReady.innerText = `${readyCarsCount} คัน`;
    if(elWaiting) {
        elWaiting.innerText = `${waitingCarsCount} คัน`;
        if(waitingCarsCount > 0) {
            elWaiting.classList.add('text-rose-600', 'animate-pulse');
        } else {
            elWaiting.classList.remove('text-rose-600', 'animate-pulse');
            elWaiting.classList.add('text-amber-600');
        }
    }
}
// =====================================
// 📱 LINE MESSAGING API REPORT SYSTEM
// =====================================
async function sendReportToLine(branchName) {
    const btnId = `btnSendLine_${branchName}`;
    const btn = document.getElementById(btnId);
    const originalHtml = btn ? btn.innerHTML : '';
    
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-base"></i> กำลังส่ง...';
        btn.disabled = true;
    }

    let msg = '';

    try {
        const start = document.getElementById('report_start_date')?.value || getFirstDayOfMonth();
        const end = document.getElementById('report_end_date')?.value || getLastDayOfMonth();
        
        // 🎯 ดึงข้อมูลเฉพาะสาขาที่กดส่ง
        const branchJobs = allJobs.filter(j => isSameBranch(j.branch_name, branchName));

        // 📝 1. สร้างหัวรายงาน
        msg += `📋 RIZENIC Report\n`;
        msg += `🏢 สาขา: สาขา${branchName === 'Navamin' ? 'นวมินทร์' : 'รังสิต'}\n`;
        msg += `📅 ช่วงเวลา: ${start} ถึง ${end}\n\n`;

        // 📝 2. ดึงข้อมูล 3 หมวดหมู่หลัก (กรองโชว์เฉพาะรายการที่ > 0)
        if (window.currentReportDef) {
            msg += `👥 จำแนกประเภทลูกค้า\n`;
            window.currentReportDef.customers.forEach(item => {
                const count = branchJobs.filter(item.filter).length;
                if(count > 0) msg += `${item.icon} ${item.label}: ${count}\n`;
            });
            msg += `\n`;

            msg += `🛠️ สถานะงานซ่อม\n`;
            window.currentReportDef.workStatus.forEach(item => {
                const count = branchJobs.filter(item.filter).length;
                if(count > 0) msg += `${item.icon} ${item.label}: ${count}\n`;
            });
            msg += `\n`;

            msg += `💵 การเงิน & ออกบิล\n`;
            window.currentReportDef.finance.forEach(item => {
                const count = branchJobs.filter(item.filter).length;
                if(count > 0) msg += `${item.icon} ${item.label}: ${count}\n`;
            });
        }

        // 🔑 3. Token สำหรับ LINE Messaging API (Broadcast)
        const tokens = {
            'Navamin': '5+CtgK2jCINRJW0Ddz/18TrLbE1hq68iVdOyZTvgwYeQWA2okMHoFfPYUK4MlKMf1Y+JqSn4Bodqk7i0DThvO+DTOmwzsyiNxwGqTctqo/QJBlbdYsb97BF981TiVnNO6ufvV6767mS0qkzJWGKgegdB04t89/1O/w1cDnyilFU=',
            'Rangsit': 'uWGDH1BPHvILvBn7Hyeimv20W8ITfbUpGV2jfy1ujMUjvFxceSEtpM50S9vAcJmy05ybn6g/wHspfuTbfUuAI5UCB2RkifntfIeOT9EOo09FfQel63guAJgMs8zhAbbP0dq8fMENKirsWXoFzYMaXgdB04t89/1O/w1cDnyilFU='
        };
        const token = tokens[branchName];

        // 🚀 4. ยิง API Line Broadcast เพื่อส่งให้ทุกคนที่ติดตามบอทนี้
        const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                messages: [{ type: 'text', text: msg.trim() }]
            })
        });

        if(res.ok) {
            alert(`✅ ส่งรายงานสาขา ${branchName === 'Navamin' ? 'นวมินทร์' : 'รังสิต'} เข้า LINE เรียบร้อยแล้ว!`);
        } else {
            throw new Error("CORS or API Error");
        }

    } catch(e) {
        // 🛡️ 5. ระบบสำรอง: เบราว์เซอร์บล็อก (CORS) ให้ก๊อปปี้แทน
        if (msg) {
            await navigator.clipboard.writeText(msg.trim());
            alert(`⚠️ ระบบความปลอดภัยของเบราว์เซอร์ (CORS) ป้องกันการยิง API ตรงๆ ครับ\n\n✅ แต่ระบบได้ทำการ Copy รายงานตามรูปแบบเป๊ะๆ ไว้ให้แล้ว!\n\nนายกด "วาง (Paste)" ลงในกลุ่ม LINE เพื่อส่งรายงานได้เลยครับ!`);
        } else {
            alert('เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน');
        }
    } finally {
        if(btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}