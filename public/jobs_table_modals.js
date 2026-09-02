// ==========================================
// 🪟 RIZENIC - Jobs Table Modals (Popups & PDI)
// ==========================================

let bulkRowCounter = 0;

// ------------------------------------------
// 📦 1. Modal เลือกรายการอะไหล่หลายรายการ
// ------------------------------------------
function openMultiPartsModal(jobId, fieldName, currentVal, isBulk = false, rowId = null) {
    isBulkModalMode = isBulk;
    activeBulkRowId = rowId;
    activeJobIdForParts = jobId; 
    activeFieldForParts = fieldName;
    
    document.getElementById('modal_parts_field_title').innerText = fieldName === 'main_part_name' ? 'อะไหล่หลัก' : 'อะไหล่รอง';
    selectedPartsSet.clear();
    
    if (currentVal && typeof currentVal === 'string') {
        currentVal.split(',').forEach(p => { 
            const trimmed = p.trim(); 
            if(trimmed) selectedPartsSet.add(trimmed); 
        });
    }
    
    renderPartsModalCheckboxes();
    document.getElementById('parts_modal_search').value = '';
    document.getElementById('parts_custom_add').value = '';
    document.getElementById('partsSelectModal').classList.replace('hidden', 'flex');
}

function closePartsSelectModal() { 
    document.getElementById('partsSelectModal').classList.replace('flex', 'hidden'); 
}

function renderPartsModalCheckboxes() {
    const container = document.getElementById('parts_modal_checkbox_container'); 
    let html = '';
    const masterList = allMasterParts.map(p => p.part_name);
    const combinedList = Array.from(new Set([...masterList, ...Array.from(selectedPartsSet)])).sort();

    combinedList.forEach(partName => {
        const isChecked = selectedPartsSet.has(partName);
        html += `
            <label class="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer border border-slate-200 rounded part-item-row transition">
                <input type="checkbox" value="${partName}" ${isChecked ? 'checked' : ''} onchange="togglePartModalItem('${partName}', this.checked)" class="w-4 h-4 accent-[#00320D] rounded cursor-pointer">
                <span class="text-xs font-medium text-slate-800 flex-1">${partName}</span>
            </label>
        `;
    });
    
    container.innerHTML = html || '<div class="text-center py-4 text-slate-400 text-xs">ไม่พบรายการอะไหล่</div>';
    updateSelectedPartsCount();
}

function togglePartModalItem(partName, isChecked) {
    if (isChecked) selectedPartsSet.add(partName); 
    else selectedPartsSet.delete(partName);
    updateSelectedPartsCount();
}

function addCustomPartToSelection() {
    const customInput = document.getElementById('parts_custom_add'); 
    const val = customInput.value.trim();
    if (val) { 
        selectedPartsSet.add(val); 
        customInput.value = ''; 
        renderPartsModalCheckboxes(); 
        showToast(`เพิ่ม '${val}' แล้ว`); 
    }
}

function filterPartsModalList() {
    const txt = document.getElementById('parts_modal_search').value.toLowerCase();
    document.querySelectorAll('#parts_modal_checkbox_container .part-item-row').forEach(row => { 
        row.style.display = row.innerText.toLowerCase().includes(txt) ? 'flex' : 'none'; 
    });
}

function updateSelectedPartsCount() { 
    document.getElementById('parts_modal_selected_count').innerText = selectedPartsSet.size; 
}

