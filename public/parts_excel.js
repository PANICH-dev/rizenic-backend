// ==========================================
// 📊 RIZENIC - Smart Excel Import System
// ==========================================

let smartExcelValidPayload = []; // ตัวแปรเก็บข้อมูลที่พร้อมบันทึก

// 1. ฟังก์ชันเปิด Modal (บังคับให้เริ่มที่หน้าโยนไฟล์เสมอ)
function openSmartExcelUpload() {
    // ซ่อนหน้าตารางพรีวิว และปุ่มบันทึก
    const previewZone = document.getElementById('excel_preview_zone');
    const btnSubmit = document.getElementById('btn_submit_smart_excel');
    const uploadZone = document.getElementById('excel_upload_zone');
    
    if(previewZone) { previewZone.classList.add('hidden'); previewZone.classList.remove('flex'); }
    if(btnSubmit) { btnSubmit.classList.add('hidden'); btnSubmit.classList.remove('flex'); }
    if(uploadZone) { uploadZone.classList.remove('hidden'); uploadZone.classList.add('flex'); }
    
    // เคลียร์ไฟล์เก่าและตาราง
    const fileInput = document.getElementById('excel_file_input');
    if(fileInput) fileInput.value = ""; 
    
    const tbody = document.getElementById('excel_preview_tbody');
    if(tbody) tbody.innerHTML = "";
    smartExcelValidPayload = [];

    // แสดง Modal
    const modal = document.getElementById('smartExcelModal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// 2. ฟังก์ชันปิด Modal
function closeSmartExcelUpload() {
    const modal = document.getElementById('smartExcelModal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    smartExcelValidPayload = [];
}

// 3. ผูก Event ลิสเนอร์ให้กล่องโยนไฟล์ (ให้คลิกได้)
document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('excel_upload_zone');
    if (uploadZone) {
        uploadZone.onclick = function() {
            const input = document.getElementById('excel_file_input');
            if(input) input.click();
        };
    }
});

// 4. ฟังก์ชันอ่านไฟล์ Excel (ใช้ ArrayBuffer มาตรฐานใหม่)
function processSmartExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // แปลงข้อมูลเป็น Array แบบข้ามแถวว่างอัตโนมัติ
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            validateExcelData(rawData);
        } catch(err) {
            console.error("Excel Read Error:", err);
            alert('❌ อ่านไฟล์ Excel ล้มเหลว กรุณาตรวจสอบรูปแบบไฟล์ครับ');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 5. ตรวจสอบข้อมูลเทียบกับ Master
function validateExcelData(dataRows) {
    const tbody = document.getElementById('excel_preview_tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    smartExcelValidPayload = [];
    
    let readyCount = 0;
    let errorCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!dataRows || dataRows.length === 0) {
        alert("⚠️ ไม่พบข้อมูลในไฟล์ Excel ครับ");
        return;
    }

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if(!row || row.length === 0) continue;
        
        const partNo = String(row[0] || '').trim().toUpperCase();
        if(!partNo) continue; // ข้ามแถวว่าง

        // ตรวจจับข้ามหัวตาราง (ถ้าพิมพ์คำว่า Part / บาร์โค้ด / หมายเลข / รหัส)
        if(i === 0 && (partNo.includes('PART') || partNo.includes('บาร์โค้ด') || partNo.includes('หมายเลข') || partNo.includes('รหัส') || partNo === 'NO')) {
            continue;
        }

        const qty = parseInt(row[1]) || 1;
        const price = parseFloat(row[2]) || 0;

        // ค้นหาใน Master Parts Cache
        const masterCache = (typeof allMasterPartsCache !== 'undefined' && Array.isArray(allMasterPartsCache)) ? allMasterPartsCache : [];
        const masterMatch = masterCache.find(m => m.part_no && m.part_no.toUpperCase() === partNo);
        
        let statusHtml = '';
        let trClass = '';
        let displayPartName = '';

        if (masterMatch) {
            statusHtml = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black"><i class="fa-solid fa-check"></i> ผ่าน</span>`;
            trClass = "bg-emerald-50/20";
            displayPartName = masterMatch.part_name;
            readyCount++;

            smartExcelValidPayload.push({
                received_date: todayStr,
                part_no: masterMatch.part_no,
                part_main_no: masterMatch.part_main_no || null,
                part_name: masterMatch.part_name,
                qty: qty,
                unit_price: price,
                branch_name: typeof userBranch !== 'undefined' ? userBranch : 'สำนักงานใหญ่'
            });
        } else {
            statusHtml = `<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black"><i class="fa-solid fa-xmark"></i> ไม่มี Master</span>`;
            trClass = "bg-rose-50";
            displayPartName = `<span class="text-rose-500 italic text-[10px]">ไม่พบ Part No นี้ใน Master</span>`;
            errorCount++;
        }

        tbody.innerHTML += `
            <tr class="${trClass} border-b border-slate-200">
                <td class="p-2 border border-slate-200 text-center">${statusHtml}</td>
                <td class="p-2 border border-slate-200 font-mono font-bold text-slate-800">${partNo}</td>
                <td class="p-2 border border-slate-200 text-center font-black">${qty}</td>
                <td class="p-2 border border-slate-200 text-right font-mono text-slate-600">${price.toFixed(2)}</td>
                <td class="p-2 border border-slate-200 font-bold">${displayPartName}</td>
            </tr>
        `;
    }

    const readyEl = document.getElementById('excel_ready_count');
    const errorEl = document.getElementById('excel_error_count');
    if(readyEl) readyEl.innerText = readyCount;
    if(errorEl) errorEl.innerText = errorCount;

    // สลับหน้าแสดงผลตาราง
    const uploadZone = document.getElementById('excel_upload_zone');
    const previewZone = document.getElementById('excel_preview_zone');
    const btnSubmit = document.getElementById('btn_submit_smart_excel');

    if(uploadZone) uploadZone.classList.add('hidden');
    if(previewZone) {
        previewZone.classList.remove('hidden');
        previewZone.classList.add('flex');
    }

    if(readyCount > 0 && btnSubmit) {
        btnSubmit.classList.remove('hidden');
        btnSubmit.classList.add('flex');
    }
}

// 6. ส่งข้อมูลขึ้นระบบ
async function submitSmartExcel() {
    if (smartExcelValidPayload.length === 0) return;

    if (!confirm(`ยืนยันการรับเข้าคลัง จำนวน ${smartExcelValidPayload.length} รายการ?`)) return;

    const btn = document.getElementById('btn_submit_smart_excel');
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
        btn.disabled = true;
    }

    try {
        await Promise.all(smartExcelValidPayload.map(item => 
            fetch(`${API_BASE_URL}/api/part-inbound`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(item) 
            })
        ));

        if(typeof showToast === 'function') showToast(`บันทึกรับเข้าคลังสำเร็จ ${smartExcelValidPayload.length} รายการ!`);
        closeSmartExcelUpload();
        if(typeof loadAllData === 'function') loadAllData(); 
    } catch(err) { 
        if(typeof showToast === 'function') showToast('บันทึกล้มเหลว กรุณาลองใหม่', 'error'); 
        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> บันทึกเฉพาะรายการที่ผ่าน (สีเขียว)';
            btn.disabled = false;
        }
    }
}