// =====================================
// 📈 ANALYTICS, CHARTS & REPORTS
// =====================================
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    try {
        Chart.register(ChartDataLabels);
    } catch (e) {
        console.warn("ChartDataLabels register warning:", e);
    }
}

function renderKPIs(start, end) {
    const contacted = filteredJobs.filter(j => isDateInRange(j.contact_date, start, end)).length;
    
    const parked = filteredJobs.filter(j => {
        const st = j.job_status || '';
        const inProcess = activeProcessStatuses.some(s => st.includes(s) || st.startsWith(s.substring(0, 2)));
        const targetDate = j.appointment_date || j.arrived_date;
        return inProcess && isDateInRange(targetDate, start, end);
    }).length;

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

function renderDailyReport() {
    const start = document.getElementById('report_start_date')?.value || getFirstDayOfMonth();
    const end = document.getElementById('report_end_date')?.value || getLastDayOfMonth();
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
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `รายงาน: ${item.label}`;
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

// 🎯 กราฟแท่งสถานะ: เรียงตามลำดับที่นายสั่งเป๊ะๆ
function renderStatusChart() {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;

    const start = document.getElementById('dash_start_date')?.value;
    const end = document.getElementById('dash_end_date')?.value;

    // 🌟 ลำดับเป๊ะๆ ตามที่สั่งมา
    const targetStatuses = [
        '01.ติดต่อสอบถาม', '02.รอเสนอประกัน', '03.รอประกันอนุมัติ', 
        '04.รอลูกค้าอนุมัติ', '05.อนุมัติแล้ว', '06.สั่งอะไหล่', 
        '07.รอนัดหมายเข้าซ่อม', '08.นัดหมายแล้วรอเข้าซ่อม', '09.จอดรอเข้าซ่อม', 
        '23.รื้อตรวจสอบความเสียหาย', '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ', 
        '12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', '15.วางบิล Tesla', 
        '16.วางบิล EV ME', '17.รอออกบิล', '18.ลูกค้ายกเลิก', '19.ออกบิลแล้ว', 
        '20.จอดซ่อม TC', '21.พักซ่อม', '22.ปิดงาน'
    ];
    
    const statusCounts = {};
    targetStatuses.forEach(s => statusCounts[s] = 0);

    filteredJobs.forEach(job => {
        const st = (job.job_status || "").trim();
        const prefix = st.substring(0, 2);
        const matchedStatus = targetStatuses.find(t => t.startsWith(prefix));
        
        if (matchedStatus) {
            if (matchedStatus.includes('วางบิล') || matchedStatus.includes('ชำระเงินสด') || matchedStatus.includes('ออกบิลแล้ว') || matchedStatus.includes('ส่งมอบ')) {
                if (!isDateInRange(job.billing_date || job.delivery_date || job.repair_finish_date, start, end)) return;
            }
            statusCounts[matchedStatus]++;
        }
    });

    const activeDataPairs = [];
    targetStatuses.forEach(s => {
        if(statusCounts[s] > 0) {
            activeDataPairs.push({
                label: s.replace(/^[0-9.]+\s*/, ''),
                originalLabel: s,
                count: statusCounts[s]
            });
        }
    });

    // 🌟 เรียงตามลำดับ targetStatuses ที่เราวนลูปไว้ (เอา sort ออก)

    const activeLabels = activeDataPairs.map(item => item.label);
    const activeData = activeDataPairs.map(item => item.count);
    const originalLabels = activeDataPairs.map(item => item.originalLabel);

    const barColors = activeData.map(val => val >= 10 ? '#ef4444' : (val >= 5 ? '#f97316' : '#3b82f6'));

    if (statusChartInstance) statusChartInstance.destroy();
    
    const ctx = canvas.getContext('2d');
    
    statusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: activeLabels, 
            datasets: [{ 
                label: 'จำนวน (คัน)', 
                data: activeData, 
                backgroundColor: barColors, 
                borderRadius: 4, 
                barPercentage: 0.7
            }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                datalabels: { 
                    color: '#334155',
                    font: { family: 'Kanit', weight: 'bold', size: 10 }, 
                    anchor: 'end', 
                    align: 'right', 
                    formatter: (val) => val > 0 ? val : '' 
                }
            }, 
            scales: { 
                y: { grid: { display: false }, ticks: { font: { family: 'Kanit', size: 10 } } }, 
                x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Kanit', size: 10 } } } 
            },
            onClick: (evt, elements) => {
                if(elements.length > 0) openStatusModal(originalLabels[elements[0].index]);
            }
        }
    });
}

