const API_BASE_URL = window.location.origin;
let globalCarData = [];
let globalStatuses = [];
let currentEditingJob = null; 

let repairBodyPartsList = { main: [], sub: [] };
let selectedBodyParts = { main: [], sub: [] };

document.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isLoggedIn') !== 'true') {
        const loginScr = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        if (loginScr) loginScr.classList.remove('hidden');
        if (mainApp) mainApp.classList.add('hidden');
        return;
    }
    
    // 🚗 ระบบเปลี่ยนสถานะจอดซ่อมอัตโนมัติตาม Job Status
    const jobStatusInput = document.getElementById('job_status');
    const isParkedInput = document.getElementById('park_status');

    if (jobStatusInput && isParkedInput) {
        jobStatusInput.addEventListener('change', function() {
            const statusValue = this.value;
            const parkedStatuses = [
                '09.จอดรอเข้าซ่อม',
                '10.กำลังซ่อม',
                '11.รถซ่อมเสร็จรอส่งมอบ',
                '12.ส่งมอบ',
                '22.ปิดงาน',
                '23.รื้อตรวจสอบความเสียหาย'
            ];

            const shouldBeParked = parkedStatuses.some(s => statusValue.includes(s));
            if (shouldBeParked) {
                isParkedInput.value = 'จอดซ่อม';
            } else {
                isParkedInput.value = 'ไม่จอดซ่อม';
            }
        });
    }

    enterApp();
});

function logout() {
    sessionStorage.clear();
    window.location.reload();
}

function formatToThaiDate(isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
}

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
    
    updateTargetDateSuggestion(); 
}

async function handleLogin(e) {
    e.preventDefault();
    const userEl = document.getElementById('login_user');
    const passEl = document.getElementById('login_pass');
    
    if (!userEl || !passEl) return alert('❌ ไม่พบช่องกรอกข้อมูล');

    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ username: userEl.value, password: passEl.value }) 
        });
        const data = await res.json();
        
        if (data.success) {
            const emp = data.employee || {};
            sessionStorage.setItem('isLoggedIn', 'true'); 
            sessionStorage.setItem('emp_name', emp.employee_name || userEl.value);
            sessionStorage.setItem('emp_role', emp.employee_role || 'SA'); 
            sessionStorage.setItem('emp_branch', emp.branch_name || 'สำนักงานใหญ่');
            
            const defaultAccess = 'dashboard,jobs,jobs_table,repair,parts,finance,admin,audit,history,index';
            sessionStorage.setItem('accessible_pages', emp.accessible_pages || defaultAccess);
            
            enterApp(); 
        } else {
            alert('❌ ' + (data.error || 'เข้าสู่ระบบไม่สำเร็จ'));
        }
    } catch (err) { 
        console.error("Login Error:", err);
        alert('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); 
    }
}

async function enterApp() {
    const loginScr = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    
    if (loginScr) loginScr.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    
    let currentAccess = sessionStorage.getItem('accessible_pages');
    if (!currentAccess || currentAccess.trim() === '') {
        sessionStorage.setItem('accessible_pages', 'dashboard,jobs,jobs_table,repair,parts,finance,admin,audit,history,index');
    }
    
    const empNameEl = document.getElementById('display_emp_name');
    const branchEl = document.getElementById('display_branch');
    const saOwnerInp = document.getElementById('sa_owner_input');
    const contactDateInp = document.getElementById('contact_date');

    if (empNameEl) empNameEl.innerText = sessionStorage.getItem('emp_name') || 'Admin Test';
    if (branchEl) branchEl.innerText = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
    if (saOwnerInp) saOwnerInp.value = sessionStorage.getItem('emp_name') || '';
    if (contactDateInp) contactDateInp.value = new Date().toISOString().split('T')[0];
    
    try {
        if (typeof selectDamage === 'function') selectDamage('เบา'); 
        await loadInitialData(); 
        if (typeof buildPartDatalist === 'function') buildPartDatalist();
        if (typeof checkCrossPageEditMode === 'function') await checkCrossPageEditMode();
    } catch (err) {
        console.error("enterApp Processing Error:", err);
    }
}

