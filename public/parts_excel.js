// ==========================================
// 📊 RIZENIC - Smart Excel Import System
// ==========================================

let smartExcelValidPayload = []; // ตัวแปรเก็บข้อมูลที่พร้อมบันทึก

// เปิด/ปิด Modal
function openSmartExcelUpload() {
    document.getElementById('excel_upload_zone').classList.remove('hidden');
    document.getElementById('excel_preview_zone').classList.add('hidden');
    document.getElementById('btn_submit_smart_excel').classList.add('hidden');
    document.getElementById('excel_file_input').value = ""; // Reset input
    
    document.getElementById('smartExcelModal').classList.remove('hidden');
    document.getElementById('smartExcelModal').classList.add('flex');
}

function closeSmartExcelUpload() {
    document.getElementById('smartExcelModal').classList.add('hidden');
    document.getElementById('smartExcelModal').classList.remove('flex');
    smartExcelValidPayload = [];
}

// ผูกอีเวนต์ให้คลิกกล่องสี่เหลี่ยมแล้วเปิดเลือกไฟล์ได้
document.getElementById('excel_upload_zone').addEventListener('click', () => {
    document.getElementById('excel_file_input').click();
});

// ฟังก์ชันอ่านไฟล์ Excel
function processSmartExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const data = evt.target.result;
        // แปลงไฟล์ด้วยไลบรารี SheetJS (XLSX)
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // แปลงหน้า Sheet ให้กลายเป็น Array 2 มิติ (แถว x คอลัมน์) โดยอ่านตั้งแต่บรรทัดแรก
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        validateExcelData(rawData);
    };
    reader.readAsBinaryString(file);
}

// ตรวจสอบข้อมูลเทียบกับ Master
function validateExcelData(dataRows) {
    const tbody = document.getElementById('excel_preview_tbody');
    tbody.innerHTML = '';
    smartExcelValidPayload = [];
    
    let readyCount = 0;
    let errorCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // ข้ามแถวแรกถ้ามันเป็นหัวตาราง (มีตัวหนังสือปนมา)
    let startIndex = 0;
    if(dataRows.length > 0) {
        const firstCell = String(Object.values(dataRows[0])[0] || '').trim();
        // ถ้าคอลัมน์แรกเป็นภาษาไทย หรือคำว่า Part แสดงว่าเป็นหัวตาราง ให้ข้าม 1 แถว
        if(/^[ก-๙a-zA-Z]+$/.test(firstCell) || firstCell.toLowerCase().includes('part')) {
            startIndex = 1;
        }
    }

    for (let i = startIndex; i < dataRows.length; i++) {
        const rowObj = dataRows[i];
        const cols = Object.values(rowObj);
        
        const partNo = String(cols[0] || '').trim().toUpperCase();
        if(!partNo) continue; // ข้ามแถวว่าง

        const qty = parseInt(cols[1]) || 1; // ถ้าไม่ใส่จำนวน ให้เป็น 1
        const price = parseFloat(cols[2]) || 0;

        // 🔍 ค้นหาใน Master Parts
        const masterMatch = allMasterPartsCache.find(m => m.part_no && m.part_no.toUpperCase() === partNo);
        
        let statusHtml = '';
        let trClass = '';
        let displayPartName = '';

        if (masterMatch) {
            // ✅ เจอใน Master
            statusHtml = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black"><i class="fa-solid fa-check"></i> ผ่าน</span>`;
            trClass = "bg-emerald-50/20";
            displayPartName = masterMatch.part_name;
            readyCount++;

            // ดันเข้า Payload เพื่อเตรียมบันทึกจริง
            smartExcelValidPayload.push({
                received_date: todayStr,
                part_no: masterMatch.part_no,
                part_main_no: masterMatch.part_main_no || null,
                part_name: masterMatch.part_name,
                qty: qty,
                unit_price: price,
                branch_name: userBranch
            });
        } else {
            // ❌ ไม่เจอใน Master
            statusHtml = `<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black"><i class="fa-solid fa-xmark"></i> ไม่มี Master</span>`;
            trClass = "bg-rose-50";
            displayPartName = `<span class="text-rose-500 italic text-[10px]">ระบบไม่รู้จัก Part No นี้ (ต้องไปเพิ่มใน Master ก่อน)</span>`;
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

    // อัปเดตตัวเลขหน้า UI
    document.getElementById('excel_ready_count').innerText = readyCount;
    document.getElementById('excel_error_count').innerText = errorCount;

    // สลับหน้าจอให้เห็นตาราง
    document.getElementById('excel_upload_zone').classList.add('hidden');
    document.getElementById('excel_preview_zone').classList.remove('hidden');
    document.getElementById('excel_preview_zone').classList.add('flex');

    if(readyCount > 0) {
        document.getElementById('btn_submit_smart_excel').classList.remove('hidden');
        document.getElementById('btn_submit_smart_excel').classList.add('flex');
    }
}

// ยิง API บันทึกเข้า Inbound
async function submitSmartExcel() {
    if (smartExcelValidPayload.length === 0) return;

    if (!confirm(`ยืนยันการรับเข้าคลัง จำนวน ${smartExcelValidPayload.length} รายการ? \n(รายการที่ไม่มี Master จะถูกข้ามอัตโนมัติ)`)) return;

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

        showToast(`บันทึกรับเข้าคลังสำเร็จ ${smartExcelValidPayload.length} รายการ!`);
        closeSmartExcelUpload();
        loadAllData(); // โหลดหน้าเว็บใหม่ให้สต๊อกอัปเดต
    } catch(err) { 
        showToast('บันทึกล้มเหลว กรุณาลองใหม่', 'error'); 
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> บันทึกเฉพาะรายการที่ผ่าน (สีเขียว)';
        btn.disabled = false;
    }
}