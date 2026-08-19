// ==========================================
// 📊 RIZENIC - Smart Excel Import System (รองรับ Inbound, PO, Outbound)
// ==========================================

let smartExcelType = 'inbound';
let smartExcelValidPayload = []; 

// 1. ฟังก์ชันเปิด Modal
function openSmartExcelUpload(type = 'inbound') {
    smartExcelType = type;
    const previewZone = document.getElementById('excel_preview_zone');
    const btnSubmit = document.getElementById('btn_submit_smart_excel');
    const uploadZone = document.getElementById('excel_upload_zone');
    
    const titleEl = document.getElementById('smart_excel_title');
    const formatEl = document.getElementById('smart_excel_format');

    // 🌟 สลับข้อความ/สี ตามประเภทที่กด 🌟
    if (type === 'po') {
        if(titleEl) titleEl.innerHTML = '<i class="fa-solid fa-file-excel mr-2 text-blue-600"></i> อัปโหลด Excel - สร้างใบสั่งซื้อ (PO)';
        if(formatEl) formatEl.innerHTML = '<b>A(EPC) | B(ทะเบียน) | C(บาร์โค้ดอะไหล่) | D(สถานะ) | E(จำนวน) | F(วันที่สั่ง) | G(คาดการณ์เข้า) | H(วันที่เข้าครบ)</b>';
    } else if (type === 'outbound') {
        if(titleEl) titleEl.innerHTML = '<i class="fa-solid fa-file-excel mr-2 text-purple-600"></i> อัปโหลด Excel - เบิก/จองอะไหล่ (Outbound)';
        if(formatEl) formatEl.innerHTML = '<b>A(วันที่) | B(สถานะเบิก) | C(บาร์โค้ดอะไหล่) | D(จำนวน) | E(ทะเบียน) | F(QT No) | G(SO No)</b>';
    } else {
        if(titleEl) titleEl.innerHTML = '<i class="fa-solid fa-file-excel mr-2 text-emerald-600"></i> อัปโหลด Excel - รับเข้าคลัง (Inbound)';
        if(formatEl) formatEl.innerHTML = '<b>A(EPC) | B(บาร์โค้ดอะไหล่) | C(จำนวน) | D(ราคา) | E(วันที่ของเข้า)</b>';
    }
    
    if(previewZone) { previewZone.classList.add('hidden'); previewZone.classList.remove('flex'); }
    if(btnSubmit) { btnSubmit.classList.add('hidden'); btnSubmit.classList.remove('flex'); }
    if(uploadZone) { uploadZone.classList.remove('hidden'); uploadZone.classList.add('flex'); }
    
    const fileInput = document.getElementById('excel_file_input');
    if(fileInput) fileInput.value = ""; 
    
    const tbody = document.getElementById('excel_preview_tbody');
    if(tbody) tbody.innerHTML = "";
    smartExcelValidPayload = [];

    const modal = document.getElementById('smartExcelModal');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeSmartExcelUpload() {
    const modal = document.getElementById('smartExcelModal');
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    smartExcelValidPayload = [];
}

// 2. ฟังก์ชันอ่านไฟล์ Excel
function processSmartExcel(e) {
    const file = e.target.files ? e.target.files[0] : (e.dataTransfer ? e.target.files[0] : null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            if (typeof XLSX === 'undefined') return alert('❌ ไม่พบไลบรารี XLSX กรุณารีเฟรชหน้าเว็บ');
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            validateExcelData(rawData);
        } catch(err) {
            console.error("Excel Read Error:", err);
            alert('❌ อ่านไฟล์ Excel ล้มเหลว');
        }
    };
    reader.readAsArrayBuffer(file);
}

