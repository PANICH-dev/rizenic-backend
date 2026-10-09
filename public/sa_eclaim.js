// =========================================================
// 📑 ระบบการจัดการ E-Claim (บล็อก 9, Line Items & Export XML)
// =========================================================

// 🌟 1. ฟังก์ชันแปลงชื่อจังหวัดเป็นตัวย่อมาตรฐาน EMCS (2 หลัก)
function getProvinceCode(provinceInput) {
    if (!provinceInput) return '';
    const val = provinceInput.trim();
    
    const provinceMap = {
        "กระบี่": "กบ", "กรุงเทพมหานคร": "กท", "กาญจนบุรี": "กจ", "กาฬสินธุ์": "กส", "กำแพงเพชร": "กพ",
        "ขอนแก่น": "ขก", "จันทบุรี": "จบ", "ฉะเชิงเทรา": "ฉช", "ชลบุรี": "ชบ", "ชัยนาท": "ชน",
        "ชัยภูมิ": "ชย", "ชุมพร": "ชพ", "เชียงราย": "ชร", "เชียงใหม่": "ชม", "ตรัง": "ตง",
        "ตราด": "ตร", "ตาก": "ตก", "นครนายก": "นย", "นครปฐม": "นฐ", "นครพนม": "นพ",
        "นครราชสีมา": "นม", "นครศรีธรรมราช": "นศ", "นครสวรรค์": "นว", "นนทบุรี": "นบ", "นราธิวาส": "นธ",
        "น่าน": "นน", "บุรีรัมย์": "บร", "ปทุมธานี": "ปท", "ประจวบคีรีขันธ์": "ปข", "ปราจีนบุรี": "ปจ",
        "ปัตตานี": "ปน", "พะเยา": "พย", "พังงา": "พง", "พัทลุง": "พท", "พิจิตร": "พจ",
        "พิษณุโลก": "พล", "เพชรบุรี": "พบ", "เพชรบูรณ์": "พช", "แพร่": "พร", "ภูเก็ต": "ภก",
        "มหาสารคาม": "มค", "มุกดาหาร": "มห", "แม่ฮ่องสอน": "มส", "ยโสธร": "ยส", "ยะลา": "ยล",
        "ร้อยเอ็ด": "รอ", "ระนอง": "รน", "ระยอง": "รย", "ราชบุรี": "รบ", "ลพบุรี": "ลบ",
        "ลำปาง": "ลป", "ลำพูน": "ลพ", "เลย": "ลย", "ศรีสะเกษ": "ศก", "สกลนคร": "สน",
        "สงขลา": "สข", "สตูล": "สต", "สมุทรปราการ": "สป", "สมุทรสงคราม": "สส", "สมุทรสาคร": "สค",
        "สระแก้ว": "สก", "สระบุรี": "สบ", "สิงห์บุรี": "สห", "สุโขทัย": "สท", "สุพรรณบุรี": "สพ",
        "สุราษฎร์ธานี": "สฎ", "สุรินทร์": "สร", "หนองคาย": "นค", "หนองบัวลำภู": "นภ", "พระนครศรีอยุธยา": "อย",
        "อ่างทอง": "อท", "อำนาจเจริญ": "อจ", "อุดรธานี": "อด", "อุตรดิตถ์": "อต", "อุทัยธานี": "อน",
        "อุบลราชธานี": "อบ", "เบตง": "บต", "บึงกาฬ": "บก"
    };

    return provinceMap[val] || val;
}

