// ==========================================
// 📊 RIZENIC - Smart Excel Import System
// ==========================================

let smartExcelValidPayload = []; // ตัวแปรเก็บข้อมูลที่พร้อมบันทึก

// 1. ฟังก์ชันเปิด Modal (บังคับให้เริ่มที่หน้าโยนไฟล์เสมอ)
function openSmartExcelUpload() {
    // ซ่อนหน้าตารางพรีวิว และปุ่มบันทึก
    document.getElementById('excel_preview_zone').classList.add('hidden');
    document.getElementById('excel_preview_zone').classList.remove('flex');
    document.getElementById('btn_submit_smart_excel').classList.add('hidden');
    document.getElementById('btn_submit_smart_excel').classList.remove('flex');
    
    // โชว์กล่องโยนไฟล์
    document.getElementById('excel_upload_zone').classList.remove('hidden');
    document.getElementById('excel_upload_zone').classList.add('flex');
    
    // เคลียร์ไฟล์เก่าและตาราง
    document.getElementById('excel_file_input').value = ""; 
    document.getElementById('excel_preview_tbody').innerHTML = "";
    smartExcelValidPayload = [];

    // แสดง Modal
    const modal = document.getElementById('smartExcelModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// 2. ฟังก์ชันปิด Modal
function closeSmartExcelUpload() {
    const modal = document.getElementById('smartExcelModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    smartExcelValidPayload = [];
}

// 3. ผูก Event ลิสเนอร์ให้กล่องโยนไฟล์ (ให้คลิกได้)
document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('excel_upload_zone');
    if (uploadZone) {
        uploadZone.addEventListener('click', () => {
            document.getElementById('excel_file_input').click();
        });
    }
});

// 4. ฟังก์ชันอ่านไฟล์ Excel
function processSmartExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // แปลงข้อมูลเป็น Array
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            validateExcelData(rawData);
        } catch(err) {
            alert('❌ อ่านไฟล์ Excel ล้มเหลว กรุณาตรวจสอบรูปแบบไฟล์ครับ');
        }
    };
    reader.readAsBinaryString(file);
}

// 5. ตรวจสอบข้อมูลเทียบกับ Master
function validateExcelData(dataRows) {
    const tbody = document.getElementById('excel_preview_tbody');
    tbody.innerHTML = '';
    smartExcelValidPayload = [];
    
    let readyCount = 0;
    let errorCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // เช็กข้ามหัวตาราง
    let startIndex = 0;
    if(dataRows.length > 0) {
        const firstCell = String(Object.values(dataRows[0])[0] || '').trim();
        if(/^[ก-๙a-zA-Z]+$/.test(firstCell) || firstCell.toLowerCase().includes('part')) {
            startIndex = 1;
        }
    }

    for (let i = startIndex; i < dataRows.length; i++) {
        const rowObj = dataRows[i];
        if(!rowObj) continue;
        const cols = Object.values(rowObj);
        
        const partNo = String(cols[0] || '').trim().toUpperCase();
        if(!partNo) continue; // ข้ามแถวว่าง

        const qty = parseInt(cols[1]) || 1;
        const price = parseFloat(cols[2]) || 0;

        // ค้นหาใน Master
        const masterMatch = (typeof allMasterPartsCache !== 'undefined' ? allMasterPartsCache : []).find(m => m.part_no && m.part_no.toUpperCase() === partNo);
        
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

    document.getElementById('excel_ready_count').innerText = readyCount;
    document.getElementById('excel_error_count').innerText = errorCount;

    // สลับหน้าแสดงผลตาราง
    document.getElementById('excel_upload_zone').classList.add('hidden');
    document.getElementById('excel_preview_zone').classList.remove('hidden');
    document.getElementById('excel_preview_zone').classList.add('flex');

    if(readyCount > 0) {
        document.getElementById('btn_submit_smart_excel').classList.remove('hidden');
        document.getElementById('btn_submit_smart_excel').classList.add('flex');
    }
}

// 6. ส่งข้อมูลขึ้นระบบ
async function submitSmartExcel() {
    if (smartExcelValidPayload.length === 0) return;

    if (!confirm(`ยืนยันการรับเข้าคลัง จำนวน ${smartExcelValidPayload.length} รายการ?`)) return;

    const btn = document.getElementById('btn_submit_smart_excel');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;

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
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> บันทึกเฉพาะรายการที่ผ่าน (สีเขียว)';
        btn.disabled = false;
    }
}