// 3. ตรวจสอบข้อมูลเทียบกับ Master 🌟
function validateExcelData(dataRows) {
    const tbody = document.getElementById('excel_preview_tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    smartExcelValidPayload = [];
    let readyCount = 0; let errorCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    if (!dataRows || dataRows.length === 0) return alert("⚠️ ไม่พบข้อมูลในไฟล์ Excel");

    const masterCache = (typeof allMasterPartsCache !== 'undefined' && Array.isArray(allMasterPartsCache)) ? allMasterPartsCache : [];

    // เปลี่ยนหัวตารางพรีวิวตาม Type
    const thead = tbody.closest('table').querySelector('thead tr');
    if(smartExcelType === 'po') {
        thead.innerHTML = `<th class="p-2 border">สถานะ</th><th class="p-2 border">ทะเบียน</th><th class="p-2 border">Part No</th><th class="p-2 border text-center">ยอดสั่ง</th><th class="p-2 border text-blue-300">ชื่ออะไหล่ (ดึงจาก Master)</th>`;
    } else if (smartExcelType === 'outbound') {
        thead.innerHTML = `<th class="p-2 border">สถานะ</th><th class="p-2 border">สถานะเบิก</th><th class="p-2 border">Part No</th><th class="p-2 border text-center">จำนวน</th><th class="p-2 border text-purple-300">ชื่ออะไหล่ (ดึงจาก Master)</th>`;
    } else {
        thead.innerHTML = `<th class="p-2 border">สถานะ</th><th class="p-2 border">EPC No</th><th class="p-2 border">Part No</th><th class="p-2 border text-center">จำนวน</th><th class="p-2 border text-emerald-300">ชื่ออะไหล่ (ดึงจาก Master)</th>`;
    }

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if(!row || row.length === 0) continue;
        
        let epc='', plate='', partNo='', status='', qty=1, price=0, date1='', date2='', date3='', qt='', so='';

        // แมปปิ้งตัวแปรตามประเภทตาราง (ข้ามแถวแรกถ้าเป็นหัวตาราง)
        if(smartExcelType === 'po') {
            epc = String(row[0]||'').trim().toUpperCase();
            plate = String(row[1]||'').trim().toUpperCase();
            partNo = String(row[2]||'').trim().toUpperCase();
            status = String(row[3]||'').trim() || 'รอสั่งซื้อ';
            qty = parseInt(row[4]) || 1;
            date1 = row[5] || todayStr; // วันที่สั่ง
            date2 = row[6] || null;     // คาดการณ์
            date3 = row[7] || null;     // เข้าครบ
            if(i===0 && (epc.includes('EPC') || partNo.includes('PART'))) continue;
            if(!plate && !partNo) continue;
        } else if (smartExcelType === 'outbound') {
            date1 = row[0] || todayStr; // วันที่เบิก
            status = String(row[1]||'').trim() || 'เบิกอะไหล่';
            partNo = String(row[2]||'').trim().toUpperCase();
            qty = parseInt(row[3]) || 1;
            plate = String(row[4]||'').trim().toUpperCase();
            qt = String(row[5]||'').trim().toUpperCase();
            so = String(row[6]||'').trim().toUpperCase();
            if(i===0 && (date1.includes('วัน') || partNo.includes('PART'))) continue;
            if(!partNo) continue;
        } else {
            // inbound
            epc = String(row[0]||'').trim().toUpperCase();
            partNo = String(row[1]||'').trim().toUpperCase();
            qty = parseInt(row[2]) || 1;
            price = parseFloat(row[3]) || 0;
            date1 = row[4] || todayStr; // วันที่รับเข้า
            if(i===0 && (epc.includes('EPC') || partNo.includes('PART'))) continue;
            if(!partNo) continue;
        }

        const masterMatch = masterCache.find(m => m.part_no && m.part_no.toUpperCase() === partNo);
        let statusHtml = ''; let trClass = ''; let displayPartName = '';

        if (masterMatch) {
            statusHtml = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black text-[11px]"><i class="fa-solid fa-check"></i> พบอะไหล่</span>`;
            trClass = "bg-emerald-50/20";
            displayPartName = masterMatch.part_name;
            readyCount++;

            if(smartExcelType === 'po') {
                smartExcelValidPayload.push({ car_plate: plate, part_no: masterMatch.part_no, part_main_no: masterMatch.part_main_no, part_name: masterMatch.part_name, qty_ordered: qty, order_status: status, order_date: date1, est_arrival_date: date2, part_received_all_date: date3, epc_no: epc, branch_name: userBranch });
                tbody.innerHTML += `<tr class="${trClass} border-b border-slate-200"><td class="p-2 border">${statusHtml}</td><td class="p-2 border font-bold text-amber-700">${plate}</td><td class="p-2 border font-mono font-bold text-blue-700">${partNo}</td><td class="p-2 border text-center font-black">${qty}</td><td class="p-2 border font-bold">${displayPartName}</td></tr>`;
            } else if (smartExcelType === 'outbound') {
                smartExcelValidPayload.push({ issue_date: date1, job_status: status, part_no: masterMatch.part_no, part_main_no: masterMatch.part_main_no, part_name: masterMatch.part_name, qty: qty, car_plate: plate, qt_no: qt, so_no: so, branch_name: userBranch });
                tbody.innerHTML += `<tr class="${trClass} border-b border-slate-200"><td class="p-2 border">${statusHtml}</td><td class="p-2 border font-bold text-amber-700">${status}</td><td class="p-2 border font-mono font-bold text-blue-700">${partNo}</td><td class="p-2 border text-center font-black">${qty}</td><td class="p-2 border font-bold">${displayPartName}</td></tr>`;
            } else {
                smartExcelValidPayload.push({ received_date: date1, epc_no: epc, part_no: masterMatch.part_no, part_main_no: masterMatch.part_main_no, part_name: masterMatch.part_name, qty: qty, unit_price: price, branch_name: userBranch });
                tbody.innerHTML += `<tr class="${trClass} border-b border-slate-200"><td class="p-2 border">${statusHtml}</td><td class="p-2 border font-bold text-amber-700">${epc||'-'}</td><td class="p-2 border font-mono font-bold text-blue-700">${partNo}</td><td class="p-2 border text-center font-black">${qty}</td><td class="p-2 border font-bold">${displayPartName}</td></tr>`;
            }
        } else {
            statusHtml = `<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black text-[11px]"><i class="fa-solid fa-xmark"></i> ไม่มี Master</span>`;
            trClass = "bg-rose-50";
            displayPartName = `<span class="text-rose-500 italic text-[10px]">ไม่พบข้อมูลในตารางมาสเตอร์ดาต้า</span>`;
            errorCount++;
            
            if(smartExcelType === 'po') tbody.innerHTML += `<tr class="${trClass} border-b border-slate-200"><td class="p-2 border">${statusHtml}</td><td class="p-2 border font-bold text-amber-700">${plate}</td><td class="p-2 border font-mono font-bold text-blue-700">${partNo}</td><td class="p-2 border text-center font-black">${qty}</td><td class="p-2 border font-bold">${displayPartName}</td></tr>`;
            else if(smartExcelType === 'outbound') tbody.innerHTML += `<tr class="${trClass} border-b border-slate-200"><td class="p-2 border">${statusHtml}</td><td class="p-2 border font-bold text-amber-700">${status}</td><td class="p-2 border font-mono font-bold text-blue-700">${partNo}</td><td class="p-2 border text-center font-black">${qty}</td><td class="p-2 border font-bold">${displayPartName}</td></tr>`;
            else tbody.innerHTML += `<tr class="${trClass} border-b border-slate-200"><td class="p-2 border">${statusHtml}</td><td class="p-2 border font-bold text-amber-700">${epc||'-'}</td><td class="p-2 border font-mono font-bold text-blue-700">${partNo}</td><td class="p-2 border text-center font-black">${qty}</td><td class="p-2 border font-bold">${displayPartName}</td></tr>`;
        }
    }

    if(document.getElementById('excel_ready_count')) document.getElementById('excel_ready_count').innerText = readyCount;
    if(document.getElementById('excel_error_count')) document.getElementById('excel_error_count').innerText = errorCount;

    document.getElementById('excel_upload_zone').classList.add('hidden');
    document.getElementById('excel_preview_zone').classList.remove('hidden');
    document.getElementById('excel_preview_zone').classList.add('flex');

    if(readyCount > 0) {
        document.getElementById('btn_submit_smart_excel').classList.remove('hidden');
        document.getElementById('btn_submit_smart_excel').classList.add('flex');
    }
}