async function confirmPartsSelection() {
    const partsArray = Array.from(selectedPartsSet);
    const joinedPartsStr = partsArray.join(', ');
    const partsCount = partsArray.length;
    
    if (isBulkModalMode) {
        const qtyFieldKey = activeFieldForParts === 'main_part_name' ? 'main_part_qty' : 'sub_part_qty';
        const inputName = document.querySelector(`.bulk-row[data-row-id="${activeBulkRowId}"] .bulk-input-${activeFieldForParts}`);
        const inputQty = document.querySelector(`.bulk-row[data-row-id="${activeBulkRowId}"] .bulk-input-${qtyFieldKey}`);
        
        if(inputName) inputName.value = joinedPartsStr;
        if(inputQty) inputQty.value = partsCount;
    } else {
        const qtyField = activeFieldForParts === 'main_part_name' ? 'main_part_qty' : 'sub_part_qty';
        await fastUpdateJob(activeJobIdForParts, activeFieldForParts, joinedPartsStr, true);
        await fastUpdateJob(activeJobIdForParts, qtyField, partsCount, false);
    }
    
    closePartsSelectModal();
}

// ------------------------------------------
// ⚡ 2. Modal นำเข้าข้อมูลด่วน (PDI / Bulk Import)
// ------------------------------------------
function openBulkModal() {
    // 🌟 ดักไม่เอา Action และ สถานีที่คำนวณอัตโนมัติ
    const pdiCols = columnsDef.filter(c => c.key !== 'action' && c.key !== 'calculated_station'); 
    
    let thHtml = '<th class="w-10 min-w-[40px] text-center bg-[#00320D] text-white border-b border-[#1e3a1e] sticky left-0 z-20">#</th>';
    pdiCols.forEach(c => {
        thHtml += `<th class="min-w-[150px] px-2 bg-[#00320D] text-white border-b border-[#1e3a1e]">${c.title} <button type="button" onclick="copyDown('${c.key}')" class="text-amber-400 hover:text-white ml-1 transition" title="คัดลอกลงด้านล่าง"><i class="fa-solid fa-arrow-down"></i></button></th>`;
    });
    
    document.getElementById('bulk_table_head_tr').innerHTML = thHtml; 
    document.getElementById('bulk_table_body').innerHTML = ''; 
    
    for(let i=0; i<10; i++) addBulkRow(); 
    document.getElementById('bulkModal').classList.replace('hidden', 'flex');
}

function closeBulkModal() { 
    document.getElementById('bulkModal').classList.replace('flex', 'hidden'); 
}

