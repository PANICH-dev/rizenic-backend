// 🎯 ขยายฟิลด์ที่แก้อัตโนมัติได้
app.put('/api/part-orders/:id/fast', async (req, res) => {
  try {
    const { field, value } = req.body;
    // 🌟 แก้ตรงนี้: เพิ่ม qt_no, so_no และเปลี่ยนเป็น received_date 🌟
    const validFields = ['epc_no', 'part_no', 'part_main_no', 'part_name', 'qty_ordered', 'order_status', 'est_arrival_date', 'received_date', 'notes', 'car_plate', 'qt_no', 'so_no'];
    
    if (!validFields.includes(field)) return res.status(400).json({ error: 'ไม่อนุญาตให้แก้ฟิลด์นี้' });
    
    // ดักจับกรณีเป็นค่าว่างให้เป็น null เพื่อป้องกัน Error วันที่
    const finalValue = (value === '') ? null : value;
    
    await pool.query(`UPDATE rizenic_part_orders SET ${field} = $1 WHERE order_id = $2`, [finalValue, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------
// 2. ข้อมูลมาสเตอร์ (Master Data)
// ------------------------------------------
function renderMasterTable() {
    const tbody = document.getElementById('master_table_body'); if(!tbody) return;
    if (allMasterPartsCache.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 font-bold bg-white">ไม่มีข้อมูลมาสเตอร์อะไหล่</td></tr>`; return; }
    
    tbody.innerHTML = allMasterPartsCache.map(m => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="font-mono text-blue-700 font-bold px-4 py-2.5">${m.part_no}</td>
            <td class="font-bold text-slate-800 px-4 py-2.5">${m.part_name}</td>
            <td class="font-mono text-slate-500 px-4 py-2.5">${m.part_main_no || '-'}</td>
            <td class="text-slate-600 text-xs font-bold px-4 py-2.5">${m.car_model || '-'}</td>
            <td class="px-4 py-2.5"><span class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm">${m.part_category || 'อะไหล่ทั่วไป'}</span></td>
            <td class="text-right font-mono font-bold text-slate-700 px-4 py-2.5">${parseFloat(m.unit_price || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}</td>
            <td class="text-center font-bold text-slate-600 px-4 py-2.5">${m.location || '-'}</td>
            <td class="text-center px-4 py-2.5"><button onclick="editMaster('${m.part_no}')" class="text-blue-500 hover:text-blue-700 px-2 transition"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteMaster('${m.part_id}')" class="text-slate-300 hover:text-red-500 px-2 transition"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function searchMasterTable() { filterTableByText('master_table_body', event.target.value); }

function openMasterModal() {
    document.getElementById('edit_master_id').value = ''; document.getElementById('master_part_no').value = '';
    document.getElementById('master_part_name').value = ''; document.getElementById('master_part_main').value = '';
    document.getElementById('master_category').value = 'อะไหล่หลัก'; document.getElementById('master_price').value = '0.00';
    document.getElementById('master_location').value = ''; document.getElementById('master_safety').value = '0';
    renderCarModelsCheckbox(''); document.getElementById('masterModal').classList.remove('hidden'); document.getElementById('masterModal').classList.add('flex');
}

function closeMasterModal() { document.getElementById('masterModal').classList.add('hidden'); document.getElementById('masterModal').classList.remove('flex'); }

async function editMaster(partNo) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(partNo)}?branch=${encodeURIComponent(userBranch)}`);
        if(res.ok) {
            const data = await res.json(); const m = Array.isArray(data) ? data[0] : (data.data ? (Array.isArray(data.data) ? data.data[0] : data.data) : data);
            if(m) {
                document.getElementById('edit_master_id').value = m.part_id; document.getElementById('master_part_no').value = m.part_no;
                document.getElementById('master_part_name').value = m.part_name; document.getElementById('master_part_main').value = m.part_main_no || '';
                document.getElementById('master_category').value = m.part_category || 'อะไหล่หลัก'; document.getElementById('master_price').value = parseFloat(m.unit_price || 0).toFixed(2);
                document.getElementById('master_location').value = m.location || ''; document.getElementById('master_safety').value = m.safety_stock || '0';
                renderCarModelsCheckbox(m.car_model || '');
                document.getElementById('masterModal').classList.remove('hidden'); document.getElementById('masterModal').classList.add('flex');
            }
        }
    } catch(e) { showToast('ดึงข้อมูลผิดพลาด', 'error'); }
}

async function saveMasterPart() {
    const id = document.getElementById('edit_master_id').value; const pNo = document.getElementById('master_part_no').value.trim().toUpperCase(); const pName = document.getElementById('master_part_name').value.trim();
    if(!pNo || !pName) return alert('กรุณากรอกบาร์โค้ดและชื่อชิ้นส่วนให้ครบถ้วน');
    const chks = document.querySelectorAll('.master-car-chk:checked'); const models = Array.from(chks).map(c => c.value).join(', ');

    const payload = {
        part_no: pNo, part_main_no: document.getElementById('master_part_main').value.trim().toUpperCase() || null,
        part_name: pName, car_model: models || null, part_category: document.getElementById('master_category').value,
        unit_price: parseFloat(document.getElementById('master_price').value) || 0, location: document.getElementById('master_location').value.trim() || null,
        safety_stock: parseInt(document.getElementById('master_safety').value) || 0, branch_name: userBranch
    };

    try {
        const url = id ? `${API_BASE_URL}/api/parts/${id}` : `${API_BASE_URL}/api/parts`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { showToast('บันทึกมาสเตอร์สำเร็จ!'); closeMasterModal(); loadAllData(); } else throw new Error();
    } catch(e) { showToast('บันทึกล้มเหลว', 'error'); }
}

async function deleteMaster(id) {
    if(!confirm('🚨 ยืนยันการลบข้อมูลมาสเตอร์นี้?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('ลบมาสเตอร์สำเร็จ'); loadAllData(); } else throw new Error();
    } catch(e) { showToast('ลบไม่สำเร็จ', 'error'); }
}

function renderCarModelsCheckbox(selectedStr) {
    const container = document.getElementById('master_car_models_container'); if(!container) return;
    const selectedArr = selectedStr.split(',').map(s => s.trim());
    
    fetch(`${API_BASE_URL}/api/car-models`).then(async r => {
        if(r.ok) {
            const data = await r.json();
            container.innerHTML = data.map(c => `
                <label class="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded border border-transparent hover:border-slate-200 transition">
                    <input type="checkbox" value="${c.car_model}" class="master-car-chk w-4 h-4 accent-blue-600 cursor-pointer" ${selectedArr.includes(c.car_model) ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-700 select-none">${c.car_brand} <span class="font-medium text-slate-500">${c.car_model}</span></span>
                </label>
            `).join('');
        }
    }).catch(()=>{});
}