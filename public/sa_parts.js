// ==========================================
// 📦 SA Parts Operations & Keying Table (sa_parts.js)
// ==========================================

// 🌟 1. ฟังก์ชันสร้าง Datalist อะไหล่สำหรับ Auto-complete 🌟
async function buildPartDatalist() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts`);
        if (!res.ok) return;
        const parts = await res.json();
        
        let datalist = document.getElementById('master_part_list');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'master_part_list';
            document.body.appendChild(datalist);
        }
        
        datalist.innerHTML = parts.map(p => 
            `<option value="${p.part_no}">${p.part_name} (MAIN: ${p.part_main_no || '-'})</option>`
        ).join('');
    } catch (e) {
        console.error('Load Datalist Error:', e);
    }
}

// 🌟 2. เพิ่มแถวบนโต๊ะคีย์อะไหล่ SA (อัปเกรดรองรับการ Paste จาก Excel) 🌟
window.addPartRow = function(partNo = '', partMain = '', partName = '', model = '', type = 'หลัก', price = '0', loc = '', safe = '0') {
    const tbody = document.getElementById('order_parts_body'); if(!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="px-2 py-2 border-b border-slate-100">
            <input type="text" list="master_part_list" class="minimal-input px-2 py-1.5 part-no-input font-mono uppercase text-xs font-bold text-blue-700 bg-blue-50/50 focus:ring-amber-500/30 text-center" placeholder="บาร์โค้ด" value="${partNo}" onchange="checkMasterPart(this)" onpaste="handleModalGridPaste(event, this)" onkeypress="if(event.key === 'Enter') { event.preventDefault(); checkMasterPart(this); }">
        </td>
        <td class="px-2 py-2 border-b border-slate-100"><input type="text" class="minimal-input px-2 py-1.5 part-main-input font-mono text-center text-xs text-slate-500" placeholder="MAIN No" value="${partMain}" readonly></td>
        <td class="px-2 py-2 border-b border-slate-100"><input type="text" class="minimal-input px-2 py-1.5 part-name-input text-xs font-bold" placeholder="ชื่อชิ้นส่วน" value="${partName}" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="px-2 py-2 border-b border-slate-100"><input type="text" class="minimal-input px-2 py-1.5 part-model-input text-center text-xs" placeholder="รุ่นรถ" value="${model}" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="px-2 py-2 border-b border-slate-100 min-w-[100px]">
            <input type="text" class="minimal-input px-2 py-1.5 part-type-input text-center text-xs font-bold text-blue-700 bg-blue-50/50" placeholder="ประเภท" value="${type}" onpaste="handleModalGridPaste(event, this)">
        </td>
        <td class="px-2 py-2 border-b border-slate-100"><input type="number" class="minimal-input px-2 py-1.5 part-price-input text-xs text-right" placeholder="ราคา" value="${price}" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="px-2 py-2 border-b border-slate-100"><input type="text" class="minimal-input px-2 py-1.5 part-loc-input text-center text-xs" placeholder="Location" value="${loc}" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="px-2 py-2 border-b border-slate-100 text-center"><input type="number" class="minimal-input px-2 py-1.5 part-safe-input text-xs text-center font-bold" value="${safe}" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="px-2 py-2 border-b border-slate-100"><input type="number" class="minimal-input px-2 py-1.5 part-qty-input text-center font-black text-xs text-amber-600 bg-amber-50 border-amber-300 focus:border-amber-500" value="1" min="1" onpaste="handleModalGridPaste(event, this)"></td>
        <td class="px-2 py-2 border-b border-slate-100 text-center flex flex-col gap-1.5 items-center justify-center">
            <button type="button" onclick="sendSinglePO(this)" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap w-full"><i class="fa-solid fa-paper-plane mr-1"></i> แอด</button>
            <button type="button" onclick="this.closest('tr').remove()" class="text-slate-400 hover:text-red-500 transition text-[10px] font-bold"><i class="fa-solid fa-trash"></i> ลบ</button>
        </td>
    `;
    tbody.appendChild(tr);
};

