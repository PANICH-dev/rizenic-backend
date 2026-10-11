const API_BASE_URL = window.location.origin;
let currentClientJob = null;

// รายชื่อสถานีช่างสำหรับลูปขั้นตอนงานซ่อมตัวถังและทำสี
const REPAIR_STATIONS = [
    { key: 'kho', name: 'เคาะตัวถังและจัดทรง', icon: 'fa-hammer' },
    { key: 'pou', name: 'โป๊วสีและแต่งผิว', icon: 'fa-fill-drip' },
    { key: 'puan', name: 'พ่นสีพื้นและเตรียมพื้นผิว', icon: 'fa-spray-can-sparkles' },
    { key: 'pon', name: 'พ่นสีจริงและเคลือบเงา', icon: 'fa-spray-can' },
    { key: 'prak', name: 'ประกอบชิ้นส่วนตัวถัง', icon: 'fa-screwdriver-wrench' },
    { key: 'kat', name: 'ขัดสีและทำความสะอาด', icon: 'fa-wand-magic-sparkles' },
    { key: 'qc', name: 'ตรวจสอบคุณภาพงานซ่อม (QC)', icon: 'fa-clipboard-check' }
];

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlate = urlParams.get('plate') || urlParams.get('id');
    const urlPhone = urlParams.get('phone');

    if (urlPlate) {
        autoLoginFromUrl(urlPlate, urlPhone);
        return;
    }

    const savedJob = sessionStorage.getItem('client_job_data');
    if (savedJob) {
        try {
            currentClientJob = JSON.parse(savedJob);
            showDashboard(currentClientJob);
        } catch (e) {
            sessionStorage.removeItem('client_job_data');
        }
    }
});

async function handleClientLogin(e) {
    e.preventDefault();
    const plateInput = document.getElementById('client_car_plate')?.value?.trim() || '';
    const phoneInput = document.getElementById('client_phone')?.value?.trim() || '';

    if (!plateInput || !phoneInput) {
        alert('⚠️ กรุณากรอกทะเบียนรถและเบอร์โทรศัพท์ให้ครบถ้วนครับ');
        return;
    }

    await verifyAndFetchJob(plateInput, phoneInput);
}

