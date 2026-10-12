// ==========================================
// 📊 RIZENIC - Jobs Table 2 (Search by Date Range <= 120 Days)
// ==========================================

const API_BASE_URL = window.location.origin;
let allJobsData = [];
let currentFilteredData = [];
let activeFilters = {};

// นิยามคอลัมน์มาตรฐานเหมือนตาราง 1
const columnsDef = [
    { idx: 1, key: 'action', title: 'Action', width: 80 },
    { idx: 2, key: 'contact_date', title: 'เข้ามาติดต่อวันที่', width: 115 },
    { idx: 36, key: 'arrived_date', title: 'วันที่รถเข้าจอดอู่', width: 150 },
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
    { idx: 20, key: 'target_finish_date', title: 'กำหนดซ่อมเสร็จ', width: 150 },
    { idx: 21, key: 'repair_finish_date', title: 'วันที่เสร็จจริง', width: 120 },
    { idx: 22, key: 'delivery_date', title: 'วันที่ส่งมอบ', width: 150 },
    { idx: 31, key: 'billing_date', title: 'วันที่ออกบิล', width: 115 },
    { idx: 24, key: 'job_status', title: 'สถานะงาน', width: 140 },
    { idx: 35, key: 'sa_owner', title: 'SA ที่รับผิดชอบ', width: 115 }
];

function formatToThaiDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

function showToast(msg, type='success') {
    const toast = document.getElementById('toastMsg');
    if(!toast) return;
    toast.className = `fixed bottom-5 right-5 font-bold px-5 py-2.5 rounded shadow-2xl transform transition-all duration-300 z-[200] flex items-center gap-2 border border-white/20 ${type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white text-xs`;
    document.getElementById('toastContent').innerHTML = `<i class="fa-solid ${type==='error'?'fa-circle-xmark':'fa-circle-check'} text-base"></i> ${msg}`;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'Staff';
    document.getElementById('display_branch').innerText = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

    // ตั้งค่าเริ่มต้นของวันที่ ย้อนหลัง 30 วัน จนถึงวันนี้
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const past30 = new Date();
    past30.setDate(past30.getDate() - 30);
    const pastStr = past30.toISOString().split('T')[0];

    document.getElementById('range_start_date').value = pastStr;
    document.getElementById('range_end_date').value = todayStr;

    initTableHeaders();
});

function initTableHeaders() {
    const thead = document.getElementById('jobs_table_head');
    let trHtml = '<tr>';
    columnsDef.forEach((col, renderIndex) => {
        trHtml += `<th class="group select-none" id="th_${col.idx}" style="width: ${col.width}px; min-width: ${col.width}px;">
            <div class="flex justify-between items-center w-full h-full px-1">
                <div class="cursor-pointer flex-1 overflow-hidden whitespace-nowrap text-ellipsis flex items-center justify-center" onclick="sortTable(${col.idx})">
                    <span>${col.title}</span> <i class="fa-solid fa-sort sort-icon"></i>
                </div>
            </div>
            <div class="resizer"></div>
        </th>`;
    });
    thead.innerHTML = trHtml + '</tr>';
}

