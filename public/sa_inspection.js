// ==========================================
// 🚗 ระบบใบตรวจสภาพรถ (Vehicle Inspection)
// ==========================================

let canvasLarge, ctxLarge;
let canvasSmall, ctxSmall;
let currentTool = 'O'; 

function openInspectionModal() {
    const carPlate = document.getElementById('car_plate')?.value || '';
    const carBrand = document.getElementById('car_brand')?.value || '';
    const carModel = document.getElementById('car_model')?.value || '';
    const custName = document.getElementById('customer_name')?.value || '';
    const phone = document.getElementById('phone_number')?.value || '';
    const vin = document.getElementById('vin_no')?.value || '';
    const arrDate = document.getElementById('arrived_date')?.value || '';
    const tgtDate = document.getElementById('target_finish_date')?.value || '';
    const saName = document.getElementById('sa_owner_input')?.value || sessionStorage.getItem('emp_name') || '';
    const jobId = document.getElementById('sa_report_id')?.value || '';
    const branchName = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    
    if (!carPlate) {
        alert("⚠️ กรุณากรอก 'ทะเบียนรถ' ก่อนเปิดใบตรวจสภาพครับ");
        return;
    }

    if (document.getElementById('ins_car_plate')) document.getElementById('ins_car_plate').value = carPlate;
    if (document.getElementById('ins_car_brand')) document.getElementById('ins_car_brand').value = carBrand;
    if (document.getElementById('ins_car_model')) document.getElementById('ins_car_model').value = carModel;
    if (document.getElementById('ins_cust_name')) document.getElementById('ins_cust_name').value = custName;
    if (document.getElementById('ins_phone')) document.getElementById('ins_phone').value = phone;
    if (document.getElementById('ins_vin')) document.getElementById('ins_vin').value = vin;
    if (document.getElementById('ins_arr_date')) document.getElementById('ins_arr_date').value = arrDate;
    if (document.getElementById('ins_tgt_date')) document.getElementById('ins_tgt_date').value = tgtDate;
    if (document.getElementById('ins_job_no')) document.getElementById('ins_job_no').value = jobId ? `JOB-${jobId}` : '';
    if (document.getElementById('sign_cust_name')) document.getElementById('sign_cust_name').value = custName;
    if (document.getElementById('sign_sa_name')) document.getElementById('sign_sa_name').value = saName;

    const addrBox = document.getElementById('ins_company_address');
    if (addrBox) {
        if (branchName.includes('Navamin') || branchName.includes('นวมินทร์')) {
            addrBox.innerHTML = `
                <p class="text-base font-black text-[#00320D]">บริษัท ไรเซน เอนเนอร์จี จำกัด</p>
                <p>เลขที่เสียภาษี 0-1055-60176-43-4</p>
                <p>50/5-6 ซอย นวมินทร์ 151 นวลจันทร์</p>
                <p>เขตบึงกุ่ม กรุงเทพมหานคร 10230</p>
                <p>โทรศัพท์ : 0981515155</p>
            `;
        } else {
            addrBox.innerHTML = `
                <p class="text-base font-black text-[#00320D]">บริษัท ไรเซน เอนเนอร์จี จำกัด</p>
                <p>เลขที่เสียภาษี 0-1055-60176-43-4</p>
                <p>47/1 หมู่ที่ 1 ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12120</p>
                <p>โทรศัพท์ : 02-055-9199 / 090-954-1115</p>
            `;
        }
    }

    document.getElementById('inspectionModal').classList.remove('hidden');
    document.getElementById('inspectionModal').classList.add('flex');

    setTimeout(() => {
        initCanvas();
        loadExistingInspectionData(carPlate);
    }, 200);
}

function closeInspectionModal() {
    document.getElementById('inspectionModal').classList.add('hidden');
    document.getElementById('inspectionModal').classList.remove('flex');
}