// 🌟 3. ระบบ Copy & Paste จาก Excel (SA Keying Table) 🌟
window.handleModalGridPaste = function(e, cellInput) {
    e.preventDefault(); 
    const clipboardData = e.clipboardData || window.clipboardData; 
    const pastedText = clipboardData.getData('Text'); 
    if (!pastedText) return;
    
    const rows = pastedText.split(/\r\n|\n|\r/).filter(row => row.trim() !== ''); 
    const tbody = cellInput.closest('tbody'); 
    let currentRow = cellInput.closest('tr');
    
    const allTds = Array.from(currentRow.children);
    const startColIndex = allTds.indexOf(cellInput.closest('td'));

    rows.forEach((rowStr) => {
        const cols = rowStr.split('\t'); 
        if (!currentRow) { 
            addPartRow(); 
            currentRow = tbody.lastElementChild; 
        }
        
        const inputs = Array.from(currentRow.querySelectorAll('td')).map(td => td.querySelector('input, select'));
        
        cols.forEach((colVal, j) => { 
            const targetInput = inputs[startColIndex + j];
            if (targetInput && !targetInput.readOnly) { 
                targetInput.value = colVal.trim(); 
                targetInput.classList.add('bg-emerald-100', 'transition-colors'); 
                setTimeout(() => targetInput.classList.remove('bg-emerald-100'), 800); 
                
                if (targetInput.classList.contains('part-no-input')) {
                    checkMasterPart(targetInput);
                }
            } 
        });
        currentRow = currentRow.nextElementSibling;
    });
};