// 4. ส่งข้อมูลขึ้นระบบ
async function submitSmartExcel() {
    if (smartExcelValidPayload.length === 0) return;
    if (!confirm(`ยืนยันการบันทึกข้อมูล จำนวน ${smartExcelValidPayload.length} รายการ? (ระบบจะข้ามรายการสีแดงอัตโนมัติ)`)) return;

    const btn = document.getElementById('btn_submit_smart_excel');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกเข้าเซิร์ฟเวอร์...';
    btn.disabled = true;

    try {
        let endpoint = '/api/part-inbound';
        if (smartExcelType === 'po') endpoint = '/api/part-orders';
        if (smartExcelType === 'outbound') endpoint = '/api/part-outbound';

        await Promise.all(smartExcelValidPayload.map(item => 
            fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item) })
        ));

        if(typeof showToast === 'function') showToast(`อัปโหลดสำเร็จ ${smartExcelValidPayload.length} รายการ!`);
        closeSmartExcelUpload();
        if(typeof loadAllData === 'function') loadAllData(); 
    } catch(err) { 
        if(typeof showToast === 'function') showToast('บันทึกล้มเหลว', 'error'); 
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> บันทึกรายการ'; btn.disabled = false;
    }
}

// 5. ดาวน์โหลด Template แจกตาม Type 🌟
function downloadExcelTemplate() {
    if (typeof XLSX === 'undefined') return alert('❌ ไม่พบไลบรารี XLSX');
    const todayStr = new Date().toISOString().split('T')[0];

    let templateData = []; let cols = []; let fileName = "";

    if (smartExcelType === 'po') {
        templateData = [
            ["EPC No", "ทะเบียนรถ (Plate)", "หมายเลขอะไหล่ (Part No) *ต้องตรงกับ Master", "สถานะการสั่ง", "ยอดสั่ง (Qty)", "วันที่สั่ง", "คาดการณ์เข้า", "วันที่เข้าครบ"],
            ["EPC-001", "กข 1234", "PART-TEST-001", "รอสั่งซื้อ", 1, todayStr, "", ""]
        ];
        cols = [{wpx: 100}, {wpx: 120}, {wpx: 200}, {wpx: 100}, {wpx: 80}, {wpx: 100}, {wpx: 100}, {wpx: 100}];
        fileName = "Template_PO.xlsx";
    } else if (smartExcelType === 'outbound') {
        templateData = [
            ["วันที่ (Date)", "สถานะเบิก", "หมายเลขอะไหล่ (Part No) *ต้องตรงกับ Master", "จำนวน (Qty)", "ทะเบียนรถ (Plate)", "QT No", "SO No"],
            [todayStr, "เบิกอะไหล่", "PART-TEST-001", 1, "กข 1234", "QT-001", "SO-001"]
        ];
        cols = [{wpx: 100}, {wpx: 120}, {wpx: 200}, {wpx: 80}, {wpx: 120}, {wpx: 100}, {wpx: 100}];
        fileName = "Template_Outbound.xlsx";
    } else {
        templateData = [
            ["EPC No", "หมายเลขอะไหล่ (Part No) *ต้องตรงกับ Master", "จำนวน (Qty)", "ราคา (Price)", "วันที่รับเข้า"],
            ["EPC-001", "PART-TEST-001", 1, 1500.00, todayStr]
        ];
        cols = [{wpx: 120}, {wpx: 200}, {wpx: 80}, {wpx: 100}, {wpx: 120}];
        fileName = "Template_Inbound.xlsx";
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, fileName);
}

// 6. ตั้งค่าการลากวางไฟล์
function initUploadZone() {
    const uploadZone = document.getElementById('excel_upload_zone');
    const fileInput = document.getElementById('excel_file_input');
    if (!uploadZone || !fileInput) return;
    uploadZone.onclick = function(e) { if (e.target !== fileInput) fileInput.click(); };
    uploadZone.ondragover = function(e) { e.preventDefault(); uploadZone.classList.add('bg-indigo-50'); };
    uploadZone.ondragleave = function(e) { e.preventDefault(); uploadZone.classList.remove('bg-indigo-50'); };
    uploadZone.ondrop = function(e) { e.preventDefault(); uploadZone.classList.remove('bg-indigo-50'); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { fileInput.files = e.dataTransfer.files; processSmartExcel({ target: { files: e.dataTransfer.files } }); } };
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initUploadZone); } else { initUploadZone(); }