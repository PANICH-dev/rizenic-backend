// ==========================================
// 🚗 ระบบใบตรวจสภาพรถ (Vehicle Inspection)
// ==========================================

let canvas, ctx;
let currentTool = 'O'; // เริ่มต้นใช้โหมดวงกลม

function openInspectionModal() {
    // 1. ดึงข้อมูลจากฟอร์มเปิดบิล มาใส่ในใบตรวจรับรถ
    const carPlate = document.getElementById('car_plate')?.value || '';
    const carBrand = document.getElementById('car_brand')?.value || '';
    const carModel = document.getElementById('car_model')?.value || '';
    const custName = document.getElementById('customer_name')?.value || '';
    const saName = document.getElementById('sa_owner_input')?.value || sessionStorage.getItem('emp_name') || '';
    
    if (!carPlate) {
        alert("⚠️ กรุณากรอก 'ทะเบียนรถ' ก่อนเปิดใบตรวจสภาพครับ");
        return;
    }

    document.getElementById('ins_car_plate').value = carPlate;
    document.getElementById('ins_car_brand').value = carBrand;
    document.getElementById('ins_car_model').value = carModel;
    document.getElementById('ins_cust_name').value = custName;
    document.getElementById('ins_sa_sign_name').innerText = saName;

    // 2. แสดง Modal
    document.getElementById('inspectionModal').classList.remove('hidden');
    document.getElementById('inspectionModal').classList.add('flex');

    // 3. ตั้งค่า Canvas และโหลดข้อมูลเก่าถ้าเคยบันทึกไว้
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
// 🖌️ ระบบ Canvas วาดรูปรถ
// ----------------------------------
function initCanvas() {
    canvas = document.getElementById('carCanvas');
    if (!canvas) return;

    // เซ็ตขนาด Canvas ให้เท่ากับขนาดกล่อง div ที่ครอบอยู่
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx = canvas.getContext('2d');
    
    // จัดการ Event การคลิกเพื่อวาด (รองรับทั้งเมาส์และหน้าจอสัมผัส)
    canvas.onmousedown = stampMark;
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        stampMark(e.touches[0]);
    };
}

function setDrawTool(tool) {
    currentTool = tool;
    const btnO = document.getElementById('tool_O');
    const btnX = document.getElementById('tool_X');
    
    if(tool === 'O') {
        btnO.className = "px-3 py-1 bg-red-100 border-2 border-red-600 text-red-700 font-bold rounded-lg text-xs";
        btnX.className = "px-3 py-1 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg text-xs";
    } else {
        btnX.className = "px-3 py-1 bg-blue-100 border-2 border-blue-600 text-blue-700 font-bold rounded-lg text-xs";
        btnO.className = "px-3 py-1 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg text-xs";
    }
}

function stampMark(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 3;
    
    if (currentTool === 'O') {
        // วาดวงกลมสีแดง (O)
        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.stroke();
    } else if (currentTool === 'X') {
        // วาดกากบาทสีน้ำเงิน (X)
        ctx.strokeStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 12);
        ctx.lineTo(x + 12, y + 12);
        ctx.moveTo(x + 12, y - 12);
        ctx.lineTo(x - 12, y + 12);
        ctx.stroke();
    }
}

function clearCanvas() {
    if(confirm("ลบเครื่องหมายแผลทั้งหมดใช่หรือไม่?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// ----------------------------------
// 🖨️ สั่งพิมพ์ (Print)
// ----------------------------------
function printInspection() {
    window.print();
}

// ----------------------------------
// 💾 บันทึกข้อมูลเข้าฐานข้อมูล (Save)
// ----------------------------------
async function saveInspectionForm() {
    const jobId = document.getElementById('sa_report_id')?.value || 'JOB-' + Date.now();
    const carPlate = document.getElementById('ins_car_plate').value;
    
    // แปลงรูปวาดจาก Canvas เป็น Base64 String
    const carImageBase64 = canvas.toDataURL("image/png");

    const payload = {
        job_id: jobId,
        car_plate: carPlate,
        branch_name: sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่',
        fuel_level: document.getElementById('ins_fuel_level').value,
        inventory_checklist: {
            jack: document.getElementById('inv_jack').checked,
            spare_tire: document.getElementById('inv_spare_tire').checked,
            tools: document.getElementById('inv_tools').checked,
            radio: document.getElementById('inv_radio').checked
        },
        car_diagram_image: carImageBase64,
        notes: document.getElementById('ins_notes').value
    };

    try {
        const btn = document.querySelector('button[onclick="saveInspectionForm()"]');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        btn.disabled = true;

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

        btn.innerHTML = oldText;
        btn.disabled = false;
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

            // เติมเกจน้ำมัน และ หมายเหตุ
            if (data.fuel_level) {
                document.getElementById('ins_fuel_level').value = data.fuel_level;
                document.getElementById('fuel_display').innerText = data.fuel_level + '%';
            }
            if (data.notes) document.getElementById('ins_notes').value = data.notes;

            // ติ๊กช่อง Checkbox
            if (data.inventory_checklist) {
                const inv = typeof data.inventory_checklist === 'string' ? JSON.parse(data.inventory_checklist) : data.inventory_checklist;
                document.getElementById('inv_jack').checked = !!inv.jack;
                document.getElementById('inv_spare_tire').checked = !!inv.spare_tire;
                document.getElementById('inv_tools').checked = !!inv.tools;
                document.getElementById('inv_radio').checked = !!inv.radio;
            }

            // วาดรูปวาดเก่ากลับลงไปบน Canvas
            if (data.car_diagram_image) {
                const img = new Image();
                img.onload = function() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                img.src = data.car_diagram_image;
            }
        }
    } catch (e) {
        console.log("ยังไม่มีข้อมูลใบตรวจรับรถเดิม");
    }
}