// 🌟 4. ฟังก์ชันดึงข้อมูล Master Part พร้อมระบบกระพริบ 🌟
async function checkMasterPart(inputElem) {
    const partNo = inputElem.value.trim(); if(!partNo) return;
    const tr = inputElem.closest('tr'); 
    const n = tr.querySelector('.part-name-input'); const m = tr.querySelector('.part-main-input');
    const mo = tr.querySelector('.part-model-input'); const p = tr.querySelector('.part-price-input');
    const l = tr.querySelector('.part-loc-input'); const s = tr.querySelector('.part-safe-input');
    const t = tr.querySelector('.part-type-input');

    inputElem.classList.add('animate-pulse', 'text-amber-500', 'bg-amber-50');

    try {
        const branch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(partNo)}?branch=${encodeURIComponent(branch)}`);
        
        if(res.ok) {
            const resData = await res.json();
            const data = Array.isArray(resData) ? resData[0] : (resData.data ? (Array.isArray(resData.data) ? resData.data[0] : resData.data) : resData);
            if (data && (data.part_name || data.part_no)) {
                if(n) n.value = data.part_name || ''; 
                if(m) m.value = data.part_main_no || '-'; 
                if(mo) mo.value = data.car_model || '-';
                if(t) t.value = data.part_category || data.part_type || 'หลัก';
                if(p) p.value = data.unit_price || 0; 
                if(l) l.value = data.location || '-'; 
                if(s) s.value = data.safety_stock || 0;
            }
        }
    } catch(e) {
        console.error("Fetch Master Part Error:", e);
    } finally {
        inputElem.classList.remove('animate-pulse', 'text-amber-500', 'bg-amber-50');
    }
}

// 🌟 5. ส่งคำสั่งซื้อแยกรายชิ้น (PO) 🌟
async function sendSinglePO(btnElem) {
    const carPlateEl = document.getElementById('car_plate');
    const carPlate = carPlateEl ? carPlateEl.value.trim() : '';
    if(!carPlate) { alert('⚠️ กรุณากรอก "ทะเบียนรถ" ด้านบนก่อนยิงออเดอร์ครับ!'); return; }

    const tr = btnElem.closest('tr');
    const pNo = tr.querySelector('.part-no-input')?.value?.trim() || ''; 
    const pMain = tr.querySelector('.part-main-input')?.value?.trim() || '';
    let pName = tr.querySelector('.part-name-input')?.value?.trim() || ''; 
    const pType = tr.querySelector('.part-type-input')?.value?.trim() || 'หลัก';
    const pQty = parseInt(tr.querySelector('.part-qty-input')?.value) || 1;
    
    if(!pNo) { alert('⚠️ กรุณาระบุบาร์โค้ดอะไหล่ก่อนสั่งซื้อ'); return; }

    if (!pName) {
        try {
            const resPart = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(pNo)}`);
            if (resPart.ok) {
                const resData = await resPart.json();
                const partData = Array.isArray(resData) ? resData[0] : (resData.data ? (Array.isArray(resData.data) ? resData.data[0] : resData.data) : resData);
                if (partData && partData.part_name) {
                    pName = partData.part_name;
                    if(tr.querySelector('.part-name-input')) tr.querySelector('.part-name-input').value = pName;
                }
            }
        } catch(e) {}
    }

    if(!pName) { 
        pName = prompt('ไม่พบชื่อชิ้นส่วนอะไหล่ในคลัง กรุณากรอกชื่ออะไหล่:');
        if(!pName) return;
        if(tr.querySelector('.part-name-input')) tr.querySelector('.part-name-input').value = pName;
    }

    let qtArr = [], soArr = [];
    document.querySelectorAll('#docs_body tr').forEach(row => {
        const type = row.querySelector('.doc-type')?.value; const val = row.querySelector('.doc-no')?.value?.trim();
        if(val) { if(type === 'QT') qtArr.push(val); if(type === 'SO') soArr.push(val); }
    });

    const currentJobId = document.getElementById('sa_report_id')?.value || null;

    try {
        btnElem.disabled = true;
        btnElem.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        const resPO = await fetch(`${API_BASE_URL}/api/part-orders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                job_id: currentJobId,
                car_plate: carPlate, 
                vin_no: document.getElementById('vin_no')?.value || null, 
                car_model: document.getElementById('car_model')?.value || null, 
                qt_no: qtArr.join(',') || null, so_no: soArr.join(',') || null, epc_no: null,
                part_no: pNo, part_main_no: pMain || null, part_name: pName, qty_ordered: pQty, part_type: pType, 
                branch_name: sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่', order_status: 'รอสั่งซื้อ', order_date: new Date().toISOString().split('T')[0]
            })
        });

        if (!resPO.ok) throw new Error('บันทึกคำสั่งซื้ออะไหล่ไม่สำเร็จ');

        await fetch(`${API_BASE_URL}/api/part-outbound`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: currentJobId,
                issue_date: new Date().toISOString().split('T')[0],
                part_no: pNo, part_main_no: pMain || null, part_name: pName, qty: pQty,
                car_plate: carPlate, qt_no: qtArr.join(',') || null, so_no: soArr.join(',') || null,
                unit_price: 0, car_model: document.getElementById('car_model')?.value || null,
                job_status: 'รอเข้าซ่อม', part_type: pType,
                branch_name: sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่'
            })
        }).catch(e => console.warn(e));

        tr.remove(); 
        const orderPartsBody = document.getElementById('order_parts_body');
        if (orderPartsBody && orderPartsBody.children.length === 0) {
            addPartRow();
        }

        const toast = document.createElement('div');
        toast.className = 'fixed bottom-5 right-5 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-2xl z-[200] flex items-center gap-2 border border-white/20 text-xs';
        toast.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> แอดสั่งซื้อและจองอะไหล่เรียบร้อย!`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);

        loadPartsTrackingTable(carPlate); 
        
    } catch(e) { 
        alert('❌ เกิดข้อผิดพลาดในการยิงออเดอร์: ' + e.message); 
    } finally {
        if (btnElem && btnElem.isConnected) {
            btnElem.disabled = false;
            btnElem.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> แอด'; 
        }
    }
}

