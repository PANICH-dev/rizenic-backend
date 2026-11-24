// ==========================================
// 🚗 ระบบใบตรวจสภาพรถ (Vehicle Inspection)
// ==========================================

let canvasLarge, ctxLarge;
let canvasSmall, ctxSmall;
let currentTool = 'O';
let inspectionSession = 0;
let inspectionLoading = false;
let inspectionSaving = false;
let inspectionLoadFailed = false;
let inspectionBranch = '';

// 🏢 1. ข้อมูล Master ของบริษัทและสาขาต่างๆ
const COMPANY_MASTERS = {
    "raisen_navamin": {
        name: "บริษัท ไรเซน เอนเนอร์จี จำกัด",
        taxId: "0105560176434",
        address: "50/5-6 ซอยนวมินทร์ 151 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพมหานคร 10230",
        phone: "098-151-5155"
    },
    "raisen_rangsit": {
        name: "บริษัท ไรเซน เอนเนอร์จี จำกัด (สาขารังสิต)",
        taxId: "0105560176434",
        address: "47/1 ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12110",
        phone: "090-956-1115"
    },
    "rizenic_head": {
        name: "บริษัท ไรเซนิค จำกัด (สำนักงานใหญ่)",
        taxId: "0-1055-67000-00-0",
        address: "50/5-6 ซอยนวมินทร์ 151 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพมหานคร 10230",
        phone: "098-151-5155"
    }
};

async function loadInspectionTemplate() {
    if (!document.getElementById('inspectionModal')) {
        try {
            const res = await fetch('inspection.html');
            const html = await res.text();
            document.body.insertAdjacentHTML('beforeend', html);
            renderPartsTable();
            document.getElementById('ins_cust_name').oninput = event => {
                setFieldValue('sign_cust_name_display', event.target.value);
            };
        } catch (e) {
            console.error("❌ ไม่สามารถโหลดไฟล์ inspection.html ได้:", e);
        }
    }
}

// Helper ตั้งค่าข้อมูลให้รองรับทั้ง <input> และ <div>/<span>
function setFieldValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const cleanVal = val ?? '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        el.value = cleanVal;
    } else {
        el.innerText = cleanVal;
    }
}

// 🏢 ฟังก์ชันอัปเดตส่วนหัวบริษัทตามการเลือก
function updateCompanyHeader(key) {
    const comp = COMPANY_MASTERS[key] || COMPANY_MASTERS["raisen_navamin"];
    const addrBox = document.getElementById('ins_company_address');
    
    if (addrBox) {
        addrBox.innerHTML = `
            <p class="text-[11px] font-black text-[#00320D] uppercase tracking-wide mb-0.5">${comp.name}</p>
            <p class="text-[9px] text-slate-700 font-bold">เลขที่เสียภาษี ${comp.taxId}</p>
            <p class="text-[9px] text-slate-700">${comp.address}</p>
            <p class="text-[9px] text-slate-700">โทรศัพท์ : ${comp.phone}</p>
        `;
    }
}

async function openInspectionModal() {
    const session = ++inspectionSession;
    await loadInspectionTemplate();

    const carPlate = document.getElementById('car_plate')?.value || '';
    const carBrand = document.getElementById('car_brand')?.value || '';
    const carModel = document.getElementById('car_model')?.value || '';
    const custName = document.getElementById('customer_name')?.value || '';
    const phone = document.getElementById('phone_number')?.value || '';
    const vin = document.getElementById('vin_no')?.value || '';
    const appointmentDate = document.getElementById('appointment_date')?.value;
    const deliveryDate = document.getElementById('delivery_date')?.value;
    const quotationNo = document.getElementById('qt_no')?.value;
    const jobId = document.getElementById('sa_report_id')?.value || '';
    let branchName = sessionStorage.getItem('emp_branch') || '';
    let job;
    if (jobId) {
        const response = await fetch(API_BASE_URL + '/api/report/' + encodeURIComponent(jobId));
        if (!response.ok) { alert('โหลดข้อมูลสาขาของใบงานไม่สำเร็จ'); return; }
        job = await response.json();
        branchName = job.branch_name || branchName;
    }

    const paymentType = document.getElementById('payment_type')?.value || '';
    const claimNo = document.getElementById('eclaim_claim_no')?.value || document.getElementById('claim_no')?.value || '';
    const damageLevel = document.getElementById('damage_level')?.value || ''; 
    
    if (!carPlate) {
        alert("⚠️ กรุณากรอก 'ทะเบียนรถ' ก่อนเปิดใบตรวจสภาพครับ");
        return;
    }

    if (session !== inspectionSession) return;
    inspectionBranch = branchName;
    document.querySelectorAll('#inspection_print_area input, #inspection_print_area textarea').forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.defaultChecked;
        else el.value = el.defaultValue;
    });
    updateFuelGauge(50);

    // 🎯 หยอดข้อมูลลงช่องแบบรองรับ <input> สม่ำเสมอ
    setFieldValue('ins_car_plate', carPlate);
    setFieldValue('ins_car_brand', carBrand);
    setFieldValue('ins_car_model', carModel);
    setFieldValue('ins_cust_name', custName);
    setFieldValue('ins_phone', phone);
    setFieldValue('ins_vin', vin);
    setFieldValue('ins_arr_date', (appointmentDate ?? job?.appointment_date ?? '').split('T')[0]);
    setFieldValue('ins_tgt_date', deliveryDate ?? job?.delivery_date?.slice(0, 10) ?? '');
    setFieldValue('ins_job_no', quotationNo ?? job?.qt_no ?? job?.quotation_no ?? '');
    setFieldValue('sign_cust_name_display', custName);

    setFieldValue('ins_insurance', paymentType);
    setFieldValue('ins_claim_no', claimNo);

    if (damageLevel) {
        let jobTypeVal = 'L'; 
        if (damageLevel === 'กลาง') jobTypeVal = 'M';
        if (damageLevel === 'หนัก') jobTypeVal = 'H';
        
        const radios = document.getElementsByName('ins_job_type');
        for (let i = 0; i < radios.length; i++) {
            radios[i].checked = (radios[i].value === jobTypeVal);
        }
    }

    // 🏢 ตั้งค่าบริษัทเริ่มต้นตามสาขาพนักงาน
    let defaultCompKey = 'raisen_navamin';
    if (branchName.includes('รังสิต') || branchName.includes('Rangsit') || branchName.includes('คลองหลวง')) {
        defaultCompKey = 'raisen_rangsit';

    }

    const companySelect = document.getElementById('ins_company_select');
    if (companySelect) companySelect.value = defaultCompKey;
    updateCompanyHeader(defaultCompKey);

    document.getElementById('inspectionModal').classList.remove('hidden');
    document.getElementById('inspectionModal').classList.add('flex');

    initCanvas();
    inspectionLoading = true;
    inspectionLoadFailed = false;
    try {
        if (jobId) await loadExistingInspectionData(jobId, session);
    } finally {
        if (session === inspectionSession) inspectionLoading = false;
    }
}

// 🌟 สร้างตารางรายการซ่อมฝั่งซ้าย (ปรับขนาดคอลัมน์กว้างอ่านง่าย)
function renderPartsTable() {
    const partsList = [
        { name: "กันชนหน้า", sides: false }, { name: "ฝากระโปรงหน้า", sides: false },
        { name: "บังโคลนหน้า", sides: true }, { name: "แผงหน้าทั้งชุด", sides: false },
        { name: "คานหม้อน้ำ", sides: false }, { name: "กระโหลกบังโคลนหน้า", sides: true },
        { name: "เสากระจกบังลมหน้า", sides: true }, { name: "กระจกบังลมหน้า", sides: false },
        { name: "หลังคา", sides: false }, { name: "ประตูหน้า", sides: true },
        { name: "กระจกมองข้าง", sides: true }, { name: "ประตูหลัง", sides: true },
        { name: "บันได", sides: true }, { name: "บังโคลนหลัง", sides: true },
        { name: "กระจกบังลมหลัง", sides: false }, { name: "ฝาปิดถังน้ำมัน", sides: false },
        { name: "ฝากระโปรงหลัง", sides: false }, { name: "ฝาปิดท้าย", sides: false },
        { name: "แผงตั้งท้าย", sides: false }, { name: "เปลือก กระบะ", sides: true },
        { name: "กันชนหลัง", sides: false }
    ];
    
    let tbodyHtml = '';
    partsList.forEach(part => {
        if(part.sides) {
            tbodyHtml += `
                <tr>
                    <td rowspan="2" class="w-[40%] text-left pl-1.5 pr-1 border-b border-r border-slate-400 font-bold text-[9.5px] leading-tight">${part.name}</td>
                    <td class="w-[12%] text-center border-b border-r border-slate-400 font-bold text-[8.5px] bg-slate-50">ซ้าย</td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                </tr>
                <tr>
                    <td class="w-[12%] text-center border-b border-r border-slate-400 font-bold text-[8.5px] bg-slate-50">ขวา</td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                </tr>
            `;
        } else {
            tbodyHtml += `
                <tr>
                    <td colspan="2" class="w-[52%] text-left pl-1.5 pr-1 border-b border-r border-slate-400 font-bold text-[9.5px] leading-tight">${part.name}</td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-r border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                    <td class="w-[9.6%] text-center border-b border-slate-400"><input type="checkbox" class="cb-box-sm"></td>
                </tr>`;
        }
    });
    const container = document.getElementById('ins_parts_table_body');
    if(container) container.innerHTML = tbodyHtml;
}

