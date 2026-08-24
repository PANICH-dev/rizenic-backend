const API_BASE_URL = window.location.origin;
let globalCarData = [];
let globalStatuses = [];
let currentEditingJob = null; 

let repairBodyPartsList = { main: [], sub: [] };
let selectedBodyParts = { main: [], sub: [] };

let currentSchedMonth = new Date().getMonth();
let currentSchedYear = new Date().getFullYear();
let allSchedJobs = [];
let allSchedQuotas = [];
let currentTargetField = 'all'; 

document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') {
        const loginScr = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        if (loginScr) loginScr.classList.remove('hidden');
        if (mainApp) mainApp.classList.add('hidden');
        return;
    }
    enterApp();
});

function formatToThaiDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

// 🌟 เพิ่มฟังก์ชันคำนวณและแจ้งเตือนวันซ่อมเสร็จอัจฉริยะ 🌟
function updateTargetDateSuggestion() {
    const suggestionEl = document.getElementById('target_date_suggestion');
    if (!suggestionEl) return;

    const damageLevel = document.getElementById('damage_level')?.value || 'เบา';
    const cleanMainParts = selectedBodyParts.main.filter(p => !p.includes('ไม่ชิ้นงาน'));
    const mainQty = cleanMainParts.length;
    const hasGlass = cleanMainParts.some(p => p.includes('กระจก')) || selectedBodyParts.sub.some(p => p.includes('กระจก'));
    
    if (mainQty === 0) {
        suggestionEl.innerHTML = '';
        suggestionEl.classList.add('hidden');
        return;
    }

    let days = 0;
    if (mainQty === 1) days = 3;
    else if (mainQty === 2) days = 5;
    else if (mainQty >= 3) days = 5 + (mainQty - 2);

    let msg = `💡 แนะนำ: ทำสีชิ้นหลัก ${mainQty} ชิ้น ควรใช้เวลาซ่อม <b>${days} วัน</b>`;
    let colorClass = "text-blue-600";

    if (damageLevel === 'หนัก') {
        msg = `⚠️ แผลหนัก: กรุณาประเมินวันซ่อมตามหน้างานจริง`;
        colorClass = "text-rose-600";
    } else if (hasGlass) {
        msg = `⚠️ มีงานกระจก: แนะนำ <b>${days} วัน</b> + ประเมินเวลาเผื่อกระจก`;
        colorClass = "text-amber-600 border-amber-200 bg-amber-50";
    }

    suggestionEl.innerHTML = `<span class="${colorClass}">${msg}</span>`;
    suggestionEl.classList.remove('hidden');
}

function selectDamage(level) {
    const dmgInput = document.getElementById('damage_level');
    if (dmgInput) dmgInput.value = level;
    
    const b = document.getElementById('dmg_btn_เบา');
    const m = document.getElementById('dmg_btn_กลาง');
    const h = document.getElementById('dmg_btn_หนัก');

    if (b) b.className = 'dmg-btn dmg-btn-light'; 
    if (m) m.className = 'dmg-btn dmg-btn-medium'; 
    if (h) h.className = 'dmg-btn dmg-btn-heavy';

    if(level === 'เบา' && b) b.className = 'dmg-btn bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02]';
    if(level === 'กลาง' && m) m.className = 'dmg-btn bg-amber-500 text-slate-900 border-amber-600 shadow-md scale-[1.02]';
    if(level === 'หนัก' && h) h.className = 'dmg-btn bg-rose-600 text-white border-rose-700 shadow-md scale-[1.02]';
    
    updateTargetDateSuggestion(); // อัปเดตข้อความเตือนเมื่อเลือกความเสียหาย
}

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login_user').value; 
    const pass = document.getElementById('login_pass').value;
    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
        const data = await res.json();
        if (data.success) {
            sessionStorage.setItem('isLoggedIn', 'true'); 
            sessionStorage.setItem('emp_name', data.employee.employee_name);
            sessionStorage.setItem('emp_role', data.employee.employee_role); 
            sessionStorage.setItem('emp_branch', data.employee.branch_name || 'สำนักงานใหญ่');
            
            const accessiblePages = data.employee.accessible_pages || '';
            sessionStorage.setItem('accessible_pages', accessiblePages);
            
            enterApp(); 
        } else alert('❌ ' + data.error);
    } catch (err) { alert('❌ ระบบขัดข้อง'); }
}

async function enterApp() {
    const loginScr = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    if (loginScr) loginScr.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    
    const empNameEl = document.getElementById('display_emp_name');
    const branchEl = document.getElementById('display_branch');
    const saOwnerInp = document.getElementById('sa_owner_input');
    const contactDateInp = document.getElementById('contact_date');

    if (empNameEl) empNameEl.innerText = sessionStorage.getItem('emp_name') || 'Admin Test';
    if (branchEl) branchEl.innerText = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    if (saOwnerInp) saOwnerInp.value = sessionStorage.getItem('emp_name') || '';
    if (contactDateInp) contactDateInp.value = new Date().toISOString().split('T')[0];
    
    selectDamage('เบา'); 
    await loadInitialData(); 
    await checkCrossPageEditMode();
}

function logout() { sessionStorage.clear(); window.location.reload(); }

function autoMapRouting() {
    const jobStatusEl = document.getElementById('job_status');
    if (!jobStatusEl) return;
    const selectedStatus = jobStatusEl.value;
    const mapping = globalStatuses.find(s => s.status_name === selectedStatus);
    const routeSelect = document.getElementById('department_routing');
    if(mapping && mapping.department && routeSelect) { routeSelect.value = mapping.department; }
    
    const parkedStatuses = [
        "09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", 
        "12.ส่งมอบ", "13.วางบิลประกัน", "14.ชำระเงินสด", 
        "15.วางบิล Tesla", "16.วางบิล EV ME", "17.รอออกบิล", 
        "19.ออกบิลแล้ว", "20.จอดซ่อม TC", "21.พักซ่อม"
    ];
    const isParked = parkedStatuses.some(st => selectedStatus.includes(st) || st.includes(selectedStatus));
    const parkStatusEl = document.getElementById('park_status');
    if (parkStatusEl) parkStatusEl.value = isParked ? 'จอดซ่อม' : 'ไม่จอดซ่อม';
}