function openStatusModal(statusName) {
    const start = document.getElementById('dash_start_date')?.value;
    const end = document.getElementById('dash_end_date')?.value;

    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `รายการ: ${statusName}`;
    const jobsToShow = filteredJobs.filter(job => {
        const st = (job.job_status || "").trim();
        const isMatch = (st.includes(statusName)) && !st.includes('ปิดงานแล้ว');

        if (isMatch) {
            if (statusName.includes('วางบิล') || statusName.includes('ชำระเงินสด') || statusName.includes('ออกบิลแล้ว')) {
                return isDateInRange(job.billing_date, start, end);
            }
            return true;
        }
        return false;
    });

    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

// 🎯 โดนัทสัดส่วนลูกค้า (Filter ตามวันที่เลือกด้านบน)
function renderInsuranceChart() {
    const canvas = document.getElementById('insuranceChart');
    if (!canvas) return;

    const start = document.getElementById('dash_start_date')?.value;
    const end = document.getElementById('dash_end_date')?.value;

    const customerTypes = {};
    filteredJobs.forEach(j => {
        // 🌟 กรองข้อมูลตามวันที่ (ถ้ารถไม่ได้เข้าหรือติดต่อในช่วงเวลานี้ ให้ข้ามไปเลย)
        if (start && end && !isDateInRange(j.arrived_date || j.contact_date || j.appointment_date, start, end)) {
            return;
        }

        const type = (j.customer_type || 'ไม่มีข้อมูล').trim();
        customerTypes[type] = (customerTypes[type] || 0) + 1;
    });

    const sortedTypes = Object.entries(customerTypes).sort((a,b) => b[1] - a[1]);
    const labels = sortedTypes.map(i => i[0]);
    const data = sortedTypes.map(i => i[1]);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];

    if (insuranceChartInstance) insuranceChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    insuranceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: { 
                legend: { position: 'right', labels: { font: { family: 'Kanit', size: 10 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 12 }, formatter: (val) => val > 0 ? val : '' }
            }
        }
    });
}

function renderDailyLineChart(start, end) {
    const canvas = document.getElementById('dailyLineChart');
    if (!canvas || !start || !end) return;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const labels = [];
    const fullDates = [];
    const dataArrived = [];
    const dataTarget = [];
    const dataDelivered = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = `${d.getDate()}/${d.getMonth()+1}`;
        
        labels.push(dayLabel);
        fullDates.push(dateStr);

        dataArrived.push(filteredJobs.filter(j => j.arrived_date && j.arrived_date.split('T')[0] === dateStr).length);
        dataTarget.push(filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr).length);
        dataDelivered.push(filteredJobs.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr).length);
    }

    if (dailyLineChartInstance) dailyLineChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    dailyLineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'รถเข้าจอด', data: dataArrived, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, borderWidth: 2 },
                { label: 'เป้าเสร็จ', data: dataTarget, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3, borderWidth: 2 },
                { label: 'ส่งมอบ', data: dataDelivered, borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3, borderWidth: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'Kanit' } } },
                datalabels: { color: '#334155', font: { family: 'Kanit', weight: 'bold', size: 10 }, align: 'top', offset: 2, formatter: (val) => val > 0 ? val : '' }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Kanit' } } },
                x: { ticks: { font: { family: 'Kanit', size: 10 } } }
            },
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const datasetIndex = elements[0].datasetIndex;
                    const dataIndex = elements[0].index;
                    openDailyLineModal(dailyLineChartInstance.data.datasets[datasetIndex].label, fullDates[dataIndex]);
                }
            }
        }
    });
}