// ----------------------------------
// 🖌️ ระบบ Canvas วาดรูปรถแบบขยายจอ
// ----------------------------------
function initCanvas() {
    canvasSmall = document.getElementById('carCanvasSmall');
    canvasLarge = document.getElementById('carCanvasLarge');
    
    if (canvasSmall) {
        const rectS = canvasSmall.parentElement.getBoundingClientRect();
        canvasSmall.width = rectS.width;
        canvasSmall.height = rectS.height;
        ctxSmall = canvasSmall.getContext('2d');
    }
    
    if (canvasLarge) {
        ctxLarge = canvasLarge.getContext('2d');
        // ติดตั้ง Event ลากวาดรูปเฉพาะจอใหญ่
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
    
    const rectL = canvasLarge.parentElement.getBoundingClientRect();
    
    // สำรองรูปเดิมจากจอเล็กมาไว้จอใหญ่
    const tempImg = new Image();
    tempImg.src = canvasSmall.toDataURL();
    
    canvasLarge.width = rectL.width;
    canvasLarge.height = rectL.height;
    
    tempImg.onload = () => {
        ctxLarge.drawImage(tempImg, 0, 0, canvasLarge.width, canvasLarge.height);
    };
}

function closeCarDrawModal(isSaved) {
    document.getElementById('carDrawModal').classList.add('hidden');
    document.getElementById('carDrawModal').classList.remove('flex');
    
    if (isSaved && canvasSmall && canvasLarge) {
        // ก๊อปปี้รูปจากจอใหญ่ ย่อกลับลงจอเล็ก A4
        ctxSmall.clearRect(0, 0, canvasSmall.width, canvasSmall.height);
        ctxSmall.drawImage(canvasLarge, 0, 0, canvasSmall.width, canvasSmall.height);
    }
}

function setDrawTool(tool) {
    currentTool = tool;
    const btnO = document.getElementById('tool_O');
    const btnX = document.getElementById('tool_X');
    
    if(tool === 'O') {
        btnO.className = "px-5 py-2 bg-red-100 border-2 border-red-600 text-red-700 font-bold rounded-xl shadow-sm";
        btnX.className = "px-5 py-2 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl shadow-sm";
    } else {
        btnX.className = "px-5 py-2 bg-blue-100 border-2 border-blue-600 text-blue-700 font-bold rounded-xl shadow-sm";
        btnO.className = "px-5 py-2 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl shadow-sm";
    }
}

function stampMark(e) {
    const rect = canvasLarge.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctxLarge.lineWidth = 4;
    
    if (currentTool === 'O') {
        ctxLarge.strokeStyle = '#ef4444';
        ctxLarge.beginPath();
        ctxLarge.arc(x, y, 20, 0, Math.PI * 2);
        ctxLarge.stroke();
    } else if (currentTool === 'X') {
        ctxLarge.strokeStyle = '#3b82f6';
        ctxLarge.beginPath();
        ctxLarge.moveTo(x - 15, y - 15);
        ctxLarge.lineTo(x + 15, y + 15);
        ctxLarge.moveTo(x + 15, y - 15);
        ctxLarge.lineTo(x - 15, y + 15);
        ctxLarge.stroke();
    }
}

function clearCanvas() {
    if(confirm("ลบเครื่องหมายแผลทั้งหมดใช่หรือไม่?")) {
        ctxLarge.clearRect(0, 0, canvasLarge.width, canvasLarge.height);
    }
}

function printInspection() {
    window.print();
}

// ----------------------------------
// 💾 บันทึกข้อมูลเข้าฐานข้อมูล (Save)
// ----------------------------------
async function saveInspectionForm() {
    const jobId = document.getElementById('sa_report_id')?.value || 'JOB-' + Date.now();
    const carPlate = document.getElementById('ins_car_plate')?.value || '';
    
    // บันทึกรูปจากจอเล็ก (เพราะสัดส่วนเข้ากับเอกสาร A4 มากที่สุด)
    const carImageBase64 = canvasSmall ? canvasSmall.toDataURL("image/png") : '';

    const payload = {
        job_id: jobId,
        car_plate: carPlate,
        branch_name: sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่',
        fuel_level: document.getElementById('ins_fuel_level')?.value || 50,
        current_mileage: document.getElementById('ins_mileage')?.value || 0,
        inventory_checklist: {
            tools: document.getElementById('inv_tools')?.checked,
            jack: document.getElementById('inv_jack')?.checked,
            spare_tire: document.getElementById('inv_spare_tire')?.checked,
            radio: document.getElementById('inv_radio')?.checked,
            carpet: document.getElementById('inv_carpet')?.checked,
            rubber: document.getElementById('inv_rubber')?.checked
        },
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
            alert('❌ บันทึกไม่สำเร็จ: ' + err.error);
        }

        if(btn) { btn.innerHTML = oldText; btn.disabled = false; }
    } catch (e) {
        console.error(e);
        alert('❌ เครือข่ายมีปัญหา ไม่สามารถบันทึกได้');
    }
}

// ----------------------------------
// 🔄 โหลดข้อมูลเก่าที่เคยบันทึกไว้
// ----------------------------------
async function loadExistingInspectionData(jobId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/inspection/${jobId}`);
        if (res.ok) {
            const result = await res.json();
            const data = result.data;
            if (!data) return;

            if (data.fuel_level && document.getElementById('ins_fuel_level')) {
                document.getElementById('ins_fuel_level').value = data.fuel_level;
                if (typeof updateFuelGauge === 'function') updateFuelGauge(data.fuel_level);
            }
            if (data.current_mileage && document.getElementById('ins_mileage')) {
                document.getElementById('ins_mileage').value = data.current_mileage;
            }
            if (data.notes && document.getElementById('ins_extra_notes')) {
                document.getElementById('ins_extra_notes').value = data.notes;
            }

            // โหลดรูปลงทั้งจอเล็กและเตรียมไว้ให้จอใหญ่
            if (data.car_diagram_image && canvasSmall) {
                const img = new Image();
                img.onload = function() {
                    ctxSmall.clearRect(0, 0, canvasSmall.width, canvasSmall.height);
                    ctxSmall.drawImage(img, 0, 0, canvasSmall.width, canvasSmall.height);
                };
                img.src = data.car_diagram_image;
            }
        }
    } catch (e) {
        console.log("ยังไม่มีข้อมูลใบตรวจรับรถเดิม");
    }
}