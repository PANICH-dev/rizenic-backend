// =====================================
// 📈 ANALYTICS, CHARTS & REPORTS
// =====================================
Chart.register(ChartDataLabels);

function renderKPIs(start, end) {
    const contacted = filteredJobs.filter(j => isDateInRange(j.contact_date, start, end)).length;
    
    const parked = filteredJobs.filter(j => {
        const st = j.job_status || '';
        const inProcess = activeProcessStatuses.some(s => st.includes(s) || st.startsWith(s.substring(0, 2)));
        return inProcess && isDateInRange(j.arrived_date, start, end);
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

function openFilteredModal(type) {
    const start = document.getElementById('dash_start_date').value;
    const end = document.getElementById('dash_end_date').value;
    
    let jobsToShow = []; 
    let title = "";
    if(type === 'contacted') { jobsToShow = filteredJobs.filter(j => isDateInRange(j.contact_date, start, end)); title = "1. รถเข้ามาที่ศูนย์"; }
    
    if(type === 'parked') { 
        jobsToShow = filteredJobs.filter(j => {
            const st = j.job_status || '';
            const inProcess = activeProcessStatuses.some(s => st.includes(s) || st.startsWith(s.substring(0, 2)));
            return inProcess && isDateInRange(j.arrived_date, start, end);
        }); 
        title = "2. รถที่เข้ามาจอดในศูนย์ (สถานะ 01-11)"; 
    }

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
    document.getElementById('modal_status_name').innerText = `รายงาน: ${item.label}`;
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

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
            body: JSON.stringify({ branch: targetBranch, message: msg })
        });

        if (res.ok) alert(`✅ ส่งข้อมูลเข้ากลุ่ม LINE ${branchName} สำเร็จแล้วครับ!`);
        else throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");

    } catch (err) {
        alert("❌ ขัดข้อง: " + err.message);
    } finally {
        btn.innerHTML = orgHtml;
        btn.disabled = false;
    }
}

// 🎯 แก้ไข: กราฟสถานะให้กรองทุกสถานะที่เกี่ยวกับบิลด้วยวันที่ออกบิล
function renderStatusChart() {
    const start = document.getElementById('dash_start_date').value;
    const end = document.getElementById('dash_end_date').value;

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
                // บังคับกรองเฉพาะวันที่ออกบิล (billing_date) ตรงกับที่ค้นหา
                if (matchedStatus.includes('วางบิล') || matchedStatus.includes('ชำระเงินสด') || matchedStatus.includes('ออกบิลแล้ว')) {
                    if (!isDateInRange(job.billing_date, start, end)) return;
                }
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
                datalabels: { color: '#ffffff', font: { family: 'Kanit', weight: 'bold', size: 10 }, anchor: 'end', align: 'bottom', formatter: (val) => val > 0 ? val : '' }
            }, 
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } },
            onClick: (evt, elements) => {
                if(elements.length > 0) openStatusModal(labels[elements[0].index]);
            }
        }
    });
}

function openStatusModal(statusName) {
    const start = document.getElementById('dash_start_date').value;
    const end = document.getElementById('dash_end_date').value;

    document.getElementById('modal_status_name').innerText = `รายการ: ${statusName.replace(/^[0-9]+\./, '')}`;
    const jobsToShow = filteredJobs.filter(job => {
        const st = (job.job_status || "").trim();
        const isMatch = (st === statusName || st.includes(statusName)) && !st.includes('ปิดงานแล้ว');

        if (isMatch) {
            // บังคับให้ Modal แสดงข้อมูลตรงกับกราฟ (กรองด้วย Billing Date)
            if (statusName.includes('วางบิล') || statusName.includes('ชำระเงินสด') || statusName.includes('ออกบิลแล้ว')) {
                return isDateInRange(job.billing_date, start, end);
            }
            return true;
        }
        return false;
    });

    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

function renderInsuranceChart() {
    const customerTypes = {};
    filteredJobs.forEach(j => {
        const type = (j.customer_type || 'ไม่มีข้อมูล').trim();
        customerTypes[type] = (customerTypes[type] || 0) + 1;
    });

    const sortedTypes = Object.entries(customerTypes).sort((a,b) => b[1] - a[1]);
    const labels = sortedTypes.map(i => i[0]);
    const data = sortedTypes.map(i => i[1]);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];

    if (insuranceChartInstance) insuranceChartInstance.destroy();
    const ctx = document.getElementById('insuranceChart').getContext('2d');
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

function renderPaymentChart() {
    const paymentTypes = {};
    filteredJobs.forEach(j => {
        const type = (j.payment_type || 'ไม่ระบุ').trim();
        paymentTypes[type] = (paymentTypes[type] || 0) + 1;
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

function renderFinanceChart(start, end) {
    const billedStatuses = ['ชำระเงินสด', 'ออกบิลแล้ว', 'วางบิล'];
    const managed = filteredJobs.filter(j => {
        const st = j.job_status || '';
        const isBilled = billedStatuses.some(b => st.includes(b));
        return isBilled && isDateInRange(j.billing_date, start, end);
    }).length;

    const unmanaged = filteredJobs.filter(j => (j.job_status || '').includes('รอออกบิล')).length;

    if (financeChartInstance) financeChartInstance.destroy();
    const ctx = document.getElementById('financeChart').getContext('2d');
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

// ==========================================
// 📈 1. กราฟเส้นรายวัน (กรองตามปฏิทิน)
// ==========================================
function renderDailyLineChart(start, end) {
    if (!start || !end) return;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const labels = [];
    const dataArrived = [];
    const dataTarget = [];
    const dataDelivered = [];

    // วนลูปสร้างวันที่
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = `${d.getDate()}/${d.getMonth()+1}`;
        labels.push(dayLabel);

        // นับจำนวนรถเข้าจอด (arrived_date)
        const arrCount = filteredJobs.filter(j => j.arrived_date && j.arrived_date.split('T')[0] === dateStr).length;
        dataArrived.push(arrCount);

        // นับจำนวนเป้าเสร็จ (target_finish_date)
        const tarCount = filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr).length;
        dataTarget.push(tarCount);

        // นับจำนวนรถส่งมอบ (delivery_date)
        const delCount = filteredJobs.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr).length;
        dataDelivered.push(delCount);
    }

    if (dailyLineChartInstance) dailyLineChartInstance.destroy();
    const ctx = document.getElementById('dailyLineChart').getContext('2d');
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
                datalabels: { 
                    color: '#334155', font: { family: 'Kanit', weight: 'bold', size: 10 },
                    align: 'top', offset: 2,
                    formatter: (val) => val > 0 ? val : '' // โชว์ค่าเฉพาะที่มีค่ามากกว่า 0
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Kanit' } } },
                x: { ticks: { font: { family: 'Kanit', size: 10 } } }
            }
        }
    });
}

// ==========================================
// 🍩 2. กราฟ Damage Level (กรองตามปฏิทินจากวันที่รถเข้า)
// ==========================================
function renderDamageChart(start, end) {
    const counts = {};
    filteredJobs.filter(j => isDateInRange(j.arrived_date || j.contact_date, start, end)).forEach(j => {
        const dmg = (j.damage_level || 'ไม่ระบุ').trim();
        counts[dmg] = (counts[dmg] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);
    const colors = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#94a3b8'];

    if (damageChartInstance) damageChartInstance.destroy();
    const ctx = document.getElementById('damageChart').getContext('2d');
    damageChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? v : '' }
            }
        }
    });
}

// ==========================================
// 🍩 3. อัปเดต Payment Chart (รับค่า Start/End เพื่อกรองปฏิทิน)
// ==========================================
function renderPaymentChart(start, end) {
    const counts = {};
    // กรองรถที่เข้าจอดหรือติดต่อ ในช่วงเวลาปฏิทิน
    filteredJobs.filter(j => isDateInRange(j.arrived_date || j.contact_date, start, end)).forEach(j => {
        const type = (j.payment_type || 'ไม่ระบุ').trim();
        counts[type] = (counts[type] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

    const canvas = document.getElementById('paymentChart');
    if (!canvas) return;

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
            }
        }
    });
}

// ==========================================
// 🍩 4. กราฟสถานะอะไหล่ (ดึงจาก filteredPartOrders)
// ==========================================
function renderPartsStatusChart() {
    const counts = {};
    const pendingParts = filteredPartOrders.filter(o => o.order_status !== 'ยกเลิก');
    
    pendingParts.forEach(o => {
        let st = (o.order_status || 'รออัปเดต').trim();
        if (st.includes('ครบ') || st.includes('มีของ')) st = 'มีของ/ครบ';
        counts[st] = (counts[st] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = labels.map(l => {
        if(l === 'มีของ/ครบ') return '#10b981'; // เขียว
        if(l === 'รอสั่งซื้อ') return '#ef4444'; // แดง
        if(l === 'รออะไหล่') return '#f59e0b'; // ส้ม
        if(l === 'ติด Back Order') return '#9333ea'; // ม่วง
        return '#94a3b8'; // เทา
    });

    if (partsStatusChartInstance) partsStatusChartInstance.destroy();
    const ctx = document.getElementById('partsStatusChart').getContext('2d');
    partsStatusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? v : '' }
            }
        }
    });
}

// ==========================================
// 🍩 5. กราฟสถานะช่าง (ดึงจากรถที่กำลังซ่อม)
// ==========================================
function renderMechanicChart() {
    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    const counts = {};
    
    // อาศัยฟังก์ชัน computeHighestStationIFS จากไฟล์ dashboard_tables.js
    filteredJobs.filter(j => !j.job_status?.includes('ส่งมอบแล้ว')).forEach(j => {
        const s = computeHighestStationIFS(j);
        if(activeStations.includes(s)) {
            const shortName = s.replace(/[0-9.]/g, ''); // ตัดตัวเลขข้างหน้าออก
            counts[shortName] = (counts[shortName] || 0) + 1;
        }
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    
    if (mechanicChartInstance) mechanicChartInstance.destroy();
    const ctx = document.getElementById('mechanicChart').getContext('2d');
    mechanicChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: '#f97316', borderWidth: 1, borderColor: '#fff' }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? v : '' }
            },
            // สุ่มสีโทนส้ม-เหลือง-แดง ให้สถานีช่าง
            elements: { arc: { backgroundColor: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#f59e0b', '#d97706', '#b45309'] } }
        }
    });
}

// ==========================================
// 🍩 5. กราฟสถานะช่าง (ดึงจากรถที่กำลังซ่อม)
// ==========================================
function renderMechanicChart() {
    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    const counts = {};
    
    // อาศัยฟังก์ชัน computeHighestStationIFS จากไฟล์ dashboard_tables.js
    filteredJobs.filter(j => !j.job_status?.includes('ส่งมอบแล้ว')).forEach(j => {
        const s = computeHighestStationIFS(j);
        if(activeStations.includes(s)) {
            const shortName = s.replace(/[0-9.]/g, ''); // ตัดตัวเลขข้างหน้าออก
            counts[shortName] = (counts[shortName] || 0) + 1;
        }
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const stationColors = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#f59e0b', '#d97706', '#b45309', '#ca8a04', '#eab308', '#facc15'];
    
    if (mechanicChartInstance) mechanicChartInstance.destroy();
    const ctx = document.getElementById('mechanicChart').getContext('2d');
    mechanicChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: stationColors.slice(0, labels.length), // ดึงสีมาใช้ตามจำนวนข้อมูลที่มี
                borderWidth: 1, 
                borderColor: '#fff' 
            }] 
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '50%',
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Kanit', size: 9 } } },
                datalabels: { color: '#fff', font: { family: 'Kanit', weight: 'bold', size: 10 }, formatter: (v) => v > 0 ? v : '' }
            }
        }
    });
}