// 🌟 ฟังก์ชันหลัก: ดึงและเช็กข้อมูลช่วงเวลาไม่เกิน 120 วัน
async function fetchAndFilter120DaysData() {
    const startDateVal = document.getElementById('range_start_date').value;
    const endDateVal = document.getElementById('range_end_date').value;
    const dateTypeVal = document.querySelector('input[name="range_date_type"]:checked')?.value;

    if (!startDateVal || !endDateVal) {
        alert('❌ กรุณาระบุทั้ง "วันที่เริ่มต้น" และ "วันที่สิ้นสุด" ครับ');
        return;
    }

    const start = new Date(startDateVal);
    const end = new Date(endDateVal);

    if (start > end) {
        alert('❌ "วันที่เริ่มต้น" ต้องไม่มากกว่า "วันที่สิ้นสุด" ครับ');
        return;
    }

    // คำนวณความต่างของวัน
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));

    if (diffDays > 120) {
        alert(`❌ ช่วงวันที่เลือกห่างกัน ${diffDays} วัน เกินโควต้ากำหนดที่ห้ามเกิน 120 วันครับ!`);
        return;
    }

    const tbody = document.getElementById('jobs_table_body');
    tbody.innerHTML = `<tr><td colspan="40" class="text-center py-20 text-slate-400 font-bold bg-white"><i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-amber-500"></i><br>กำลังดึงข้อมูล...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`);
        const data = await res.json();
        const rawJobs = Array.isArray(data) ? data : (data.data || []);

        const userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
        const userRole = sessionStorage.getItem('emp_role');
        const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);

        // กรองตามสาขา + กรองช่วงวันที่ไม่เกิน 120 วัน
        allJobsData = rawJobs.filter(job => {
            if (!isManager && job.branch_name !== userBranch) return false;

            const jobDateRaw = job[dateTypeVal];
            if (!jobDateRaw) return false;
            
            const jobDateStr = String(jobDateRaw).split('T')[0];
            return jobDateStr >= startDateVal && jobDateStr <= endDateVal;
        });

        currentFilteredData = [...allJobsData];
        renderTable(currentFilteredData);
        document.getElementById('row_count').innerText = currentFilteredData.length;

        showToast(`ดึงข้อมูลสำเร็จ ${currentFilteredData.length} รายการ`, 'success');

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="40" class="text-center py-20 text-red-600 font-bold bg-white"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><br>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

function applyLocalSearch() {
    const txt = document.getElementById('search_input').value.toLowerCase().trim();
    if (!txt) {
        currentFilteredData = [...allJobsData];
    } else {
        currentFilteredData = allJobsData.filter(job => {
            return Object.values(job).join(' ').toLowerCase().includes(txt);
        });
    }
    renderTable(currentFilteredData);
    document.getElementById('row_count').innerText = currentFilteredData.length;
}

function renderTable(data) {
    const tbody = document.getElementById('jobs_table_body');
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="40" class="text-center py-16 text-slate-400 font-bold bg-white">ไม่พบข้อมูลตรงตามเงื่อนไขช่วงวันที่เลือก</td></tr>`;
        return;
    }

    let allRowsHtml = '';
    data.forEach((job, idx) => {
        let rowHtml = `<tr class="${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-amber-50/50 transition">`;
        
        columnsDef.forEach(col => {
            let cellData = job[col.key] || '-';
            
            if (col.key === 'action') {
                cellData = `<div class="text-center"><button onclick="sessionStorage.setItem('edit_job_id', '${job.id}'); window.location.href='index.html';" class="bg-[#00320D] text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-black"><i class="fa-solid fa-pen"></i> เปิด</button></div>`;
            } else if (col.key.includes('date') && job[col.key]) {
                cellData = `<div class="text-center font-mono font-bold">${formatToThaiDate(job[col.key])}</div>`;
            } else if (col.key === 'car_plate') {
                cellData = `<div class="text-center font-black text-blue-800">${job.car_plate || '-'}</div>`;
            } else if (col.key === 'main_part_name' || col.key === 'sub_part_name') {
                const badgeClass = col.key === 'main_part_name' ? 'part-badge-main' : 'part-badge-sub';
                cellData = job[col.key] ? `<div class="px-2 py-1 flex flex-wrap gap-1">${job[col.key].split(',').map(p => `<span class="${badgeClass}">${p.trim()}</span>`).join('')}</div>` : '-';
            } else {
                cellData = `<div class="px-2 py-1 truncate" title="${cellData}">${cellData}</div>`;
            }

            rowHtml += `<td class="p-0">${cellData}</td>`;
        });

        allRowsHtml += rowHtml + '</tr>';
    });

    tbody.innerHTML = allRowsHtml;
}

function exportToExcel() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        showToast('ไม่มีข้อมูลในตารางให้โหลดครับ!', 'error');
        return;
    }

    const exportData = [];
    const exportCols = columnsDef.filter(c => c.key !== 'action');
    
    exportData.push(exportCols.map(col => col.title));
    
    currentFilteredData.forEach(job => {
        const row = exportCols.map(colDef => {
            let val = job[colDef.key];
            if (colDef.key.includes('date') && val) val = formatToThaiDate(val);
            return val || '';
        });
        exportData.push(row);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Jobs_Range_Data");
    XLSX.writeFile(wb, `Rizenic_Jobs_Range_120Days.xlsx`);
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }