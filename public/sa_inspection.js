// ==========================================
// 🚗 ระบบใบตรวจสภาพรถ (Vehicle Inspection)
// ==========================================

let canvasLarge, ctxLarge;
let canvasSmall, ctxSmall;
let currentTool = 'O'; 

// 🏢 1. ข้อมูล Master ของบริษัทและสาขาต่างๆ
const COMPANY_MASTERS = {
    "raisen_navamin": {
        name: "บริษัท ไรเซน เอนเนอร์จี จำกัด (สาขานวมินทร์)",
        taxId: "0-1055-60176-43-4",
        address: "50/5-6 ซอย นวมินทร์ 151 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพมหานคร 10240",
        phone: "02-051-9199 / 098-151-5155"
    },
    "raisen_rangsit": {
        name: "บริษัท ไรเซน เอนเนอร์จี จำกัด (สาขารังสิต)",
        taxId: "0-1055-60176-43-4",
        address: "47/1 หมู่ที่ 1 ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12120",
        phone: "02-055-9199 / 090-954-1115"
    },
    "rizenic_head": {
        name: "บริษัท ไรเซนิค จำกัด (สำนักงานใหญ่)",
        taxId: "0-1055-67000-00-0",
        address: "50/5-6 ซอย นวมินทร์ 151 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพมหานคร 10240",
        phone: "02-051-9199 / 098-151-5155"
    }
};

async function loadInspectionTemplate() {
    if (!document.getElementById('inspectionModal')) {
        try {
            const res = await fetch('inspection.html');
            const html = await res.text();
            document.body.insertAdjacentHTML('beforeend', html);
            renderPartsTable();
        } catch (e) {
            console.error("❌ ไม่สามารถโหลดไฟล์ inspection.html ได้:", e);
        }
    }
}

// Helper ตั้งค่าข้อมูลให้รองรับทั้ง <input> และ <div>/<span>
function setFieldValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    const cleanVal = val || '';
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
    await loadInspectionTemplate();

    const carPlate = document.getElementById('car_plate')?.value || '';
    const carBrand = document.getElementById('car_brand')?.value || '';
    const carModel = document.getElementById('car_model')?.value || '';
    const custName = document.getElementById('customer_name')?.value || '';
    const phone = document.getElementById('phone_number')?.value || '';
    const vin = document.getElementById('vin_no')?.value || '';
    const arrDate = document.getElementById('arrived_date')?.value || '';
    const tgtDate = document.getElementById('target_finish_date')?.value || '';
    const jobId = document.getElementById('sa_report_id')?.value || '';
    const branchName = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';

    const paymentType = document.getElementById('payment_type')?.value || '';
    const claimNo = document.getElementById('eclaim_claim_no')?.value || document.getElementById('claim_no')?.value || '';
    const damageLevel = document.getElementById('damage_level')?.value || ''; 
    
    if (!carPlate) {
        alert("⚠️ กรุณากรอก 'ทะเบียนรถ' ก่อนเปิดใบตรวจสภาพครับ");
        return;
    }

    // 🎯 หยอดข้อมูลลงช่องแบบรองรับ <input> สม่ำเสมอ
    setFieldValue('ins_car_plate', carPlate);
    setFieldValue('ins_car_brand', carBrand);
    setFieldValue('ins_car_model', carModel);
    setFieldValue('ins_cust_name', custName);
    setFieldValue('ins_phone', phone);
    setFieldValue('ins_vin', vin);
    setFieldValue('ins_arr_date', arrDate);
    setFieldValue('ins_tgt_date', tgtDate);
    setFieldValue('ins_job_no', jobId ? `JOB-${jobId}` : '');
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
    } else if (branchName.includes('RIZENIC') || branchName.includes('ไรเซนิค')) {
        defaultCompKey = 'rizenic_head';
    }

    const companySelect = document.getElementById('ins_company_select');
    if (companySelect) companySelect.value = defaultCompKey;
    updateCompanyHeader(defaultCompKey);

    document.getElementById('inspectionModal').classList.remove('hidden');
    document.getElementById('inspectionModal').classList.add('flex');

    setTimeout(() => {
        initCanvas();
        loadExistingInspectionData(carPlate);
    }, 200);
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
    if(document.getElementById('fuel_txt')) document.getElementById('fuel_txt').innerText = val;
    const arcLength = 110;
    const filled = (val / 100) * arcLength;
    const offset = arcLength - filled; 
    if(document.getElementById('fuel_arc')) {
        document.getElementById('fuel_arc').style.strokeDasharray = `${arcLength}`;
        document.getElementById('fuel_arc').style.strokeDashoffset = `${offset}`;
    }
}

function printInspection() {
    window.print();
}

async function saveInspectionForm() {
    const jobId = document.getElementById('sa_report_id')?.value || 'JOB-' + Date.now();
    const carPlate = document.getElementById('ins_car_plate')?.value || document.getElementById('ins_car_plate')?.innerText || '';
    const carImageBase64 = canvasSmall ? canvasSmall.toDataURL("image/png") : '';

    const payload = {
        job_id: jobId,
        car_plate: carPlate,
        branch_name: sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่',
        company_code: document.getElementById('ins_company_select')?.value || 'raisen_navamin',
        fuel_level: document.getElementById('ins_fuel_level')?.value || 50,
        current_mileage: document.getElementById('ins_mileage')?.value || 0,
        car_diagram_image: carImageBase64,
        notes: document.getElementById('ins_extra_notes')?.value || ''
    };

    try {
        const btn = document.querySelector('button[onclick="saveInspectionForm()"]');
        const oldText = btn ? btn.innerHTML : '';
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; btn.disabled = true; }

        const res = await fetch(`${API_BASE_URL}/api/inspection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('🎉 บันทึกข้อมูลใบตรวจรับรถเรียบร้อยครับ!');
            closeInspectionModal();
        } else {
            const err = await res.json();
            alert('❌ บันทึกไม่สำเร็จ: ' + (err.error || 'โปรดตรวจสอบข้อมูล'));
        }

        if(btn) { btn.innerHTML = oldText; btn.disabled = false; }
    } catch (e) {
        console.error(e);
        alert('❌ เครือข่ายมีปัญหา ไม่สามารถบันทึกได้');
    }
}

async function loadExistingInspectionData(carPlate) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/inspection/${encodeURIComponent(carPlate)}`);
        if (res.ok) {
            const result = await res.json();
            const data = result.data;
            if (!data) return;

            if (data.company_code) {
                const compSelect = document.getElementById('ins_company_select');
                if (compSelect) compSelect.value = data.company_code;
                updateCompanyHeader(data.company_code);
            }

            if (data.fuel_level && document.getElementById('ins_fuel_level')) {
                document.getElementById('ins_fuel_level').value = data.fuel_level;
                updateFuelGauge(data.fuel_level);
            }
            if (data.current_mileage && document.getElementById('ins_mileage')) {
                document.getElementById('ins_mileage').value = data.current_mileage;
            }
            if (data.notes && document.getElementById('ins_extra_notes')) {
                document.getElementById('ins_extra_notes').value = data.notes;
            }

            if (data.car_diagram_image && canvasSmall) {
                const img = new Image();
                img.onload = function() {
                    ctxSmall.clearRect(0, 0, 1000, 400);
                    ctxSmall.drawImage(img, 0, 0, 1000, 400);
                };
                img.src = data.car_diagram_image;
            }
        }
    } catch (e) {
        console.log("ยังไม่มีข้อมูลใบตรวจรับรถเดิม");
    }
}