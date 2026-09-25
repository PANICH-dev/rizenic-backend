const API_BASE_URL = window.location.origin;
let allJobsData = [];
let allPartOrders = [];
let partOrdersLoaded = false;
let partOrdersLoadPromise = null;
let partOrdersByPlate = new Map();
let historyResults = [];
const historyPager = RizenicPagination.createState(50);

document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'index.html'; return; }
    document.getElementById('display_emp_name').innerText = sessionStorage.getItem('emp_name') || 'Admin Test';
    document.getElementById('display_branch').innerText = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    
    loadData();
});

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }
function getValidDateStr(val) {
    if (!val || String(val).trim() === '' || String(val) === 'null' || String(val) === 'undefined') return '-';
    const str = String(val).split('T')[0];
    if (str.startsWith('1970') || str.startsWith('0000')) return '-';
    return new Date(str).toLocaleDateString('th-TH');
}
const formatMoney = (val) => Number(val || 0).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});


function rebuildHistoryPartOrderIndex() {
    partOrdersByPlate = new Map();
    allPartOrders.forEach(po => {
        if (!po || po.order_status === 'ยกเลิก') return;
        const key = po.car_plate;
        if (!partOrdersByPlate.has(key)) partOrdersByPlate.set(key, []);
        partOrdersByPlate.get(key).push(po);
    });
}

async function ensureHistoryPartOrdersLoaded() {
    if (partOrdersLoaded) return allPartOrders;
    if (partOrdersLoadPromise) return partOrdersLoadPromise;

    partOrdersLoadPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/part-orders`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            allPartOrders = Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error lazy-loading history part orders:', error);
            allPartOrders = [];
        } finally {
            partOrdersLoaded = true;
            rebuildHistoryPartOrderIndex();
            partOrdersLoadPromise = null;
        }
        return allPartOrders;
    })();

    return partOrdersLoadPromise;
}

function getHistoryPartOrdersForJob(job, jobId) {
    const candidates = partOrdersByPlate.get(job?.car_plate) || [];
    return candidates.filter(po => po.job_id == jobId || !po.job_id);
}

async function loadData() {
    try {
        const btn = document.querySelector('button[onclick="searchHistory()"]');
        const orgHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังเตรียมข้อมูล...`;
        btn.disabled = true;

        const result = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/reports`).then(res => res.json())
        ]);

        if (result[0].status === 'fulfilled') allJobsData = result[0].value;

        btn.innerHTML = orgHtml;
        btn.disabled = false;
        
        // ถ้ามาจากหน้าอื่นแล้วส่งทะเบียนมาทาง URL ให้ค้นหาออโต้
        const urlParams = new URLSearchParams(window.location.search);
        const searchQ = urlParams.get('q');
        if(searchQ) {
            document.getElementById('searchInput').value = searchQ;
            searchHistory();
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('resultContainer').classList.add('hidden');
    document.getElementById('resultContainer').classList.remove('flex');
    document.getElementById('historyTableBody').innerHTML = '';
}

function searchHistory() {
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!keyword) { alert("กรุณาพิมพ์คำค้นหาก่อนครับ"); return; }

    historyResults = allJobsData.filter(j => {
        const plate = (j.car_plate || '').toLowerCase();
        const name = (j.customer_name || '').toLowerCase();
        const tel = (j.customer_phone || '').toLowerCase();
        const vin = (j.vin_no || '').toLowerCase();
        return plate.includes(keyword) || name.includes(keyword) || tel.includes(keyword) || vin.includes(keyword);
    });

    historyResults.sort((a, b) => new Date(b.arrived_date || b.contact_date || 0) - new Date(a.arrived_date || a.contact_date || 0));
    RizenicPagination.reset(historyPager);
    renderHistoryResults();
}

function goHistoryPage(page) {
    historyPager.page = page;
    renderHistoryResults();
}

function renderHistoryResults() {
    const tbody = document.getElementById('historyTableBody');
    const container = document.getElementById('resultContainer');
    const pageInfo = RizenicPagination.paginate(historyResults, historyPager);

    document.getElementById('resultCount').innerText = historyResults.length;
    RizenicPagination.renderControls({
        anchorId: 'historyTable', containerId: 'history_table_pagination', pageInfo,
        noun: 'รายการ', onPageChange: goHistoryPage
    });

    if (historyResults.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-500 font-bold"><i class="fa-solid fa-magnifying-glass text-3xl mb-2 block opacity-50"></i> ไม่พบประวัติงานซ่อมที่ตรงกับคำค้นหา</td></tr>`;
    } else {
        tbody.innerHTML = pageInfo.items.map(j => {
            const totalCost = Number(j.cost_labor||0) + Number(j.cost_part||0) + Number(j.cost_external||0);
            const statusBadge = (j.job_status||'').includes('ส่งมอบ') ? `bg-emerald-100 text-emerald-700 border-emerald-300` : `bg-amber-100 text-amber-700 border-amber-300`;
            return `
            <tr class="hover:bg-purple-50/50 transition cursor-pointer border-b border-slate-100" onclick="viewHistoryDetail('${j.id}')">
                <td class="px-4 py-3 font-bold text-[#00320D]"><span class="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td>
                <td class="px-4 py-3 leading-tight"><div class="font-bold text-slate-800 text-xs">${j.customer_name || '-'}</div><div class="text-[10px] text-slate-500 font-mono mt-0.5"><i class="fa-solid fa-phone"></i> ${j.customer_phone || '-'}</div></td>
                <td class="px-4 py-3 text-xs font-bold text-slate-600">${j.car_brand} ${j.car_model || ''}</td>
                <td class="px-4 py-3 text-center text-xs font-mono font-bold text-blue-600">${getValidDateStr(j.arrived_date)}</td>
                <td class="px-4 py-3 text-center"><span class="border px-2 py-1 rounded text-[10px] font-bold shadow-sm whitespace-nowrap ${statusBadge}">${j.job_status || '-'}</span></td>
                <td class="px-4 py-3 text-right text-xs font-mono font-black text-slate-700">${formatMoney(totalCost)}</td>
                <td class="px-4 py-3 text-center"><button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md whitespace-nowrap"><i class="fa-solid fa-file-lines"></i> ดูประวัติ</button></td>
            </tr>`;
        }).join('');
    }
    container.classList.remove('hidden');
    container.classList.add('flex');
}