function openDailyLineModal(type, dateStr) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `รายการ ${type} ประจำวันที่: ${dateStr}`;
    const jobsToShow = filteredJobs.filter(j => {
        if (type === 'รถเข้าจอด') return j.arrived_date && j.arrived_date.split('T')[0] === dateStr;
        if (type === 'เป้าเสร็จ') return j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr;
        if (type === 'ส่งมอบ') return j.delivery_date && j.delivery_date.split('T')[0] === dateStr;
        return false;
    });
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function renderPaymentChart(start, end) {
    const canvas = document.getElementById('paymentChart');
    if (!canvas) return;

    const counts = {};
    filteredJobs.filter(j => isDateInRange(j.arrived_date || j.contact_date, start, end)).forEach(j => {
        const type = (j.payment_type || 'ไม่ระบุ').trim();
        counts[type] = (counts[type] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const labels = sorted.map(i => i[0]); 
    const data = sorted.map(i => i[1]);
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

    if (paymentChartInstance) paymentChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    paymentChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? v : '' }
            },
            onClick: (evt, elements) => {
                if (elements.length > 0) openPaymentModal(labels[elements[0].index], start, end);
            }
        }
    });
}

function openPaymentModal(paymentType, start, end) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `ประเภทการชำระเงิน: ${paymentType}`;
    const jobsToShow = filteredJobs.filter(j => {
        const pType = (j.payment_type || 'ไม่ระบุ').trim();
        return pType === paymentType && isDateInRange(j.arrived_date || j.contact_date, start, end);
    });
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function renderFinanceChart(start, end) {
    const canvas = document.getElementById('financeChart');
    if (!canvas) return;

    const billedStatuses = ['ชำระเงินสด', 'ออกบิลแล้ว', 'วางบิล'];
    const managed = filteredJobs.filter(j => {
        const st = j.job_status || '';
        const isBilled = billedStatuses.some(b => st.includes(b));
        return isBilled && isDateInRange(j.billing_date, start, end);
    }).length;

    const unmanaged = filteredJobs.filter(j => (j.job_status || '').includes('รอออกบิล')).length;

    if (financeChartInstance) financeChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['ยังไม่ออกบิล (รอจัดการ)', 'ออกบิลแล้ว (ตามช่วงเวลา)'],
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

let damageFilterMode = 'calendar'; 

function toggleDamageFilterMode() {
    damageFilterMode = (damageFilterMode === 'calendar') ? 'parked' : 'calendar';
    
    const lbl = document.getElementById('lbl_damage_mode');
    const btn = document.getElementById('btn_damage_toggle');
    
    if (damageFilterMode === 'parked') {
        if (lbl) lbl.innerText = 'เฉพาะรถจอดซ่อม';
        if (btn) { btn.classList.remove('bg-red-50', 'text-red-700', 'border-red-200'); btn.classList.add('bg-red-600', 'text-white', 'border-red-600'); }
    } else {
        if (lbl) lbl.innerText = 'ตามปฏิทิน';
        if (btn) { btn.classList.remove('bg-red-600', 'text-white', 'border-red-600'); btn.classList.add('bg-red-50', 'text-red-700', 'border-red-200'); }
    }

    const start = document.getElementById('dash_start_date')?.value;
    const end = document.getElementById('dash_end_date')?.value;
    renderDamageChart(start, end);
}

function renderDamageChart(start, end) {
    const canvas = document.getElementById('damageChart');
    if (!canvas) return;

    const damageMap = {
        'เบา': { count: 0, color: '#10b981' },   
        'กลาง': { count: 0, color: '#facc15' },  
        'หนัก': { count: 0, color: '#ef4444' },  
        'ไม่ระบุ': { count: 0, color: '#94a3b8' } 
    };

    const parkedStatuses = ['09.จอดรอเข้าซ่อม', '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ'];

    const targetJobs = filteredJobs.filter(j => {
        const st = (j.job_status || '').trim();
        if (damageFilterMode === 'parked') {
            return parkedStatuses.some(ps => st.includes(ps) || st.includes(ps.replace(/^[0-9]+\./, '')));
        } else {
            return isDateInRange(j.arrived_date || j.contact_date, start, end);
        }
    });

    targetJobs.forEach(j => {
        const dmg = (j.damage_level || 'ไม่ระบุ').trim();
        if (damageMap[dmg]) {
            damageMap[dmg].count++;
        } else {
            if (dmg.includes('เบา')) damageMap['เบา'].count++;
            else if (dmg.includes('กลาง')) damageMap['กลาง'].count++;
            else if (dmg.includes('หนัก')) damageMap['หนัก'].count++;
            else damageMap['ไม่ระบุ'].count++;
        }
    });

    const labels = []; const data = []; const colors = [];
    Object.keys(damageMap).forEach(key => {
        if (damageMap[key].count > 0) {
            labels.push(key); data.push(damageMap[key].count); colors.push(damageMap[key].color);
        }
    });

    if (damageChartInstance) damageChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    damageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? `${v} คัน` : '' }
            },
            onClick: (evt, elements) => {
                if (elements.length > 0) openDamageModal(labels[elements[0].index], start, end);
            }
        }
    });
}