async function loadInitialData() {
    try {
        const results = await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/employees`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/statuses`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/customer-types`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/car-models`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/insurances`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/body-parts`).then(r => r.json()),
            fetch(`${API_BASE_URL}/api/part-orders`).then(r => r.json())
        ]);

        if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
            const data = results[0].value;
            const saList = document.getElementById('sa_list');
            if (saList) {
                saList.innerHTML = '';
                const userBranch = sessionStorage.getItem('emp_branch') || 'สำนักงานใหญ่';
                const branchSAs = data.filter(e => e && e.branch_name === userBranch && String(e.employee_role || '').toUpperCase().includes('SA'));
                const uniqueSAs = [...new Set(branchSAs.map(e => e.employee_name).filter(Boolean))].sort();
                uniqueSAs.forEach(name => { saList.innerHTML += `<option value="${name}">`; });
            }
        }

        if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
            globalStatuses = results[1].value;
            const statusSelect = document.getElementById('job_status');
            if (statusSelect) {
                statusSelect.innerHTML = '<option value="">-- เลือกสถานะใบงาน --</option>' + 
                    globalStatuses.map(item => `<option value="${item.status_name}">${item.status_name}</option>`).join('');
            }
        }

        if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) {
            let listEl = document.getElementById('customer_type_list');
            if (listEl) {
                listEl.innerHTML = results[2].value.map(item => `<option value="${item.type_name}">`).join('');
            }
        }

        if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) {
            globalCarData = results[3].value; 
            const uniqueBrands = [...new Set(globalCarData.map(car => car.car_brand).filter(Boolean))];
            const brandList = document.getElementById('brand_list'); 
            if (brandList) {
                brandList.innerHTML = '';
                uniqueBrands.forEach(brand => brandList.innerHTML += `<option value="${brand}">`);
            }
            updateCarModels('Tesla'); 
        }

        if (results[4].status === 'fulfilled' && Array.isArray(results[4].value)) {
            let listEl = document.getElementById('payment_type_list');
            if (listEl) {
                listEl.innerHTML = results[4].value.map(item => `<option value="${item.insurance_name}">`).join('');
            }
        }

        if (results[5].status === 'fulfilled' && Array.isArray(results[5].value)) {
            const data = results[5].value;
            repairBodyPartsList.main = data.filter(p => p && p.category === 'ชิ้นส่วนหลัก').map(p => p.part_name);
            repairBodyPartsList.sub = data.filter(p => p && p.category === 'ชิ้นส่วนรอง').map(p => p.part_name);
            if (typeof renderBodyPartsUI === 'function') renderBodyPartsUI();
        }

        if (results[6].status === 'fulfilled' && Array.isArray(results[6].value)) {
            window.allPartOrders = results[6].value;
        } else {
            window.allPartOrders = [];
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
    updateTargetDateSuggestion(); 
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

window.addPipelineRow = function(claim = '', qt = '', so = '', bl = '') {
    const container = document.getElementById('doc_pipeline_container');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = "pipeline-set relative bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm transition-all hover:border-blue-300";
    
    div.innerHTML = `
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <span class="text-xs font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                <i class="fa-solid fa-folder-tree mr-1"></i> ชุดเอกสารที่ <span class="row-num">1</span>
            </span>
            <button type="button" onclick="this.closest('.pipeline-set').remove(); updatePipelineNumbers();" class="text-slate-300 hover:text-red-500 transition px-2 py-1 text-xs font-bold" title="ลบชุดนี้">
                <i class="fa-solid fa-trash mr-1"></i> ลบชุดนี้
            </button>
        </div>

        <div class="flex flex-col md:flex-row items-stretch justify-between gap-4 relative">
            <div class="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-1 bg-slate-200 -z-10 -translate-y-1/2 rounded-full"></div>

            <div class="flex-1 bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-sm relative z-0 flex flex-col items-center text-center group hover:border-indigo-400 transition-colors">
                <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black mb-3 border-2 border-indigo-300 group-hover:scale-110 transition-transform">1</div>
                <label class="label-text text-indigo-800 text-[10px]">เลขที่ เคลม/รับแจ้ง</label>
                <input type="text" class="pipe-claim w-full mt-1 text-center font-mono font-black text-indigo-700 border-b-2 border-indigo-200 focus:border-indigo-500 outline-none bg-transparent py-1 uppercase" placeholder="ระบุเลขที่..." value="${claim}">
            </div>

            <i class="fa-solid fa-chevron-right text-slate-300 md:self-center hidden md:block text-xl"></i>
            <i class="fa-solid fa-chevron-down text-slate-300 self-center md:hidden text-xl"></i>

            <div class="flex-1 bg-white p-4 rounded-xl border-2 border-emerald-200 shadow-sm relative z-0 flex flex-col items-center text-center group hover:border-emerald-400 transition-colors">
                <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black mb-3 border-2 border-emerald-300 group-hover:scale-110 transition-transform">2</div>
                <label class="label-text text-emerald-800 text-[10px]">ใบเสนอราคา (QT)</label>
                <input type="text" class="pipe-qt w-full mt-1 text-center font-mono font-black text-emerald-700 border-b-2 border-emerald-200 focus:border-emerald-500 outline-none bg-transparent py-1 uppercase" placeholder="ระบุเลขที่..." value="${qt}">
            </div>

            <i class="fa-solid fa-chevron-right text-slate-300 md:self-center hidden md:block text-xl"></i>
            <i class="fa-solid fa-chevron-down text-slate-300 self-center md:hidden text-xl"></i>

            <div class="flex-1 bg-white p-4 rounded-xl border-2 border-amber-200 shadow-sm relative z-0 flex flex-col items-center text-center group hover:border-amber-400 transition-colors">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black mb-3 border-2 border-amber-300 group-hover:scale-110 transition-transform">3</div>
                <label class="label-text text-amber-800 text-[10px]">ใบสั่งซ่อม (SO)</label>
                <input type="text" class="pipe-so w-full mt-1 text-center font-mono font-black text-amber-700 border-b-2 border-amber-200 focus:border-amber-500 outline-none bg-transparent py-1 uppercase" placeholder="ระบุเลขที่..." value="${so}">
            </div>

            <i class="fa-solid fa-chevron-right text-slate-300 md:self-center hidden md:block text-xl"></i>
            <i class="fa-solid fa-chevron-down text-slate-300 self-center md:hidden text-xl"></i>

            <div class="flex-1 bg-slate-50 p-4 rounded-xl border-2 border-slate-200 shadow-inner relative z-0 flex flex-col items-center text-center opacity-80">
                <div class="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-black mb-3 border-2 border-slate-300"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                <label class="label-text text-slate-600 text-[10px]">ใบวางบิล / แจ้งหนี้ (BL)</label>
                <div class="w-full mt-1 flex flex-col items-center justify-center">
                    <input type="text" class="pipe-bl w-full text-center font-mono font-bold text-slate-500 bg-transparent border-none outline-none py-1" placeholder="-" value="${bl}" readonly title="รอแผนกบัญชีดำเนินการ">
                    <span class="text-[9px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full mt-1">ส่วนของบัญชี</span>
                </div>
            </div>
        </div>
    `;
    container.appendChild(div);
    updatePipelineNumbers();
};

function updatePipelineNumbers() {
    document.querySelectorAll('.pipeline-set').forEach((row, index) => {
        const numEl = row.querySelector('.row-num');
        if(numEl) numEl.innerText = index + 1;
    });
}

function addDocRow(type = 'QT', val = '') {
    console.log("addDocRow is deprecated. Using new Document Pipeline UI.");
}

async function checkCrossPageEditMode() {
    const idToEdit = sessionStorage.getItem('edit_job_id'); 
    const orderPartsBody = document.getElementById('order_parts_body');
    const container = document.getElementById('doc_pipeline_container');

    if(!idToEdit) {
        if (container) { container.innerHTML = ''; addPipelineRow(); }
        if(orderPartsBody && orderPartsBody.children.length === 0 && typeof addPartRow === 'function') addPartRow();
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
            const el = document.getElementById(elementId);
            if (!el) return;
            if (!el.options) { el.value = value; return; }
            const optionExists = Array.from(el.options).some(opt => opt.value === value);
            if (!optionExists) { el.add(new Option(value, value)); }
            el.value = value;
        };

        const custTypeInp = document.getElementById('customer_type');
        if (custTypeInp) custTypeInp.value = job.customer_type || '';

        const payTypeInp = document.getElementById('payment_type');
        if (payTypeInp) payTypeInp.value = job.payment_type || '';

        safeSetSelect('car_model', job.car_model);
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

        if (container) container.innerHTML = '';
        
        const claims = job.claim_no ? job.claim_no.split(',').map(s=>s.trim()) : [];
        const qts = job.qt_no ? job.qt_no.split(',').map(s=>s.trim()) : [];
        const sos = job.so_no ? job.so_no.split(',').map(s=>s.trim()) : [];
        const bls = job.bl_no ? job.bl_no.split(',').map(s=>s.trim()) : [];
        
        const maxLen = Math.max(claims.length, qts.length, sos.length, bls.length, 1);
        for(let i=0; i<maxLen; i++) {
            addPipelineRow(claims[i]||'', qts[i]||'', sos[i]||'', bls[i]||'');
        }

        if (orderPartsBody) orderPartsBody.innerHTML = '';
        if (typeof addPartRow === 'function') addPartRow();

        selectDamage(job.damage_level || 'เบา');
        selectedBodyParts.main = job.main_part_name ? job.main_part_name.split(',').map(s => s.trim()).filter(Boolean) : [];
        selectedBodyParts.sub = job.sub_part_name ? job.sub_part_name.split(',').map(s => s.trim()).filter(Boolean) : [];
        renderBodyPartsUI();

        // 🌟 โหลดรายการประเมินราคา E-Claim เก่ามาแสดง (Line Items) 🌟
        if (typeof loadEclaimItems === 'function') {
            await loadEclaimItems(job.id || idToEdit);
        }

        const stations = ['kho', 'pou', 'puan', 'pon', 'prak', 'kat', 'qc', 'mag', 'kraj', 'film', 'pak', 'ready'];
        stations.forEach(st => {
            const badge = document.getElementById('badge_st_' + st);
            if (badge) {
                if (job[`station_${st}`] === true || job[`station_${st}`] === 'true' || job[`station_${st}`] === 1) {
                    badge.className = 'px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#00320D] text-amber-400 border border-[#00320D] shadow-md transition-all transform scale-105';
                } else {
                    badge.className = 'px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-slate-400 border border-slate-200 shadow-sm transition-all';
                }
            }
        });

        const noteDisplay = document.getElementById('repair_note_display');
        const noteText = document.getElementById('repair_note_text');
        if (job.repair_notes && String(job.repair_notes).trim() !== '') {
            if (noteText) noteText.innerText = job.repair_notes;
            if (noteDisplay) noteDisplay.classList.remove('hidden');
        } else {
            if (noteDisplay) noteDisplay.classList.add('hidden');
            if (noteText) noteText.innerText = '';
        }
        
        const setDateVal = (elemId, isoVal) => {
            const el = document.getElementById(elemId);
            if (el) el.value = isoVal ? String(isoVal).split('T')[0] : '';
        };
        setDateVal('contact_date', job.contact_date);
        setDateVal('arrived_date', job.arrived_date);
        setDateVal('target_finish_date', job.target_finish_date);
        setDateVal('repair_finish_date', job.repair_finish_date);
        setDateVal('delivery_date', job.delivery_date);

        if (job.car_plate && typeof loadPartsTrackingTable === 'function') {
            loadPartsTrackingTable(job.car_plate.trim(), job.id || idToEdit);
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
    const orderPartsBody = document.getElementById('order_parts_body');
    const trackPartsBody = document.getElementById('track_parts_body');
    const container = document.getElementById('doc_pipeline_container');

    if (saForm) saForm.reset(); 
    if (saRepId) saRepId.value = '';
    if (editBadge) editBadge.classList.add('hidden');
    if (btnSubSa) btnSubSa.innerHTML = '<i class="fa-solid fa-save mr-2"></i> บันทึกข้อมูลและดำเนินการ';
    
    if (container) { container.innerHTML = ''; addPipelineRow(); }

    if (orderPartsBody) { orderPartsBody.innerHTML = ''; if(typeof addPartRow === 'function') addPartRow(); }
    if (trackPartsBody) trackPartsBody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs font-bold bg-white">กรุณาบันทึกใบงานเพื่อติดตามสถานะอะไหล่</td></tr>`;
    
    selectedBodyParts.main = [];
    selectedBodyParts.sub = [];
    renderBodyPartsUI();

    // 🌟 เคลียร์ตาราง E-Claim (Line Items) ตอนกดยกเลิก
    const eclaimBody = document.getElementById('eclaim_items_body');
    if (eclaimBody) {
        eclaimBody.innerHTML = '<tr id="eclaim_empty_row"><td colspan="7" class="text-center py-10 text-purple-400 text-xs font-bold bg-purple-50/20">ยังไม่มีรายการ (กดปุ่ม "นำเข้าไฟล์บัญชี" จากด้านบนเพื่อดึงข้อมูลอัตโนมัติ)</td></tr>';
    }

    selectDamage('เบา');

    const stations = ['kho', 'pou', 'puan', 'pon', 'prak', 'kat', 'qc', 'mag', 'kraj', 'film', 'pak', 'ready'];
    stations.forEach(st => {
        const badge = document.getElementById('badge_st_' + st);
        if (badge) {
            badge.className = 'px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-slate-400 border border-slate-200 shadow-sm transition-all';
        }
    });
    const noteDisplay = document.getElementById('repair_note_display');
    if (noteDisplay) noteDisplay.classList.add('hidden');
    
    const deptRoute = document.getElementById('department_routing');
    const parkStat = document.getElementById('park_status');
    const saOwnerInp = document.getElementById('sa_owner_input');

    if (deptRoute) deptRoute.value = 'รอดำเนินการ';
    if (parkStat) parkStat.value = 'ไม่จอดซ่อม';
    if (saOwnerInp) saOwnerInp.value = sessionStorage.getItem('emp_name') || '';
}

async function submitSaForm(event) {
    event.preventDefault(); 
    
    const jobStatusCheck = document.getElementById('job_status')?.value || '';
    const arrivedDateCheck = document.getElementById('arrived_date')?.value || '';

    const mandatoryArrivedStatuses = [
        '09.จอดรอเข้าซ่อม', 
        '10.กำลังซ่อม', 
        '11.รถซ่อมเสร็จรอส่งมอบ', 
        '12.ส่งมอบ', 
        '23.รื้อตรวจสอบความเสียหาย'
    ];

    const requiresArrivedDate = mandatoryArrivedStatuses.some(st => jobStatusCheck.includes(st) || jobStatusCheck === st);

    if (requiresArrivedDate && !arrivedDateCheck) {
        alert(`❌ ไม่สามารถบันทึกได้:\nเมื่อรถอยู่ในสถานะ "${jobStatusCheck}"\nกรุณาระบุ "วันที่รถเข้าจอดอู่" (ในข้อ 7) ให้ครบถ้วนด้วยครับ!`);
        
        const arrInput = document.getElementById('arrived_date');
        if (arrInput) {
            arrInput.focus();
            arrInput.classList.add('ring-4', 'ring-red-500/50', 'border-red-500');
            setTimeout(() => arrInput.classList.remove('ring-4', 'ring-red-500/50', 'border-red-500'), 3000);
        }
        return; 
    }

    let claimArr = [], qtArr = [], soArr = [], blArr = [];
    document.querySelectorAll('.pipeline-set').forEach(row => {
        const claim = row.querySelector('.pipe-claim')?.value?.trim() || '';
        const qt = row.querySelector('.pipe-qt')?.value?.trim() || '';
        const so = row.querySelector('.pipe-so')?.value?.trim() || '';
        const bl = row.querySelector('.pipe-bl')?.value?.trim() || '';
        
        if(claim || qt || so || bl) {
            claimArr.push(claim);
            qtArr.push(qt);
            soArr.push(so);
            blArr.push(bl);
        }
    });

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
        alert(`⚠️ กรุณากรอกข้อมูลบังคับให้ครบถ้วนก่อนบันทึกครับ:\n\n- ` + missingFields.join('\n- ')); 
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

        if(typeof checkQuotaBeforeSubmit === 'function') {
            const quotaCheck = await checkQuotaBeforeSubmit(branchName, arrivedDate, targetFinishDate, deliveryDate, cleanMainParts.length, cleanSubParts.length);
            
            if (quotaCheck !== true) {
                alert(`❌ ไม่สามารถบันทึกได้:\n\n` + quotaCheck + `\n\nกรุณาเลือกวันที่ใหม่ครับ`);
                if (btnSubmit) {
                    btnSubmit.innerHTML = oldBtnText;
                    btnSubmit.disabled = false;
                }
                return;
            }
        }
        
        if (btnSubmit) btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
    }

    const editId = document.getElementById('sa_report_id')?.value || '';
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
    
    formData.claim_no = claimArr.join(', ');
    formData.qt_no = qtArr.join(', '); 
    formData.so_no = soArr.join(', '); 
    formData.bl_no = blArr.join(', ');
    
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
            alert(`❌ บันทึกล้มเหลว:\n\n` + (errData.error || 'โปรดตรวจสอบอีกครั้ง'));
            if (btnSubmit) {
                btnSubmit.innerHTML = editId ? '<i class="fa-solid fa-file-pen"></i> บันทึกอัปเดตใบงานซ่อม' : '<i class="fa-solid fa-save mr-2"></i> บันทึกข้อมูลและดำเนินการ';
                btnSubmit.disabled = false; 
            }
            return;
        }

        const resJson = await response.json();
        const savedJobId = editId || resJson?.insertedId || resJson?.id || null;

        // 🌟 1. บันทึกข้อมูล E-Claim Details (ข้อมูลรายละเอียดรถและประกัน) 🌟
        if (savedJobId) {
            const eclaimDetails = {
                eclaim_province: document.getElementById('eclaim_province')?.value || '',
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
                eclaim_deductible: document.getElementById('eclaim_deductible')?.value || 0
            };

            try {
                await fetch(`${API_BASE_URL}/api/report/${savedJobId}/eclaim-details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(eclaimDetails)
                });
            } catch (err) {
                console.error("Save Eclaim Details Error:", err);
            }

            // 🌟 2. บันทึกรายการย่อย (E-Claim Line Items - จากตาราง Express) 🌟
            await saveEclaimItems(savedJobId);
        }

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
                            report_id: savedJobId,
                            qt_no: formData.qt_no, so_no: formData.so_no, epc_no: null,
                            order_date: new Date().toISOString().split('T')[0], car_plate: formData.car_plate, vin_no: formData.vin_no, car_model: formData.car_model, 
                            part_no: pNo, part_main_no: pMain, part_name: pName, qty_ordered: pQty, part_type: pType, branch_name: formData.branch_name, order_status: 'รอสั่งซื้อ' 
                        })
                    });

                    await fetch(`${API_BASE_URL}/api/part-outbound`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            job_id: savedJobId,
                            report_id: savedJobId,
                            issue_date: new Date().toISOString().split('T')[0],
                            part_no: pNo, part_main_no: pMain || null, part_name: pName, qty: pQty,
                            car_plate: formData.car_plate, qt_no: formData.qt_no || null, so_no: formData.so_no || null,
                            unit_price: 0, car_model: formData.car_model || null,
                            job_status: 'รอเข้าซ่อม', part_type: pType,
                            branch_name: formData.branch_name
                        })
                    }).catch(e => console.warn(e));
                }
            }
        }
        
        if (editId) { 
            alert(`🎉 อัปเดตใบงานเรียบร้อย!`); 
            if(formData.car_plate && typeof loadPartsTrackingTable === 'function') loadPartsTrackingTable(formData.car_plate, savedJobId);
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

function autoMapRouting() {
    const statusVal = document.getElementById('job_status')?.value || '';
    const deptSelect = document.getElementById('department_routing');
    
    if (!statusVal || !deptSelect) return;

    const matchedStatus = globalStatuses.find(s => s.status_name === statusVal);
    let targetDept = "รอดำเนินการ";

    if (matchedStatus && matchedStatus.default_department) {
        targetDept = matchedStatus.default_department;
    } else {
        if (/^(01|02|03|04|05|07|08|12)/.test(statusVal)) {
            targetDept = "บริการ";
        } else if (/^(06)/.test(statusVal)) {
            targetDept = "อะไหล่";
        } else if (/^(09|10|11|20|21)/.test(statusVal)) {
            targetDept = "ซ่อม";
        } else if (/^(13|14|15|16|17|19)/.test(statusVal)) {
            targetDept = "บัญชี";
        }
    }

    deptSelect.value = targetDept;
}

// =========================================================
// 🛒 ระบบจัดการตารางรายการย่อย E-Claim (Line Items)
// =========================================================

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
            <select class="minimal-input !px-2 !py-1 text-xs item-type border-purple-200 font-bold" onchange="toggleEclaimRowType(this)">
                <option value="P" ${iType === 'P' ? 'selected' : ''}>อะไหล่ (P)</option>
                <option value="L" ${iType === 'L' ? 'selected' : ''}>ค่าแรง (L)</option>
            </select>
        </td>
        <td class="px-2 py-2">
            <input type="text" list="master_parts_datalist" class="minimal-input !px-2 !py-1 text-xs item-partno border-purple-200 font-mono uppercase" 
                   value="${iPartNo}" placeholder="รหัส..." onchange="autoFillEclaimPart(this)">
        </td>
        <td class="px-2 py-2">
            <input type="text" class="minimal-input !px-2 !py-1 text-xs item-name border-purple-200 font-bold" value="${iName}" placeholder="ชื่อรายการ..." required>
        </td>
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-2 !py-1 text-xs item-damage border-purple-200 text-center">
                <option value="เบา" ${iDamage === 'เบา' ? 'selected' : ''}>ซ่อมเบา</option>
                <option value="กลาง" ${iDamage === 'กลาง' ? 'selected' : ''}>ซ่อมกลาง</option>
                <option value="หนัก" ${iDamage === 'หนัก' ? 'selected' : ''}>ซ่อมหนัก</option>
                <option value="เปลี่ยน" ${iDamage === 'เปลี่ยน' ? 'selected' : ''}>เปลี่ยน</option>
            </select>
        </td>
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-2 !py-1 text-xs item-ship border-purple-200 text-center">
                <option value="garage" ${iShip === 'garage' ? 'selected' : ''}>ศูนย์จัด</option>
                <option value="ins" ${iShip === 'ins' ? 'selected' : ''}>ประกันจัด</option>
            </select>
        </td>
        <td class="px-2 py-2">
            <input type="number" class="minimal-input !px-1.5 !py-1 text-center text-xs item-qty border-purple-200 font-mono" value="${iQty}" min="1" onkeyup="calcEclaimRow(this)" onchange="calcEclaimRow(this)">
        </td>
        <td class="px-2 py-2">
            <input type="number" step="0.01" class="minimal-input !px-2 !py-1 text-right text-xs item-price border-purple-200 font-mono" value="${iPrice}" min="0" placeholder="0.00" onkeyup="calcEclaimRow(this)" onchange="calcEclaimRow(this)">
        </td>
        <td class="px-2 py-2">
            <input type="number" step="0.01" class="minimal-input !px-1.5 !py-1 text-right text-xs item-discount border-purple-200 font-mono" value="${iDiscount}" min="0" placeholder="0%" onkeyup="calcEclaimRow(this)" onchange="calcEclaimRow(this)">
        </td>
        <td class="px-2 py-2">
            <input type="number" step="0.01" class="minimal-input !px-2 !py-1 text-right text-xs item-total bg-purple-50 font-bold text-purple-900 border-purple-300 font-mono" value="${iTotal}" readonly placeholder="0.00">
        </td>
        <td class="px-2 py-2 text-center">
            <select class="minimal-input !px-1 !py-1 text-xs item-scrap border-purple-200 text-center">
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

// สลับเปิด-ปิดช่องเลือกระหว่าง L และ P
function toggleEclaimRowType(selectEl) {
    const tr = selectEl.closest('tr');
    const type = selectEl.value;
    const damageSelect = tr.querySelector('.item-damage');
    const shipSelect = tr.querySelector('.item-ship');
    const scrapSelect = tr.querySelector('.item-scrap');

    if (type === 'L') {
        damageSelect.disabled = false;
        damageSelect.classList.remove('bg-slate-100', 'text-slate-400');
        
        shipSelect.disabled = true;
        shipSelect.classList.add('bg-slate-100', 'text-slate-400');
        
        scrapSelect.disabled = true;
        scrapSelect.value = '0';
    } else {
        damageSelect.disabled = true;
        damageSelect.classList.add('bg-slate-100', 'text-slate-400');
        
        shipSelect.disabled = false;
        shipSelect.classList.remove('bg-slate-100', 'text-slate-400');
        
        scrapSelect.disabled = false;
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

// =========================================================
// 🚀 ดึงรายการอะไหล่จาก PO เข้าตาราง E-Claim
// =========================================================
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

    // 🎯 ดึงเฉพาะอะไหล่ที่เป็นของ Job ID ปัจจุบัน และยังไม่ถูกยกเลิก
    const currentJobParts = window.allPartOrders.filter(po => 
        (String(po.job_id) === String(editId) || String(po.report_id) === String(editId)) && 
        po.order_status !== 'ยกเลิก'
    );

    if (currentJobParts.length === 0) {
        alert('ไม่พบรายการอะไหล่ในบิลซ่อมนี้ (คุณได้เพิ่มรายการในบล็อก 4 หรือยัง?)');
        return;
    }

    // เคลียร์ตารางเดิมถ้ามีแค่แถวว่าง
    const emptyRow = document.getElementById('eclaim_empty_row');
    if (emptyRow) emptyRow.style.display = 'none';

    // เช็กว่ามีอะไหล่รหัสนี้อยู่แล้วหรือไม่ ถ้ามีจะไม่สร้างซ้ำ
    const existingPartNos = Array.from(document.querySelectorAll('.eclaim-item-row .item-partno')).map(inp => inp.value.trim().toUpperCase());
    let addedCount = 0;

    currentJobParts.forEach(po => {
        const pNo = (po.part_no || '').trim().toUpperCase();
        if (pNo && !existingPartNos.includes(pNo)) {
            // สร้างไอเทมใหม่ส่งไปให้ addEclaimItemRow
            const partItem = {
                item_type: 'P',
                part_no: po.part_no,
                item_name_th: po.part_name || '',
                qty: parseInt(po.qty_ordered) || 1,
                unit_price: 0,
                total_after_discount: 0
            };
            
            addEclaimItemRow(partItem);
            
            // ให้ช่องราคาดึงราคาจาก Master อีกที (ถ้าฟังก์ชัน autoFillEclaimPart ทำงาน)
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

// =========================================================
// 🚗 เช็กประวัติรถเก่าเพื่อดึงข้อมูลลูกค้าอัตโนมัติ (ใส่แทน Onchange เดิม)
// =========================================================
async function checkCarHistory(plateInput) {
    const plate = plateInput.trim().toUpperCase();
    if (!plate) return;

    // 1. เรียกโหลดตาราง PO Tracking ตามปกติ
    if (typeof loadPartsTrackingTable === 'function') {
        loadPartsTrackingTable(plate);
    }

    // 2. ข้ามการเช็กประวัติถ้านี่คือโหมด Edit ใบงานเก่า
    if (document.getElementById('sa_report_id')?.value) return;

    try {
        // ค้นหาประวัติรถเก่าจากฐานข้อมูลรายงาน
        const res = await fetch(`${API_BASE_URL}/api/reports?start=2020-01-01&end=2030-12-31`);
        if (!res.ok) return;
        
        const allReports = await res.json();
        
        // กรองเอาเฉพาะทะเบียนที่ตรงกัน และดึงบิลล่าสุด
        const carHistory = allReports.filter(r => (r.car_plate || '').trim().toUpperCase() === plate)
                                     .sort((a,b) => b.id - a.id);

        if (carHistory.length > 0) {
            const lastJob = carHistory[0];
            
            // แจ้งเตือน SA เบาๆ
            if(typeof showToast === 'function') showToast('เจอประวัติรถเก่า! กำลังดึงข้อมูลลูกค้า...', 'info');

            // หยอดข้อมูลลูกค้า
            const cName = document.getElementById('customer_name');
            const phone = document.getElementById('phone_number');
            const brand = document.getElementById('car_brand');
            const model = document.getElementById('car_model');
            const vin = document.getElementById('vin_no');
            const cType = document.getElementById('customer_type');

            if (cName && !cName.value) cName.value = lastJob.customer_name || '';
            if (phone && !phone.value) phone.value = lastJob.phone_number || '';
            if (brand && !brand.value) {
                brand.value = lastJob.car_brand || '';
                updateCarModels(lastJob.car_brand);
            }
            if (model && !model.value) {
                setTimeout(() => { model.value = lastJob.car_model || ''; }, 500); // รอรุ่นรถโหลดแปปนึง
            }
            if (vin && !vin.value) vin.value = lastJob.vin_no || '';
            if (cType && !cType.value) cType.value = lastJob.customer_type || '';
        }
    } catch (e) {
        console.error("Error checking car history:", e);
    }
}