function addBulkRow(rowData = null) {
    const tbody = document.getElementById('bulk_table_body'); 
    bulkRowCounter++;
    const rowId = `bulk_row_${bulkRowCounter}`;
    const tr = document.createElement('tr'); 
    tr.className = `bulk-row hover:bg-amber-50/30 transition-colors`;
    tr.setAttribute('data-row-id', rowId);
    
    let tdHtml = `<td class="text-center text-xs text-slate-400 font-mono bg-slate-50 border-r border-slate-200 p-0 sticky left-0 z-10">${tbody.children.length + 1}</td>`;
    
    let saOptions = '<option value="">-- ระบุ SA --</option>';
    const branchSAs = getSAsForCurrentBranch();
    if (branchSAs.length > 0) {
        saOptions += branchSAs.map(sa => `<option value="${sa}">${sa}</option>`).join('');
    }

    let custTypeOptions = '<option value="">-- เลือก --</option>';
    allCustomerTypes.forEach(c => custTypeOptions += `<option value="${c.type_name}">${c.type_name}</option>`);

    let paymentOptions = '<option value="">-- เลือก --</option>';
    allInsurances.forEach(i => paymentOptions += `<option value="${i.insurance_name}">${i.insurance_name}</option>`);

    let statusOptions = '<option value="">-- เลือก --</option>';
    globalStatuses.forEach(s => statusOptions += `<option value="${s.status_name}">${s.status_name}</option>`);

    let branchOptions = '<option value="">-- เลือก --</option>';
    if (['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole)) {
        const branches = ['สำนักงานใหญ่', 'สาขารามอินทรา', 'สาขาบางนา']; 
        branches.forEach(b => branchOptions += `<option value="${b}">${b}</option>`);
    } else {
        branchOptions = `<option value="${userBranch}" selected>${userBranch}</option>`;
    }

    columnsDef.filter(c => c.key !== 'action' && c.key !== 'calculated_station').forEach(c => {
        const val = rowData ? (rowData[c.title] || '') : '';
        
        if (c.key.includes('date')) {
            if (['arrived_date', 'target_finish_date', 'delivery_date'].includes(c.key)) {
                tdHtml += `<td class="p-0 border-r border-slate-200"><div class="flex items-center justify-between w-full h-full bg-white">
                    <input type="date" id="bulk_date_${rowId}_${c.key}" class="bulk-input bulk-input-${c.key} text-center font-mono" style="width:calc(100% - 24px);" value="${val ? new Date(val).toISOString().split('T')[0] : ''}">
                    <button type="button" onclick="openScheduleCalendarBulk('${rowId}', '${c.key}')" class="text-blue-500 hover:text-blue-700 flex items-center justify-center w-6 h-full border-l border-slate-200 bg-slate-50 transition-colors"><i class="fa-solid fa-calendar-check text-[10px]"></i></button>
                </div></td>`;
            } else {
                tdHtml += `<td class="p-0 border-r border-slate-200"><input type="date" class="bulk-input bulk-input-${c.key} text-center font-mono" value="${val ? new Date(val).toISOString().split('T')[0] : ''}"></td>`;
            }
        } 
        else if (c.key === 'sa_owner') {
            let currentSaOpts = saOptions;
            if(val && !branchSAs.includes(val)) {
                currentSaOpts += `<option value="${val}" selected>${val}</option>`;
            } else if (val) {
                currentSaOpts = currentSaOpts.replace(`value="${val}"`, `value="${val}" selected`);
            }
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} font-bold text-blue-700 cursor-pointer">${currentSaOpts}</select></td>`;
        }
        else if (c.key === 'customer_type') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer">${custTypeOptions}</select></td>`;
        }
        else if (c.key === 'payment_type') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer">${paymentOptions}</select></td>`;
        }
        else if (c.key === 'job_status') {
            let opts = statusOptions.replace(`value="09.จอดรอเข้าซ่อม"`, `value="09.จอดรอเข้าซ่อม" selected`);
            if(val) opts = statusOptions.replace(`value="${val}"`, `value="${val}" selected`);
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} font-bold text-blue-700 cursor-pointer">${opts}</select></td>`;
        }
        else if (c.key === 'branch_name') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer">${branchOptions}</select></td>`;
        }
        else if (c.key === 'damage_level') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><select class="bulk-input bulk-input-${c.key} cursor-pointer font-bold"><option value="เบา" ${val==='เบา'?'selected':''}>เบา</option><option value="กลาง" ${val==='กลาง'?'selected':''}>กลาง</option><option value="หนัก" ${val==='หนัก'?'selected':''}>หนัก</option></select></td>`;
        }
        else if (c.key === 'car_brand') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" list="dl_car_brands" class="bulk-input bulk-input-${c.key} font-bold text-slate-800" placeholder="${c.title}" value="${val}"></td>`;
        }
        else if (c.key === 'car_model') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" list="dl_car_models" class="bulk-input bulk-input-${c.key} text-slate-700 font-medium" placeholder="${c.title}" value="${val}"></td>`;
        }
        else if (c.key === 'main_part_name' || c.key === 'sub_part_name') {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" readonly onclick="openMultiPartsModal(null, '${c.key}', this.value, true, '${rowId}')" class="bulk-input bulk-input-${c.key} cursor-pointer bg-slate-50 text-blue-700 font-bold hover:bg-slate-100" placeholder="คลิกเพื่อเลือกชิ้นส่วน..." value="${val}"></td>`;
        }
        else if (c.key === 'main_part_qty' || c.key === 'sub_part_qty') {
            tdHtml += `<td class="p-0 border-r border-slate-200 bg-slate-100"><input type="text" readonly class="bulk-input bulk-input-${c.key} text-center font-black text-slate-500 pointer-events-none" placeholder="0" value="${val}"></td>`;
        }
        else {
            tdHtml += `<td class="p-0 border-r border-slate-200"><input type="text" class="bulk-input bulk-input-${c.key} ${c.key==='car_plate'?'font-black text-blue-700 uppercase bg-amber-50/30':''}" placeholder="${c.title}" value="${val}"></td>`;
        }
    });
    tr.innerHTML = tdHtml; 
    tbody.appendChild(tr);

    if(!rowData) {
        const saInp = tr.querySelector('.bulk-input-sa_owner');
        const empName = sessionStorage.getItem('emp_name');
        if(saInp && empName && branchSAs.includes(empName)) {
            saInp.value = empName;
        }
        const branchInp = tr.querySelector('.bulk-input-branch_name');
        if(branchInp && userRole !== 'Manager' && userRole !== 'Admin') branchInp.value = userBranch;
    }
}