function openDamageModal(dmgLevel, start, end) {
    const modeText = (damageFilterMode === 'parked') ? 'เฉพาะรถจอดซ่อม' : 'ตามปฏิทิน';
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `ระดับความเสียหาย: ${dmgLevel} (${modeText})`;
    
    const parkedStatuses = ['09.จอดรอเข้าซ่อม', '10.กำลังซ่อม', '11.รถซ่อมเสร็จรอส่งมอบ'];

    const jobsToShow = filteredJobs.filter(j => {
        const st = (j.job_status || '').trim();
        const jDmg = (j.damage_level || 'ไม่ระบุ').trim();
        
        let isDmgMatch = dmgLevel === 'ไม่ระบุ' ? (!jDmg.includes('เบา') && !jDmg.includes('กลาง') && !jDmg.includes('หนัก')) : jDmg.includes(dmgLevel);
        if (!isDmgMatch) return false;

        return damageFilterMode === 'parked' ? parkedStatuses.some(ps => st.includes(ps) || st.includes(ps.replace(/^[0-9]+\./, ''))) : isDateInRange(j.arrived_date || j.contact_date, start, end);
    });

    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function renderPartsStatusChart() {
    const canvas = document.getElementById('partsStatusChart');
    if (!canvas) return;

    const statusSummary = {
        'รอสั่งซื้อ': { cars: 0, parts: 0 },
        'รออะไหล่': { cars: 0, parts: 0 },
        'ติด Back Order': { cars: 0, parts: 0 },
        'มีของ/ครบ': { cars: 0, parts: 0 },
        'รออัปเดต': { cars: 0, parts: 0 }
    };

    const orderingJobs = filteredJobs.filter(j => (j.job_status || '').trim().includes('สั่งอะไหล่'));
    const cleanPlate = str => String(str || '').replace(/\s+/g, '').toLowerCase();

    orderingJobs.forEach(job => {
        const jobIdStr = String(job.id);
        const jobPlate = cleanPlate(job.car_plate);

        const carParts = filteredPartOrders.filter(o => {
            if (o.order_status === 'ยกเลิก') return false;
            const oJobId = String(o.job_id || o.report_id || '');
            if (oJobId && oJobId !== 'undefined' && oJobId !== 'null' && oJobId !== '') return oJobId === jobIdStr;
            return jobPlate && cleanPlate(o.car_plate) === jobPlate;
        });

        let carStatus = 'รอสั่งซื้อ';
        if (carParts.length > 0) {
            const statuses = carParts.map(p => (p.order_status || '').trim());
            if (statuses.some(s => s.includes('รอสั่งซื้อ'))) carStatus = 'รอสั่งซื้อ';
            else if (statuses.some(s => s.includes('Back Order') || s.includes('ติด Back Order'))) carStatus = 'ติด Back Order';
            else if (statuses.some(s => s.includes('รออะไหล่'))) carStatus = 'รออะไหล่';
            else if (statuses.every(s => s.includes('ครบ') || s.includes('มีของ'))) carStatus = 'มีของ/ครบ';
            else carStatus = 'รออัปเดต';
        }

        statusSummary[carStatus].cars += 1;
        statusSummary[carStatus].parts += carParts.length;
    });

    const labels = []; const carData = []; const partsData = [];
    Object.keys(statusSummary).forEach(st => {
        if (statusSummary[st].cars > 0) {
            labels.push(st); carData.push(statusSummary[st].cars); partsData.push(statusSummary[st].parts);
        }
    });

    const statusColorMap = { 'มีของ/ครบ': '#10b981', 'รอสั่งซื้อ': '#ef4444', 'รออะไหล่': '#f59e0b', 'ติด Back Order': '#9333ea', 'รออัปเดต': '#94a3b8' };
    const colors = labels.map(l => statusColorMap[l] || '#64748b');

    if (partsStatusChartInstance) partsStatusChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    partsStatusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: carData, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                tooltip: { callbacks: { label: function(c) { return ` ${c.label}: ${carData[c.dataIndex]} คัน (${partsData[c.dataIndex]} ชิ้น)`; } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, textAlign: 'center', formatter: (v, ctx) => v > 0 ? `${carData[ctx.dataIndex]} คัน\n(${partsData[ctx.dataIndex]} ชิ้น)` : '' }
            },
            onClick: (evt, elements) => { if (elements.length > 0) openPartsStatusModal(labels[elements[0].index]); }
        }
    });
}