// 🌟 6. ฟังก์ชันโหลดตารางติดตามสถานะอะไหล่ 🌟
async function loadPartsTrackingTable(carPlate, paramJobId = null) {
    const tbody = document.getElementById('track_parts_body');
    if (!tbody) return;
    if (!carPlate || !carPlate.trim()) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">กรุณาระบุทะเบียนรถเพื่อติดตามสถานะอะไหล่</td></tr>`;
        return;
    }

    // 💡 ระบบตรวจจับ ID ใบงานอัตโนมัติ (ดึงจากหน้าฟอร์มที่ SA กำลังเปิดอยู่)
    let activeJobId = paramJobId;
    if (!activeJobId) {
        const hiddenIdInput = document.getElementById('sa_report_id');
        if (hiddenIdInput && hiddenIdInput.value) {
            activeJobId = hiddenIdInput.value;
        }
    }

    try {
        const clean = str => String(str || '').replace(/\s+/g, '').toUpperCase();
        const searchPlate = clean(carPlate);

        const res = await fetch(`${API_BASE_URL}/api/part-orders?_t=` + new Date().getTime(), { cache: 'no-store' });
        if (!res.ok) return;
        const resData = await res.json();
        const data = Array.isArray(resData) ? resData : (resData.data || []);
        
        const filtered = data.filter(p => {
            // ✅ ถ้ากำลังเปิดบิลเก่าอยู่ (มี ID) ให้กรองข้อมูลด้วย ID ใบงานแบบเป๊ะๆ 100%
            if (activeJobId) {
                return String(p.report_id) === String(activeJobId);
            }
            // ❌ ถ้ากำลังเปิดบิลใหม่ (ยังไม่มี ID) ค่อยค้นประวัติเก่าๆ ด้วยทะเบียนรถ
            if(!p || !p.car_plate) return false;
            const pPlate = clean(p.car_plate);
            return pPlate === searchPlate || pPlate.includes(searchPlate) || searchPlate.includes(pPlate);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">ไม่พบรายการสั่งซื้ออะไหล่สำหรับทะเบียน "${carPlate}" (ในใบงานนี้)</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const orderId = item.id || item.order_id;
            const hasETA = item.est_arrival_date && String(item.est_arrival_date).trim() !== '';
            const encodedNotes = encodeURIComponent(item.notes || '');

            const actionButtons = hasETA 
                ? `<span class="text-slate-400 text-[11px] font-bold flex items-center justify-center gap-1" title="สั่งของแล้ว ไม่สามารถแก้ไขได้"><i class="fa-solid fa-lock"></i> ล็อก</span>`
                : `<div class="flex items-center justify-center gap-1">
                       <button type="button" onclick="openEditPOModal('${orderId}', '${item.qty_ordered || 1}', '${encodedNotes}', '${carPlate}')" class="text-blue-600 hover:text-blue-800 bg-white border border-slate-300 p-1 rounded shadow-2xs transition" title="แก้ไขรายการนี้"><i class="fa-solid fa-pen text-[11px]"></i></button>
                       <button type="button" onclick="deletePO('${orderId}', '${carPlate}')" class="text-red-500 hover:text-red-700 bg-white border border-slate-300 p-1 rounded shadow-2xs transition" title="ลบรายการนี้"><i class="fa-solid fa-trash text-[11px]"></i></button>
                   </div>`;

            const receivedDateVal = item.received_date || item.part_received_all_date;

            return `
            <tr class="hover:bg-amber-50/50 transition-colors border-b border-slate-100">
                <td class="font-mono text-xs font-bold text-slate-600 text-center">${item.epc_no || '-'}</td>
                <td class="font-mono text-xs font-bold text-blue-700 text-center">${item.part_no || '-'}</td>
                <td class="font-mono text-xs font-bold text-slate-600 text-center">${item.part_main_no || '-'}</td>
                <td class="font-bold text-slate-800 whitespace-normal break-words">${item.part_name || '-'}</td>
                <td class="text-center font-bold text-blue-700 bg-blue-50/50">${item.part_type || '-'}</td>
                <td class="text-center font-bold"><span class="text-amber-600">${item.qty_ordered || 0}</span> / <span class="text-emerald-600">${item.qty_received || 0}</span></td>
                <td class="text-center"><span class="px-2 py-0.5 rounded border text-[10px] font-bold shadow-2xs bg-slate-100 text-slate-700">${item.order_status || 'รอสั่งซื้อ'}</span></td>
                <td class="font-mono text-xs text-slate-500 text-center">${item.order_date ? String(item.order_date).split('T')[0] : '-'}</td>
                <td class="font-mono text-xs font-bold text-center ${hasETA ? 'text-amber-600' : 'text-slate-400'}">${hasETA ? String(item.est_arrival_date).split('T')[0] : '-'}</td>
                <td class="font-mono text-xs text-emerald-600 font-bold text-center">${receivedDateVal ? String(receivedDateVal).split('T')[0] : '-'}</td>
                <td class="whitespace-normal break-words text-slate-600">${item.notes || '-'}</td>
                <td class="text-center py-1.5">${actionButtons}</td>
            </tr>
        `}).join('');

        setTimeout(initResizablePOColumns, 300);
    } catch (e) {
        console.error("Error loading tracking table:", e);
    }
}

