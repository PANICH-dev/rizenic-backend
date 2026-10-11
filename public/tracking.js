const API_BASE_URL = window.location.origin;
let currentClientJob = null;

// สถานีช่างหลักสำหรับแสดงสถานะให้ลูกค้า
const CLIENT_STATIONS = [
    { key: 'kho', label: 'เคาะตัวถังและปรับสภาพ' },
    { key: 'pou', label: 'โป๊วสีและจัดทรง' },
    { key: 'puan', label: 'พ่นสีพื้นและเตรียมผิว' },
    { key: 'pon', label: 'พ่นสีจริงและเคลือบเงา' },
    { key: 'prak', label: 'ประกอบชิ้นส่วนกลับ' },
    { key: 'kat', label: 'ขัดสีและทำความสะอาด' },
    { key: 'qc', label: 'ตรวจสอบคุณภาพ (QC)' },
    { key: 'ready', label: 'รถพร้อมส่งมอบ' }
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
    
    document.getElementById('disp_arrived_date').innerText = formatThaiDate(job.arrived_date);
    document.getElementById('disp_target_date').innerText = formatThaiDate(job.target_finish_date);
    document.getElementById('disp_delivery_date').innerText = formatThaiDate(job.delivery_date);

    document.getElementById('disp_status_badge').innerText = job.job_status || 'กำลังดำเนินการ';

    renderTimeline(job);
}

// 🛠️ วาด Timeline สไตล์แอปส่งอาหาร (Vertical Timeline)
function renderTimeline(job) {
    const container = document.getElementById('station_timeline_container');
    if (!container) return;

    // หาว่าขั้นตอนล่าสุดที่ทำเสร็จคืออันไหน
    let lastCompletedIdx = -1;
    CLIENT_STATIONS.forEach((st, idx) => {
        if (job[`station_${st.key}`] === true || job[`station_${st.key}`] === 'true' || job[`station_${st.key}`] === 1) {
            lastCompletedIdx = idx;
        }
    });

    let html = '<div class="relative border-l-2 border-slate-100 ml-4 space-y-8 mt-2 py-2">';

    CLIENT_STATIONS.forEach((st, idx) => {
        const isDone = idx <= lastCompletedIdx;
        const isCurrent = idx === lastCompletedIdx + 1; // สถานีที่กำลังทำอยู่ (ถัดจากที่เสร็จล่าสุด)
        const isLastItem = idx === CLIENT_STATIONS.length - 1;

        if (isDone) {
            // สำเร็จแล้ว (สีเขียวติ๊กถูก)
            html += `
                <div class="relative pl-8">
                    <div class="absolute -left-[11px] top-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-sm flex items-center justify-center">
                        <i class="fa-solid fa-check text-[8px] text-white"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-800 text-sm">${st.label}</span>
                        <span class="text-[10px] text-slate-400 mt-0.5">เสร็จสิ้นเรียบร้อย</span>
                    </div>
                </div>
            `;
        } else if (isCurrent) {
            // กำลังดำเนินการ (สีส้ม/เหลือง กระพริบ)
            html += `
                <div class="relative pl-8">
                    <div class="absolute -left-[11px] top-1 w-5 h-5 bg-amber-400 rounded-full border-4 border-white shadow-sm animate-pulse"></div>
                    <div class="flex flex-col bg-amber-50/50 -mt-2 p-3 rounded-2xl border border-amber-100">
                        <span class="font-black text-amber-800 text-sm">${st.label}</span>
                        <span class="text-[11px] font-bold text-amber-600 mt-0.5 flex items-center gap-1.5">
                            <i class="fa-solid fa-circle-notch fa-spin"></i> ช่างกำลังดำเนินการ...
                        </span>
                    </div>
                </div>
            `;
        } else {
            // ยังไม่ถึง (สีเทาจางๆ)
            html += `
                <div class="relative pl-8 opacity-40">
                    <div class="absolute -left-[9px] top-1.5 w-4 h-4 bg-slate-200 rounded-full border-4 border-white"></div>
                    <div class="flex flex-col">
                        <span class="font-medium text-slate-500 text-sm">${st.label}</span>
                    </div>
                </div>
            `;
        }
    });

    html += '</div>';
    container.innerHTML = html;
}

function openCustomerDriveFolder() {
    if (!currentClientJob) return;

    const driveUrl = currentClientJob.drive_folder_link;
    if (driveUrl && driveUrl.trim() !== '') {
        window.open(driveUrl, '_blank');
    } else {
        alert('ℹ️ ขณะนี้เจ้าหน้าที่กำลังจัดเตรียมแกลลอรี่รูปภาพ กรุณาตรวจสอบใหม่อีกครั้งในภายหลังครับ');
    }
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