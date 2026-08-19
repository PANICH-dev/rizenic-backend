// ==========================================
// 📊 RIZENIC - Smart Excel Import System
// ==========================================

let smartExcelValidPayload = []; // ตัวแปรเก็บข้อมูลที่พร้อมบันทึก

// 1. ฟังก์ชันเปิด Modal
function openSmartExcelUpload() {
    const previewZone = document.getElementById('excel_preview_zone');
    const btnSubmit = document.getElementById('btn_submit_smart_excel');
    const uploadZone = document.getElementById('excel_upload_zone');
    
    if(previewZone) { previewZone.classList.add('hidden'); previewZone.classList.remove('flex'); }
    if(btnSubmit) { btnSubmit.classList.add('hidden'); btnSubmit.classList.remove('flex'); }
    if(uploadZone) { uploadZone.classList.remove('hidden'); uploadZone.classList.add('flex'); }
    
    const fileInput = document.getElementById('excel_file_input');
    if(fileInput) fileInput.value = ""; 
    
    const tbody = document.getElementById('excel_preview_tbody');
    if(tbody) tbody.innerHTML = "";
    smartExcelValidPayload = [];

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

// 3. ฟังก์ชันอ่านไฟล์ Excel
function processSmartExcel(e) {
    const file = e.target.files ? e.target.files[0] : (e.dataTransfer ? e.target.files[0] : null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            if (typeof XLSX === 'undefined') {
                alert('❌ ไม่พบไลบรารี XLSX กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง');
                return;
            }
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            validateExcelData(rawData);
        } catch(err) {
            console.error("Excel Read Error:", err);
            alert('❌ อ่านไฟล์ Excel ล้มเหลว กรุณาตรวจสอบรูปแบบไฟล์ครับ');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 4. ตรวจสอบข้อมูลเทียบกับ Master & PO
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

    const masterCache = (typeof allMasterPartsCache !== 'undefined' && Array.isArray(allMasterPartsCache)) ? allMasterPartsCache : [];
    const poCache = (typeof allPartOrders !== 'undefined' && Array.isArray(allPartOrders)) ? allPartOrders : [];

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if(!row || row.length === 0) continue;
        
        const col0 = String(row[0] || '').trim().toUpperCase();
        const col1 = String(row[1] || '').trim().toUpperCase();

        // ข้ามแถวหัวตารางอัตโนมัติ
        if(i === 0 && (col0.includes('EPC') || col0.includes('PART') || col0.includes('บาร์โค้ด') || col0.includes('หมายเลข') || col0.includes('รหัส') || col0 === 'NO')) {
            continue;
        }

        if(!col0 && !col1) continue;

        let epcNo = '';
        let partNo = '';
        let qty = 1;
        let price = 0;
        let rcvDate = todayStr;

        // เช็กโครงสร้างคอลัมน์ Excel แบบ Smart
        const isCol0PartInMaster = masterCache.some(m => m.part_no && m.part_no.toUpperCase() === col0);

        if (isCol0PartInMaster) {
            // โครงสร้างแบบเดิม: [PartNo, Qty, Price, EPC, Date]
            partNo = col0;
            qty = parseInt(row[1]) || 1;
            price = parseFloat(row[2]) || 0;
            epcNo = String(row[3] || '').trim().toUpperCase();
            if (row[4] && String(row[4]).trim() !== '') rcvDate = String(row[4]).trim();
        } else {
            // โครงสร้างใหม่แบบสเปคศูนย์: [EPC No, Part No, Qty, Price, Date]
            epcNo = col0;
            partNo = col1;
            qty = parseInt(row[2]) || 1;
            price = parseFloat(row[3]) || 0;
            if (row[4] && String(row[4]).trim() !== '') rcvDate = String(row[4]).trim();
        }

        if (!partNo) continue;

        // ค้นหาใน Master Parts
        const masterMatch = masterCache.find(m => m.part_no && m.part_no.toUpperCase() === partNo);
        
        // ค้นหาการเชื่อมโยงกับตารางสั่งอะไหล่ (PO)
        const poMatch = poCache.find(p => p.part_no && p.part_no.toUpperCase() === partNo && (epcNo ? p.epc_no === epcNo : true));

        let statusHtml = '';
        let trClass = '';
        let displayPartName = '';
        let poBadge = '';

        if (masterMatch) {
            statusHtml = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black text-[11px]"><i class="fa-solid fa-check"></i> ผ่าน</span>`;
            trClass = "bg-emerald-50/20";
            displayPartName = masterMatch.part_name;
            readyCount++;

            if (poMatch) {
                poBadge = `<span class="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-link"></i> เชื่อม PO (${poMatch.car_plate || 'พบรายการ'})</span>`;
            } else if (epcNo) {
                poBadge = `<span class="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold"><i class="fa-solid fa-circle-info"></i> รับเข้าคลัง (ไม่มี PO)</span>`;
            } else {
                poBadge = `<span class="text-slate-400 text-[10px]">-</span>`;
            }

            smartExcelValidPayload.push({
                received_date: rcvDate,
                epc_no: epcNo || null,
                part_no: masterMatch.part_no,
                part_main_no: masterMatch.part_main_no || null,
                part_name: masterMatch.part_name,
                qty: qty,
                unit_price: price,
                branch_name: typeof userBranch !== 'undefined' ? userBranch : 'สำนักงานใหญ่'
            });
        } else {
            statusHtml = `<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black text-[11px]"><i class="fa-solid fa-xmark"></i> ไม่มี Master</span>`;
            trClass = "bg-rose-50";
            displayPartName = `<span class="text-rose-500 italic text-[10px]">ไม่พบ Part No นี้ใน Master</span>`;
            poBadge = `<span class="text-slate-300 text-[10px]">-</span>`;
            errorCount++;
        }

        tbody.innerHTML += `
            <tr class="${trClass} border-b border-slate-200">
                <td class="p-2 border border-slate-200 text-center">${statusHtml}</td>
                <td class="p-2 border border-slate-200 font-mono font-bold text-amber-700 text-center">${epcNo || '-'}</td>
                <td class="p-2 border border-slate-200 font-mono font-bold text-blue-700">${partNo}</td>
                <td class="p-2 border border-slate-200 text-center font-black">${qty}</td>
                <td class="p-2 border border-slate-200 text-right font-mono text-slate-600">${price.toFixed(2)}</td>
                <td class="p-2 border border-slate-200 font-mono text-center text-xs text-emerald-700 font-bold">${rcvDate}</td>
                <td class="p-2 border border-slate-200 font-bold">${displayPartName}</td>
                <td class="p-2 border border-slate-200 text-center">${poBadge}</td>
            </tr>
        `;
    }

    const readyEl = document.getElementById('excel_ready_count');
    const errorEl = document.getElementById('excel_error_count');
    if(readyEl) readyEl.innerText = readyCount;
    if(errorEl) errorEl.innerText = errorCount;

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

// 5. ส่งข้อมูลขึ้นระบบ
async function submitSmartExcel() {
    if (smartExcelValidPayload.length === 0) return;

    if (!confirm(`ยืนยันการรับเข้าคลัง และอัปเดตตารางสั่งอะไหล่ จำนวน ${smartExcelValidPayload.length} รายการ?`)) return;

    const btn = document.getElementById('btn_submit_smart_excel');
    if(btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกและอัปเดตสเตตัส...';
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

        if(typeof showToast === 'function') showToast(`บันทึกรับเข้าคลังและอัปเดต PO สำเร็จ ${smartExcelValidPayload.length} รายการ!`);
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

// 6. ตั้งค่าการลากวางไฟล์ (Drag & Drop)
function initUploadZone() {
    const uploadZone = document.getElementById('excel_upload_zone');
    const fileInput = document.getElementById('excel_file_input');
    if (!uploadZone || !fileInput) return;

    uploadZone.onclick = function(e) {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    };

    uploadZone.ondragover = function(e) {
        e.preventDefault();
        uploadZone.classList.add('bg-indigo-50');
    };

    uploadZone.ondragleave = function(e) {
        e.preventDefault();
        uploadZone.classList.remove('bg-indigo-50');
    };

    uploadZone.ondrop = function(e) {
        e.preventDefault();
        uploadZone.classList.remove('bg-indigo-50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            processSmartExcel({ target: { files: e.dataTransfer.files } });
        }
    };
}

// 7. ฟังก์ชันสร้างและดาวน์โหลดแบบฟอร์ม Excel ตัวอย่าง (Template)
function downloadExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('❌ ไม่พบไลบรารี XLSX กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง');
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const templateData = [
        ["EPC No", "หมายเลขอะไหล่ (Part No)", "จำนวน (Qty)", "ราคาต่อหน่วย (Unit Price)", "วันที่ของเข้า (YYYY-MM-DD)"],
        ["EPC-2026-001", "PART-TEST-001", 1, 1500.00, todayStr],
        ["EPC-2026-002", "PART-TEST-002", 5, 850.50, todayStr]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    ws['!cols'] = [
        { wpx: 130 }, // EPC No
        { wpx: 180 }, // Part No
        { wpx: 90 },  // Qty
        { wpx: 130 }, // Unit Price
        { wpx: 150 }  // Received Date
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Inbound_Template");
    XLSX.writeFile(wb, "Rizenic_Parts_Inbound_Template.xlsx");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUploadZone);
} else {
    initUploadZone();
}