async function loadInitialData() {
    try {
        const results = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/employees`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/statuses`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/customer-types`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/car-models`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/insurances`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/body-parts`).then(r => r.json())
        ]);

        if (results[0].status === 'fulfilled') {
            const data = results[0].value;
            const saList = document.getElementById('sa_list');
            if (saList) {
                saList.innerHTML = '';
                const userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
                const branchSAs = data.filter(e => e.branch_name === userBranch && (e.employee_role || '').toUpperCase().includes('SA'));
                const uniqueSAs = [...new Set(branchSAs.map(e => e.employee_name).filter(Boolean))].sort();
                uniqueSAs.forEach(name => { saList.innerHTML += `<option value="${name}">`; });
            }
        }

        if (results[1].status === 'fulfilled') {
            globalStatuses = results[1].value;
            const select = document.getElementById('job_status'); 
            if (select) {
                select.innerHTML = '<option value="">-- เลือกสถานะใบงาน --</option>';
                globalStatuses.forEach(item => select.innerHTML += `<option value="${item.status_name}">${item.status_name}</option>`);
            }
        }

        if (results[2].status === 'fulfilled') {
            const select = document.getElementById('customer_type'); 
            if (select) {
                select.innerHTML = '<option value="">-- เลือก --</option>';
                results[2].value.forEach(item => select.innerHTML += `<option value="${item.type_name}">${item.type_name}</option>`);
            }
        }

        if (results[3].status === 'fulfilled') {
            globalCarData = results[3].value; 
            const uniqueBrands = [...new Set(globalCarData.map(car => car.car_brand))];
            const brandList = document.getElementById('brand_list'); 
            if (brandList) {
                brandList.innerHTML = '';
                uniqueBrands.forEach(brand => brandList.innerHTML += `<option value="${brand}">`);
            }
            updateCarModels('Tesla'); 
        }

        if (results[4].status === 'fulfilled') {
            const select = document.getElementById('payment_type'); 
            if (select) {
                select.innerHTML = '<option value="">-- เลือก --</option>';
                results[4].value.forEach(item => select.innerHTML += `<option value="${item.insurance_name}">${item.insurance_name}</option>`);
            }
        }

        if (results[5].status === 'fulfilled') {
            const data = results[5].value;
            repairBodyPartsList.main = data.filter(p => p.category === 'ชิ้นส่วนหลัก').map(p => p.part_name);
            repairBodyPartsList.sub = data.filter(p => p.category === 'ชิ้นส่วนรอง').map(p => p.part_name);
            renderBodyPartsUI();
        }
    } catch (err) {
        console.error("Error loading initial data", err);
    }
}

function updateCarModels(brandName) {
    const select = document.getElementById('car_model'); 
    if (!select) return;
    select.innerHTML = '<option value="">-- เลือกรุ่นรถ --</option>';
    globalCarData.filter(car => car.car_brand === brandName).forEach(car => { 
        select.innerHTML += `<option value="${car.car_model}">${car.car_model}</option>`; 
    });
}

function renderBodyPartsUI() {
    const mainContainer = document.getElementById('body_parts_main'); 
    const subContainer = document.getElementById('body_parts_sub');
    if (!mainContainer || !subContainer) return;

    mainContainer.innerHTML = ''; 
    subContainer.innerHTML = '';
    
    repairBodyPartsList.main.forEach(part => {
        const isSelected = selectedBodyParts.main.includes(part);
        mainContainer.innerHTML += `<span onclick="toggleBodyPart('main', '${part}')" class="part-badge ${isSelected ? 'selected-main' : 'unselected'}">${part}</span>`;
    });
    repairBodyPartsList.sub.forEach(part => {
        const isSelected = selectedBodyParts.sub.includes(part);
        subContainer.innerHTML += `<span onclick="toggleBodyPart('sub', '${part}')" class="part-badge ${isSelected ? 'selected-sub' : 'unselected'}">${part}</span>`;
    });

    const cMain = document.getElementById('count_main');
    const cSub = document.getElementById('count_sub');
    if (cMain) cMain.innerText = selectedBodyParts.main.length;
    if (cSub) cSub.innerText = selectedBodyParts.sub.length;

    autoCalculateDamageLevel();
    updateTargetDateSuggestion(); // อัปเดตข้อความเตือนเมื่อเลือกอะไหล่เสร็จ
}

function toggleBodyPart(category, partName) {
    const index = selectedBodyParts[category].indexOf(partName);
    if (index > -1) { selectedBodyParts[category].splice(index, 1); } 
    else { selectedBodyParts[category].push(partName); }
    renderBodyPartsUI();
}

function autoCalculateDamageLevel() {
    const validMain = selectedBodyParts.main.filter(p => !p.includes('ไม่ชิ้นงาน'));
    const validSub = selectedBodyParts.sub.filter(p => !p.includes('ไม่ชิ้นงาน'));
    const totalParts = validMain.length + validSub.length;

    if (totalParts >= 1 && totalParts <= 3) { selectDamage('เบา'); } 
    else if (totalParts >= 4 && totalParts <= 7) { selectDamage('กลาง'); } 
    else if (totalParts > 7) { selectDamage('หนัก'); }
}

function addDocRow(type = 'QT', val = '') {
    const tbody = document.getElementById('docs_body');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="px-4 py-3"><select class="minimal-input doc-type font-bold !py-1.5"><option value="QT" ${type==='QT'?'selected':''}>ใบเสนอราคา (QT)</option><option value="SO" ${type==='SO'?'selected':''}>ใบสั่งซ่อม (SO)</option><option value="BL" ${type==='BL'?'selected':''}>ใบวางบิล (BL)</option></select></td>
        <td class="px-4 py-3"><input type="text" class="minimal-input doc-no font-mono uppercase !py-1.5" placeholder="กรอกหมายเลขเอกสาร" value="${val}"></td>
        <td class="px-4 py-3 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-slate-400 hover:text-red-600 transition bg-white p-2 rounded-lg border border-slate-200 shadow-sm"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function addPartRow(partNo = '', partMain = '', partName = '', model = '', type = 'อะไหล่หลัก', price = '0', loc = '', safe = '0') {
    const tbody = document.getElementById('order_parts_body'); if(!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="px-2 py-2"><input type="text" class="minimal-input px-2 py-1.5 part-no-input font-mono uppercase text-xs bg-white" placeholder="บาร์โค้ด" value="${partNo}" onblur="checkMasterPart(this)"></td>
        <td class="px-2 py-2"><input type="text" class="minimal-input px-2 py-1.5 part-main-input font-mono text-xs" placeholder="MAIN No" value="${partMain}" readonly></td>
        <td class="px-2 py-2"><input type="text" class="minimal-input px-2 py-1.5 part-name-input text-xs" placeholder="ชื่อชิ้นส่วน" value="${partName}"></td>
        <td class="px-2 py-2"><input type="text" class="minimal-input px-2 py-1.5 part-model-input text-xs" placeholder="รุ่นรถ" value="${model}"></td>
        <td class="px-2 py-2 min-w-[120px]">
            <input type="text" class="minimal-input px-2 py-1.5 part-type-input text-xs font-bold" placeholder="ประเภท" value="${type}">
        </td>
        <td class="px-2 py-2"><input type="number" class="minimal-input px-2 py-1.5 part-price-input text-xs text-right" placeholder="ราคา" value="${price}"></td>
        <td class="px-2 py-2"><input type="text" class="minimal-input px-2 py-1.5 part-loc-input text-xs" placeholder="Location" value="${loc}"></td>
        <td class="px-2 py-2 text-center"><input type="number" class="minimal-input px-2 py-1.5 part-safe-input text-xs text-center font-bold" value="${safe}"></td>
        <td class="px-2 py-2"><input type="number" class="minimal-input px-2 py-1.5 part-qty-input text-center font-black text-xs text-amber-600 bg-amber-50 border-amber-300 focus:border-amber-500" value="1" min="1"></td>
        <td class="px-2 py-2 text-center flex flex-col gap-1.5">
            <button type="button" onclick="sendSinglePO(this)" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"><i class="fa-solid fa-paper-plane mr-1"></i> แอด</button>
            <button type="button" onclick="this.closest('tr').remove()" class="text-slate-400 hover:text-red-500 transition text-[10px] font-bold"><i class="fa-solid fa-trash"></i> ทิ้ง</button>
        </td>
    `;
    tbody.appendChild(tr);
}

async function checkMasterPart(inputElem) {
    const partNo = inputElem.value.trim(); if(!partNo) return;
    const tr = inputElem.closest('tr'); 
    const n = tr.querySelector('.part-name-input'); const m = tr.querySelector('.part-main-input');
    const mo = tr.querySelector('.part-model-input'); const p = tr.querySelector('.part-price-input');
    const l = tr.querySelector('.part-loc-input'); const s = tr.querySelector('.part-safe-input');
    const t = tr.querySelector('.part-type-input');

    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(partNo)}`);
        if(res.ok) {
            const resData = await res.json();
            const data = Array.isArray(resData) ? resData[0] : (resData.data ? (Array.isArray(resData.data) ? resData.data[0] : resData.data) : resData);
            if (data && (data.part_name || data.part_no)) {
                if(n) n.value = data.part_name || ''; 
                if(m) m.value = data.part_main_no || '-'; 
                if(mo) mo.value = data.car_model || '-';
                if(t) t.value = data.part_category || 'อะไหล่หลัก'; 
                if(p) p.value = data.unit_price || 0; 
                if(l) l.value = data.location || '-'; 
                if(s) s.value = data.safety_stock || 0;
            }
        }
    } catch(e) {}
}

