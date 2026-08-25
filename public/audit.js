const API_BASE_URL = window.location.origin;

let allReportsData = [];
let allPartOrdersData = [];
let userBranch = '';

const activePrefixes = ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];

document.addEventListener('DOMContentLoaded', async () => {
    userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    await fetchInitialAuditData();
});

async function fetchInitialAuditData() {
    try {
        const [resReports, resParts] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/part-orders`)
        ]);

        const rawReports = await resReports.json();
        allReportsData = Array.isArray(rawReports) ? rawReports.filter(r => r.branch_name === userBranch) : [];

        const rawParts = await resParts.json();
        allPartOrdersData = Array.isArray(rawParts) ? rawParts : [];

        buildSADropdown();
        runDiagnosticScan();
    } catch (e) {
        console.error("Diagnostic Fetch Error:", e);
    }
}

function buildSADropdown() {
    const select = document.getElementById('sa_filter');
    const saList = [...new Set(allReportsData.map(r => r.sa_owner).filter(Boolean))].sort();
    select.innerHTML = '<option value="ALL">-- แสดง SA ทุกคน --</option>' + 
        saList.map(sa => `<option value="${sa}">${sa}</option>`).join('');
}

function runDiagnosticScan() {
    const selectedSA = document.getElementById('sa_filter').value;
    const filteredJobs = selectedSA === 'ALL' ? allReportsData : allReportsData.filter(r => r.sa_owner === selectedSA);

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. ตรวจสอบรถเข้าจอดล่าช้า
    scanLateIntake(filteredJobs, todayStr);

    // 2. ตรวจสอบการนัดเป้าเสร็จผิดเกณฑ์ SLA
    scanSLAMismatch(filteredJobs);

    // 3. ตรวจสอบการเลยกำหนดส่งมอบ
    scanOverdueDelivery(filteredJobs, todayStr);

    // 4. ตรวจสอบความสัมพันธ์อะไหล่
    scanPartsDependency(filteredJobs, todayStr);
}

// -------------------------------------------------------------
// 1. รถเข้าจอดล่าช้า (Late Intake)
// -------------------------------------------------------------
function scanLateIntake(jobs, todayStr) {
    const list = jobs.filter(j => {
        if (!j.arrived_date) return false;
        const arrDate = j.arrived_date.split('T')[0];
        const st = j.job_status || '';
        const isAlreadyIn = activePrefixes.some(p => st.startsWith(p));
        
        return arrDate <= todayStr && !isAlreadyIn;
    });

    document.getElementById('cnt_late_intake').innerText = list.length;
    document.getElementById('title_late_intake').innerText = `พบ ${list.length} คัน`;

    const tbody = document.getElementById('tb_late_intake');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-400 py-6 font-bold">🎉 ไม่พบรายการนัดเข้าจอดล่าช้า</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(j => `
        <tr>
            <td class="font-black text-rose-600 font-mono">${j.car_plate || '-'}</td>
            <td class="font-bold text-slate-700">${j.sa_owner || 'ไม่ระบุ'}</td>
            <td>${j.car_brand || '-'} ${j.car_model || ''}</td>
            <td class="font-mono font-bold text-slate-600">${j.arrived_date ? j.arrived_date.split('T')[0] : '-'}</td>
            <td><span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[11px]">${j.job_status || 'รออัปเดต'}</span></td>
            <td class="text-rose-600 font-bold text-xs"><i class="fa-solid fa-phone mr-1"></i> ติดตามลูกค้าขอยกเลิก/เลื่อนคิว หรือเปลี่ยนสถานะเข้าอู่</td>
        </tr>
    `).join('');
}

// -------------------------------------------------------------
// 2. นัดเป้าเสร็จผิดเกณฑ์ SLA
// -------------------------------------------------------------
function scanSLAMismatch(jobs) {
    const list = [];

    jobs.forEach(j => {
        if (!j.target_finish_date) return;
        const startDateStr = j.arrived_date ? j.arrived_date.split('T')[0] : (j.contact_date ? j.contact_date.split('T')[0] : null);
        if (!startDateStr) return;

        const mainParts = j.main_part_name ? j.main_part_name.split(',').map(s=>s.trim()).filter(p => p && !p.includes('ไม่ชิ้นงาน')) : [];
        const mainCount = mainParts.length;
        if (mainCount === 0) return;

        const isHeavy = j.damage_level === 'หนัก';
        const hasGlass = (j.main_part_name && j.main_part_name.includes('กระจก')) || (j.sub_part_name && j.sub_part_name.includes('กระจก'));

        // คำนวณวันมาตรฐาน
        let stdDays = 3;
        if (mainCount === 2) stdDays = 5;
        else if (mainCount >= 3) stdDays = 5 + (mainCount - 2);

        // คำนวณวันจริงที่ SA นัดไว้
        const dStart = new Date(startDateStr);
        const dTarget = new Date(j.target_finish_date.split('T')[0]);
        const diffDays = Math.ceil((dTarget - dStart) / (1000 * 60 * 60 * 24));

        let isMismatch = false;
        let reason = '';

        if (!isHeavy && !hasGlass) {
            if (diffDays < stdDays) {
                isMismatch = true;
                reason = `นัดเร็วกว่าเกณฑ์ (ตั้งไว้ ${diffDays} วัน / เกณฑ์ต่ำสุด ${stdDays} วัน)`;
            }
        }

        if (isMismatch) {
            list.push({ job: j, mainCount, stdDays, diffDays, reason });
        }
    });

    document.getElementById('cnt_sla_mismatch').innerText = list.length;
    document.getElementById('title_sla_mismatch').innerText = `พบ ${list.length} คัน`;

    const tbody = document.getElementById('tb_sla_mismatch');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-400 py-6 font-bold">🎉 SA ทุกคนกำหนดวันซ่อมเสร็จได้ตามเกณฑ์มาตรฐานดีเยี่ยม</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => `
        <tr>
            <td class="font-black text-amber-700 font-mono">${item.job.car_plate || '-'}</td>
            <td class="font-bold text-slate-700">${item.job.sa_owner || 'ไม่ระบุ'}</td>
            <td class="text-center font-black text-blue-600">${item.mainCount} ชิ้น</td>
            <td class="text-center font-bold text-slate-600">${item.stdDays} วัน</td>
            <td class="text-center font-bold text-rose-600">${item.diffDays} วัน</td>
            <td class="font-bold text-rose-600 text-xs"><i class="fa-solid fa-circle-exclamation mr-1"></i> ${item.reason}</td>
        </tr>
    `).join('');
}

// -------------------------------------------------------------
// 3. เลยกำหนดส่งมอบ (Overdue Delivery)
// -------------------------------------------------------------
function scanOverdueDelivery(jobs, todayStr) {
    const list = jobs.filter(j => {
        if (!j.delivery_date) return false;
        const delDate = j.delivery_date.split('T')[0];
        const st = j.job_status || '';
        const isDelivered = st.includes('ส่งมอบแล้ว') || st === '12.ส่งมอบ' || st.includes('ออกบิลแล้ว') || st.includes('ชำระเงินสด');

        return delDate < todayStr && !isDelivered;
    });

    document.getElementById('cnt_overdue_del').innerText = list.length;
    document.getElementById('title_overdue_del').innerText = `พบ ${list.length} คัน`;

    const tbody = document.getElementById('tb_overdue_del');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-400 py-6 font-bold">🎉 ไม่มีคิวรถส่งมอบล่าช้า</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(j => `
        <tr>
            <td class="font-black text-purple-700 font-mono">${j.car_plate || '-'}</td>
            <td class="font-bold text-slate-700">${j.sa_owner || 'ไม่ระบุ'}</td>
            <td>${j.customer_name || '-'}</td>
            <td class="font-mono font-bold text-rose-600">${j.delivery_date.split('T')[0]}</td>
            <td><span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold text-[11px]">${j.job_status || 'รอส่งมอบ'}</span></td>
            <td class="text-purple-700 font-bold text-xs"><i class="fa-solid fa-bell mr-1"></i> เลื่อนวันส่งมอบ หรือ รีบแจ้ง SA ปิดงานส่งมอบหน้าร้าน</td>
        </tr>
    `).join('');
}

// -------------------------------------------------------------
// 4. ความสัมพันธ์อะไหล่ (Parts Dependency)
// -------------------------------------------------------------
function scanPartsDependency(jobs, todayStr) {
    const list = [];
    const clean = s => String(s || '').replace(/\s+/g, '').toUpperCase();

    jobs.forEach(j => {
        if (!j.target_finish_date) return;
        const targetDateStr = j.target_finish_date.split('T')[0];
        
        const carPlateClean = clean(j.car_plate);
        const relatedPOs = allPartOrdersData.filter(po => clean(po.car_plate) === carPlateClean && po.order_status !== 'ยกเลิก');

        relatedPOs.forEach(po => {
            const isArrived = po.order_status && (po.order_status.includes('ครบ') || po.order_status.includes('มีสต๊อก'));
            if (isArrived) return;

            const etaStr = po.est_arrival_date ? po.est_arrival_date.split('T')[0] : null;

            // เคส 1: ETA ช้ากว่าวันเป้าเสร็จ
            if (etaStr && etaStr > targetDateStr) {
                list.push({
                    job: j, po,
                    alertType: 'CRITICAL',
                    msg: `ETA อะไหล่เข้า (${etaStr}) ช้ากว่าเป้าซ่อมเสร็จ (${targetDateStr})`
                });
            } 
            // เคส 2: เหลือน้อยกว่า 3 วันจะถึงเป้าเสร็จ แต่อะไหล่ยังไม่เข้า
            else {
                const dToday = new Date(todayStr);
                const dTarget = new Date(targetDateStr);
                const daysLeft = Math.ceil((dTarget - dToday) / (1000 * 60 * 60 * 24));

                if (daysLeft >= 0 && daysLeft <= 3) {
                    list.push({
                        job: j, po,
                        alertType: 'WARNING',
                        msg: `เหลือเวลาอีก ${daysLeft} วันจะถึงเป้าเสร็จ แต่อะไหล่ยังค้างรับ [${po.order_status || 'รอสั่ง'}]`
                    });
                }
            }
        });
    });

    document.getElementById('cnt_part_risk').innerText = list.length;
    document.getElementById('title_part_risk').innerText = `พบ ${list.length} รายการ`;

    const tbody = document.getElementById('tb_part_risk');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-400 py-6 font-bold">🎉 อะไหล่ทุกชิ้นสัมพันธ์กับกำหนดวันซ่อมเสร็จราบรื่นดี</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => `
        <tr>
            <td class="font-black text-blue-700 font-mono">${item.job.car_plate || '-'}</td>
            <td class="font-bold text-slate-700">${item.job.sa_owner || 'ไม่ระบุ'}</td>
            <td class="font-bold text-slate-800">${item.po.part_name || '-'} <span class="text-blue-600 font-mono">[${item.po.part_no || '-'}]</span></td>
            <td class="font-mono font-bold text-amber-600">${item.po.est_arrival_date ? item.po.est_arrival_date.split('T')[0] : 'ยังไม่ระบุ ETA'}</td>
            <td class="font-mono font-bold text-slate-600">${item.job.target_finish_date.split('T')[0]}</td>
            <td class="font-bold text-xs ${item.alertType === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'}">
                <i class="fa-solid fa-truck-fast mr-1"></i> ${item.msg}
            </td>
        </tr>
    `).join('');
}