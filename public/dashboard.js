Chart.register(ChartDataLabels);

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

let userRole = '';
let userBranch = '';

function isTrue(val) {
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase();
    return strVal === 'TRUE' || strVal === '1' || val === true || val === 1;
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

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

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

    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'ไม่ระบุชื่อ';
    document.getElementById('display_branch').innerText = userBranch;
    
    const today = new Date();
    document.getElementById('current_date_display').innerText = today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    
    document.getElementById('dash_start_date').value = getFirstDayOfMonth();
    document.getElementById('dash_end_date').value = getLastDayOfMonth();
    document.getElementById('report_start_date').value = getFirstDayOfMonth();
    document.getElementById('report_end_date').value = getLastDayOfMonth();

    setupBranchDropdown();
    fetchDashboardData();
});

function logout() { 
    sessionStorage.clear(); 
    window.location.href = 'index.html'; 
}

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
        allJobs = await resJobs.json();
        
        const resParts = await fetch(`${API_BASE_URL}/api/part-orders`).catch(() => null);
        if(resParts && resParts.ok) { allPartOrders = await resParts.json(); }

        const statRes = await fetch(`${API_BASE_URL}/api/statuses`).catch(() => null);
        if(statRes && statRes.ok) { 
            allStatuses = await statRes.json(); 
            globalStatusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        }

        const resQuotas = await fetch(`${API_BASE_URL}/api/quotas`).catch(() => null);
        if(resQuotas && resQuotas.ok) { allQuotas = await resQuotas.json(); }

        const rStr = String(userRole).toLowerCase();
        if (rStr.includes('admin') || rStr.includes('แอดมิน') || rStr.includes('manager') || rStr.includes('ba')) {
            const uniqueBranches = [...new Set(allJobs.map(j => j.branch_name).filter(b => b))];
            const filterSelect = document.getElementById('branchFilter');
            const savedVal = filterSelect.value;
            filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>`;
            uniqueBranches.forEach(b => filterSelect.innerHTML += `<option value="${b}">${b}</option>`);
            if(uniqueBranches.includes(savedVal)) filterSelect.value = savedVal;
        }

        applyFilters(); 
    } catch (err) { 
        console.error("โหลดข้อมูลแดชบอร์ดพัง:", err); 
    }
}

function applyFilters() {
    const filterSelect = document.getElementById('branchFilter');
    const selectedBranch = filterSelect ? filterSelect.value : 'all';
    
    const startDate = document.getElementById('dash_start_date').value;
    const endDate = document.getElementById('dash_end_date').value;
    
    const chartBranchLabel = document.getElementById('chartBranchLabel');
    if (chartBranchLabel) {
        chartBranchLabel.innerText = selectedBranch === 'all' ? 'ทุกสาขา' : selectedBranch;
    }

    if (selectedBranch === 'all') {
        filteredJobs = [...allJobs];
        filteredPartOrders = [...allPartOrders];
    } else {
        filteredJobs = allJobs.filter(j => j.branch_name === selectedBranch);
        filteredPartOrders = allPartOrders.filter(o => o.branch_name === selectedBranch);
    }

    renderKPIs(startDate, endDate);
    renderDailyReport(); 
    renderStatusChart();
    renderInsuranceChart();
    renderPaymentChart(); 
    renderFinanceChart(startDate, endDate);
    renderSASection();
    renderStationSection();
    
    renderPartsTracking();
    renderStationTable(); 
    renderParkedCars();
    
    renderCalendarByRange(startDate, endDate);
}

function isDateInRange(dateStr, start, end) {
    if(!dateStr || String(dateStr).trim() === '') return false;
    const dStr = dateStr.split('T')[0];
    if(start && dStr < start) return false;
    if(end && dStr > end) return false;
    return true;
}

function renderKPIs(start, end) {
    const contacted = filteredJobs.filter(j => isDateInRange(j.contact_date, start, end)).length;
    const parked = filteredJobs.filter(j => isDateInRange(j.appointment_date, start, end)).length;
    const billedJobs = filteredJobs.filter(j => isDateInRange(j.billing_date, start, end));
    const billed = billedJobs.length;

    const deliveredStatuses = [
        '12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', 
        '15.วางบิล Tesla', '16.วางบิล EV ME', '17.รอออกบิล', '19.ออกบิลแล้ว'
    ];
    
    const delivered = filteredJobs.filter(j => {
        const st = j.job_status || '';
        const hasStatus = deliveredStatuses.some(ds => st.includes(ds));
        return isDateInRange(j.delivery_date, start, end) && hasStatus;
    }).length;

    if (document.getElementById('stat_contacted')) document.getElementById('stat_contacted').innerText = contacted;
    if (document.getElementById('stat_parked')) document.getElementById('stat_parked').innerText = parked;
    if (document.getElementById('stat_delivered')) document.getElementById('stat_delivered').innerText = delivered;
    if (document.getElementById('stat_billed')) document.getElementById('stat_billed').innerText = billed;

    let sumLabor = 0, sumParts = 0, sumOutsource = 0;
    billedJobs.forEach(j => {
        sumLabor += Number(j.cost_labor || j.labor_total || 0);
        sumParts += Number(j.cost_part || j.part_total || 0);
        sumOutsource += Number(j.cost_external || j.outsource_total || 0);
    });

    const formatMoney = (val) => val.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    if (document.getElementById('sum_labor')) document.getElementById('sum_labor').innerText = formatMoney(sumLabor);
    if (document.getElementById('sum_parts')) document.getElementById('sum_parts').innerText = formatMoney(sumParts);
    if (document.getElementById('sum_outsource')) document.getElementById('sum_outsource').innerText = formatMoney(sumOutsource);
}

function openFilteredModal(type) {
    const start = document.getElementById('dash_start_date').value;
    const end = document.getElementById('dash_end_date').value;
    
    let jobsToShow = []; 
    let title = "";
    if(type === 'contacted') { jobsToShow = filteredJobs.filter(j => isDateInRange(j.contact_date, start, end)); title = "1. รถเข้ามาที่ศูนย์"; }
    if(type === 'parked') { jobsToShow = filteredJobs.filter(j => isDateInRange(j.appointment_date, start, end)); title = "2. รถที่เข้ามาจอด"; }
    if(type === 'delivered') { 
        const deliveredStatuses = ['12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', '15.วางบิล Tesla', '16.วางบิล EV ME', '17.รอออกบิล', '19.ออกบิลแล้ว'];
        jobsToShow = filteredJobs.filter(j => {
            const st = j.job_status || '';
            const hasStatus = deliveredStatuses.some(ds => st.includes(ds));
            return isDateInRange(j.delivery_date, start, end) && hasStatus;
        });
        title = "3. ยอดส่งมอบ (ตามสถานะและวันที่)"; 
    }
    if(type === 'billed') { jobsToShow = filteredJobs.filter(j => isDateInRange(j.billing_date, start, end)); title = "4. ยอดปิดบิล"; }

    document.getElementById('modal_status_name').innerText = title;
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

function renderDailyReport() {
    const start = document.getElementById('report_start_date').value || getFirstDayOfMonth();
    const end = document.getElementById('report_end_date').value || getLastDayOfMonth();
    
    // 🌟 ดึงวันที่ปัจจุบันของจริงมาใช้สำหรับคำว่า "Today / ประจำวัน"
    const todayDate = new Date().toISOString().split('T')[0]; 

    const activeContacts = filteredJobs.filter(j => isDateInRange(j.contact_date, start, end));
    const uniqueCustomerTypes = [...new Set(activeContacts.map(j => (j.customer_type || 'ไม่ระบุ').trim()))].sort();

    const dynamicCustomerTypes = uniqueCustomerTypes.map(type => ({
        label: `${type}`,
        icon: "🏷️",
        filter: j => (j.customer_type || 'ไม่ระบุ').trim() === type && isDateInRange(j.contact_date, start, end)
    }));

    const reportDef = {
        customers: [
            { label: "ติดต่อประจำวัน (Today)", icon: "🔥", filter: j => j.contact_date && j.contact_date.split('T')[0] === todayDate },
            { label: "ติดต่อรวมช่วงเวลาที่เลือก", icon: "📅", filter: j => isDateInRange(j.contact_date, start, end) },
            ...dynamicCustomerTypes
        ],
        workStatus: [
            { label: "รถเข้าจอด (ประจำวัน Today)", icon: "🔥", filter: j => j.arrived_date && j.arrived_date.split('T')[0] === todayDate },
            { label: "ซ่อมเสร็จ (ประจำวัน Today)", icon: "🔥", filter: j => j.repair_finish_date && j.repair_finish_date.split('T')[0] === todayDate },
            { label: "ส่งมอบ (ประจำวัน Today)", icon: "🔥", filter: j => (j.job_status||'').includes('ส่งมอบ') && !(j.job_status||'').includes('ซ่อมเสร็จรอส่งมอบ') && j.delivery_date && j.delivery_date.split('T')[0] === todayDate },
            { label: "รอเสนอประกัน", icon: "⏳", filter: j => (j.job_status||'').includes('รอเสนอประกัน') },
            { label: "รอประกันอนุมัติ", icon: "📝", filter: j => (j.job_status||'').includes('รอประกันอนุมัติ') },
            { label: "รอลูกค้าอนุมัติ (เงินสด)", icon: "💵", filter: j => (j.job_status||'').includes('รอลูกค้าอนุมัติ') },
            { label: "อนุมัติแล้ว", icon: "✅", filter: j => (j.job_status||'').includes('อนุมัติแล้ว') },
            { label: "สั่งอะไหล่", icon: "🛠️", filter: j => (j.job_status||'').includes('สั่งอะไหล่') },
            { label: "รอนัดหมายเข้าซ่อม", icon: "📅", filter: j => (j.job_status||'').includes('รอนัดหมายเข้าซ่อม') },
            { label: "นัดหมายแล้วรอเข้าซ่อม", icon: "🕒", filter: j => (j.job_status||'').includes('นัดหมายแล้วรอเข้าซ่อม') },
            { label: "จอดรอเข้าซ่อม", icon: "🚗", filter: j => (j.job_status||'').includes('จอดรอเข้าซ่อม') },
            { label: "กำลังซ่อม", icon: "🔧", filter: j => (j.job_status||'').includes('กำลังซ่อม') },
            { label: "ซ่อมTC", icon: "🏷️", filter: j => (j.job_status||'').includes('ซ่อม TC') || (j.job_status||'').includes('ซ่อมTC') },
            { label: "รถซ่อมเสร็จรอส่งมอบ", icon: "🎁", filter: j => (j.job_status||'').includes('ซ่อมเสร็จรอส่งมอบ') },
            { label: "ส่งมอบ", icon: "🏁", filter: j => j.job_status === '12.ส่งมอบแล้ว' || j.job_status === 'ส่งมอบแล้ว' },
            { label: "พักซ่อม", icon: "👥", filter: j => (j.job_status||'').includes('พักซ่อม') }
        ],
        finance: [
            // 🌟 เอาออกบิลแล้วประจำวัน ออกไปแล้ว ตามคำสั่ง 🌟
            { label: "วางบิลประกัน (ตามช่วงเวลา)", icon: "💳", filter: j => (j.job_status||'').includes('วางบิลประกัน') && isDateInRange(j.billing_date, start, end) },
            { label: "ชำระเงินสด (ตามช่วงเวลา)", icon: "💵", filter: j => (j.job_status||'').includes('ชำระเงินสด') && isDateInRange(j.billing_date, start, end) },
            { label: "วางบิล Tesla (ตามช่วงเวลา)", icon: "🏎️", filter: j => (j.job_status||'').includes('วางบิล Tesla') && isDateInRange(j.billing_date, start, end) },
            { label: "วางบิล EV ME (ตามช่วงเวลา)", icon: "⚡", filter: j => ((j.job_status||'').includes('วางบิล EV ME') || (j.job_status||'').includes('วางบิล EVME')) && isDateInRange(j.billing_date, start, end) },
            { label: "รอออกบิล (สะสมรวม)", icon: "⏳", filter: j => (j.job_status||'').includes('รอออกบิล') },
            { label: "ลูกค้ายกเลิก", icon: "❌", filter: j => (j.job_status||'').includes('ยกเลิก') },
            { label: "ออกบิลแล้ว (ตามช่วงเวลา)", icon: "📄", filter: j => (j.job_status||'').includes('ออกบิลแล้ว') && isDateInRange(j.billing_date, start, end) },
            { label: "สรุปออกบิลรวม (ตามช่วงเวลา)", icon: "📄", filter: j => isDateInRange(j.billing_date, start, end) }
        ]
    };

    window.currentReportDef = reportDef;

    ['customers', 'workStatus', 'finance'].forEach((cat, colIdx) => {
        const containerId = colIdx === 0 ? 'report_col_customers' : (colIdx === 1 ? 'report_col_status' : 'report_col_finance');
        const container = document.getElementById(containerId);
        if(!container) return;
        
        container.innerHTML = reportDef[cat].map((item, itemIdx) => {
            const count = filteredJobs.filter(item.filter).length;
            return `
                <div onclick="openReportModal('${cat}', ${itemIdx})" class="flex justify-between items-center py-2 px-3 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors group border border-transparent hover:border-slate-200">
                    <span class="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">${item.icon} ${item.label}</span>
                    <span class="text-base font-black ${count > 0 ? 'text-blue-600' : 'text-slate-400'}">${count}</span>
                </div>
            `;
        }).join('');
    });
}

function openReportModal(cat, itemIdx) {
    const item = window.currentReportDef[cat][itemIdx];
    const jobsToShow = filteredJobs.filter(item.filter);
    document.getElementById('modal_status_name').innerText = `รายงาน: ${item.label}`;
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

function renderStatusChart() {
    const targetStatuses = [
        '01.ติดต่อสอบถาม', '02.รอเสนอประกัน', '03.รอประกันอนุมัติ', 
        '04.รอลูกค้าอนุมัติ (เงินสด)', '05.อนุมัติแล้ว', '06.สั่งอะไหล่', 
        '07.รอนัดหมายเข้าซ่อม', '08.นัดหมายแล้วรอเข้าซ่อม', '09.จอดรอเข้าซ่อม', 
        '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ', 
        '12.ส่งมอบ', '17.รอออกบิล', '19.ออกบิลแล้ว', 
        '13.วางบิลประกัน', '14.ชำระเงินสด', '15.วางบิล Tesla', 
        '16.วางบิล EV ME', '18.ลูกค้ายกเลิก', '20.จอดซ่อม TC', '21.พักซ่อม'
    ];
    
    const statusCounts = {};
    targetStatuses.forEach(s => statusCounts[s] = 0);

    filteredJobs.forEach(job => {
        const st = (job.job_status || "").trim();
        if (!st.includes('ปิดงานแล้ว')) {
            const matchedStatus = targetStatuses.find(t => st === t || st.includes(t));
            if (matchedStatus) {
                statusCounts[matchedStatus]++;
            }
        }
    });

    const labels = targetStatuses;
    const data = labels.map(l => statusCounts[l]);

    if (statusChartInstance) statusChartInstance.destroy();
    const ctx = document.getElementById('statusChart').getContext('2d');
    statusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => l.replace(/^[0-9]+\./, '')), 
            datasets: [{ label: 'จำนวน (คัน)', data: data, backgroundColor: '#00320D', borderRadius: 4, barPercentage: 0.6, hoverBackgroundColor: '#f59e0b' }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                datalabels: { 
                    color: '#ffffff', 
                    font: { family: 'Kanit', weight: 'bold', size: 10 }, 
                    anchor: 'end', 
                    align: 'bottom',
                    formatter: (val) => val > 0 ? val : '' 
                }
            }, 
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } },
            onClick: (evt, elements) => {
                if(elements.length > 0) {
                    const index = elements[0].index;
                    openStatusModal(labels[index]);
                }
            }
        }
    });
}

function openStatusModal(statusName) {
    document.getElementById('modal_status_name').innerText = `รายการ: ${statusName.replace(/^[0-9]+\./, '')}`;
    const jobsToShow = filteredJobs.filter(job => {
        const st = (job.job_status || "").trim();
        return (st === statusName || st.includes(statusName)) && !st.includes('ปิดงานแล้ว');
    });

    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

function renderInsuranceChart() {
    const customerTypes = {};
    filteredJobs.forEach(j => {
        const type = (j.customer_type || 'ไม่มีข้อมูล').trim();
        if(customerTypes[type] !== undefined) customerTypes[type]++;
        else customerTypes[type] = 1;
    });

    const sortedTypes = Object.entries(customerTypes).sort((a,b) => b[1] - a[1]);
    const labels = sortedTypes.map(i => i[0]);
    const data = sortedTypes.map(i => i[1]);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];

    if (insuranceChartInstance) insuranceChartInstance.destroy();
    const ctx = document.getElementById('insuranceChart').getContext('2d');
    insuranceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: { 
                legend: { position: 'right', labels: { font: { family: 'Kanit', size: 10 } } },
                datalabels: { 
                    color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 12 },
                    formatter: (val) => val > 0 ? val : ''
                }
            }
        }
    });
}

function renderPaymentChart() {
    const paymentTypes = {};
    filteredJobs.forEach(j => {
        const type = (j.payment_type || 'ไม่ระบุ').trim();
        if(paymentTypes[type] !== undefined) paymentTypes[type]++;
        else paymentTypes[type] = 1;
    });

    const sortedTypes = Object.entries(paymentTypes).sort((a,b) => b[1] - a[1]);
    const labels = sortedTypes.map(i => i[0]);
    const data = sortedTypes.map(i => i[1]);

    const colors = ['#f43f5e', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#06b6d4', '#64748b'];

    const canvas = document.getElementById('paymentChart');
    if (!canvas) return;

    if (paymentChartInstance) paymentChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    paymentChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: { 
                legend: { position: 'right', labels: { font: { family: 'Kanit', size: 10 } } },
                datalabels: { 
                    color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 12 },
                    formatter: (val) => val > 0 ? val : ''
                }
            }
        }
    });
}

function renderFinanceChart(start, end) {
    const accJobs = filteredJobs.filter(d => d.department_routing === 'บัญชี');
    
    const unmanaged = accJobs.filter(j => !j.billing_date || j.billing_date.trim() === '').length;
    const managed = accJobs.filter(j => {
        if (!j.billing_date || j.billing_date.trim() === '') return false;
        return isDateInRange(j.billing_date, start, end);
    }).length;

    if (financeChartInstance) financeChartInstance.destroy();
    const ctx = document.getElementById('financeChart').getContext('2d');
    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['ยังไม่ออกบิล (รอจัดการ)', 'ออกบิลแล้ว (จัดการแล้ว)'],
            datasets: [{ data: [unmanaged, managed], backgroundColor: ['#ef4444', '#10b981'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: { 
                legend: { position: 'bottom', labels: { font: { family: 'Kanit', weight: 'bold' } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 14 } }
            }
        }
    });
}

function renderSASection() {
    const saCounts = {};
    filteredJobs.forEach(job => {
        const sa = job.sa_owner || "ไม่ระบุ SA";
        saCounts[sa] = (saCounts[sa] || 0) + 1;
    });

    const sortedSAs = Object.keys(saCounts).sort((a, b) => saCounts[b] - saCounts[a]);
    const container = document.getElementById('sa_list_container');
    container.innerHTML = sortedSAs.map(sa => `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center hover:border-amber-500 hover:shadow-md transition-all">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black shadow-inner"><i class="fa-solid fa-user-tie"></i></div>
                <div>
                    <p class="text-sm font-bold text-slate-800">${sa}</p>
                    <p class="text-[10px] text-slate-500">จำนวน: <span class="text-amber-600 font-black">${saCounts[sa]}</span> คัน</p>
                </div>
            </div>
            <button onclick="openSAModal('${sa}')" class="px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition shadow-sm border border-amber-200 whitespace-nowrap">
                <i class="fa-solid fa-list-ul"></i> ดูรายการ
            </button>
        </div>
    `).join('');
}

function openSAModal(saName) {
    document.getElementById('modal_status_name').innerText = `รถทั้งหมดของ SA: ${saName}`;
    const jobsToShow = filteredJobs.filter(j => (j.sa_owner || "ไม่ระบุ SA") === saName);
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

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

function renderStationSection() {
    const stCounts = { "01.เคาะ":0, "02.โป๊ว":0, "03.เตรียมพื้น":0, "04.พ่นสี":0, "05.ประกอบ":0, "06.ขัดสี":0, "08.เก็บงาน":0, "09.ซ่อมแม็ก":0, "10.กระจก":0, "11.ฟิล์ม":0, "12.พักซ่อม":0, "13.รอส่งมอบ":0, "รอรับรถ":0 };
    
    filteredJobs.filter(j => !j.job_status?.includes('ส่งมอบแล้ว')).forEach(j => {
        const s = computeHighestStationIFS(j);
        if(stCounts[s] !== undefined) stCounts[s]++;
    });

    const container = document.getElementById('station_list_container');
    container.innerHTML = Object.keys(stCounts).map(st => `
        <div onclick="openStationModal('${st}')" class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-orange-500 hover:shadow hover:bg-white transition-all group">
            <span class="text-xs font-bold text-slate-700 group-hover:text-orange-600 transition-colors truncate" title="${st}">${st.replace(/[0-9.]/g, '')}</span>
            <span class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200 text-xs font-black shadow-sm">${stCounts[st]}</span>
        </div>
    `).join('');
}

function openStationModal(stationName) {
    document.getElementById('modal_status_name').innerText = `สถานีช่าง: ${stationName}`;
    const jobsToShow = filteredJobs.filter(j => j.job_status !== '12.ส่งมอบแล้ว' && computeHighestStationIFS(j) === stationName);
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

function sortTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => {
        icon.className = "fa-solid fa-sort sort-icon";
    });

    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc';
    table.setAttribute(`data-dir-${colIndex}`, dir === 'asc' ? 'desc' : 'asc');
    
    const clickedIcon = table.querySelectorAll('th')[colIndex].querySelector('.sort-icon');
    if (clickedIcon) {
        clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-white opacity-100" : "fa-solid fa-sort-up ml-1 text-white opacity-100";
    }

    rows.sort((a, b) => {
        let valA = getCellValue(a.cells[colIndex]); 
        let valB = getCellValue(b.cells[colIndex]);
        let numA = parseFloat(valA.replace(/,/g, '')); 
        let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });
    rows.forEach(row => tbody.appendChild(row));
}

function renderStationTable() {
    const tbody = document.getElementById('station_table_body');
    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    
    const inRepairCars = filteredJobs.filter(j => {
        if((j.job_status||'').includes('ส่งมอบแล้ว') || (j.job_status||'').includes('12.ส่งมอบ')) return false;
        const st = computeHighestStationIFS(j);
        return activeStations.includes(st);
    });
    
    if(inRepairCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-slate-50">ไม่มีรถกำลังดำเนินการในสถานีช่างขณะนี้ 🎉</td></tr>`;
        return;
    }

    inRepairCars.sort((a,b) => new Date(a.target_finish_date||'9999') - new Date(b.target_finish_date||'9999'));

    const today = new Date();
    today.setHours(0,0,0,0);

    tbody.innerHTML = inRepairCars.map(j => {
        const target = j.target_finish_date ? j.target_finish_date.split('T')[0] : '-';
        const actual = j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '-';
        const delivery = j.delivery_date ? j.delivery_date.split('T')[0] : '-';
        const station = computeHighestStationIFS(j);
        
        let overdueWarning = '';
        if (j.delivery_date) {
            let dDate = new Date(j.delivery_date); dDate.setHours(0,0,0,0);
            if (today > dDate) overdueWarning = `<i class="fa-solid fa-triangle-exclamation text-red-500 animate-pulse ml-1" title="เลยกำหนดส่งมอบ!"></i>`;
        } else if (j.target_finish_date) {
            let tDate = new Date(j.target_finish_date); tDate.setHours(0,0,0,0);
            if (today > tDate) overdueWarning = `<i class="fa-solid fa-clock text-amber-500 animate-pulse ml-1" title="เลยเป้าซ่อมเสร็จ!"></i>`;
        }
        
        return `
            <tr class="cursor-pointer hover:bg-orange-50/50 transition-colors border-b border-slate-100" onclick="goToEditJob('${j.id}')">
                <td class="px-4 py-3 font-black text-orange-700"><span class="bg-orange-50 px-2.5 py-1 rounded border border-orange-200 shadow-inner">${j.car_plate || '-'}${overdueWarning}</span></td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700">${j.car_brand} ${j.car_model || ''}</td>
                <td class="px-4 py-3 text-xs font-medium text-slate-600 truncate max-w-[150px]" title="${j.customer_name}">${j.customer_name || '-'}</td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700"><span class="bg-slate-100 px-2 py-1 rounded shadow-sm border border-slate-200">${j.job_status || '-'}</span></td>
                <td class="px-4 py-3 text-xs font-black text-orange-600 bg-orange-50/30"><i class="fa-solid fa-wrench"></i> ${station.replace(/[0-9.]/g, '')}</td>
                <td class="px-4 py-3 font-mono text-xs text-blue-600 text-center font-bold">${target}</td>
                <td class="px-4 py-3 font-mono text-xs text-emerald-600 text-center font-bold">${actual}</td>
                <td class="px-4 py-3 font-mono text-xs text-purple-600 text-center font-bold">${delivery}</td>
                <td class="px-4 py-3 text-center"><button class="bg-white text-orange-600 border border-orange-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition shadow-sm whitespace-nowrap"><i class="fa-solid fa-folder-open"></i> ดูใบงาน</button></td>
            </tr>
        `;
    }).join('');
}