function openPartsStatusModal(statusLabel) {
    const orderingJobs = filteredJobs.filter(j => (j.job_status || '').trim().includes('สั่งอะไหล่'));
    const cleanPlate = str => String(str || '').replace(/\s+/g, '').toLowerCase();

    let totalPartsInModal = 0;
    const jobsToShow = orderingJobs.filter(job => {
        const jobIdStr = String(job.id);
        const jobPlate = cleanPlate(job.car_plate);

        const carParts = filteredPartOrders.filter(o => {
            if (o.order_status === 'ยกเลิก') return false;
            const oJobId = String(o.job_id || o.report_id || '');
            if (oJobId && oJobId !== 'undefined' && oJobId !== 'null' && oJobId !== '') return oJobId === jobIdStr;
            return jobPlate && cleanPlate(o.car_plate) === jobPlate;
        });

        let carStatus = 'รอสั่งซื้อ';
        if (carParts.length > 0) {
            const statuses = carParts.map(p => (p.order_status || '').trim());
            if (statuses.some(s => s.includes('รอสั่งซื้อ'))) carStatus = 'รอสั่งซื้อ';
            else if (statuses.some(s => s.includes('Back Order') || s.includes('ติด Back Order'))) carStatus = 'ติด Back Order';
            else if (statuses.some(s => s.includes('รออะไหล่'))) carStatus = 'รออะไหล่';
            else if (statuses.every(s => s.includes('ครบ') || s.includes('มีของ'))) carStatus = 'มีของ/ครบ';
            else carStatus = 'รออัปเดต';
        }

        if (carStatus === statusLabel) { totalPartsInModal += carParts.length; return true; }
        return false;
    });

    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `รายการรถที่สถานะอะไหล่: ${statusLabel} (${jobsToShow.length} คัน / รวม ${totalPartsInModal} ชิ้น)`;
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function renderMechanicChart() {
    const canvas = document.getElementById('mechanicChart');
    if (!canvas) return;

    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    const targetStatuses = ["09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", "จอดรอเข้าซ่อม", "กำลังซ่อม", "รถซ่อมเสร็จรอส่งมอบ"];
    
    const counts = {};
    const targetJobs = filteredJobs.filter(j => targetStatuses.some(ts => (j.job_status || '').trim().includes(ts)));

    targetJobs.forEach(j => {
        const s = computeHighestStationIFS(j);
        if(activeStations.includes(s)) {
            const shortName = s.replace(/[0-9.]/g, ''); 
            counts[shortName] = (counts[shortName] || 0) + 1;
        }
    });

    const labels = Object.keys(counts); 
    const data = Object.values(counts);
    const stationColors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
    
    if (mechanicChartInstance) mechanicChartInstance.destroy();
    const ctx = canvas.getContext('2d');
    mechanicChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: stationColors.slice(0, labels.length), borderWidth: 2, borderColor: '#ffffff' }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? `${v} คัน` : '' }
            },
            onClick: (evt, elements) => { if (elements.length > 0) openMechanicModal(labels[elements[0].index]); }
        }
    });
}

function openMechanicModal(stationName) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `รถในสถานีช่าง (${stationName}): สถานะ 09, 10, 11`;
    const targetStatuses = ["09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", "จอดรอเข้าซ่อม", "กำลังซ่อม", "รถซ่อมเสร็จรอส่งมอบ"];

    const jobsToShow = filteredJobs.filter(j => {
        const st = (j.job_status || '').trim();
        if (!targetStatuses.some(ts => st.includes(ts))) return false;
        const s = computeHighestStationIFS(j);
        return s.replace(/[0-9.]/g, '') === stationName;
    });

    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}