// 🌟 2. ดึงข้อมูลรายละเอียดรถ ประกันภัย และผู้ติดต่อ E-Claim มาหยอดใส่ช่องหน้าจอ
async function loadEclaimDetails(reportId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${reportId}/eclaim-details`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.success && data.data) {
            const d = data.data;
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = (val !== null && val !== undefined) ? val : '';
            };

            const setDate = (id, isoStr) => {
                const el = document.getElementById(id);
                if (el) el.value = isoStr ? String(isoStr).split('T')[0] : '';
            };

            // 9.1 ข้อมูลรถ
            setVal('eclaim_province', d.car_province);
            setVal('eclaim_car_type', d.car_type);
            setVal('eclaim_year', d.model_year);
            setVal('eclaim_trim', d.trim_level);
            setVal('eclaim_engine_no', d.engine_no);
            setVal('eclaim_car_color', d.car_color);
            setVal('eclaim_paint_type', d.paint_type_id);
            setVal('eclaim_mileage', d.car_km);
            setVal('eclaim_cc', d.engine_cc);
            setVal('eclaim_condition', d.car_condition_id);
            setVal('eclaim_party', d.car_iden || 'own');
            setVal('eclaim_accident_no', d.car_iden_no || '1');

            // 9.2 กรมธรรม์ เคลม
            setVal('eclaim_policy_no', d.policy_no);
            setVal('eclaim_policy_type', d.policy_type_id);
            setVal('eclaim_insuree_name', d.insuree_name);
            setVal('eclaim_claim_no', d.claim_no);
            // 👈 เพิ่มบรรทัดนี้: ถ้าในฐานข้อมูลยังไม่มี claim_no ให้ดึงจากส่วนที่ 2 ทันที
if (!d.claim_no) {
    syncClaimNoToBlock9();
}
            
            setVal('eclaim_claim_ref_no', d.claim_ref_no);
            setVal('eclaim_insured_value', d.insured_value || 0);
            setVal('eclaim_deductible', d.deductible || 0);
            setVal('eclaim_deduction_src', d.deduction_src);
            setVal('eclaim_deduction_amount', d.deduction_amount || 0);
            setDate('eclaim_notify_date', d.claim_notify_date);
            setDate('eclaim_accident_date', d.accident_occ_date);

            // 9.3 ผู้ขับขี่ และผู้นำรถเข้า/รับกลับ
            setVal('eclaim_driver_name', d.driver_name);
            setVal('eclaim_driver_idcard', d.driver_idcard);
            setVal('eclaim_driver_license', d.driver_license_no);
            setVal('eclaim_driver_phone', d.driver_phone);
            setDate('eclaim_bring_date', d.bring_date);
            setVal('eclaim_bring_name', d.bring_name);
            setVal('eclaim_bring_phone', d.bring_phone);
            setVal('eclaim_get_car_name', d.get_car_name);
            setVal('eclaim_get_car_phone', d.get_car_phone);
        }
    } catch (err) {
        console.error('Load Eclaim Details Error:', err);
    }
}

// 🛒 3. ระบบจัดการตารางรายการย่อย E-Claim (Line Items)
function addEclaimItemRow(item = null) {
    const tbody = document.getElementById('eclaim_items_body');
    const emptyRow = document.getElementById('eclaim_empty_row');
    if (emptyRow) emptyRow.style.display = 'none';

    const tr = document.createElement('tr');
    tr.className = 'eclaim-item-row hover:bg-purple-50/50 transition border-b border-purple-100';
    
    const iType = item ? item.item_type : 'P';
    const iPartNo = item ? (item.part_no || '') : '';
    const iName = item ? (item.item_name_th || '') : '';
    const iQty = item ? (item.qty || 1) : 1;
    const iPrice = item ? (item.unit_price || 0) : 0;
    const iDiscount = item ? (item.discount_amount || 0) : 0;
    const iTotal = item ? (item.total_after_discount || 0) : 0;
    const iDamage = item ? (item.damage_level || 'เบา') : 'เบา';
    const iShip = item ? (item.part_ship || 'garage') : 'garage';
    const iScrap = item ? (item.scrap_return || '0') : '0';

    tr.innerHTML = `
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-2 !py-1 text-xs item-type border-purple-200 font-bold min-w-[110px]" onchange="toggleEclaimRowType(this)">
                <option value="P" ${iType === 'P' ? 'selected' : ''}>อะไหล่ (P)</option>
                <option value="L" ${iType === 'L' ? 'selected' : ''}>ค่าแรง (L)</option>
            </select>
        </td>
        <td class="px-2 py-2">
            <input type="text" list="master_parts_datalist" class="minimal-input !px-2 !py-1 text-xs item-partno border-purple-200 font-mono uppercase min-w-[155px]" 
                   value="${iPartNo}" placeholder="รหัสอ้างอิง..." onchange="autoFillEclaimPart(this)">
        </td>
        <td class="px-2 py-2">
            <input type="text" class="minimal-input !px-2 !py-1 text-xs item-name border-purple-200 font-bold min-w-[220px]" value="${iName}" placeholder="ชื่อรายการ..." required>
        </td>
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-1.5 !py-1 text-xs item-damage border-purple-200 text-center min-w-[110px]">
                <option value="เบา" ${iDamage === 'เบา' ? 'selected' : ''}>ซ่อมเบา</option>
                <option value="กลาง" ${iDamage === 'กลาง' ? 'selected' : ''}>ซ่อมกลาง</option>
                <option value="หนัก" ${iDamage === 'หนัก' ? 'selected' : ''}>ซ่อมหนัก</option>
                <option value="เปลี่ยน" ${iDamage === 'เปลี่ยน' ? 'selected' : ''}>เปลี่ยน</option>
            </select>
        </td>
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-1.5 !py-1 text-xs item-ship border-purple-200 text-center min-w-[110px]">
                <option value="garage" ${iShip === 'garage' ? 'selected' : ''}>ศูนย์จัด</option>
                <option value="ins" ${iShip === 'ins' ? 'selected' : ''}>ประกันจัด</option>
            </select>
        </td>
        <td class="px-2 py-2 text-center">
            <input type="number" class="minimal-input !px-1 !py-1 text-center text-xs item-qty border-purple-200 font-mono min-w-[65px]" value="${iQty}" min="1" onkeyup="calcEclaimRow(this)" onchange="calcEclaimRow(this)">
        </td>
        <td class="px-2 py-2">
            <input type="number" step="0.01" class="minimal-input !px-2 !py-1 text-right text-xs item-price border-purple-200 font-mono min-w-[115px]" value="${iPrice}" min="0" placeholder="0.00" onkeyup="calcEclaimRow(this)" onchange="calcEclaimRow(this)">
        </td>
        <td class="px-2 py-2">
            <input type="number" step="0.01" class="minimal-input !px-1.5 !py-1 text-right text-xs item-discount border-purple-200 font-mono min-w-[80px]" value="${iDiscount}" min="0" placeholder="0%" onkeyup="calcEclaimRow(this)" onchange="calcEclaimRow(this)">
        </td>
        <td class="px-2 py-2">
            <input type="number" step="0.01" class="minimal-input !px-2 !py-1 text-right text-xs item-total bg-purple-50 font-bold text-purple-900 border-purple-300 font-mono min-w-[125px]" value="${iTotal}" readonly placeholder="0.00">
        </td>
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-1 !py-1 text-xs item-scrap border-purple-200 text-center min-w-[95px]">
                <option value="0" ${iScrap === '0' || iScrap === 0 ? 'selected' : ''}>ไม่คืน</option>
                <option value="1" ${iScrap === '1' || iScrap === 1 ? 'selected' : ''}>คืนซาก</option>
            </select>
        </td>
        <td class="px-2 py-2 text-center">
            <button type="button" onclick="this.closest('tr').remove(); checkEmptyEclaimTable();" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition shadow-sm" title="ลบรายการ"><i class="fa-solid fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
    toggleEclaimRowType(tr.querySelector('.item-type'));
    if (iPrice > 0 || iDiscount > 0) calcEclaimRow(tr.querySelector('.item-price'));
}

