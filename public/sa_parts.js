// ==========================================
// 📦 RIZENIC - SA Parts Management (sa_parts.js)
// ==========================================

let allMasterPartsCache = [];

// 1. โหลดข้อมูลมาสเตอร์อะไหล่และสร้าง Datalist ตัวช่วยค้นหา
async function buildPartDatalist() {
    try {
        const branch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
        const res = await fetch(`${API_BASE_URL}/api/parts?branch=${encodeURIComponent(branch)}`);
        if (res.ok) {
            allMasterPartsCache = await res.json();
            window.allMasterPartsCache = allMasterPartsCache;

            let datalist = document.getElementById('master_parts_datalist');
            if (!datalist) {
                datalist = document.createElement('datalist');
                datalist.id = 'master_parts_datalist';
                document.body.appendChild(datalist);
            }

            datalist.innerHTML = allMasterPartsCache.map(p =>
                `<option value="${p.part_no}">${p.part_name} (MAIN: ${p.part_main_no || '-'})</option>`
            ).join('');
        }
    } catch (e) {
        console.error("Error building part datalist:", e);
    }
}

// 2. เพิ่มแถวสั่งซื้ออะไหล่ใหม่ในฟอร์ม SA (บล็อก 4)
function addPartRow(partNo = '', partMainNo = '', partName = '', partType = 'อะไหล่หลัก', qty = 1, orderId = '') {
    const tbody = document.getElementById('order_parts_body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition-colors";
    if (orderId) tr.setAttribute('data-order-id', orderId);

    tr.innerHTML = `
        <td>
            <input type="text" list="master_parts_datalist" class="minimal-input part-no-input font-mono uppercase text-xs" 
                   placeholder="บาร์โค้ด" value="${partNo}" onchange="autoFillPartRow(this)">
        </td>
        <td>
            <input type="text" class="minimal-input part-main-input font-mono text-xs text-slate-500" 
                   placeholder="MAIN No." value="${partMainNo}">
        </td>
        <td>
            <input type="text" class="minimal-input part-name-input font-bold text-xs" 
                   placeholder="ชื่อชิ้นส่วน" value="${partName}">
        </td>
        <td>
            <input type="text" class="minimal-input car-model-input text-xs text-slate-600" 
                   placeholder="รุ่นรถ" readonly>
        </td>
        <td>
            <select class="minimal-input part-type-input text-xs font-bold text-blue-700 bg-blue-50">
                <option value="อะไหล่หลัก" ${partType === 'อะไหล่หลัก' ? 'selected' : ''}>อะไหล่หลัก</option>
                <option value="อะไหล่รอง" ${partType === 'อะไหล่รอง' ? 'selected' : ''}>อะไหล่รอง</option>
                <option value="อะไหล่ทั่วไป" ${partType === 'อะไหล่ทั่วไป' ? 'selected' : ''}>อะไหล่ทั่วไป</option>
            </select>
        </td>
        <td>
            <input type="text" class="minimal-input unit-price-input text-right font-mono text-xs" 
                   placeholder="0.00" readonly>
        </td>
        <td>
            <input type="text" class="minimal-input location-input text-center text-xs" 
                   placeholder="-" readonly>
        </td>
        <td>
            <input type="text" class="minimal-input safety-stock-input text-center font-mono text-xs" 
                   placeholder="0" readonly>
        </td>
        <td>
            <input type="number" class="minimal-input part-qty-input text-center font-black text-amber-600 bg-amber-50" 
                   value="${qty}" min="1">
        </td>
        <td class="text-center">
            <button type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 p-2 transition">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    if (partNo) {
        const noInput = tr.querySelector('.part-no-input');
        if (noInput) autoFillPartRow(noInput);
    }
}

// 3. ดึงข้อมูลจาก Master มาเติมลงในช่องอัตโนมัติเมื่อเลือกรหัสบาร์โค้ด
function autoFillPartRow(inputEl) {
    const pNo = inputEl.value.trim().toUpperCase();
    if (!pNo) return;

    const tr = inputEl.closest('tr');
    const matched = allMasterPartsCache.find(x => x.part_no && x.part_no.toUpperCase() === pNo);

    if (matched) {
        const mainInp = tr.querySelector('.part-main-input');
        const nameInp = tr.querySelector('.part-name-input');
        const carModelInp = tr.querySelector('.car-model-input');
        const typeInp = tr.querySelector('.part-type-input');
        const priceInp = tr.querySelector('.unit-price-input');
        const locInp = tr.querySelector('.location-input');
        const safetyInp = tr.querySelector('.safety-stock-input');

        if (mainInp && !mainInp.value) mainInp.value = matched.part_main_no || '';
        if (nameInp && !nameInp.value) nameInp.value = matched.part_name || '';
        if (carModelInp) carModelInp.value = matched.car_model || '';
        if (typeInp) typeInp.value = matched.part_category || matched.part_type || 'อะไหล่หลัก';
        if (priceInp) priceInp.value = parseFloat(matched.unit_price || 0).toLocaleString('th-TH', {minimumFractionDigits: 2});
        if (locInp) locInp.value = matched.location || '-';
        if (safetyInp) safetyInp.value = matched.safety_stock || '0';
    }
}

// 4. โหลดตารางติดตามสถานะอะไหล่ PO Tracking (บล็อก 5)
async function loadPartsTrackingTable(carPlate = '', jobId = '') {
    const tbody = document.getElementById('track_parts_body');
    if (!tbody) return;

    const cleanPlate = carPlate ? carPlate.trim().toUpperCase() : '';
    const cleanJobId = jobId ? String(jobId) : '';

    if (!cleanPlate && !cleanJobId) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">กรุณาระบุทะเบียนรถเพื่อติดตามสถานะอะไหล่</td></tr>`;
        return;
    }

    try {
        if (!window.allPartOrders || window.allPartOrders.length === 0) {
            const res = await fetch(`${API_BASE_URL}/api/part-orders`);
            if (res.ok) window.allPartOrders = await res.json();
        }

        const orders = (window.allPartOrders || []).filter(p => {
            const pPlate = p.car_plate ? p.car_plate.trim().toUpperCase() : '';
            const pJobId = p.job_id ? String(p.job_id) : '';
            const pReportId = p.report_id ? String(p.report_id) : '';

            const plateMatch = cleanPlate && pPlate === cleanPlate;
            const idMatch = cleanJobId && (pJobId === cleanJobId || pReportId === cleanJobId);

            return plateMatch || idMatch;
        });

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">ไม่พบรายการสั่งซื้ออะไหล่สำหรับรถคันนี้</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => {
            const isComplete = o.order_status && (o.order_status.includes('ครบ') || o.order_status === 'มีสต๊อก');
            const statusColor = isComplete ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300';

            const orderDateStr = o.order_date ? String(o.order_date).split('T')[0] : '-';
            const estDateStr = o.est_arrival_date ? String(o.est_arrival_date).split('T')[0] : '-';
            const rcvDateStr = o.received_date ? String(o.received_date).split('T')[0] : '-';

            return `
                <tr class="hover:bg-amber-50/50 transition-colors">
                    <td class="font-mono font-bold text-purple-700 text-center">${o.epc_no || '-'}</td>
                    <td class="font-mono font-bold text-blue-700 text-center">${o.part_no || '-'}</td>
                    <td class="font-mono text-slate-500 text-center">${o.part_main_no || '-'}</td>
                    <td class="font-bold text-slate-800 truncate max-w-[200px]" title="${o.part_name || '-'}">${o.part_name || '-'}</td>
                    <td class="text-center"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">${o.part_type || 'หลัก'}</span></td>
                    <td class="text-center font-bold"><span class="text-amber-600">${o.qty_ordered || 1}</span> / <span class="text-emerald-600">${o.qty_received || 0}</span></td>
                    <td class="text-center"><span class="px-2 py-0.5 rounded border text-[10px] font-bold ${statusColor}">${o.order_status || 'รอสั่งซื้อ'}</span></td>
                    <td class="font-mono text-slate-500 text-center">${orderDateStr}</td>
                    <td class="font-mono font-bold text-amber-600 text-center">${estDateStr}</td>
                    <td class="font-mono font-bold text-emerald-600 text-center">${rcvDateStr}</td>
                    <td class="text-slate-600 truncate max-w-[150px]" title="${o.notes || ''}">${o.notes || '-'}</td>
                    <td class="text-center">
                        <button type="button" onclick="openEditPOModal('${o.order_id || o.id}', '${o.qty_ordered || 1}', '${o.notes || ''}', '${o.car_plate || ''}')" 
                                class="text-blue-600 hover:text-blue-800 p-1 font-bold text-xs">
                            <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Error loading PO tracking table:", e);
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-red-500 text-xs font-bold bg-white">เกิดข้อผิดพลาดในการดึงข้อมูลอะไหล่</td></tr>`;
    }
}