function downloadExcelTemplate() {
    let row = {}; 
    columnsDef.filter(c => c.key !== 'action' && c.key !== 'calculated_station').forEach(c => { row[c.title] = ''; });
    row['ทะเบียนรถ'] = 'กข 1234'; 
    row['ยี่ห้อรถ'] = 'Tesla'; 
    row['รุ่นรถ'] = 'Model 3'; 
    row['สถานะงาน'] = '09.จอดรอเข้าซ่อม';
    
    const ws = XLSX.utils.json_to_sheet([row]); 
    const wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, "PDI_Full_Template"); 
    XLSX.writeFile(wb, "RIZENIC_PDI_Full_Template.xlsx");
}

function handleExcelUpload(event) {
    const file = event.target.files[0]; 
    if (!file) return; 
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const jsonData = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).Sheets[XLSX.read(new Uint8Array(e.target.result), {type: 'array'}).SheetNames[0]], {raw: false});
            if(jsonData.length > 0) { 
                document.getElementById('bulk_table_body').innerHTML = ''; 
                jsonData.forEach(row => addBulkRow(row)); 
                alert(`✅ โหลดข้อมูลสำเร็จ ${jsonData.length} คัน`); 
            }
        } catch(err) { 
            alert('❌ รูปแบบไฟล์ไม่ถูกต้อง'); 
        } 
        document.getElementById('excel_upload').value = '';
    }; 
    reader.readAsArrayBuffer(file);
}

function copyDown(fieldKey) {
    const inputs = document.querySelectorAll(`.bulk-input-${fieldKey}`); 
    if(inputs.length === 0) return; 
    const topValue = inputs[0].value; 
    
    for(let i = 1; i < inputs.length; i++) { 
        inputs[i].value = topValue; 
        inputs[i].classList.add('bg-green-100', 'transition-colors'); 
        setTimeout(() => inputs[i].classList.remove('bg-green-100'), 500); 
    }
}