async function viewHistoryDetail(jobId) {
    const job = allJobsData.find(j => j.id == jobId);
    if(!job) return;

    await ensureHistoryPartOrdersLoaded();
    const jobPOs = getHistoryPartOrdersForJob(job, jobId);

    const totalLabor = Number(job.cost_labor || job.labor_total || 0);
    const totalParts = Number(job.cost_part || job.part_total || 0);
    const totalExt = Number(job.cost_external || job.outsource_total || 0);
    const totalNet = totalLabor + totalParts + totalExt;

    let poHtml = '';
    if (jobPOs.length === 0) {
        poHtml = `<div class="text-center py-6 text-slate-400 font-bold bg-white rounded border border-slate-200 text-sm">ไม่มีประวัติการเปลี่ยนอะไหล่ในระบบ</div>`;
    } else {
        poHtml = `
        <table class="w-full text-left border-collapse text-xs">
            <thead class="bg-slate-100 text-slate-600 uppercase border-b border-slate-200">
                <tr><th class="p-2">เลขอะไหล่</th><th class="p-2">ชื่อรายการ</th><th class="p-2 text-center">จำนวน</th><th class="p-2 text-center">วันที่สั่ง</th><th class="p-2">สถานะ</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
                ${jobPOs.map(po => `
                    <tr>
                        <td class="p-2 font-mono font-bold text-blue-700">${po.part_no || '-'}</td>
                        <td class="p-2 font-bold text-slate-700">${po.part_name || '-'}</td>
                        <td class="p-2 text-center font-black text-amber-700">${po.qty_ordered || 1}</td>
                        <td class="p-2 text-center font-mono">${getValidDateStr(po.order_date)}</td>
                        <td class="p-2 font-bold"><span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">${po.order_status || '-'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    }

    const html = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- ข้อมูลรถและลูกค้า -->
        <div class="md:col-span-1 space-y-4">
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 class="font-black text-[#00320D] border-b pb-2 mb-3"><i class="fa-solid fa-car-side text-amber-500"></i> ข้อมูลรถยนต์</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ทะเบียน:</span> <span class="font-black text-lg text-[#00320D] bg-slate-100 px-2 py-0.5 rounded border border-slate-300 shadow-inner">${job.car_plate || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ยี่ห้อ/รุ่น:</span> <span class="font-bold text-slate-800">${job.car_brand} ${job.car_model || ''}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">VIN:</span> <span class="font-mono text-xs text-slate-600">${job.vin_no || '-'}</span></div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 class="font-black text-[#00320D] border-b pb-2 mb-3"><i class="fa-solid fa-user text-amber-500"></i> ข้อมูลลูกค้า</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ชื่อ:</span> <span class="font-bold text-slate-800">${job.customer_name || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">โทร:</span> <span class="font-mono font-bold text-blue-600">${job.customer_phone || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ประเภท:</span> <span class="font-bold text-slate-800">${job.customer_type || '-'}</span></div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h3 class="font-black text-[#00320D] border-b pb-2 mb-3"><i class="fa-solid fa-clipboard text-amber-500"></i> เอกสารอ้างอิง</h3>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ใบเสนอราคา:</span> <span class="font-mono font-bold text-slate-700">${job.qt_no || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ใบสั่งซ่อม:</span> <span class="font-mono font-bold text-slate-700">${job.so_no || '-'}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-bold">ผู้รับผิดชอบ:</span> <span class="font-bold text-slate-800">${job.sa_owner || '-'}</span></div>
                </div>
            </div>
        </div>

        <!-- ข้อมูลเวลา และ การเงิน -->
        <div class="md:col-span-2 flex flex-col gap-4">
            <!-- ไทม์ไลน์ -->
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-black text-[#00320D]"><i class="fa-regular fa-clock text-amber-500"></i> ไทม์ไลน์งานซ่อม</h3>
                    <span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-black shadow-sm">สถานะ: ${job.job_status || '-'}</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div class="bg-slate-50 p-2 rounded border border-slate-100">
                        <p class="text-[10px] text-slate-500 font-bold mb-1">วันที่ติดต่อ</p>
                        <p class="text-sm font-mono font-black text-slate-700">${getValidDateStr(job.contact_date)}</p>
                    </div>
                    <div class="bg-blue-50 p-2 rounded border border-blue-100">
                        <p class="text-[10px] text-blue-600 font-bold mb-1">วันที่เข้าจอด</p>
                        <p class="text-sm font-mono font-black text-blue-700">${getValidDateStr(job.arrived_date)}</p>
                    </div>
                    <div class="bg-amber-50 p-2 rounded border border-amber-100">
                        <p class="text-[10px] text-amber-600 font-bold mb-1">เป้าหมายเสร็จ</p>
                        <p class="text-sm font-mono font-black text-amber-700">${getValidDateStr(job.target_finish_date)}</p>
                    </div>
                    <div class="bg-emerald-50 p-2 rounded border border-emerald-100">
                        <p class="text-[10px] text-emerald-600 font-bold mb-1">วันที่ส่งมอบจริง</p>
                        <p class="text-sm font-mono font-black text-emerald-700">${getValidDateStr(job.delivery_date)}</p>
                    </div>
                </div>
            </div>

            <!-- การเงิน -->
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <h3 class="font-black text-[#00320D] border-b pb-2 mb-4"><i class="fa-solid fa-sack-dollar text-amber-500"></i> สรุปค่าใช้จ่าย (Financial)</h3>
                <div class="grid grid-cols-4 gap-4 text-center">
                    <div>
                        <p class="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-1">ค่าแรง</p>
                        <h3 class="text-lg font-black text-emerald-600">${formatMoney(totalLabor)}</h3>
                    </div>
                    <div class="border-l border-slate-200">
                        <p class="text-[11px] font-bold text-purple-700 uppercase tracking-widest mb-1">ค่าอะไหล่</p>
                        <h3 class="text-lg font-black text-purple-600">${formatMoney(totalParts)}</h3>
                    </div>
                    <div class="border-l border-slate-200">
                        <p class="text-[11px] font-bold text-orange-700 uppercase tracking-widest mb-1">งานนอก</p>
                        <h3 class="text-lg font-black text-orange-600">${formatMoney(totalExt)}</h3>
                    </div>
                    <div class="border-l border-amber-300 bg-amber-50 rounded-r-lg">
                        <p class="text-[11px] font-bold text-amber-800 uppercase tracking-widest mb-1 mt-1">ยอดรวมสุทธิ</p>
                        <h3 class="text-xl font-black text-amber-600 mb-1">${formatMoney(totalNet)}</h3>
                    </div>
                </div>
            </div>

            <!-- ประวัติการสั่งอะไหล่ -->
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                <h3 class="font-black text-[#00320D] border-b pb-2 mb-3"><i class="fa-solid fa-boxes-stacked text-amber-500"></i> ประวัติรายการอะไหล่ (${jobPOs.length} ชิ้น)</h3>
                <div class="overflow-y-auto custom-scrollbar flex-1 border border-slate-200 rounded-lg">
                    ${poHtml}
                </div>
            </div>
        </div>
    </div>
    `;

    document.getElementById('historyModalContent').innerHTML = html;
    
    // ตั้งค่าปุ่ม "เปิดใบงานนี้" เพื่อลิงก์ไปหน้า Edit
    document.getElementById('btnOpenJob').onclick = () => {
        sessionStorage.setItem('edit_job_id', jobId); 
        window.location.href = 'index.html';
    };

    document.getElementById('historyModal').classList.remove('hidden');
}