function renderPartsTracking() {
    const tbody = document.getElementById('parts_tracking_body');
    
    // 1. กรองเฉพาะอะไหล่ที่ยังมาไม่ครบ
    const pendingParts = filteredPartOrders.filter(o => {
        const status = o.order_status || '';
        return !status.includes('ครบ') && status !== 'ยกเลิก';
    });

    if (pendingParts.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-slate-400 font-bold bg-slate-50"><i class="fa-solid fa-box-open text-3xl mb-3 block opacity-50"></i>ไม่มีรายการใบสั่งอะไหล่ที่ค้างรับ 🎉</td></tr>`; 
        return; 
    }

    // 2. จัดกลุ่มข้อมูลตาม "ทะเบียนรถ"
    const groupedParts = {};
    pendingParts.forEach(o => {
        const plate = o.car_plate || 'ไม่ระบุ';
        if (!groupedParts[plate]) {
            const jobMatch = allJobs.find(j => j.car_plate === plate);
            groupedParts[plate] = {
                saName: jobMatch ? (jobMatch.sa_owner || 'ไม่ระบุ') : 'ไม่ระบุ',
                totalItems: 0,
                statusCounts: {}
            };
        }
        
        groupedParts[plate].totalItems++;
        
        // นับจำนวนสถานะแต่ละประเภทของคันนี้
        const st = o.order_status || 'รออัปเดต';
        groupedParts[plate].statusCounts[st] = (groupedParts[plate].statusCounts[st] || 0) + 1;
    });

    const sortedPlates = Object.keys(groupedParts).sort();

    // 3. แสดงผลตารางเป็นคัน
    tbody.innerHTML = sortedPlates.map(plate => {
        const data = groupedParts[plate];
        
        // สร้างป้าย Badge แจ้งสถานะและจำนวนชิ้นย่อยๆ
        const statusBadges = Object.keys(data.statusCounts).map(st => {
            const count = data.statusCounts[st];
            const badgeClass = (st === 'รอสั่งซื้อ' || st === 'รออะไหล่' || st === 'ติด Back Order') 
                ? 'bg-red-50 text-red-700 border-red-300' 
                : 'bg-amber-50 text-amber-700 border-amber-300';
            
            return `
                <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold shadow-sm ${badgeClass} mr-1.5 mb-1.5 whitespace-nowrap">
                    ${st} <span class="bg-white px-1.5 py-0.5 rounded text-slate-800 shadow-inner border border-slate-100">${count}</span>
                </span>`;
        }).join('');

        return `
            <tr class="cursor-pointer hover:bg-blue-50/80 transition-colors border-b border-slate-100" onclick="window.location.href='parts.html'">
                <td class="font-black text-[#00320D] px-4 py-3"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-xs shadow-inner">${plate}</span></td>
                <td class="text-xs font-bold text-slate-600 px-4 py-3"><i class="fa-solid fa-user-tie text-blue-400 mr-1.5"></i>${data.saName}</td>
                <td class="text-center px-4 py-3"><span class="text-blue-700 font-black bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">${data.totalItems} รายการ</span></td>
                <td class="px-4 py-3 align-middle">${statusBadges}</td>
                <td class="text-center px-4 py-3"><button class="text-[10px] bg-white border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition font-bold shadow-sm whitespace-nowrap"><i class="fa-solid fa-search"></i> ดูอะไหล่</button></td>
            </tr>
        `;
    }).join('');
}

function renderParkedCars() {
    const tbody = document.getElementById('parked_cars_body');
    
    const parkedStatuses = [
        "08.นัดหมายแล้วรอเข้าซ่อม", "09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", 
        "20.จอดซ่อม TC", "21.พักซ่อม"
    ];
    
    const parkedCars = filteredJobs.filter(j => {
        const st = j.job_status || '';
        return parkedStatuses.some(p => st.includes(p) || p.includes(st));
    });
    
    if(parkedCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400 font-bold bg-slate-50"><i class="fa-solid fa-car-tunnel text-3xl mb-3 block opacity-50"></i>ไม่มีรถจอดซ่อมในศูนย์ขณะนี้ 🎉</td></tr>`;
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    parkedCars.sort((a,b) => new Date(a.arrived_date) - new Date(b.arrived_date)); 

    tbody.innerHTML = parkedCars.map(j => {
        const arrDate = new Date(j.arrived_date); arrDate.setHours(0,0,0,0);
        const diffTime = Math.abs(today - arrDate);
        const diffDays = j.arrived_date ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
        
        let dayBadge = diffDays > 14 ? 'bg-red-100 text-red-700 border-red-400 font-black shadow-sm animate-pulse' : (diffDays > 7 ? 'bg-amber-100 text-amber-700 border-amber-400 font-bold shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-300 font-bold shadow-sm');
        
        const target = j.target_finish_date ? j.target_finish_date.split('T')[0] : '-';
        const actual = j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '-';
        const delivery = j.delivery_date ? j.delivery_date.split('T')[0] : '-';
        const station = computeHighestStationIFS(j);

        return `
            <tr class="cursor-pointer hover:bg-amber-50/80 transition-colors border-b border-slate-100" onclick="goToEditJob('${j.id}')">
                <td class="text-center px-4 py-3"><span class="px-3 py-1 rounded-lg border ${dayBadge}">${diffDays}</span></td>
                <td class="font-black text-amber-700 px-4 py-3"><span class="bg-amber-50 px-2.5 py-1 rounded border border-amber-300 shadow-inner">${j.car_plate || '-'}</span></td>
                <td class="font-bold text-slate-800 px-4 py-3 text-xs">${j.car_brand} ${j.car_model || ''}</td>
                <td class="truncate max-w-[150px] font-medium text-slate-700 px-4 py-3 text-xs" title="${j.customer_name}">${j.customer_name || '-'}</td>
                <td class="font-bold text-orange-600 text-xs px-4 py-3"><i class="fa-solid fa-wrench"></i> ${station.replace(/[0-9.]/g, '')}</td>
                <td class="font-mono text-xs text-blue-600 text-center font-bold px-4 py-3">${target}</td>
                <td class="font-mono text-xs text-emerald-600 text-center font-bold px-4 py-3">${actual}</td>
                <td class="font-mono text-xs text-purple-600 text-center font-bold px-4 py-3">${delivery}</td>
                <td class="font-bold text-slate-600 text-[11px] px-4 py-3"><span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm">${j.job_status || '-'}</span></td>
                <td class="text-center px-4 py-3"><button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> ดูข้อมูล</button></td>
            </tr>
        `;
    }).join('');
}

function renderCalendarByRange(startDate, endDate) {
    const grid = document.getElementById('calendar_grid'); 
    grid.innerHTML = '';
    
    if(!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if(isNaN(start) || isNaN(end) || start > end) {
        grid.innerHTML = `<div class="col-span-7 text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-xl">วันที่ไม่ถูกต้อง หรือช่วงเวลาที่เลือกกว้างเกินไป</div>`;
        return;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if(diffDays > 31) {
        grid.innerHTML = `<div class="col-span-7 text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-xl">การแสดงผลปฏิทินรองรับสูงสุด 31 วัน กรุณาเลือกช่วงเวลาใหม่</div>`;
        return;
    }

    const firstDayOfWeek = start.getDay();
    for(let i = 0; i < firstDayOfWeek; i++) { 
        grid.innerHTML += `<div class="bg-slate-50/50 rounded-xl border border-transparent"></div>`; 
    }

    let maxCount = 1; 
    const daysData = [];
    
    let currentDay = new Date(start);
    while(currentDay <= end) {
        const dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth()+1).padStart(2,'0')}-${String(currentDay.getDate()).padStart(2,'0')}`;
        
        const arrived = filteredJobs.filter(j => j.arrived_date && j.arrived_date.split('T')[0] === dateStr);
        const target = filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr);
        const delivery = filteredJobs.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr);
        
        const dayMax = Math.max(arrived.length, target.length, delivery.length);
        if (dayMax > maxCount) maxCount = dayMax;
        daysData.push({ day: currentDay.getDate(), dateStr, arrJobs: arrived, tarJobs: target, delJobs: delivery });

        currentDay.setDate(currentDay.getDate() + 1);
    }

    const selectedBranch = document.getElementById('branchFilter').value;
    let branchesToCheck = selectedBranch === 'all' ? [...new Set(allJobs.map(j => j.branch_name).filter(b => b))] : [selectedBranch];

    daysData.forEach(d => {
        const arrCount = d.arrJobs.length; const tarCount = d.tarJobs.length; const delCount = d.delJobs.length;
        let barBlock = '';
        
        if(arrCount > 0 || tarCount > 0 || delCount > 0) {
            barBlock = `<div class="flex items-end justify-center gap-2 w-full h-[60px] mt-auto pb-1">`;
            if(arrCount > 0) {
                const h = Math.max(20, (arrCount / maxCount) * 100);
                barBlock += `
                <div class="flex flex-col items-center justify-end h-full group/bar cursor-pointer w-[18px]" onclick="openJobListModalCalendar('${d.dateStr}', 'arrived')" title="รถเข้าจอด: ${arrCount} คัน">
                    <span class="text-[9px] font-black text-blue-700 mb-0.5 z-10 bg-white/90 rounded-sm min-w-[16px] h-4 flex items-center justify-center shadow-sm border border-blue-200">${arrCount}</span>
                    <div class="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-md transition-all group-hover/bar:brightness-110 shadow-sm border border-blue-700/20" style="height: ${h}%;"></div>
                </div>`;
            }
            if(tarCount > 0) {
                const h = Math.max(20, (tarCount / maxCount) * 100);
                barBlock += `
                <div class="flex flex-col items-center justify-end h-full group/bar cursor-pointer w-[18px]" onclick="openJobListModalCalendar('${d.dateStr}', 'target')" title="เป้าซ่อมเสร็จ: ${tarCount} คัน">
                    <span class="text-[9px] font-black text-amber-700 mb-0.5 z-10 bg-white/90 rounded-sm min-w-[16px] h-4 flex items-center justify-center shadow-sm border border-amber-200">${tarCount}</span>
                    <div class="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-md transition-all group-hover/bar:brightness-110 shadow-sm border border-amber-600/20" style="height: ${h}%;"></div>
                </div>`;
            }
            if(delCount > 0) {
                const h = Math.max(20, (delCount / maxCount) * 100);
                barBlock += `
                <div class="flex flex-col items-center justify-end h-full group/bar cursor-pointer w-[18px]" onclick="openJobListModalCalendar('${d.dateStr}', 'delivery')" title="นัดส่งมอบ: ${delCount} คัน">
                    <span class="text-[9px] font-black text-emerald-700 mb-0.5 z-10 bg-white/90 rounded-sm min-w-[16px] h-4 flex items-center justify-center shadow-sm border border-emerald-200">${delCount}</span>
                    <div class="w-full bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-md transition-all group-hover/bar:brightness-110 shadow-sm border border-emerald-600/20" style="height: ${h}%;"></div>
                </div>`;
            }
            barBlock += `</div>`;
        } else {
            barBlock = `<div class="flex items-center justify-center h-[60px] w-full mt-auto"><span class="text-[10px] font-bold text-slate-300">ว่าง</span></div>`;
        }

        let maxMain = 0; let maxSub = 0;
        branchesToCheck.forEach(b => {
            const branchQuotas = allQuotas.filter(q => q.branch_name === b);
            const specialQ = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === d.dateStr);
            const defaultQ = branchQuotas.find(q => q.quota_type === 'default');
            maxMain += specialQ ? (parseInt(specialQ.quota_main_parts)||0) : (defaultQ ? (parseInt(defaultQ.quota_main_parts)||0) : 0);
            maxSub += specialQ ? (parseInt(specialQ.quota_sub_parts)||0) : (defaultQ ? (parseInt(defaultQ.quota_sub_parts)||0) : 0);
        });

        // 🌟 คำนวณชิ้นส่วนหลักและรอง ตามวันเป้าหมายซ่อมเสร็จ
        const mainSum = filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === d.dateStr).reduce((sum, j) => {
            let qty = parseInt(j.main_part_qty);
            if (isNaN(qty) || qty <= 0) qty = (j.main_part_name && j.main_part_name.trim() !== '-' && j.main_part_name.trim() !== '') ? 1 : 0;
            return sum + qty;
        }, 0);

        const subSum = filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === d.dateStr).reduce((sum, j) => {
            let qty = parseInt(j.sub_part_qty);
            if (isNaN(qty) || qty <= 0) qty = (j.sub_part_name && j.sub_part_name.trim() !== '-' && j.sub_part_name.trim() !== '') ? 1 : 0;
            return sum + qty;
        }, 0);

        // 🌟 เช็กสถานะ "เต็ม" 🌟
        let isMainFull = (maxMain > 0 && mainSum >= maxMain);
        let isSubFull = (maxSub > 0 && subSum >= maxSub);
        let isFull = isMainFull || isSubFull;

        let quotaHTML = '';
        if (maxMain > 0 || maxSub > 0) {
            quotaHTML = `<div class="w-full mt-2 pt-1 border-t border-slate-100 flex flex-col gap-1">`;
            if (maxMain > 0) {
                let pct = Math.min((mainSum / maxMain) * 100, 100);
                let color = pct >= 100 ? 'bg-rose-500' : (pct >= 80 ? 'bg-amber-500' : 'bg-blue-500');
                quotaHTML += `
                    <div title="เป้าหมายชิ้นส่วนหลัก">
                        <div class="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5"><span>ชิ้นหลัก</span><span class="${pct>=100?'text-rose-600':''}">${mainSum}/${maxMain}</span></div>
                        <div class="h-1.5 rounded-full bg-slate-200"><div class="h-full rounded-full ${color} transition-all" style="width: ${pct}%"></div></div>
                    </div>
                `;
            }
            if (maxSub > 0) {
                let pct = Math.min((subSum / maxSub) * 100, 100);
                let color = pct >= 100 ? 'bg-rose-500' : (pct >= 80 ? 'bg-amber-500' : 'bg-amber-400');
                quotaHTML += `
                    <div title="เป้าหมายชิ้นส่วนรอง">
                        <div class="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5"><span>ชิ้นรอง</span><span class="${pct>=100?'text-rose-600':''}">${subSum}/${maxSub}</span></div>
                        <div class="h-1.5 rounded-full bg-slate-200"><div class="h-full rounded-full ${color} transition-all" style="width: ${pct}%"></div></div>
                    </div>
                `;
            }
            quotaHTML += `</div>`;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = d.dateStr === todayStr;

        // 🌟 สร้างป้ายแสดงคำว่า "🔥 เต็ม" 🌟
        let fullBadgeHTML = isFull ? `<span class="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse border border-rose-600">🔥 เต็ม</span>` : '';

        // เพิ่ม flex layout ให้วันที่มีป้ายเต็มแสดงผลได้สวยงาม
        grid.innerHTML += `
            <div class="calendar-cell ${isToday ? 'today' : ''} ${isFull ? 'border-rose-300 bg-rose-50/20' : ''}">
                <div class="flex justify-between items-start w-full mb-2">
                    <span class="calendar-day-label !mb-0">${d.day}</span>
                    ${fullBadgeHTML}
                </div>
                <div class="flex-1 flex flex-col justify-end w-full">
                    ${barBlock}
                    ${quotaHTML}
                </div>
            </div>
        `;
    });

}

function openJobListModalCalendar(dateStr, type) {
    let typeLabel = ""; let jobsToShow = [];
    if(type === 'arrived') { typeLabel = "รถเข้าจอด"; jobsToShow = filteredJobs.filter(j => j.arrived_date && j.arrived_date.split('T')[0] === dateStr); }
    else if(type === 'target') { typeLabel = "กำหนดเสร็จ"; jobsToShow = filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr); }
    else if(type === 'delivery') { typeLabel = "วันส่งมอบ"; jobsToShow = filteredJobs.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr); }

    document.getElementById('modal_status_name').innerText = `วันที่ ${new Date(dateStr).toLocaleDateString('th-TH')} (${typeLabel})`;
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

window.toggleSAAccordion = function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.classList.add('rotate-90'); 
    } else {
        el.classList.add('hidden');
        icon.classList.remove('rotate-90');
    }
}

function renderJobTableInModalGroupedBySA(jobs) {
    const container = document.getElementById('modal_job_container');
    if (jobs.length === 0) { 
        container.innerHTML = `<div class="text-center py-10 text-slate-500 font-bold bg-white m-4 rounded-xl shadow-sm">ไม่มีข้อมูล</div>`; 
        return; 
    }

    const groupedBySA = {};
    jobs.forEach(j => {
        const sa = j.sa_owner || 'ไม่ระบุ SA';
        if(!groupedBySA[sa]) groupedBySA[sa] = [];
        groupedBySA[sa].push(j);
    });

    let finalHtml = '';
    
    Object.keys(groupedBySA).sort().forEach((sa, index) => {
        const groupId = `sa_group_${index}`;
        finalHtml += `
            <div class="bg-slate-100 px-4 py-3 border-y border-slate-300 flex items-center justify-between sticky top-0 z-10 shadow-sm cursor-pointer hover:bg-slate-200 transition" onclick="toggleSAAccordion('${groupId}')">
                <span class="font-black text-[#00320D] text-sm flex items-center gap-2">
                    <i class="fa-solid fa-chevron-right transition-transform duration-200 text-slate-400" id="icon_${groupId}"></i> 
                    <i class="fa-solid fa-user-tie text-amber-500"></i> SA: ${sa}
                </span>
                <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-300">${groupedBySA[sa].length} คัน</span>
            </div>
            <div id="${groupId}" class="hidden">
                <table class="excel-table w-full border-none mb-2">
                    <thead class="bg-white text-slate-500 text-[10px] uppercase border-b border-slate-200">
                        <tr>
                            <th class="px-4 py-2 font-bold text-left w-32">ทะเบียนรถ</th>
                            <th class="px-4 py-2 font-bold text-left w-48">ลูกค้า</th>
                            <th class="px-4 py-2 font-bold text-left w-48">ชิ้นส่วนที่ทำสี / สถานะอะไหล่</th>
                            <th class="px-4 py-2 font-bold text-left w-40">สถานะซ่อม (ERP)</th>
                            <th class="px-4 py-2 font-bold text-center w-20">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm divide-y divide-slate-100 bg-white">
        `;
        
        groupedBySA[sa].forEach(j => {
            let safeStatus = j.job_status || '';
            let safeOptions = globalStatusOptionsHtml;
            if(!safeOptions.includes(`value="${safeStatus}"`)) { safeOptions = `<option value="${safeStatus}">${safeStatus}</option>` + safeOptions; } 
            safeOptions = safeOptions.replace(`value="${safeStatus}"`, `value="${safeStatus}" selected`); 

            finalHtml += `
                <tr class="hover:bg-emerald-50/50 transition cursor-pointer" onclick="goToEditJob('${j.id}')">
                    <td class="px-4 py-3 font-bold text-[#00320D] align-top">
                        <span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span>
                    </td>
                    <td class="px-4 py-3 align-top">
                        <div class="font-bold text-slate-800 text-[11px] leading-tight mb-1">${j.car_brand} <span class="text-slate-500 font-medium">${j.car_model || ''}</span></div>
                        <div class="text-[11px] font-bold text-slate-700 truncate max-w-[150px]" title="${j.customer_name}">${j.customer_name || '-'}</div>
                    </td>
                    <td class="px-4 py-3 text-[11px] font-bold text-slate-700 align-top">
                        <div class="text-blue-600 mb-0.5"><i class="fa-solid fa-layer-group text-blue-400 mr-1"></i> หลัก: ${j.main_part_name || '-'}</div>
                        <div class="text-amber-600 mb-1"><i class="fa-solid fa-puzzle-piece text-amber-400 mr-1"></i> รอง: ${j.sub_part_name || '-'}</div>
                        <div class="text-purple-600 pt-1 border-t border-slate-100"><i class="fa-solid fa-box text-purple-400 mr-1"></i> อะไหล่: <span class="bg-purple-50 px-1.5 py-0.5 rounded shadow-sm border border-purple-200">${j.part_status || '-'}</span></div>
                    </td>
                    <td class="px-4 py-3 text-[10px] font-bold text-slate-700 align-top">
                        <select onclick="event.stopPropagation()" onchange="fastUpdateJob('${j.id}', 'job_status', this.value)" class="bg-slate-50 border border-slate-300 rounded px-2 py-1 outline-none focus:border-amber-500 w-full cursor-pointer font-bold text-[#00320D]">
                            ${safeOptions}
                        </select>
                    </td>
                    <td class="px-4 py-3 text-center align-top">
                        <button onclick="event.stopPropagation(); goToEditJob('${j.id}')" class="bg-[#00320D] text-[#ffffff] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> เปิด</button>
                    </td>
                </tr>
            `;
        });
        finalHtml += `</tbody></table></div>`;
    });

    container.innerHTML = finalHtml;
}

function goToEditJob(jobId) { 
    sessionStorage.setItem('edit_job_id', jobId); 
    window.location.href = 'index.html'; 
}

async function fastUpdateJob(jobId, field, value) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${jobId}/fast-date`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ field, value })
        });
        if (res.ok) {
            const jobIndex = allJobs.findIndex(j => j.id === jobId);
            if(jobIndex > -1) allJobs[jobIndex][field] = value;
            applyFilters(); 
        } else throw new Error();
    } catch (err) { 
        alert('บันทึกข้อมูลไม่สำเร็จ'); 
        fetchDashboardData(); 
    }
}

function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

// ==========================================
// 🚀 ส่งข้อมูล Report ไปที่ LINE
// ==========================================
async function sendReportToLine(targetBranch) {
    const btn = document.getElementById(`btnSendLine_${targetBranch}`);
    const orgHtml = btn.innerHTML;
    
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...`;
    btn.disabled = true;

    try {
        const startDate = document.getElementById('report_start_date').value;
        const endDate = document.getElementById('report_end_date').value;
        const branchName = targetBranch === 'Navamin' ? 'สาขานวมินทร์' : 'สาขารังสิต';
        
        let msg = `\n📋 RIZENIC Report\nสาขา: ${branchName}\nช่วงเวลา: ${startDate || 'ไม่ระบุ'} ถึง ${endDate || 'ไม่ระบุ'}\n`;
        
        if (!window.currentReportDef) {
            throw new Error("ยังไม่มีข้อมูล Report กรุณากดค้นหาบนหน้าจอก่อนครับ");
        }

        const branchJobs = allJobs.filter(j => 
            (targetBranch === 'Navamin' && (j.branch_name === 'Navamin' || j.branch_name === 'สาขานวมินทร์')) ||
            (targetBranch === 'Rangsit' && (j.branch_name === 'Rangsit' || j.branch_name === 'สาขารังสิต'))
        );

        const categories = {
            'customers': '\n👥 จำแนกประเภทลูกค้า',
            'workStatus': '\n🛠️ สถานะงานซ่อม',
            'finance': '\n💵 การเงิน & ออกบิล'
        };

        for (const [catKey, catTitle] of Object.entries(categories)) {
            msg += catTitle + '\n';
            window.currentReportDef[catKey].forEach(item => {
                const count = branchJobs.filter(item.filter).length;
                if (count > 0) {
                    msg += `${item.icon} ${item.label}: ${count}\n`;
                }
            });
        }

        const res = await fetch(`${API_BASE_URL}/api/send-line-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                branch: targetBranch,
                message: msg 
            })
        });

        if (res.ok) {
            alert(`✅ ส่งข้อมูลเข้ากลุ่ม LINE ${branchName} สำเร็จแล้วครับ!`);
        } else {
            const errData = await res.json();
            throw new Error(errData.error || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        }

    } catch (err) {
        alert("❌ ขัดข้อง: " + err.message);
    } finally {
        btn.innerHTML = orgHtml;
        btn.disabled = false;
    }
}