async function saveBulkData() {
    const rows = document.querySelectorAll('.bulk-row'); 
    let promises = []; 
    const pdiCols = columnsDef.filter(c => c.key !== 'action' && c.key !== 'calculated_station');
    
    const btn = document.getElementById('btn_save_bulk'); 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบข้อมูล...'; 
    btn.disabled = true;
    
    try {
        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        const allJobs = await resJobs.json();
        const allQuotas = await resQuotas.json();

        let hasError = false;

        rows.forEach(row => {
            if (hasError) return;
            const plateInput = row.querySelector('.bulk-input-car_plate'); 
            if(!plateInput || !plateInput.value.trim()) return; 
            
            let payload = {};
            pdiCols.forEach(c => { 
                const inp = row.querySelector(`.bulk-input-${c.key}`); 
                if (inp && inp.value !== '') { payload[c.key] = inp.value; } 
            });
            
            if (!payload.branch_name) payload.branch_name = userBranch;
            if (!payload.job_status) payload.job_status = '09.จอดรอเข้าซ่อม'; 
            if (!payload.damage_level) payload.damage_level = 'เบา'; 
            
            payload.main_part_qty = parseInt(payload.main_part_qty) || 0;
            payload.sub_part_qty = parseInt(payload.sub_part_qty) || 0;

            if (payload.arrived_date) {
                const dateVal = String(payload.arrived_date).split('T')[0];
                const branchQuotas = allQuotas.filter(q => q.branch_name === payload.branch_name);
                const specialQ = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === dateVal);
                const defaultQ = branchQuotas.find(q => q.quota_type === 'default');
                const maxCars = specialQ && specialQ.quota_cars !== undefined ? parseInt(specialQ.quota_cars) : (defaultQ ? parseInt(defaultQ.quota_cars) : 0);
                if (maxCars > 0) {
                    const jobsInDay = allJobs.filter(j => j.branch_name === payload.branch_name && j.arrived_date && j.arrived_date.split('T')[0] === dateVal);
                    if (jobsInDay.length + 1 > maxCars) {
                        alert(`❌ ทะเบียน ${payload.car_plate}: โควต้ารถเข้าจอดในวันที่ ${formatToThaiDate(dateVal)} เต็มแล้ว!`);
                        hasError = true; return;
                    }
                }
            }
            
            if (payload.target_finish_date) {
                const dateVal = String(payload.target_finish_date).split('T')[0];
                const branchQuotas = allQuotas.filter(q => q.branch_name === payload.branch_name);
                const specialQ = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && q.quota_date.split('T')[0] === dateVal);
                const defaultQ = branchQuotas.find(q => q.quota_type === 'default');
                const maxMain = specialQ ? parseInt(specialQ.quota_main_parts||0) : (defaultQ ? parseInt(defaultQ.quota_main_parts||0) : 0);
                const maxSub = specialQ ? parseInt(specialQ.quota_sub_parts||0) : (defaultQ ? parseInt(defaultQ.quota_sub_parts||0) : 0);

                const jobsInDay = allJobs.filter(j => j.branch_name === payload.branch_name && j.target_finish_date && j.target_finish_date.split('T')[0] === dateVal);
                let usedMain = 0; let usedSub = 0;
                jobsInDay.forEach(j => { usedMain += parseInt(j.main_part_qty)||0; usedSub += parseInt(j.sub_part_qty)||0; });

                if (maxMain > 0 && (usedMain + payload.main_part_qty) > maxMain) {
                    alert(`❌ ทะเบียน ${payload.car_plate}: กำลังผลิตชิ้นส่วนหลักวันที่ ${formatToThaiDate(dateVal)} เต็มแล้ว!`); 
                    hasError = true; return;
                }
                if (maxSub > 0 && (usedSub + payload.sub_part_qty) > maxSub) {
                    alert(`❌ ทะเบียน ${payload.car_plate}: กำลังผลิตชิ้นส่วนรองวันที่ ${formatToThaiDate(dateVal)} เต็มแล้ว!`); 
                    hasError = true; return;
                }
            }

            promises.push(fetch(`${API_BASE_URL}/api/report`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }));
        });
        
        if (hasError) {
            btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลเข้าฐานข้อมูล'; btn.disabled = false;
            return;
        }

        if(promises.length === 0) {
            alert('⚠️ กรุณากรอกข้อมูลอย่างน้อย 1 คัน (ต้องระบุทะเบียนรถ)'); 
            btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลเข้าฐานข้อมูล'; btn.disabled = false;
            return;
        }
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกข้อมูล...';
        await Promise.all(promises); 
        alert(`🎉 นำเข้าสำเร็จ ${promises.length} คัน!`); 
        closeBulkModal(); 
        
        if(typeof loadJobsData === 'function') loadJobsData(); 
    } catch(e) { 
        alert('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล'); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-save"></i> บันทึกข้อมูลเข้าฐานข้อมูล'; 
        btn.disabled = false; 
    }
}