async function sendSinglePO(btnElem) {
    const carPlateEl = document.getElementById('car_plate');
    const carPlate = carPlateEl ? carPlateEl.value.trim() : '';
    if(!carPlate) { alert('⚠️ กรุณากรอก "ทะเบียนรถ" ด้านบนก่อนยิงออเดอร์ครับ!'); return; }

    const tr = btnElem.closest('tr');
    const pNo = tr.querySelector('.part-no-input')?.value?.trim() || ''; 
    const pMain = tr.querySelector('.part-main-input')?.value?.trim() || '';
    let pName = tr.querySelector('.part-name-input')?.value?.trim() || ''; 
    const pType = tr.querySelector('.part-type-input')?.value?.trim() || 'อะไหล่หลัก';
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

        if (!resPO.ok) {
            throw new Error('บันทึกคำสั่งซื้ออะไหล่ไม่สำเร็จ');
        }

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

async function loadPartsTrackingTable(carPlate) {
    const tbody = document.getElementById('track_parts_body');
    if (!tbody) return;
    if (!carPlate || !carPlate.trim()) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">กรุณาระบุทะเบียนรถเพื่อติดตามสถานะอะไหล่</td></tr>`;
        return;
    }
    try {
        const clean = str => String(str || '').replace(/\s+/g, '').toUpperCase();
        const searchPlate = clean(carPlate);

        const res = await fetch(`${API_BASE_URL}/api/part-orders?_t=` + new Date().getTime(), { cache: 'no-store' });
        if (!res.ok) return;
        const resData = await res.json();
        const data = Array.isArray(resData) ? resData : (resData.data || []);
        
        const filtered = data.filter(p => {
            if(!p || !p.car_plate) return false;
            const pPlate = clean(p.car_plate);
            return pPlate === searchPlate || pPlate.includes(searchPlate) || searchPlate.includes(pPlate);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">ไม่พบรายการสั่งซื้ออะไหล่สำหรับทะเบียน "${carPlate}"</td></tr>`;
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
                <td class="text-center font-bold text-slate-600">${item.part_type || 'หลัก'}</td>
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

async function checkCrossPageEditMode() {
    const idToEdit = sessionStorage.getItem('edit_job_id'); 
    const docsBody = document.getElementById('docs_body');
    const orderPartsBody = document.getElementById('order_parts_body');

    if(!idToEdit) {
        if(docsBody && docsBody.children.length === 0) addDocRow();
        if(orderPartsBody && orderPartsBody.children.length === 0) addPartRow();
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/report/${idToEdit}`); 
        if (!res.ok) return;
        const job = await res.json();
        currentEditingJob = job; 
        
        const saRepId = document.getElementById('sa_report_id');
        const curEditId = document.getElementById('current_editing_id');
        const editBadge = document.getElementById('edit_mode_badge');
        const btnSubSa = document.getElementById('btn_submit_sa');

        if (saRepId) saRepId.value = job.id || idToEdit;
        if (curEditId) curEditId.innerText = job.id || idToEdit;
        if (editBadge) editBadge.classList.remove('hidden'); 
        if (btnSubSa) btnSubSa.innerHTML = '<i class="fa-solid fa-file-pen mr-2"></i> บันทึกอัปเดตใบงานซ่อม';

        const saOwnerInp = document.getElementById('sa_owner_input');
        const custNameInp = document.getElementById('customer_name');
        const phoneInp = document.getElementById('phone_number');
        const carBrandInp = document.getElementById('car_brand');

        if (saOwnerInp) saOwnerInp.value = job.sa_owner || sessionStorage.getItem('emp_name') || '';
        if (custNameInp) custNameInp.value = job.customer_name || ''; 
        if (phoneInp) phoneInp.value = job.phone_number || '';
        if (carBrandInp) carBrandInp.value = job.car_brand || 'Tesla';
        
        await updateCarModels(job.car_brand || 'Tesla');

        const safeSetSelect = (elementId, value) => {
            if (!value) return;
            const selectEl = document.getElementById(elementId);
            if (!selectEl) return;
            const optionExists = Array.from(selectEl.options).some(opt => opt.value === value);
            if (!optionExists) { selectEl.add(new Option(value, value)); }
            selectEl.value = value;
        };

        safeSetSelect('customer_type', job.customer_type);
        safeSetSelect('car_model', job.car_model);
        safeSetSelect('payment_type', job.payment_type);
        safeSetSelect('job_status', job.job_status);

        if (job.department_routing) safeSetSelect('department_routing', job.department_routing);
        else autoMapRouting();

        if (job.is_parked) safeSetSelect('park_status', job.is_parked);
        else autoMapRouting(); 

        const notesEl = document.getElementById('notes');
        const carPlateEl = document.getElementById('car_plate');
        const vinEl = document.getElementById('vin_no');

        if (notesEl) notesEl.value = job.notes || '';
        if (carPlateEl) carPlateEl.value = job.car_plate || ''; 
        if (vinEl) vinEl.value = job.vin_no || '';

        if (docsBody) docsBody.innerHTML = '';
        if (job.qt_no) job.qt_no.split(',').forEach(v => { let val = v.trim(); if(val) addDocRow('QT', val); });
        if (job.so_no) job.so_no.split(',').forEach(v => { let val = v.trim(); if(val) addDocRow('SO', val); });
        if (job.bl_no) job.bl_no.split(',').forEach(v => { let val = v.trim(); if(val) addDocRow('BL', val); });
        if (docsBody && docsBody.children.length === 0) addDocRow();

        if (orderPartsBody) orderPartsBody.innerHTML = '';
        addPartRow();

        selectDamage(job.damage_level || 'เบา');
        selectedBodyParts.main = job.main_part_name ? job.main_part_name.split(',').map(s => s.trim()).filter(Boolean) : [];
        selectedBodyParts.sub = job.sub_part_name ? job.sub_part_name.split(',').map(s => s.trim()).filter(Boolean) : [];
        renderBodyPartsUI();
        
        const setDateVal = (elemId, isoVal) => {
            const el = document.getElementById(elemId);
            if (el) el.value = isoVal ? String(isoVal).split('T')[0] : '';
        };
        setDateVal('contact_date', job.contact_date);
        setDateVal('arrived_date', job.arrived_date);
        setDateVal('target_finish_date', job.target_finish_date);
        setDateVal('repair_finish_date', job.repair_finish_date);
        setDateVal('delivery_date', job.delivery_date);

        if (job.car_plate) {
            loadPartsTrackingTable(job.car_plate.trim());
        }

    } catch(e) {
        console.error("Error loading job for edit:", e);
    }
}

function cancelEditMode() {
    currentEditingJob = null;
    sessionStorage.removeItem('edit_job_id'); 
    
    const saForm = document.getElementById('saForm');
    const saRepId = document.getElementById('sa_report_id');
    const editBadge = document.getElementById('edit_mode_badge');
    const btnSubSa = document.getElementById('btn_submit_sa');
    const docsBody = document.getElementById('docs_body');
    const orderPartsBody = document.getElementById('order_parts_body');
    const trackPartsBody = document.getElementById('track_parts_body');

    if (saForm) saForm.reset(); 
    if (saRepId) saRepId.value = '';
    if (editBadge) editBadge.classList.add('hidden');
    if (btnSubSa) btnSubSa.innerHTML = '<i class="fa-solid fa-save mr-2"></i> บันทึกข้อมูลและดำเนินการ';
    
    if (docsBody) { docsBody.innerHTML = ''; addDocRow(); }
    if (orderPartsBody) { orderPartsBody.innerHTML = ''; addPartRow(); }
    if (trackPartsBody) trackPartsBody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">กรุณาบันทึกใบงานเพื่อติดตามสถานะอะไหล่</td></tr>`;
    
    selectedBodyParts.main = [];
    selectedBodyParts.sub = [];
    renderBodyPartsUI();

    selectDamage('เบา');
    
    const deptRoute = document.getElementById('department_routing');
    const parkStat = document.getElementById('park_status');
    const saOwnerInp = document.getElementById('sa_owner_input');

    if (deptRoute) deptRoute.value = 'รอดำเนินการ';
    if (parkStat) parkStat.value = 'ไม่จอดซ่อม';
    if (saOwnerInp) saOwnerInp.value = sessionStorage.getItem('emp_name') || '';
}

async function checkQuotaBeforeSubmit(branch, arrivedDate, targetDate, deliveryDate, reqMain, reqSub) {
    try {
        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        const allJobs = await resJobs.json();
        const allQuotas = await resQuotas.json();
        const branchQuotas = allQuotas.filter(q => q.branch_name === branch);
        const defaultQuota = branchQuotas.find(q => q.quota_type === 'default');
        const editIdEl = document.getElementById('sa_report_id');
        const editId = editIdEl ? editIdEl.value : '';

        // 🌟 แก้ไขแมพโควต้าจาก DB ฟิลด์: quota_arrived, quota_target, quota_delivery 🌟
        const getQ = (d) => {
            const sq = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === d);
            const getVal = (fArr) => {
                for (let f of fArr) {
                    if (sq && sq[f] !== undefined && sq[f] !== null && sq[f] !== '') return parseInt(sq[f]) || 0;
                    if (defaultQuota && defaultQuota[f] !== undefined && defaultQuota[f] !== null && defaultQuota[f] !== '') return parseInt(defaultQuota[f]) || 0;
                }
                return 0;
            };

            return {
                maxArrived: getVal(['quota_arrived', 'quota_cars']),
                maxTarget: getVal(['quota_target', 'quota_cars']),
                maxDelivery: getVal(['quota_delivery', 'quota_cars']),
                maxMain: getVal(['quota_main_parts']),
                maxSub: getVal(['quota_sub_parts'])
            };
        };

        if (arrivedDate) {
            const q = getQ(arrivedDate);
            if (q.maxArrived > 0) {
                const count = allJobs.filter(j => j.branch_name === branch && j.arrived_date && j.arrived_date.split('T')[0] === arrivedDate && String(j.id) !== String(editId)).length;
                if (count >= q.maxArrived) return `โควต้ารถเข้าจอด (คัน) ในวันที่ ${formatToThaiDate(arrivedDate)} เต็มแล้ว!`;
            }
        }

        if (targetDate) {
            const q = getQ(targetDate);
            const jobsInDay = allJobs.filter(j => j.branch_name === branch && j.target_finish_date && j.target_finish_date.split('T')[0] === targetDate && String(j.id) !== String(editId));
            
            if (q.maxTarget > 0 && jobsInDay.length >= q.maxTarget) {
                return `โควต้าเป้าหมายซ่อมเสร็จ (คัน) ในวันที่ ${formatToThaiDate(targetDate)} เต็มแล้ว!`;
            }
            
            let usedMain = 0; let usedSub = 0;
            jobsInDay.forEach(j => { usedMain += parseInt(j.main_part_qty)||0; usedSub += parseInt(j.sub_part_qty)||0; });
            
            if (q.maxMain > 0 && (usedMain + reqMain) > q.maxMain) return `กำลังผลิตชิ้นส่วนหลักวันที่ ${formatToThaiDate(targetDate)} เต็มแล้ว!`;
            if (q.maxSub > 0 && (usedSub + reqSub) > q.maxSub) return `กำลังผลิตชิ้นส่วนรองวันที่ ${formatToThaiDate(targetDate)} เต็มแล้ว!`;
        }

        if (deliveryDate) {
            const q = getQ(deliveryDate);
            if (q.maxDelivery > 0) {
                const count = allJobs.filter(j => j.branch_name === branch && j.delivery_date && j.delivery_date.split('T')[0] === deliveryDate && String(j.id) !== String(editId)).length;
                if (count >= q.maxDelivery) return `โควต้าคิวส่งมอบรถในวันที่ ${formatToThaiDate(deliveryDate)} เต็มแล้ว!`;
            }
        }
        
        return true;
    } catch(e) {
        return true; 
    }
}

async function submitSaForm(event) {
    event.preventDefault(); 
    
    const requiredFields = [
        { id: 'contact_date', name: '1. วันที่ติดต่อ' },
        { id: 'sa_owner_input', name: 'SA ผู้รับผิดชอบ' },
        { id: 'customer_name', name: '4. ชื่อลูกค้า' },
        { id: 'customer_type', name: '5. ประเภทลูกค้า' },
        { id: 'payment_type', name: '6. ประเภทการชำระเงิน/ประกัน' },
        { id: 'car_plate', name: '2. ทะเบียนรถ' },
        { id: 'car_brand', name: 'ยี่ห้อรถ' },
        { id: 'vin_no', name: '3. หมายเลขตัวถัง (VIN)' },
        { id: 'job_status', name: 'สถานะใบงาน' }
    ];
    
    let missingFields = [];
    requiredFields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el || !el.value.trim()) missingFields.push(field.name);
    });

    if (missingFields.length > 0) { 
        alert('⚠️ กรุณากรอกข้อมูลบังคับให้ครบถ้วนก่อนบันทึกครับ:\n\n- ' + missingFields.join('\n- ')); 
        return; 
    }

    const branchName = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    const arrivedDate = document.getElementById('arrived_date')?.value || '';
    const targetFinishDate = document.getElementById('target_finish_date')?.value || '';
    const deliveryDate = document.getElementById('delivery_date')?.value || '';

    const cleanMainParts = selectedBodyParts.main.filter(p => !p.includes('ไม่ชิ้นงาน'));
    const cleanSubParts = selectedBodyParts.sub.filter(p => !p.includes('ไม่ชิ้นงาน'));

    const btnSubmit = document.getElementById('btn_submit_sa');
    const oldBtnText = btnSubmit ? btnSubmit.innerHTML : '';

    if (arrivedDate || targetFinishDate || deliveryDate) {
        if (btnSubmit) {
            btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังตรวจสอบโควต้า...';
            btnSubmit.disabled = true;
        }

        const quotaCheck = await checkQuotaBeforeSubmit(branchName, arrivedDate, targetFinishDate, deliveryDate, cleanMainParts.length, cleanSubParts.length);
        
        if (quotaCheck !== true) {
            alert('❌ ไม่สามารถบันทึกได้:\n\n' + quotaCheck + '\n\nกรุณาเลือกวันที่ใหม่ครับ');
            if (btnSubmit) {
                btnSubmit.innerHTML = oldBtnText;
                btnSubmit.disabled = false;
            }
            return;
        }
        
        if (btnSubmit) btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
    }

    const editId = document.getElementById('sa_report_id')?.value || '';
    let qtArr = [], soArr = [], blArr = [];
    document.querySelectorAll('#docs_body tr').forEach(tr => {
        const type = tr.querySelector('.doc-type')?.value; const val = tr.querySelector('.doc-no')?.value?.trim();
        if(val) { if(type === 'QT') qtArr.push(val); if(type === 'SO') soArr.push(val); if(type === 'BL') blArr.push(val); }
    });

    const routingDept = document.getElementById('department_routing')?.value || 'รอดำเนินการ';
    
    let formData = {};
    if (editId && currentEditingJob) { formData = { ...currentEditingJob }; } 
    else {
        formData.appointment_date = null; formData.customer_phone = null; formData.expected_finish_date = null;
        formData.cost_labor = 0; formData.cost_part = 0; formData.cost_external = 0; formData.quotation_no = null;
        formData.job_order_no = null; formData.ivn_no = null;
    }

    formData.sa_owner = document.getElementById('sa_owner_input')?.value?.trim() || ''; 
    formData.branch_name = branchName;
    formData.customer_name = document.getElementById('customer_name')?.value || ''; 
    formData.phone_number = document.getElementById('phone_number')?.value || '';
    formData.customer_type = document.getElementById('customer_type')?.value || ''; 
    formData.car_brand = document.getElementById('car_brand')?.value || '';
    formData.car_model = document.getElementById('car_model')?.value || ''; 
    formData.vin_no = document.getElementById('vin_no')?.value || '';
    formData.qt_no = qtArr.join(', '); formData.so_no = soArr.join(', '); formData.bl_no = blArr.join(', ');
    formData.payment_type = document.getElementById('payment_type')?.value || ''; 
    formData.damage_level = document.getElementById('damage_level')?.value || 'เบา';
    formData.contact_date = document.getElementById('contact_date')?.value || null; 
    formData.arrived_date = arrivedDate || null;
    formData.target_finish_date = targetFinishDate || null; 
    formData.repair_finish_date = document.getElementById('repair_finish_date')?.value || null;
    formData.delivery_date = deliveryDate || null; 
    formData.notes = document.getElementById('notes')?.value || ''; 
    formData.is_parked = document.getElementById('park_status')?.value || 'ไม่จอดซ่อม'; 
    formData.job_status = document.getElementById('job_status')?.value || ''; 
    formData.car_plate = document.getElementById('car_plate')?.value || '';
    formData.department_routing = routingDept;
    formData.main_part_qty = cleanMainParts.length;
    formData.sub_part_qty = cleanSubParts.length;
    formData.main_part_name = cleanMainParts.join(' , '); 
    formData.sub_part_name = cleanSubParts.join(' , ');

    const url = editId ? `${API_BASE_URL}/api/report/${editId}` : `${API_BASE_URL}/api/report`;
    const method = editId ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        if (!response.ok) {
            const errData = await response.json();
            alert('❌ บันทึกล้มเหลว:\n\n' + (errData.error || 'โปรดตรวจสอบอีกครั้ง'));
            if (btnSubmit) {
                btnSubmit.innerHTML = editId ? '<i class="fa-solid fa-file-pen"></i> บันทึกอัปเดตใบงานซ่อม' : '<i class="fa-solid fa-save mr-2"></i> บันทึกข้อมูลและดำเนินการ';
                btnSubmit.disabled = false; 
            }
            return;
        }

        const resJson = await response.json();
        const savedJobId = editId || resJson?.insertedId || resJson?.id || null;

        if (routingDept.includes('อะไหล่') || formData.job_status.includes('06.สั่งอะไหล่')) {
            const partRows = document.querySelectorAll('#order_parts_body tr');
            for (let tr of partRows) {
                const pNo = tr.querySelector('.part-no-input')?.value; 
                const pMain = tr.querySelector('.part-main-input')?.value;
                const pName = tr.querySelector('.part-name-input')?.value; 
                const pType = tr.querySelector('.part-type-input')?.value || 'อะไหล่หลัก';
                const pQty = tr.querySelector('.part-qty-input')?.value || '1';
                
                if (pNo && pName) {
                    await fetch(`${API_BASE_URL}/api/part-orders`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            job_id: savedJobId,
                            qt_no: qtArr.join(', '), so_no: soArr.join(', '), epc_no: null,
                            order_date: new Date().toISOString().split('T')[0], car_plate: formData.car_plate, vin_no: formData.vin_no, car_model: formData.car_model, 
                            part_no: pNo, part_main_no: pMain, part_name: pName, qty_ordered: pQty, part_type: pType, branch_name: formData.branch_name, order_status: 'รอสั่งซื้อ' 
                        })
                    });

                    await fetch(`${API_BASE_URL}/api/part-outbound`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            job_id: savedJobId,
                            issue_date: new Date().toISOString().split('T')[0],
                            part_no: pNo, part_main_no: pMain || null, part_name: pName, qty: pQty,
                            car_plate: formData.car_plate, qt_no: qtArr.join(',') || null, so_no: soArr.join(',') || null,
                            unit_price: 0, car_model: formData.car_model || null,
                            job_status: 'รอเข้าซ่อม', part_type: pType,
                            branch_name: formData.branch_name
                        })
                    }).catch(e => console.warn(e));
                }
            }
        }
        
        // 🌟 แก้ไข: บันทึกสำเร็จแล้วให้อยู่ในโหมดแก้ไขต่อ 🌟
        if (editId) { 
            alert(`🎉 อัปเดตใบงานเรียบร้อย!`); 
            if(formData.car_plate) loadPartsTrackingTable(formData.car_plate);
            if (btnSubmit) {
                btnSubmit.innerHTML = '<i class="fa-solid fa-file-pen"></i> บันทึกอัปเดตใบงานซ่อม';
                btnSubmit.disabled = false;
            }
        } 
        else { 
            alert(`🎉 เปิดบิลเรียบร้อย!`); 
            if (savedJobId) {
                sessionStorage.setItem('edit_job_id', savedJobId);
                await checkCrossPageEditMode();
            } else {
                cancelEditMode();
            }
        }
        
    } catch (e) { 
        alert('❌ เครือข่ายขัดข้อง'); 
        if (btnSubmit) {
            btnSubmit.innerHTML = editId ? '<i class="fa-solid fa-file-pen"></i> บันทึกอัปเดตใบงานซ่อม' : '<i class="fa-solid fa-save mr-2"></i> บันทึกข้อมูลและดำเนินการ'; 
            btnSubmit.disabled = false;
        }
    }
}

