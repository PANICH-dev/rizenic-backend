const API_BASE_URL = window.location.origin;
let currentClientJob = null;

// สถานีช่างหลักสำหรับแสดงสถานะให้ลูกค้า
const CLIENT_STATIONS = [
    { key: 'kho', label: '01. เคาะชิ้นส่วน' },
    { key: 'pou', label: '02. โป๊วสี' },
    { key: 'puan', label: '03. เตรียมพื้น' },
    { key: 'pon', label: '04. พ่นสี' },
    { key: 'prak', label: '05. ประกอบชิ้นส่วน' },
    { key: 'kat', label: '06. ขัดสี' },
    { key: 'qc', label: '07. ตรวจสอบ QC' },
    { key: 'ready', label: '08. พร้อมส่งมอบ' }
];

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็ก Query String ใน URL ว่าแนบ ?plate=...&phone=... มาหรือไม่
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlate = urlParams.get('plate') || urlParams.get('id');
    const urlPhone = urlParams.get('phone');

    if (urlPlate) {
        autoLoginFromUrl(urlPlate, urlPhone);
        return;
    }

    // 2. เช็ก Session เดิมของลูกค้า
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

// 🚀 ฟังก์ชันล็อกอินฝั่งลูกค้า
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

// 🔍 ยิงค้นหาข้อมูลใบงาน
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

        // คลีนรูปแบบข้อความเปรียบเทียบ
        const cleanPlate = plate.replace(/\s+/g, '').toUpperCase();
        const cleanPhone = phone ? phone.replace(/[- ]/g, '') : '';

        // ค้นหาใบงานที่ทะเบียนรถและเบอร์โทรตรงกัน
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
            alert('❌ ไม่พบข้อมูลงานซ่อมสำหรับทะเบียนรถหรือเบอร์โทรศัพท์นี้\n\nกรุณาตรวจสอบข้อมูลหรือสอบถาม SA ผู้ดูแลครับ');
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

// 🌟 แสดงผลหน้า Tracking Dashboard
function showDashboard(job) {
    document.getElementById('client_login_screen').classList.add('hidden');
    document.getElementById('client_dashboard').classList.remove('hidden');
    document.getElementById('btn_logout_client').classList.remove('hidden');

    // เติมข้อมูลรถ
    document.getElementById('disp_car_plate').innerText = job.car_plate || '-';
    document.getElementById('disp_car_brand_model').innerText = `${job.car_brand || ''} ${job.car_model || ''}`.trim() || 'รถยนต์';
    document.getElementById('disp_customer_name').innerText = job.customer_name || '-';
    document.getElementById('disp_sa_owner').innerText = job.sa_owner || 'ทีมงานบริการ';

    // เติมวันที่
    document.getElementById('disp_arrived_date').innerText = formatThaiDate(job.arrived_date);
    document.getElementById('disp_target_date').innerText = formatThaiDate(job.target_finish_date);
    document.getElementById('disp_delivery_date').innerText = formatThaiDate(job.delivery_date);

    // สถานะหลัก
    document.getElementById('disp_status_badge').innerText = job.job_status || 'กำลังดำเนินการ';

    // Render Station Badges
    renderStationBadges(job);
}

// 🛠️ วาดสถานะช่าง 8 ขั้นตอน
function renderStationBadges(job) {
    const container = document.getElementById('station_grid_container');
    if (!container) return;

    container.innerHTML = CLIENT_STATIONS.map(st => {
        const isDone = job[`station_${st.key}`] === true || job[`station_${st.key}`] === 'true' || job[`station_${st.key}`] === 1;

        if (isDone) {
            return `
                <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 flex items-center justify-between font-bold text-xs shadow-sm">
                    <span>${st.label}</span>
                    <i class="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
                </div>
            `;
        } else {
            return `
                <div class="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 flex items-center justify-between font-medium text-xs">
                    <span>${st.label}</span>
                    <i class="fa-regular fa-circle text-slate-700 text-sm"></i>
                </div>
            `;
        }
    }).join('');
}

// 📁 เปิดดูรูปภาพ Google Drive
function openCustomerDriveFolder() {
    if (!currentClientJob) return;

    const driveUrl = currentClientJob.drive_folder_link;
    if (driveUrl && driveUrl.trim() !== '') {
        window.open(driveUrl, '_blank');
    } else {
        alert('ℹ️ ขณะนี้เจ้าหน้าที่กำลังจัดเตรียมโฟลเดอร์รูปภาพ กรุณาตรวจสอบใหม่อีกครั้งในภายหลังครับ');
    }
}

// 🚪 ออกจากระบบลูกค้า
function clientLogout() {
    sessionStorage.removeItem('client_job_data');
    window.location.href = 'tracking.html';
}

// 📅 แปลงวันที่เป็นไทย (DD/MM/YYYY)
function formatThaiDate(isoStr) {
    if (!isoStr) return '-';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

// Auto Login กรณีแนบ Parameter มาทาง URL
async function autoLoginFromUrl(plate, phone) {
    await verifyAndFetchJob(plate, phone || '');
}