function toggleEclaimRowType(selectEl) {
    const tr = selectEl.closest('tr');
    const type = selectEl.value;
    const damageSelect = tr.querySelector('.item-damage');
    const shipSelect = tr.querySelector('.item-ship');
    const scrapSelect = tr.querySelector('.item-scrap');

    if (type === 'L') {
        if (damageSelect) {
            damageSelect.disabled = false;
            damageSelect.classList.remove('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
        }
        if (shipSelect) {
            shipSelect.disabled = true;
            shipSelect.classList.add('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
        }
        if (scrapSelect) {
            scrapSelect.disabled = true;
            scrapSelect.value = '0';
        }
    } else {
        if (damageSelect) {
            damageSelect.disabled = true;
            damageSelect.classList.add('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
        }
        if (shipSelect) {
            shipSelect.disabled = false;
            shipSelect.classList.remove('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
        }
        if (scrapSelect) {
            scrapSelect.disabled = false;
        }
    }
}

function calcEclaimRow(input) {
    const tr = input.closest('tr');
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    const discount = parseFloat(tr.querySelector('.item-discount').value) || 0;
    
    let subtotal = qty * price;
    let finalTotal = subtotal;

    if (discount > 0) {
        if (discount <= 100) {
            finalTotal = subtotal * (1 - (discount / 100));
        } else {
            finalTotal = Math.max(0, subtotal - discount);
        }
    }
    
    tr.querySelector('.item-total').value = finalTotal.toFixed(2);
}

function checkEmptyEclaimTable() {
    const tbody = document.getElementById('eclaim_items_body');
    const rows = tbody.querySelectorAll('.eclaim-item-row');
    const emptyRow = document.getElementById('eclaim_empty_row');
    if (rows.length === 0 && emptyRow) {
        emptyRow.style.display = '';
    }
}

async function saveEclaimItems(reportId) {
    const rows = document.querySelectorAll('.eclaim-item-row');
    const globalComment = document.getElementById('eclaim_center_comment')?.value?.trim() || '';
    const items = [];

    rows.forEach(tr => {
        const name = tr.querySelector('.item-name')?.value?.trim();
        if (name) {
            const type = tr.querySelector('.item-type')?.value || 'P';
            const damage = tr.querySelector('.item-damage')?.value || 'เบา';
            const ship = tr.querySelector('.item-ship')?.value || 'garage';
            const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 1;
            const unitPrice = parseFloat(tr.querySelector('.item-price')?.value) || 0;
            const discount = parseFloat(tr.querySelector('.item-discount')?.value) || 0;
            const total = parseFloat(tr.querySelector('.item-total')?.value) || 0;

            items.push({
                item_type: type,
                part_no: tr.querySelector('.item-partno')?.value?.trim() || '',
                item_name_th: name,
                qty: qty,
                unit_price: unitPrice,
                discount_amount: discount,
                total_before_discount: qty * unitPrice,
                total_after_discount: total,
                damage_level: type === 'L' ? damage : 'เบา',
                part_ship: type === 'P' ? ship : 'garage',
                scrap_return: tr.querySelector('.item-scrap')?.value || '0',
                comment: globalComment
            });
        }
    });

    try {
        await fetch(`${API_BASE_URL}/api/report/${reportId}/eclaim-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
    } catch (err) {
        console.error('Save Eclaim Items Error:', err);
    }
}

async function loadEclaimItems(reportId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${reportId}/eclaim-items`);
        const data = await res.json();
        
        document.querySelectorAll('.eclaim-item-row').forEach(row => row.remove());
        
        if (data.success && data.data && data.data.length > 0) {
            data.data.forEach(item => addEclaimItemRow(item));
            
            const firstComment = data.data.find(x => x.comment && x.comment.trim() !== '');
            const commentInput = document.getElementById('eclaim_center_comment');
            if (commentInput) {
                commentInput.value = firstComment ? firstComment.comment : '';
            }
        } else {
            checkEmptyEclaimTable();
            const commentInput = document.getElementById('eclaim_center_comment');
            if (commentInput) commentInput.value = '';
        }
    } catch (err) {
        console.error('Load Eclaim Items Error:', err);
    }
}

// 🚀 4. ดึงรายการอะไหล่จาก PO เข้าตาราง E-Claim
function pullPartsToEclaim() {
    const editId = document.getElementById('sa_report_id')?.value;
    if (!editId) {
        alert('กรุณาบันทึกข้อมูลเปิดบิลก่อนดึงรายการอะไหล่ครับ!');
        return;
    }

    if (!window.allPartOrders || window.allPartOrders.length === 0) {
        alert('ไม่พบรายการอะไหล่ในระบบ หรือกำลังโหลดข้อมูล...');
        return;
    }

    const currentJobParts = window.allPartOrders.filter(po => 
        (String(po.job_id) === String(editId) || String(po.report_id) === String(editId)) && 
        po.order_status !== 'ยกเลิก'
    );

    if (currentJobParts.length === 0) {
        alert('ไม่พบรายการอะไหล่ในบิลซ่อมนี้ (คุณได้เพิ่มรายการในบล็อก 4 หรือยัง?)');
        return;
    }

    const emptyRow = document.getElementById('eclaim_empty_row');
    if (emptyRow) emptyRow.style.display = 'none';

    const existingPartNos = Array.from(document.querySelectorAll('.eclaim-item-row .item-partno')).map(inp => inp.value.trim().toUpperCase());
    let addedCount = 0;

    currentJobParts.forEach(po => {
        const pNo = (po.part_no || '').trim().toUpperCase();
        if (pNo && !existingPartNos.includes(pNo)) {
            const partItem = {
                item_type: 'P',
                part_no: po.part_no,
                item_name_th: po.part_name || '',
                qty: parseInt(po.qty_ordered) || 1,
                unit_price: 0,
                total_after_discount: 0
            };
            
            addEclaimItemRow(partItem);
            
            const newRows = document.querySelectorAll('.eclaim-item-row');
            const lastRow = newRows[newRows.length - 1];
            const noInput = lastRow.querySelector('.item-partno');
            if(noInput) autoFillEclaimPart(noInput);
            
            addedCount++;
        }
    });

    if (addedCount > 0) {
        alert(`ดึงรายการอะไหล่ใหม่สำเร็จ ${addedCount} รายการ!`);
    } else {
        alert('อะไหล่ทั้งหมดมีอยู่ในตารางประเมินราคาเรียบร้อยแล้วครับ');
    }
}

// 📥 5. ส่งออกและดาวน์โหลดไฟล์ XML สำหรับ EMCS
async function exportEMCSXml() {
  const reportId = document.getElementById('sa_report_id')?.value;
  
  if (!reportId) {
    alert('⚠️ กรุณาบันทึกข้อมูลเปิดบิลใบงานเข้าสู่ระบบก่อนทำการ Export ไฟล์ XML ครับ!');
    return;
  }

  const btn = document.querySelector("button[onclick='exportEMCSXml()']");
  const oldText = btn ? btn.innerHTML : '';

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังเซฟข้อมูล...';
    }

    const eclaimDetails = {
        eclaim_province: getProvinceCode(document.getElementById('eclaim_province')?.value),
        eclaim_car_type: document.getElementById('eclaim_car_type')?.value || '',
        eclaim_year: document.getElementById('eclaim_year')?.value || '',
        eclaim_trim: document.getElementById('eclaim_trim')?.value || '',
        eclaim_engine_no: document.getElementById('eclaim_engine_no')?.value || '',
        eclaim_car_color: document.getElementById('eclaim_car_color')?.value || '',
        eclaim_paint_type: document.getElementById('eclaim_paint_type')?.value || '',
        eclaim_mileage: document.getElementById('eclaim_mileage')?.value || '',
        eclaim_cc: document.getElementById('eclaim_cc')?.value || '',
        eclaim_condition: document.getElementById('eclaim_condition')?.value || '',
        eclaim_party: document.getElementById('eclaim_party')?.value || '',
        eclaim_accident_no: document.getElementById('eclaim_accident_no')?.value || '1',
        
        eclaim_policy_no: document.getElementById('eclaim_policy_no')?.value || '',
        eclaim_policy_type: document.getElementById('eclaim_policy_type')?.value || '',
        eclaim_insuree_name: document.getElementById('eclaim_insuree_name')?.value || '',
        eclaim_claim_no: document.getElementById('eclaim_claim_no')?.value || '',
        eclaim_claim_ref_no: document.getElementById('eclaim_claim_ref_no')?.value || '',
        eclaim_insured_value: document.getElementById('eclaim_insured_value')?.value || 0,
        eclaim_deductible: document.getElementById('eclaim_deductible')?.value || 0,
        eclaim_deduction_src: document.getElementById('eclaim_deduction_src')?.value || '',
        eclaim_deduction_amount: document.getElementById('eclaim_deduction_amount')?.value || 0,
        eclaim_notify_date: document.getElementById('eclaim_notify_date')?.value || '',
        eclaim_accident_date: document.getElementById('eclaim_accident_date')?.value || '',

        eclaim_driver_name: document.getElementById('eclaim_driver_name')?.value || '',
        eclaim_driver_idcard: document.getElementById('eclaim_driver_idcard')?.value || '',
        eclaim_driver_license: document.getElementById('eclaim_driver_license')?.value || '',
        eclaim_driver_phone: document.getElementById('eclaim_driver_phone')?.value || '',
        eclaim_bring_date: document.getElementById('eclaim_bring_date')?.value || '',
        eclaim_bring_name: document.getElementById('eclaim_bring_name')?.value || '',
        eclaim_bring_phone: document.getElementById('eclaim_bring_phone')?.value || '',
        eclaim_get_car_name: document.getElementById('eclaim_get_car_name')?.value || '',
        eclaim_get_car_phone: document.getElementById('eclaim_get_car_phone')?.value || ''
    };

    await fetch(`${API_BASE_URL}/api/report/${reportId}/eclaim-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eclaimDetails)
    });

    await saveEclaimItems(reportId);

    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> กำลังสร้าง XML...';
    }

    const xmlUrl = `${API_BASE_URL}/api/report/${reportId}/export-xml`;
    let downloadIframe = document.getElementById('xml_download_iframe');
    if (!downloadIframe) {
        downloadIframe = document.createElement('iframe');
        downloadIframe.id = 'xml_download_iframe';
        downloadIframe.style.display = 'none';
        document.body.appendChild(downloadIframe);
    }
    downloadIframe.src = xmlUrl;

  } catch (err) {
    console.error('Export XML Error:', err);
    alert('❌ เกิดข้อผิดพลาดในการสร้างไฟล์ XML: ' + (err.message || 'เน็ตเวิร์กขัดข้อง'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldText || '<i class="fa-solid fa-file-export mr-1"></i> ดาวน์โหลด XML';
    }
  }
}

// 🌟 1. ฟังก์ชันพับ/คลี่ บล็อก 9 (Collapsible Block 9)
function toggleBlock9() {
    const body = document.getElementById('block9_body_container');
    const icon = document.getElementById('block9_toggle_icon');
    const text = document.getElementById('block9_toggle_text');
    if (!body) return;

    const isHidden = body.classList.toggle('hidden');
    if (icon && text) {
        if (isHidden) {
            icon.className = 'fa-solid fa-chevron-down transition-transform duration-300';
            text.innerText = 'คลี่แสดง';
        } else {
            icon.className = 'fa-solid fa-chevron-up transition-transform duration-300';
            text.innerText = 'พับเก็บ';
        }
    }
}

// 🌟 2. ฟังก์ชันดึง "เลขที่ เคลม/รับแจ้ง" จากส่วนที่ 2 มาลงช่อง "เลขที่เคลม (Ref Claim No)" ในส่วนที่ 9 อัตโนมัติ
function syncClaimNoToBlock9() {
    const firstClaimInput = document.querySelector('.pipe-claim'); // ช่องในส่วนที่ 2
    const eclaimClaimNoInput = document.getElementById('eclaim_claim_no'); // ช่องในส่วนที่ 9
    
    if (firstClaimInput && eclaimClaimNoInput) {
        // ซิงค์ถ้าช่องส่วนที่ 9 ยังว่างอยู่ หรือเคยถูกซิงค์อัตโนมัติมา
        if (!eclaimClaimNoInput.value.trim() || eclaimClaimNoInput.dataset.autoSynced === 'true') {
            const val = firstClaimInput.value.trim();
            if (val) {
                eclaimClaimNoInput.value = val;
                eclaimClaimNoInput.dataset.autoSynced = 'true';
            }
        }
    }
}

// 🎯 ดักจับ Event พิมพ์ในส่วนที่ 2 เพื่อซิงค์ไปส่วนที่ 9 เรียลไทม์
document.addEventListener('DOMContentLoaded', () => {
    const pipelineContainer = document.getElementById('doc_pipeline_container');
    if (pipelineContainer) {
        pipelineContainer.addEventListener('input', (e) => {
            if (e.target && e.target.classList.contains('pipe-claim')) {
                syncClaimNoToBlock9();
            }
        });
    }

    // หาก SA พิมพ์แก้ไขในช่องส่วนที่ 9 เอง ให้ปิดการทับอัตโนมัติ
    const eclaimClaimNoInput = document.getElementById('eclaim_claim_no');
    if (eclaimClaimNoInput) {
        eclaimClaimNoInput.addEventListener('input', () => {
            eclaimClaimNoInput.dataset.autoSynced = 'false';
        });
    }
});