// 5. จัดการ Modal แก้ไขรายการ PO
function openEditPOModal(orderId, qty, notes, carPlate) {
    document.getElementById('edit_po_modal_id').value = orderId;
    document.getElementById('edit_po_modal_car_plate').value = carPlate;
    document.getElementById('edit_po_modal_qty').value = qty;
    document.getElementById('edit_po_modal_notes').value = notes === 'null' ? '' : notes;

    const modal = document.getElementById('editPOModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeEditPOModal() {
    const modal = document.getElementById('editPOModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function submitEditPOModal(e) {
    e.preventDefault();
    const orderId = document.getElementById('edit_po_modal_id').value;
    const carPlate = document.getElementById('edit_po_modal_car_plate').value;
    const qty = parseInt(document.getElementById('edit_po_modal_qty').value) || 1;
    const notes = document.getElementById('edit_po_modal_notes').value.trim();

    const btn = document.getElementById('btn_submit_edit_po');
    const oldHtml = btn ? btn.innerHTML : '';

    try {
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> บันทึก...'; btn.disabled = true; }

        const res = await fetch(`${API_BASE_URL}/api/part-orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty_ordered: qty, notes: notes })
        });

        if (res.ok) {
            closeEditPOModal();
            window.allPartOrders = []; // เคลียร์แคชเพื่อโหลดใหม่
            await loadPartsTrackingTable(carPlate);
            if (typeof showToast === 'function') showToast('อัปเดตรายการอะไหล่สำเร็จ!', 'success');
        } else {
            throw new Error('Update PO failed');
        }
    } catch (err) {
        alert('❌ ไม่สามารถอัปเดตข้อมูลอะไหล่ได้');
    } finally {
        if (btn) { btn.innerHTML = oldHtml; btn.disabled = false; }
    }
}