function closeInspectionModal() {
    document.getElementById('inspectionModal').classList.add('hidden');
    document.getElementById('inspectionModal').classList.remove('flex');
}

// 🌟 ระบบ Canvas ป้องกันตำแหน่งมาร์กเคลื่อนแบบล็อก Resolution 1000x400
function initCanvas() {
    canvasSmall = document.getElementById('carCanvasSmall');
    canvasLarge = document.getElementById('carCanvasLarge');
    
    const RES_W = 1000;
    const RES_H = 400;

    if (canvasSmall) {
        canvasSmall.width = RES_W;
        canvasSmall.height = RES_H;
        ctxSmall = canvasSmall.getContext('2d');
    }
    
    if (canvasLarge) {
        canvasLarge.width = RES_W;
        canvasLarge.height = RES_H;
        ctxLarge = canvasLarge.getContext('2d');
        canvasLarge.onmousedown = stampMark;
        canvasLarge.ontouchstart = (e) => {
            e.preventDefault();
            stampMark(e.touches[0]);
        };
    }
}

function openCarDrawModal() {
    document.getElementById('carDrawModal').classList.remove('hidden');
    document.getElementById('carDrawModal').classList.add('flex');
    
    if (canvasSmall && canvasLarge) {
        canvasLarge.width = 1000;
        canvasLarge.height = 400;
        ctxLarge.clearRect(0, 0, 1000, 400);
        ctxLarge.drawImage(canvasSmall, 0, 0, 1000, 400);
    }
}

function closeCarDrawModal(isSaved) {
    document.getElementById('carDrawModal').classList.add('hidden');
    document.getElementById('carDrawModal').classList.remove('flex');
    
    if (isSaved && canvasSmall && canvasLarge) {
        ctxSmall.clearRect(0, 0, 1000, 400);
        ctxSmall.drawImage(canvasLarge, 0, 0, 1000, 400);
    }
}

function setDrawTool(tool) {
    currentTool = tool;
    const btnO = document.getElementById('tool_O');
    const btnX = document.getElementById('tool_X');
    
    if(tool === 'O') {
        btnO.className = "px-6 py-2.5 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 font-bold rounded-xl shadow-sm transition hover:bg-emerald-100";
        btnX.className = "px-6 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl shadow-sm transition hover:bg-slate-100";
    } else {
        btnX.className = "px-6 py-2.5 bg-rose-50 border-2 border-rose-500 text-rose-700 font-bold rounded-xl shadow-sm transition hover:bg-rose-100";
        btnO.className = "px-6 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl shadow-sm transition hover:bg-slate-100";
    }
}

// 🎯 คำนวณพิกัดคลิกบน Canvas อย่างแม่นยำ
function stampMark(e) {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const rect = canvasLarge.getBoundingClientRect();
    const scaleX = canvasLarge.width / rect.width;
    const scaleY = canvasLarge.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctxLarge.lineWidth = 5;
    
    if (currentTool === 'O') {
        ctxLarge.strokeStyle = '#10b981';
        ctxLarge.beginPath();
        ctxLarge.arc(x, y, 18, 0, Math.PI * 2);
        ctxLarge.stroke();
    } else if (currentTool === 'X') {
        const size = 14;
        ctxLarge.strokeStyle = '#ef4444';
        ctxLarge.beginPath();
        ctxLarge.moveTo(x - size, y - size);
        ctxLarge.lineTo(x + size, y + size);
        ctxLarge.moveTo(x + size, y - size);
        ctxLarge.lineTo(x - size, y + size);
        ctxLarge.stroke();
    }
}

function clearCanvas() {
    if(confirm("ลบเครื่องหมายแผลทั้งหมดใช่หรือไม่?")) {
        ctxLarge.clearRect(0, 0, canvasLarge.width, canvasLarge.height);
    }
}

let currentZoom = 1;
function changeZoom(delta) {
    currentZoom += delta;
    if(currentZoom < 0.5) currentZoom = 0.5;
    if(currentZoom > 1.8) currentZoom = 1.8;
    applyZoom();
}

function resetZoom() {
    currentZoom = 1;
    applyZoom();
}

function applyZoom() {
    const area = document.getElementById('inspection_print_area');
    const text = document.getElementById('zoomLevelText');
    if(area) area.style.transform = `scale(${currentZoom})`;
    if(text) text.innerText = Math.round(currentZoom * 100) + '%';
}

function updateFuelGauge(val) {
    const numeric = Number(val);
    const level = Math.round(Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 50)));
    setFieldValue('ins_fuel_level', level);
    setFieldValue('ins_battery_percent', level);
    const text = document.getElementById('fuel_txt');
    if (text) text.textContent = level;
    document.getElementById('ins_battery_fill')?.setAttribute('width', String(level * 0.81));
}

function printInspection() {
    window.print();
}