// 🌟 1. ดึงข้อมูลปฏิทิน 🌟
async function openScheduleCalendar(field) {
    currentTargetField = field;
    const modalEl = document.getElementById('scheduleCalendarModal');
    const loadingEl = document.getElementById('calendar_loading');
    const titleEl = document.getElementById('modal_dynamic_title');

    if (modalEl) modalEl.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');

    const titles = {
        'arrived_date': 'เช็คโควต้า: รถเข้าจอดอู่ (คัน)',
        'target_finish_date': 'เช็คโควต้า: เป้าซ่อมเสร็จ & ชิ้นงานทำสี',
        'delivery_date': 'เช็คโควต้า: ส่งมอบรถลูกค้า (คัน)',
        'all': 'ตารางตรวจสอบโควต้า (ภาพรวม)'
    };
    
    if (titleEl) {
        titleEl.innerText = titles[field] || 'ตารางโควต้า';
    }

    try {
        const b = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
        const editIdEl = document.getElementById('sa_report_id');
        const editId = editIdEl ? editIdEl.value : '';

        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        
        const rawJobs = await resJobs.json();
        allSchedJobs = Array.isArray(rawJobs) ? rawJobs.filter(j => j.branch_name === b && String(j.id) !== String(editId)) : [];
        
        const rawQuotas = await resQuotas.json();
        allSchedQuotas = Array.isArray(rawQuotas) ? rawQuotas.filter(q => q.branch_name === b) : [];
        
        renderSchedCalendar();
    } catch (e) { 
        console.error('โหลดข้อมูลปฏิทินล้มเหลว', e); 
        alert('ไม่สามารถดึงข้อมูลตารางโควต้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function changeSchedMonth(direction) {
    currentSchedMonth += direction;
    if (currentSchedMonth > 11) { currentSchedMonth = 0; currentSchedYear++; }
    if (currentSchedMonth < 0) { currentSchedMonth = 11; currentSchedYear--; }
    renderSchedCalendar();
}

// 🌟 2. Render ปฏิทิน แก้ไขฟิลด์โควต้าถูกต้อง (ไม่มี ∞) + เพิ่มเป้าซ่อมเสร็จคัน/วัน 🌟
function renderSchedCalendar() {
    const grid = document.getElementById('sched_calendar_grid'); 
    if (!grid) return;
    grid.innerHTML = ''; 
    
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const monthTitleEl = document.getElementById('sched_month_title');
    if (monthTitleEl) monthTitleEl.innerText = `${monthNames[currentSchedMonth]} ${currentSchedYear}`;

    const firstDay = new Date(currentSchedYear, currentSchedMonth, 1).getDay();
    const totalDays = new Date(currentSchedYear, currentSchedMonth + 1, 0).getDate();

    const defaultQuota = allSchedQuotas.find(q => q.quota_type === 'default');

    const dailyData = {};
    const specialQuotasMap = {};

    allSchedQuotas.forEach(q => {
        if(q.quota_type === 'special' && q.quota_date) {
            specialQuotasMap[q.quota_date.split('T')[0]] = q;
        }
    });

    allSchedJobs.forEach(j => {
        const arrD = j.arrived_date ? String(j.arrived_date).split('T')[0] : null;
        const tgtD = j.target_finish_date ? String(j.target_finish_date).split('T')[0] : null;
        const delD = j.delivery_date ? String(j.delivery_date).split('T')[0] : null;

        if (arrD) { 
            if(!dailyData[arrD]) dailyData[arrD] = {a:0, t:0, d:0, m:0, s:0}; 
            dailyData[arrD].a++; 
        }
        if (tgtD) { 
            if(!dailyData[tgtD]) dailyData[tgtD] = {a:0, t:0, d:0, m:0, s:0}; 
            dailyData[tgtD].t++; 
            dailyData[tgtD].m += parseInt(j.main_part_qty) || 0; 
            dailyData[tgtD].s += parseInt(j.sub_part_qty) || 0; 
        }
        if (delD) { 
            if(!dailyData[delD]) dailyData[delD] = {a:0, t:0, d:0, m:0, s:0}; 
            dailyData[delD].d++; 
        }
    });

    let htmlBuffer = '';
    for(let i = 0; i < firstDay; i++) { htmlBuffer += `<div class="bg-transparent rounded-xl"></div>`; }

    // Helper ช่วยดึงค่าโควต้า ไม่ให้ติด undefined/NaN จนกลายเป็น ∞
    const getQVal = (sq, fieldArr) => {
        for (let f of fieldArr) {
            if (sq && sq[f] !== undefined && sq[f] !== null && sq[f] !== '') return parseInt(sq[f]) || 0;
            if (defaultQuota && defaultQuota[f] !== undefined && defaultQuota[f] !== null && defaultQuota[f] !== '') return parseInt(defaultQuota[f]) || 0;
        }
        return 0;
    };

    for(let day = 1; day <= totalDays; day++) {
        const dateStr = `${currentSchedYear}-${String(currentSchedMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        const dData = dailyData[dateStr] || {a:0, t:0, d:0, m:0, s:0};
        const arrCount = dData.a;
        const tarCount = dData.t;
        const delCount = dData.d;
        const mainPartsSum = dData.m;
        const subPartsSum = dData.s;

        const specialQuota = specialQuotasMap[dateStr];
        
        // 🌟 อ่านคอลัมน์จริงจาก DB: quota_arrived, quota_target, quota_delivery, quota_main_parts, quota_sub_parts
        const maxArrived = getQVal(specialQuota, ['quota_arrived', 'quota_cars']);
        const maxTarget = getQVal(specialQuota, ['quota_target', 'quota_cars']);
        const maxDelivery = getQVal(specialQuota, ['quota_delivery', 'quota_cars']);
        const maxMain = getQVal(specialQuota, ['quota_main_parts']);
        const maxSub = getQVal(specialQuota, ['quota_sub_parts']);

        const isArriveFull = maxArrived > 0 && arrCount >= maxArrived;
        const isTargetCarFull = maxTarget > 0 && tarCount >= maxTarget;
        const isTargetMainFull = maxMain > 0 && mainPartsSum >= maxMain;
        const isTargetSubFull = maxSub > 0 && subPartsSum >= maxSub;
        const isTargetOverallFull = isTargetCarFull || isTargetMainFull || isTargetSubFull;
        const isDeliveryFull = maxDelivery > 0 && delCount >= maxDelivery;
        const allFull = isArriveFull && isTargetOverallFull && isDeliveryFull;

        let quotaHTML = `<div class="mt-auto w-full pt-1 flex flex-col gap-1.5">`;
        let isCurrentFieldFull = false;
        let cellClass = 'sched-cell transition-all ';
        let clickAction = '';
        let lockIcon = '';

        if (currentTargetField === 'arrived_date') {
            isCurrentFieldFull = isArriveFull;
            let pct = maxArrived > 0 ? Math.min((arrCount / maxArrived) * 100, 100) : 0;
            let color = pct >= 100 ? 'bg-rose-500' : 'bg-emerald-500';
            quotaHTML += `
                <div class="flex justify-between text-[10px] font-black ${pct>=100?'text-rose-600':'text-emerald-700'} mb-1">
                    <span>รถเข้าจอด</span> <span>${arrCount}/${maxArrived > 0 ? maxArrived : '∞'} คัน</span>
                </div>
                ${maxArrived > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full"><div class="h-full ${color} rounded-full" style="width:${pct}%"></div></div>` : ''}
            `;
        } 
        else if (currentTargetField === 'target_finish_date') {
            isCurrentFieldFull = isTargetOverallFull;
            let pctT = maxTarget > 0 ? Math.min((tarCount / maxTarget) * 100, 100) : 0;
            let pctM = maxMain > 0 ? Math.min((mainPartsSum / maxMain) * 100, 100) : 0;
            let pctS = maxSub > 0 ? Math.min((subPartsSum / maxSub) * 100, 100) : 0;
            
            quotaHTML += `
                <!-- 🌟 เพิ่มโควต้ารถคิวเป้าซ่อมเสร็จ (คัน/วัน) ตามที่ระบุ 🌟 -->
                <div>
                    <div class="flex justify-between text-[9px] font-black ${pctT>=100?'text-rose-600':'text-amber-800'} mb-0.5">
                        <span>เป้าเสร็จ</span> <span>${tarCount}/${maxTarget > 0 ? maxTarget : '∞'} คัน</span>
                    </div>
                    ${maxTarget > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full mb-1"><div class="h-full ${pctT>=100?'bg-rose-500':'bg-amber-500'} rounded-full" style="width:${pctT}%"></div></div>` : ''}
                </div>
                <div>
                    <div class="flex justify-between text-[9px] font-black ${pctM>=100?'text-rose-600':'text-blue-700'} mb-0.5">
                        <span>ชิ้นหลัก</span> <span>${mainPartsSum}/${maxMain > 0 ? maxMain : '∞'} ชิ้น</span>
                    </div>
                    ${maxMain > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full mb-1"><div class="h-full ${pctM>=100?'bg-rose-500':'bg-blue-500'} rounded-full" style="width:${pctM}%"></div></div>` : ''}
                </div>
                <div>
                    <div class="flex justify-between text-[9px] font-black ${pctS>=100?'text-rose-600':'text-amber-700'} mb-0.5">
                        <span>ชิ้นรอง</span> <span>${subPartsSum}/${maxSub > 0 ? maxSub : '∞'} ชิ้น</span>
                    </div>
                    ${maxSub > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full"><div class="h-full ${pctS>=100?'bg-rose-500':'bg-amber-500'} rounded-full" style="width:${pctS}%"></div></div>` : ''}
                </div>
            `;
        } 
        else if (currentTargetField === 'delivery_date') {
            isCurrentFieldFull = isDeliveryFull;
            let pct = maxDelivery > 0 ? Math.min((delCount / maxDelivery) * 100, 100) : 0;
            let color = pct >= 100 ? 'bg-rose-500' : 'bg-indigo-500';
            quotaHTML += `
                <div class="flex justify-between text-[10px] font-black ${pct>=100?'text-rose-600':'text-indigo-700'} mb-1">
                    <span>ส่งมอบรถ</span> <span>${delCount}/${maxDelivery > 0 ? maxDelivery : '∞'} คัน</span>
                </div>
                ${maxDelivery > 0 ? `<div class="h-1.5 bg-slate-200 rounded-full"><div class="h-full ${color} rounded-full" style="width:${pct}%"></div></div>` : ''}
            `;
        } 
        else {
            isCurrentFieldFull = allFull;
            quotaHTML += `
                <div class="text-[9px] font-bold ${isArriveFull?'text-rose-600':'text-emerald-700'} flex justify-between"><span>เข้า</span><span>${arrCount}/${maxArrived > 0 ? maxArrived : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isTargetCarFull?'text-rose-600':'text-amber-700'} flex justify-between"><span>เป้า</span><span>${tarCount}/${maxTarget > 0 ? maxTarget : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isTargetMainFull?'text-rose-600':'text-blue-700'} flex justify-between"><span>หลัก</span><span>${mainPartsSum}/${maxMain > 0 ? maxMain : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isTargetSubFull?'text-rose-600':'text-amber-700'} flex justify-between"><span>รอง</span><span>${subPartsSum}/${maxSub > 0 ? maxSub : '∞'}</span></div>
                <div class="text-[9px] font-bold ${isDeliveryFull?'text-rose-600':'text-indigo-700'} flex justify-between"><span>ส่ง</span><span>${delCount}/${maxDelivery > 0 ? maxDelivery : '∞'}</span></div>
            `;
        }
        quotaHTML += `</div>`;

        const thaiDateStr = `${String(day).padStart(2,'0')}/${String(currentSchedMonth+1).padStart(2,'0')}/${currentSchedYear}`;

        if (isCurrentFieldFull) {
            cellClass += 'bg-slate-50 border-rose-200 opacity-60 cursor-not-allowed grayscale';
            clickAction = `onclick="alert('❌ โควต้าของวันที่นี้เต็มแล้ว ไม่สามารถเลือกได้ครับ!')"`;
            lockIcon = '<i class="fa-solid fa-lock text-rose-500 text-[10px]" title="คิวเต็มแล้ว"></i>';
        } else {
            cellClass += 'hover:border-blue-500 cursor-pointer hover:shadow-md hover:-translate-y-1 bg-white';
            if (currentTargetField !== 'all') {
                clickAction = `onclick="applySelectedDateToFieldDirect('${dateStr}', '${currentTargetField}')"`;
            } else {
                clickAction = `onclick="openDateSelectorModal('${dateStr}', '${thaiDateStr}', ${isArriveFull}, ${isTargetOverallFull}, ${isDeliveryFull})"`;
            }
        }

        htmlBuffer += `
            <div class="${cellClass}" ${clickAction}>
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-xs font-black ${isCurrentFieldFull ? 'text-rose-500' : 'text-slate-400'} font-mono">${day}</span>
                    ${lockIcon}
                </div>
                ${quotaHTML}
            </div>
        `;
    }

    grid.innerHTML = htmlBuffer;
}

// 🌟 3. ฟังก์ชันนำวันที่ไปใส่ในฟอร์มทันที 🌟
function applySelectedDateToFieldDirect(dateStr, fieldId) {
    const inputField = document.getElementById(fieldId);
    closeModal('scheduleCalendarModal');
    
    if (inputField) {
        requestAnimationFrame(() => {
            inputField.value = dateStr;
            inputField.dispatchEvent(new Event('change', { bubbles: true }));
            inputField.classList.add('ring-4', 'ring-blue-500/30', 'border-blue-500');
            setTimeout(() => { 
                inputField.classList.remove('ring-4', 'ring-blue-500/30', 'border-blue-500'); 
            }, 1000);
        });
    }
}

function openDateSelectorModal(dateStr, thaiDateStr, isArriveFull, isTargetFull, isDeliveryFull) {
    const tempDateInp = document.getElementById('ds_temp_date_val');
    const textEl = document.getElementById('ds_selected_date_text');

    if (tempDateInp) tempDateInp.value = dateStr;
    if (textEl) textEl.innerText = thaiDateStr;

    const btnArrived = document.getElementById('btn_apply_arrived');
    const btnTarget = document.getElementById('btn_apply_target');
    const btnDelivery = document.getElementById('btn_apply_delivery');

    if (btnArrived) {
        if (isArriveFull) {
            btnArrived.disabled = true;
            btnArrived.className = "w-full text-left px-4 py-3 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl shadow-none cursor-not-allowed flex items-center gap-3";
            btnArrived.innerHTML = `<i class="fa-solid fa-lock w-5 text-center text-rose-400"></i> คิว "รถเข้าจอดอู่" เต็มแล้ว`;
        } else {
            btnArrived.disabled = false;
            btnArrived.className = "w-full text-left px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-xl shadow-sm transition flex items-center gap-3";
            btnArrived.innerHTML = `<i class="fa-solid fa-truck-ramp-box w-5 text-center text-emerald-500"></i> นำไปใส่ช่อง "รถเข้าจอดอู่"`;
        }
    }

    if (btnTarget) {
        if (isTargetFull) {
            btnTarget.disabled = true;
            btnTarget.className = "w-full text-left px-4 py-3 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl shadow-none cursor-not-allowed flex items-center gap-3";
            btnTarget.innerHTML = `<i class="fa-solid fa-lock w-5 text-center text-rose-400"></i> โควต้า "กำหนดซ่อมเสร็จ" เต็มแล้ว`;
        } else {
            btnTarget.disabled = false;
            btnTarget.className = "w-full text-left px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-xl shadow-sm transition flex items-center gap-3";
            btnTarget.innerHTML = `<i class="fa-solid fa-car-tunnel w-5 text-center text-amber-500"></i> นำไปใส่ช่อง "กำหนดซ่อมเสร็จ"`;
        }
    }

    if (btnDelivery) {
        if (isDeliveryFull) {
            btnDelivery.disabled = true;
            btnDelivery.className = "w-full text-left px-4 py-3 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl shadow-none cursor-not-allowed flex items-center gap-3";
            btnDelivery.innerHTML = `<i class="fa-solid fa-lock w-5 text-center text-rose-400"></i> คิว "ส่งมอบรถลูกค้า" เต็มแล้ว`;
        } else {
            btnDelivery.disabled = false;
            btnDelivery.className = "w-full text-left px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold rounded-xl shadow-sm transition flex items-center gap-3";
            btnDelivery.innerHTML = `<i class="fa-solid fa-key w-5 text-center text-indigo-500"></i> นำไปใส่ช่อง "ส่งมอบรถลูกค้า"`;
        }
    }

    const dsModal = document.getElementById('dateSelectorModal');
    if (dsModal) dsModal.classList.remove('hidden');
}

function applySelectedDateToField(fieldId) {
    const tempDateInp = document.getElementById('ds_temp_date_val');
    if (tempDateInp) {
        applySelectedDateToFieldDirect(tempDateInp.value, fieldId);
    }
    closeModal('dateSelectorModal');
}

function closeModal(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden'); 
}

let dateInputTimer = null;
document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('change', function(e) {
        if (e.target.id === 'arrived_date' || e.target.id === 'target_finish_date' || e.target.id === 'delivery_date') {
            e.target.classList.add('opacity-50'); 
            clearTimeout(dateInputTimer);
            dateInputTimer = setTimeout(() => {
                e.target.classList.remove('opacity-50');
            }, 200);
        }
    });
});