async function verifyAndFetchJob(plate, phone) {
    const btnSubmit = document.getElementById('btn_client_submit');
    const oldText = btnSubmit ? btnSubmit.innerHTML : '';
    if (btnSubmit) {
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบ...';
        btnSubmit.disabled = true;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`);
        if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลได้');

        const reports = await res.json();
        const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
        const cleanPhone = phone ? phone.replace(/[- ]/g, '') : '';

        const matchedJob = reports.find(r => {
            const rPlate = (r.car_plate || '').replace(/\s+/g, '').toUpperCase();
            const rPhone = (r.phone_number || r.customer_phone || '').replace(/[- ]/g, '');

            if (cleanPhone) {
                return rPlate === cleanPlate && rPhone.includes(cleanPhone);
            }
            return rPlate === cleanPlate || String(r.id) === cleanPlate;
        });

        if (matchedJob) {
            currentClientJob = matchedJob;
            sessionStorage.setItem('client_job_data', JSON.stringify(matchedJob));
            showDashboard(matchedJob);
        } else {
            alert('❌ ไม่พบข้อมูลงานซ่อมสำหรับทะเบียนรถหรือเบอร์โทรศัพท์นี้');
        }

    } catch (err) {
        console.error("Tracking Error:", err);
        alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
        if (btnSubmit) {
            btnSubmit.innerHTML = oldText;
            btnSubmit.disabled = false;
        }
    }
}

function showDashboard(job) {
    document.getElementById('client_login_screen').classList.add('hidden');
    document.getElementById('client_dashboard').classList.remove('hidden');
    document.getElementById('btn_logout_client').classList.remove('hidden');

    document.getElementById('disp_car_plate').innerText = job.car_plate || '-';
    document.getElementById('disp_car_brand_model').innerText = `${job.car_brand || ''} ${job.car_model || ''}`.trim() || 'รถยนต์ของคุณ';
    document.getElementById('disp_customer_name').innerText = job.customer_name || '-';

    document.getElementById('disp_arrived_date').innerText = formatThaiDate(job.arrived_date);
    document.getElementById('disp_target_date').innerText = formatThaiDate(job.target_finish_date);
    document.getElementById('disp_delivery_date').innerText = formatThaiDate(job.delivery_date);

    document.getElementById('disp_status_badge').innerText = job.job_status || 'กำลังดำเนินการ';

    renderConveyorTimeline(job);
}

// 🛠️ วาดสายพานสถานะ (Conveyor Timeline System)
function renderConveyorTimeline(job) {
    const container = document.getElementById('conveyor_timeline_container');
    if (!container) return;

    // แกะ JSON ลิงก์โฟลเดอร์รูปภาพของแต่ละสถานี
    let stationLinks = {};
    if (job.customer_station_links) {
        try {
            stationLinks = typeof job.customer_station_links === 'string' 
                ? JSON.parse(job.customer_station_links) 
                : job.customer_station_links;
        } catch (e) { stationLinks = {}; }
    }

    const currentStatus = job.job_status || '';

    // เช็คสภาวะแต่ละเฟส
    const isPreRepairDone = Boolean(job.arrived_date || /^(09|10|11|12|22)/.test(currentStatus));
    const isPostRepairDone = Boolean(job.repair_finish_date || job.station_ready || /^(11|12|22)/.test(currentStatus));
    const isDeliveryDone = Boolean(/^(12\.ส่งมอบ|12\.ส่งมอบแล้ว|22\.ปิดงาน)/.test(currentStatus));

    // เช็คสถานีย่อยว่าทำถึงขั้นไหน
    let lastCompletedRepairIdx = -1;
    REPAIR_STATIONS.forEach((st, idx) => {
        if (job[`station_${st.key}`] === true || job[`station_${st.key}`] === 'true' || job[`station_${st.key}`] === 1) {
            lastCompletedRepairIdx = idx;
        }
    });

    const isCurrentlyInRepairLoop = isPreRepairDone && !isPostRepairDone;

    let html = `<div class="relative border-l-2 border-slate-200 ml-5 space-y-8 py-2">`;

    // 🔴 1. โฟลเดอร์ก่อนซ่อม (Pre-Repair Phase)
    const preRepairLink = stationLinks.before || job.customer_drive_link || job.drive_folder_link;
    html += `
        <div class="relative pl-8">
            <div class="absolute -left-[17px] top-0 w-8 h-8 ${isPreRepairDone ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900 active-pulse-node'} rounded-full border-4 border-white shadow-md flex items-center justify-center text-xs font-bold">
                <i class="fa-solid ${isPreRepairDone ? 'fa-check' : 'fa-clipboard-list'}"></i>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center justify-between">
                    <span class="font-black text-slate-800 text-sm">1. สภาพรถก่อนเข้าซ่อม</span>
                    ${isPreRepairDone ? '<span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold border border-emerald-100"><i class="fa-solid fa-check mr-1"></i>เรียบร้อย</span>' : '<span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold border border-amber-100"><i class="fa-solid fa-spinner fa-spin mr-1"></i>กำลังดำเนินการ</span>'}
                </div>
                <p class="text-xs text-slate-400 mt-0.5">เสนอประกัน / อนุมัติเคลม / สั่งซื้ออะไหล่ / นัดหมายเข้าซ่อม</p>
                ${preRepairLink ? `
                    <div class="mt-2.5">
                        <a href="${preRepairLink}" target="_blank" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition shadow-sm">
                            <i class="fa-solid fa-folder-open text-emerald-500"></i> เปิดดูรูปโฟลเดอร์ก่อนซ่อม
                        </a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // 🔴 2. สายพานสถานีซ่อมตัวถังและทำสี (In-Repair Conveyor Loop)
    html += `
        <div class="relative pl-8">
            <div class="absolute -left-[17px] top-0 w-8 h-8 ${isPostRepairDone ? 'bg-emerald-500 text-white' : (isCurrentlyInRepairLoop ? 'bg-amber-500 text-white active-pulse-node' : 'bg-slate-200 text-slate-400')} rounded-full border-4 border-white shadow-md flex items-center justify-center text-xs font-bold">
                <i class="fa-solid fa-screwdriver-wrench"></i>
            </div>
            
            <div class="flex flex-col">
                <div class="flex items-center justify-between mb-3">
                    <span class="font-black text-slate-800 text-sm">2. ขั้นตอนงานซ่อมแซมตัวถังและทำสี</span>
                    ${isPostRepairDone ? '<span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold border border-emerald-100">ซ่อมเสร็จแล้ว</span>' : (isCurrentlyInRepairLoop ? '<span class="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold border border-amber-100"><i class="fa-solid fa-gear fa-spin mr-1"></i>กำลังซ่อมแซม</span>' : '')}
                </div>

                <div class="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-4">
    `;

    REPAIR_STATIONS.forEach((st, idx) => {
        const isStDone = idx <= lastCompletedRepairIdx;
        const isStCurrent = isCurrentlyInRepairLoop && (idx === lastCompletedRepairIdx + 1);
        const stPhotoUrl = stationLinks[st.key];

        html += `
            <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/60 last:border-b-0 last:pb-0">
                <div class="flex items-center gap-3">
                    <div class="w-7 h-7 rounded-xl ${isStDone ? 'bg-emerald-500 text-white' : (isStCurrent ? 'bg-amber-400 text-slate-900 animate-pulse' : 'bg-slate-200 text-slate-400')} flex items-center justify-center text-xs shrink-0 shadow-sm">
                        <i class="fa-solid ${st.icon}"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold ${isStDone ? 'text-slate-800' : (isStCurrent ? 'text-amber-900 font-black' : 'text-slate-400')}">${st.name}</p>
                        ${isStCurrent ? '<span class="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-0.5"><i class="fa-solid fa-circle-notch fa-spin"></i> ช่างกำลังอยู่ในขั้นตอนนี้</span>' : ''}
                    </div>
                </div>

                ${stPhotoUrl ? `
                    <a href="${stPhotoUrl}" target="_blank" class="px-3 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-[11px] font-bold rounded-xl border border-slate-200 hover:border-emerald-300 transition shadow-sm shrink-0 flex items-center gap-1.5">
                        <i class="fa-solid fa-folder-open text-emerald-500"></i> ดูรูปสถานีนี้
                    </a>
                ` : ''}
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    // 🔴 3. โฟลเดอร์หลังซ่อมเสร็จสมบูรณ์ (Post-Repair Completed Phase)
    const postRepairLink = stationLinks.after || job.customer_drive_link || job.drive_folder_link;
    html += `
        <div class="relative pl-8">
            <div class="absolute -left-[17px] top-0 w-8 h-8 ${isPostRepairDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'} rounded-full border-4 border-white shadow-md flex items-center justify-center text-xs font-bold">
                <i class="fa-solid fa-car-circle-check"></i>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center justify-between">
                    <span class="font-black text-slate-800 text-sm">3. รถซ่อมเสร็จสมบูรณ์</span>
                    ${isPostRepairDone ? '<span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold border border-emerald-100"><i class="fa-solid fa-check mr-1"></i>พร้อมส่งมอบ</span>' : ''}
                </div>
                <p class="text-xs text-slate-400 mt-0.5">ทำความสะอาด ตรวจเช็ค QC ขั้นสุดท้าย และเตรียมส่งมอบ</p>
                ${(isPostRepairDone && postRepairLink) ? `
                    <div class="mt-2.5">
                        <a href="${postRepairLink}" target="_blank" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition shadow-sm">
                            <i class="fa-solid fa-folder-open text-emerald-600"></i> เปิดดูรูปโฟลเดอร์หลังซ่อมเสร็จ
                        </a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    // 🔴 4. เฟสส่งมอบรถคืนลูกค้า (Final Delivery Phase)
    html += `
        <div class="relative pl-8">
            <div class="absolute -left-[17px] top-0 w-8 h-8 ${isDeliveryDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'} rounded-full border-4 border-white shadow-md flex items-center justify-center text-xs font-bold">
                <i class="fa-solid fa-key"></i>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center justify-between">
                    <span class="font-black text-slate-800 text-sm">4. ส่งมอบรถคืนลูกค้า</span>
                    ${isDeliveryDone ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold border border-emerald-300">ส่งมอบเรียบร้อย</span>' : ''}
                </div>
                <p class="text-xs text-slate-400 mt-0.5">ลูกค้าตรวจรับรถยนต์และรับกุญแจรถคืน</p>
            </div>
        </div>
    `;

    html += `</div>`;
    container.innerHTML = html;
}

function clientLogout() {
    sessionStorage.removeItem('client_job_data');
    window.location.href = 'tracking.html';
}

function formatThaiDate(isoStr) {
    if (!isoStr) return '-';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

async function autoLoginFromUrl(plate, phone) {
    await verifyAndFetchJob(plate, phone || '');
}