// Store stable form keys in the existing JSON checklist column; no database migration is needed.
function inspectionControls() {
    const controls = [...document.querySelectorAll('#inspection_print_area input, #inspection_print_area textarea')];
    controls.forEach((el, index) => {
        if (!el.dataset.inspectionKey) el.dataset.inspectionKey = el.id || 'control_' + index;
    });
    return controls;
}

async function saveInspectionForm() {
    if (inspectionSaving || inspectionLoading) return;
    if (inspectionLoadFailed) { alert('กรุณาเปิดใบตรวจใหม่เพื่อโหลดข้อมูลเดิมก่อนบันทึก'); return; }
    const jobId = document.getElementById('sa_report_id')?.value;
    if (!jobId) {
        alert('กรุณาบันทึกใบงานหลักก่อนบันทึกใบตรวจรับรถ');
        return;
    }
    const formFields = {};
    inspectionControls().forEach(el => {
        formFields[el.dataset.inspectionKey] = ['radio', 'checkbox'].includes(el.type) ? el.checked : el.value;
    });
    const selected = name => document.querySelector('input[name="' + name + '"]:checked')?.value;
    const payload = {
        job_id: jobId,
        car_plate: document.getElementById('ins_car_plate').value,
        branch_name: inspectionBranch || sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่',
        fuel_level: Number(document.getElementById('ins_fuel_level').value),
        current_mileage: document.getElementById('ins_mileage').value || 0,
        job_type: selected('ins_job_type'),
        job_category: selected('ins_job_cat'),
        repair_checklist: {
            version: 1,
            company_code: document.getElementById('ins_company_select').value,
            form_fields: formFields
        },
        car_diagram_image: canvasSmall?.toDataURL('image/png') || '',
        notes: document.getElementById('ins_extra_notes').value
    };
    const btn = document.querySelector('button[onclick="saveInspectionForm()"]');
    const oldText = btn?.innerHTML;
    inspectionSaving = true;
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
    try {
        const res = await fetch(API_BASE_URL + '/api/inspection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok || result.success === false) throw new Error(result.error || 'บันทึกไม่สำเร็จ');
        alert('บันทึกใบตรวจรับรถแล้ว สามารถพิมพ์ต่อได้');
    } catch (e) {
        alert('บันทึกไม่สำเร็จ: ' + e.message);
    } finally {
        inspectionSaving = false;
        if (btn) { btn.disabled = false; btn.innerHTML = oldText; }
    }
}

async function loadExistingInspectionData(jobId, session = inspectionSession) {
    try {
        const res = await fetch(API_BASE_URL + '/api/inspection/' + encodeURIComponent(jobId), { cache: 'no-store' });
        if (res.status === 404) return;
        const result = await res.json();
        if (!res.ok || result.success === false) throw new Error(result.error || 'โหลดข้อมูลไม่สำเร็จ');
        if (session !== inspectionSession || !result.data) return;
        const data = result.data;
        const checklist = typeof data.repair_checklist === 'string' ? JSON.parse(data.repair_checklist) : data.repair_checklist;
        const fields = checklist?.form_fields;
        if (fields) {
            inspectionControls().forEach(el => {
                const value = fields[el.dataset.inspectionKey];
                if (value === undefined) return;
                if (['radio', 'checkbox'].includes(el.type)) el.checked = value === true;
                else el.value = value;
            });
        }
        const companyCode = checklist?.company_code || data.company_code;
        if (companyCode && COMPANY_MASTERS[companyCode]) {
            setFieldValue('ins_company_select', companyCode);
            updateCompanyHeader(companyCode);
        }
        for (const [name, value] of [['ins_job_type', data.job_type], ['ins_job_cat', data.job_category]]) {
            if (value) document.getElementsByName(name).forEach(el => { el.checked = el.value === value; });
        }
        updateFuelGauge(data.fuel_level ?? 50);
        setFieldValue('ins_mileage', data.current_mileage ?? '');
        setFieldValue('ins_extra_notes', data.notes ?? '');
        setFieldValue('sign_cust_name_display', document.getElementById('ins_cust_name').value);
        if (data.car_diagram_image && canvasSmall) {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    if (session === inspectionSession) {
                        ctxSmall.clearRect(0, 0, canvasSmall.width, canvasSmall.height);
                        ctxSmall.drawImage(img, 0, 0, canvasSmall.width, canvasSmall.height);
                    }
                    resolve();
                };
                img.onerror = () => reject(new Error('โหลดภาพรอยแผลไม่สำเร็จ'));
                img.src = data.car_diagram_image;
            });
        }
    } catch (e) {
        if (session === inspectionSession) alert('โหลดใบตรวจเดิมไม่สำเร็จ กรุณาลองเปิดใหม่ก่อนบันทึก: ' + e.message);
        if (session === inspectionSession) inspectionLoadFailed = true;
    }
}