function initResizablePOColumns() {
    const cols = document.querySelectorAll('#poTrackingTable th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer-po'); if(!resizer) return;
        let startX = 0; let startWidth = 0;
        
        const onMouseDown = (e) => { 
            e.stopPropagation(); e.preventDefault(); 
            startX = e.clientX; startWidth = col.offsetWidth; 
            resizer.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove); 
            document.addEventListener('mouseup', onMouseUp); 
        };
        const onMouseMove = (e) => { 
            const newWidth = Math.max(40, startWidth + (e.clientX - startX));
            col.style.width = `${newWidth}px`; 
            col.style.minWidth = `${newWidth}px`; 
        };
        const onMouseUp = () => { 
            resizer.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove); 
            document.removeEventListener('mouseup', onMouseUp); 
        };
        resizer.removeEventListener('mousedown', onMouseDown);
        resizer.addEventListener('mousedown', onMouseDown);
    });
}

function openEditPOModal(id, qty, encodedNotes, carPlate) {
    const decodedNotes = decodeURIComponent(encodedNotes);
    const poIdInp = document.getElementById('edit_po_modal_id');
    const poPlateInp = document.getElementById('edit_po_modal_car_plate');
    const poQtyInp = document.getElementById('edit_po_modal_qty');
    const poNotesInp = document.getElementById('edit_po_modal_notes');
    const poModal = document.getElementById('editPOModal');

    if (poIdInp) poIdInp.value = id;
    if (poPlateInp) poPlateInp.value = carPlate;
    if (poQtyInp) poQtyInp.value = qty;
    if (poNotesInp) poNotesInp.value = decodedNotes;
    
    if (poModal) poModal.classList.remove('hidden');
}

function closeEditPOModal() {
    const poModal = document.getElementById('editPOModal');
    if (poModal) poModal.classList.add('hidden');
}

async function submitEditPOModal(e) {
    e.preventDefault();
    const id = document.getElementById('edit_po_modal_id').value;
    const carPlate = document.getElementById('edit_po_modal_car_plate').value;
    const qty = parseInt(document.getElementById('edit_po_modal_qty').value) || 1;
    const notes = document.getElementById('edit_po_modal_notes').value;

    const btn = document.getElementById('btn_submit_edit_po');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
    }

    try {
        const resMain = await fetch(`${API_BASE_URL}/api/part-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty_ordered: qty, notes: notes })
        });

        if (!resMain.ok) {
            await fetch(`${API_BASE_URL}/api/part-orders/${id}/fast`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field: 'qty_ordered', value: qty })
            });
            
            await new Promise(resolve => setTimeout(resolve, 200));

            await fetch(`${API_BASE_URL}/api/part-orders/${id}/fast`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field: 'notes', value: notes })
            });
        }

        closeEditPOModal();
        loadPartsTrackingTable(carPlate);
    } catch(err) {
        alert('❌ แก้ไขข้อมูลไม่สำเร็จ'); 
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }
}

async function deletePO(id, carPlate) {
    if(confirm('🚨 ยืนยันการลบรายการสั่งซื้อนี้ออกจากระบบ?')) {
        try { 
            const res = await fetch(`${API_BASE_URL}/api/part-orders/${id}`, { method: 'DELETE' }); 
            if(!res.ok) throw new Error();
            alert('✅ ลบข้อมูลเรียบร้อย'); 
            loadPartsTrackingTable(carPlate); 
        } catch(e) { 
            alert('❌ ลบข้อมูลไม่สำเร็จ'); 
        }
    }
}