// ------------------------------------------
// 📅 3. Modal ปฏิทินเช็คโควต้า
// ------------------------------------------
async function openScheduleCalendar(jobId, field) {
    currentTargetJobId = jobId;
    currentTargetField = field;
    isBulkCalendarMode = false;
    await _openScheduleCalendar(field, jobId);
}

async function openScheduleCalendarBulk(rowId, field) {
    currentTargetBulkRowId = rowId;
    currentTargetField = field;
    isBulkCalendarMode = true;
    await _openScheduleCalendar(field, null);
}

async function _openScheduleCalendar(field, jobId) {
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
    if (titleEl) titleEl.innerText = titles[field] || 'ตารางโควต้า';

    try {
        const b = userBranch || 'สำนักงานใหญ่';

        const [resJobs, resQuotas] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/quotas`)
        ]);
        
        const rawJobs = await resJobs.json();
        allSchedJobs = Array.isArray(rawJobs) ? rawJobs.filter(j => j.branch_name === b && String(j.id) !== String(jobId)) : [];
        
        const rawQuotas = await resQuotas.json();
        allSchedQuotas = Array.isArray(rawQuotas) ? rawQuotas.filter(q => q.branch_name === b) : [];
        
        renderSchedCalendar();
    } catch (e) { 
        console.error(e); 
        alert('ไม่สามารถดึงข้อมูลตารางโควต้าได้');
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

        if (arrD) { if(!dailyData[arrD]) dailyData[arrD] = {a:0, t:0, d:0, m:0, s:0}; dailyData[arrD].a++; }
        if (tgtD) { 
            if(!dailyData[tgtD]) dailyData[tgtD] = {a:0, t:0, d:0, m:0, s:0}; 
            dailyData[tgtD].t++; 
            dailyData[tgtD].m += parseInt(j.main_part_qty) || 0; 
            dailyData[tgtD].s += parseInt(j.sub_part_qty) || 0; 
        }
        if (delD) { if(!dailyData[delD]) dailyData[delD] = {a:0, t:0, d:0, m:0, s:0}; dailyData[delD].d++; }
    });

    let htmlBuffer = '';
    for(let i = 0; i < firstDay; i++) { htmlBuffer += `<div class="bg-transparent rounded-xl"></div>`; }

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

        if (isCurrentFieldFull) {
            cellClass += 'bg-slate-50 border-rose-200 opacity-60 cursor-not-allowed grayscale';
            clickAction = `onclick="alert('❌ โควต้าของวันที่นี้เต็มแล้ว ไม่สามารถเลือกได้ครับ!')"`;
            lockIcon = '<i class="fa-solid fa-lock text-rose-500 text-[10px]" title="คิวเต็มแล้ว"></i>';
        } else {
            cellClass += 'hover:border-blue-500 cursor-pointer hover:shadow-md hover:-translate-y-1 bg-white';
            if (currentTargetField !== 'all') {
                clickAction = `onclick="applySelectedDateToFieldDirect('${dateStr}')"`;
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

function applySelectedDateToFieldDirect(dateStr) {
    closeModal('scheduleCalendarModal');
    
    let inputField;
    if (isBulkCalendarMode) {
        inputField = document.getElementById(`bulk_date_${currentTargetBulkRowId}_${currentTargetField}`);
    } else {
        inputField = document.getElementById(`date_${currentTargetJobId}_${currentTargetField}`);
    }

    if (inputField) {
        inputField.value = dateStr;
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        inputField.classList.add('bg-emerald-100');
        setTimeout(() => inputField.classList.remove('bg-emerald-100'), 1000);
        
        // ถ้าเป็นแบบเดี่ยว ให้ยิง API บันทึกทันที
        if (!isBulkCalendarMode && typeof fastUpdateJob === 'function') {
            fastUpdateJob(currentTargetJobId, currentTargetField, dateStr);
        }
    }
}

function closeModal(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden'); 
}