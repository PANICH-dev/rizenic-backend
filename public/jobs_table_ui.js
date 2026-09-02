// ==========================================
// 🎨 RIZENIC - Jobs Table UI (Table & Filters)
// ==========================================

// ------------------------------------------
// 🛠️ 1. จัดการคอลัมน์ (ยืด-หด, ซ่อน-แสดง, ลากสลับ)
// ------------------------------------------
function initColumns() {
    const thead = document.getElementById('jobs_table_head'); 
    let trHtml = '<tr>';
    
    columnsDef.forEach((col, renderIndex) => {
        let filterIcon = col.key !== 'action' ? `<i class="fa-solid fa-filter filter-icon" onclick="openExcelFilter(event, ${col.idx}, '${col.title}')"></i>` : '';
        trHtml += `<th class="group select-none" data-render-idx="${renderIndex + 1}" id="th_${col.idx}" style="width: ${col.width}px; min-width: ${col.width}px;">
            <div class="flex justify-between items-center w-full h-full px-1">
                <div class="cursor-pointer flex-1 overflow-hidden whitespace-nowrap text-ellipsis flex items-center justify-center" onclick="${col.key !== 'action' ? `sortTable(${col.idx})` : ''}">
                    <span>${col.title}</span> <i class="fa-solid fa-sort sort-icon"></i>
                </div>
                ${filterIcon}
            </div>
            <div class="resizer"></div>
        </th>`;
    });
    thead.innerHTML = trHtml + '</tr>';

    const toggleContainer = document.getElementById('col_toggles_container'); 
    let togglesHtml = '';
    
    columnsDef.forEach(col => {
        if(col.key === 'action') return; 
        togglesHtml += `
            <label draggable="true" ondragstart="handleDragStart(event, ${col.idx})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${col.idx})" ondragend="handleDragEnd(event)" class="flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 rounded cursor-grab hover:bg-slate-50 transition">
                <i class="fa-solid fa-grip-vertical text-slate-400"></i>
                <input type="checkbox" onchange="toggleColumnVisibility(${col.idx}, this.checked)" ${hiddenCols.has(col.idx) ? '' : 'checked'} class="accent-[#00320D] w-3.5 h-3.5">
                <span class="text-xs font-bold text-slate-700">${col.title}</span>
            </label>`;
    });
    
    toggleContainer.innerHTML = togglesHtml;

    applyColumnStyles(); 
    setTimeout(initResizableColumns, 300);
}

function handleDragStart(e, idx) { draggedColIdx = idx; e.target.style.opacity = '0.5'; }
function handleDragOver(e) { e.preventDefault(); }
function handleDrop(e, targetIdx) {
    e.preventDefault(); e.target.closest('label').style.opacity = '1';
    if (draggedColIdx === null || draggedColIdx === targetIdx) return;
    const srcPos = columnsDef.findIndex(c => c.idx === draggedColIdx);
    const tgtPos = columnsDef.findIndex(c => c.idx === targetIdx);
    const [movedCol] = columnsDef.splice(srcPos, 1); columnsDef.splice(tgtPos, 0, movedCol);
    
    saveUserPreferences(); 
    initColumns(); 
    applyFilters(); 
}
function handleDragEnd(e) { e.target.style.opacity = '1'; }

function toggleColManager() { document.getElementById('colManagerPanel').classList.toggle('hidden'); }

function toggleColumnVisibility(idx, isShow) { 
    if (isShow) hiddenCols.delete(idx); 
    else hiddenCols.add(idx); 
    applyColumnStyles(); 
    saveUserPreferences(); 
}

function applyColumnStyles() {
    const styleTag = document.getElementById('dynamic-col-styles'); let css = '';
    hiddenCols.forEach(idx => { 
        const rIdx = columnsDef.findIndex(c => c.idx === idx) + 1; 
        if(rIdx > 0) css += `#jobsTable th:nth-child(${rIdx}), #jobsTable td:nth-child(${rIdx}) { display: none !important; }\n`; 
    });
    styleTag.innerHTML = css;
}

function initResizableColumns() {
    const cols = document.querySelectorAll('#jobsTable th');
    cols.forEach(col => {
        const resizer = col.querySelector('.resizer'); if(!resizer) return;
        let startX = 0; let startWidth = 0;
        
        const onMouseDown = (e) => { 
            e.stopPropagation(); e.preventDefault(); 
            startX = e.clientX; startWidth = col.offsetWidth; 
            resizer.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove); 
            document.addEventListener('mouseup', onMouseUp); 
        };
        const onMouseMove = (e) => { 
            const newWidth = Math.max(50, startWidth + (e.clientX - startX));
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

// ------------------------------------------
// 🔍 2. จัดการตัวกรองและค้นหา (Filters & Search)
// ------------------------------------------
function buildBranchDropdown() {
    const branchSelect = document.getElementById('branch_filter_select'); 
    const savedValue = branchSelect.value;
    
    if (['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole)) {
        const activeData = getActiveJobsData();
        const uniqueBranches = [...new Set(activeData.map(j => j.branch_name).filter(Boolean))].sort();
        branchSelect.innerHTML = '<option value="ALL">-- ทุกสาขา --</option>' + uniqueBranches.map(b => `<option value="${b}">${b}</option>`).join('');
        if(savedValue && savedValue !== 'ALL' && uniqueBranches.includes(savedValue)) branchSelect.value = savedValue;
    } else { 
        branchSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`; 
        branchSelect.disabled = true; 
    }
}

function buildSADropdown() {
    const saSelect = document.getElementById('sa_filter_select'); 
    const savedValue = saSelect.value; 
    
    const branchSAs = getSAsForCurrentBranch();
    saSelect.innerHTML = '<option value="">-- แสดง SA ทั้งหมด --</option>' + branchSAs.map(sa => `<option value="${sa}">${sa}</option>`).join('');
    if(savedValue && branchSAs.includes(savedValue)) saSelect.value = savedValue;
}

function openExcelFilter(e, colIndex, title) {
    e.stopPropagation(); 
    currentFilterKey = colIndex; 
    document.getElementById('ef_col_name').innerText = title; 
    document.getElementById('ef_search').value = '';
    
    const uniqueValues = new Set();
    allJobsData.forEach(job => {
        const colDef = columnsDef.find(c => c.idx === colIndex); if(!colDef) return;
        let val = job[colDef.key]; 
        if(colDef.key.includes('date') && val) {
            val = formatToThaiDate(val);
        } else val = String(val || '').trim();
        uniqueValues.add(val);
    });

    const listDiv = document.getElementById('ef_checkbox_list'); 
    listDiv.innerHTML = '';
    
    [...uniqueValues].sort().forEach(val => {
        const isChecked = activeFilters[colIndex] ? activeFilters[colIndex].has(val) : true;
        listDiv.innerHTML += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer ef-item transition"><input type="checkbox" value="${val}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] w-3.5 h-3.5 rounded"><span class="text-slate-700 text-xs font-medium w-full truncate" title="${val}">${val === '' ? '(ว่าง)' : val}</span></label>`;
    });
    
    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);
    
    const modal = document.getElementById('excelFilterModal'); 
    const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px'; 
    let leftPos = rect.left + window.scrollX; 
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px'; 
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
}

function closeExcelFilter() { 
    document.getElementById('excelFilterModal').classList.add('hidden'); 
    document.getElementById('excelFilterModal').classList.remove('flex'); 
}

function searchExcelFilter() { 
    const txt = document.getElementById('ef_search').value.toLowerCase(); 
    document.querySelectorAll('.ef-item').forEach(l => l.style.display = l.querySelector('.ef-check').value.toLowerCase().includes(txt) ? 'flex' : 'none'); 
}

function toggleAllExcelFilters(c) { 
    document.querySelectorAll('.ef-item:not([style*="display: none"]) .ef-check').forEach(cb => cb.checked = c); 
}

function applyExcelFilter() {
    const checks = document.querySelectorAll('.ef-check'); 
    const checkedVals = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);
    const thIcon = document.getElementById(`th_${currentFilterKey}`)?.querySelector('.filter-icon');
    
    if (checkedVals.length === checks.length || checkedVals.length === 0) { 
        delete activeFilters[currentFilterKey]; 
        if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-slate-300'); } 
    } else { 
        activeFilters[currentFilterKey] = new Set(checkedVals); 
        if(thIcon) { thIcon.classList.remove('text-slate-300'); thIcon.classList.add('text-amber-400'); } 
    }
    closeExcelFilter(); 
    applyFilters();
}

function clearSpecificExcelFilter() { 
    if(activeFilters[currentFilterKey]) delete activeFilters[currentFilterKey]; 
    const thIcon = document.getElementById(`th_${currentFilterKey}`)?.querySelector('.filter-icon'); 
    if(thIcon) { thIcon.classList.remove('text-amber-400'); thIcon.classList.add('text-slate-300'); } 
    closeExcelFilter(); 
    applyFilters(); 
}

function clearAllFilters() {
    activeFilters = {}; 
    document.getElementById('search_input').value = ''; 
    document.getElementById('sa_filter_select').value = ''; 
    if (['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole)) document.getElementById('branch_filter_select').value = 'ALL'; 
    document.querySelectorAll('.filter-icon').forEach(icon => { icon.classList.remove('text-amber-400'); icon.classList.add('text-slate-300'); });
    applyFilters();
}

function debounceSearch() { 
    clearTimeout(searchTimeout); 
    searchTimeout = setTimeout(applyFilters, 300); 
}

function applyFilters() {
    const searchTxt = document.getElementById('search_input').value.toLowerCase();
    const saSelectedTxt = document.getElementById('sa_filter_select').value; 
    const branchSelectedTxt = document.getElementById('branch_filter_select').value; 
    
    const activeData = getActiveJobsData();
    
    const filteredData = activeData.filter(job => {
        if (searchTxt) { const matchStr = Object.values(job).join(' ').toLowerCase(); if(!matchStr.includes(searchTxt)) return false; }
        if (saSelectedTxt && job.sa_owner !== saSelectedTxt) return false;
        if (branchSelectedTxt && branchSelectedTxt !== 'ALL' && job.branch_name !== branchSelectedTxt) return false;
        
        for (let key in activeFilters) {
            const colDef = columnsDef.find(c => c.idx === parseInt(key)); if(!colDef) continue;
            let rawVal = job[colDef.key] || ''; 
            
            if (colDef.key.includes('date') && rawVal) {
                rawVal = formatToThaiDate(rawVal);
            } else {
                rawVal = String(rawVal).trim();
            }
            if (!activeFilters[key].has(rawVal)) return false;
        }
        return true;
    });

    currentFilteredData = filteredData;
    renderTable(filteredData); 
    document.getElementById('row_count').innerText = filteredData.length;
}

function sortTable(colIndex) {
    const table = document.getElementById('jobsTable'); 
    const tbody = table.querySelector('tbody'); 
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    if (rows.length <= 1) return;
    
    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => { icon.className = "fa-solid fa-sort sort-icon"; });
    
    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc'; 
    table.setAttribute(`data-dir-${colIndex}`, dir === 'asc' ? 'desc' : 'asc');
    
    const clickedTh = Array.from(table.querySelectorAll('th')).find(th => th.id === `th_${colIndex}`);
    if (clickedTh) { 
        const clickedIcon = clickedTh.querySelector('.sort-icon'); 
        if (clickedIcon) clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-amber-400 opacity-100" : "fa-solid fa-sort-up ml-1 text-amber-400 opacity-100"; 
    }
    
    const thIndex = Array.from(table.querySelectorAll('th')).findIndex(th => th.id === `th_${colIndex}`);

    rows.sort((a, b) => {
        let valA = getCellValue(a.cells[thIndex]); let valB = getCellValue(b.cells[thIndex]);
        let isDateA = valA.match(/^\d{4}-\d{2}-\d{2}$/); let isDateB = valB.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isDateA && isDateB) { let dateA = new Date(valA); let dateB = new Date(valB); if (!isNaN(dateA) && !isNaN(dateB)) return dir === 'asc' ? dateA - dateB : dateB - dateA; }
        let numA = parseFloat(valA.replace(/,/g, '')); let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });
    
    rows.forEach(row => tbody.appendChild(row));
}

// ------------------------------------------
// 📋 3. วาดตารางและข้อมูลใน Cell (Rendering)
// ------------------------------------------
function formatPartsText(partStr, type) {
    if(!partStr || partStr.trim() === '') return '<span class="text-slate-400 font-normal px-2">-</span>';
    return `<div class="px-2 py-1 flex flex-wrap gap-1 items-center whitespace-normal leading-normal">
        ${partStr.split(',').map(p => p.trim()).filter(Boolean).map(p => `<span class="${type === 'main' ? 'part-badge-main' : 'part-badge-sub'}">${p}</span>`).join('')}
    </div>`;
}

function renderTable(data) {
    const tbody = document.getElementById('jobs_table_body'); 
    if (!data || data.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="40" class="text-center py-16 text-slate-400 font-bold bg-white">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`; 
        return; 
    }

    let safeOptsGlobal = globalStatusOptionsHtml;
    let allRowsHtml = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    const branchSAs = getSAsForCurrentBranch();
    const activePartOrders = (allPartOrders || []).filter(p => p.order_status !== 'ยกเลิก');
    
    const partsByJobId = {};
    const partsByPlate = {};
    
    activePartOrders.forEach(p => {
        if (p.job_id) {
            if(!partsByJobId[p.job_id]) partsByJobId[p.job_id] = [];
            partsByJobId[p.job_id].push(p);
        }
        if (p.car_plate) {
            const plate = p.car_plate.trim().toUpperCase();
            if(!partsByPlate[plate]) partsByPlate[plate] = [];
            partsByPlate[plate].push(p);
        }
    });

    data.forEach(job => {
        let carParts = [];
        if (job.id && partsByJobId[job.id]) {
            carParts = partsByJobId[job.id];
        } else if (job.car_plate) {
            const plate = job.car_plate.trim().toUpperCase();
            const plateParts = partsByPlate[plate] || [];
            carParts = plateParts.filter(p => {
                if (job.qt_no && p.qt_no && job.qt_no.includes(p.qt_no)) return true;
                if (job.so_no && p.so_no && job.so_no.includes(p.so_no)) return true;
                return (!p.qt_no && !p.so_no);
            });
        }
        
        let rowHtml = `<tr id="row_${job.id}" ondblclick="goToEditJob('${job.id}')" title="ดับเบิ้ลคลิกเพื่อเปิดใบงานนี้">`;
        
        columnsDef.forEach(col => {
            let cellData = ''; let cellClass = '';
            
            switch(col.key) {
                case 'action': 
                    cellData = `
                    <div class="flex items-center justify-center gap-1 w-full h-full p-0.5">
                        <button onclick="event.stopPropagation(); goToEditJob('${job.id}')" class="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded transition flex items-center justify-center w-6 h-6 shadow-2xs" title="อัปเดต/แก้ไข">
                            <i class="fa-solid fa-pen-to-square text-[11px]"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deleteJobRow('${job.id}', '${job.car_plate || '-'}')" class="bg-red-500 hover:bg-red-600 text-white p-1 rounded transition flex items-center justify-center w-6 h-6 shadow-2xs" title="ลบใบงาน">
                            <i class="fa-solid fa-trash-can text-[11px]"></i>
                        </button>
                    </div>`; 
                    break;
                
                case 'car_plate': 
                    const isUrgent = job.damage_level === 'หนัก';
                    const alertIcon = isUrgent ? '<i class="fa-solid fa-circle-exclamation text-red-500 mr-1"></i>' : '';
                    cellData = `<div class="px-2 py-1 text-center font-bold text-blue-800">${alertIcon}${job.car_plate || '-'}</div>`; 
                    break;
                    
                case 'car_brand':
                    cellData = `<div class="px-2 py-1 text-left font-bold text-slate-800">${job.car_brand || '-'}</div>`; break;
                
                case 'car_model':
                    cellData = `<div class="px-2 py-1 text-left font-medium text-slate-600">${job.car_model || '-'}</div>`; break;

                case 'main_part_name':
                    cellData = `<div onclick="event.stopPropagation(); openMultiPartsModal('${job.id}', 'main_part_name', '${(job.main_part_name||'').replace(/'/g, "\\'")}')" class="w-full h-full text-left cursor-pointer group">
                        ${formatPartsText(job.main_part_name, 'main')}
                    </div>`; break;
                
                case 'sub_part_name':
                    cellData = `<div onclick="event.stopPropagation(); openMultiPartsModal('${job.id}', 'sub_part_name', '${(job.sub_part_name||'').replace(/'/g, "\\'")}')" class="w-full h-full text-left cursor-pointer group">
                        ${formatPartsText(job.sub_part_name, 'sub')}
                    </div>`; break;

                case 'main_part_qty': 
                    cellData = `<div class="text-center font-black text-blue-600 text-xs">${job.main_part_qty || 0}</div>`; break;
                
                case 'sub_part_qty': 
                    cellData = `<div class="text-center font-black text-amber-600 text-xs">${job.sub_part_qty || 0}</div>`; break;

                case 'contact_date': case 'arrived_date': case 'target_finish_date': case 'repair_finish_date': case 'delivery_date': case 'order_part_date': case 'est_part_date': case 'part_received_all_date': case 'billing_date':
                    let colorClass = 'text-slate-700';
                    if (col.key === 'arrived_date') colorClass = 'text-emerald-700 font-bold';
                    if (col.key === 'target_finish_date') colorClass = 'text-amber-600 font-bold';
                    if (col.key === 'repair_finish_date') colorClass = 'text-[#00320D] font-bold';
                    if (col.key === 'delivery_date') colorClass = 'text-emerald-600 font-bold';
                    
                    if (['arrived_date', 'target_finish_date', 'delivery_date'].includes(col.key)) {
                        cellData = `<div class="flex items-center justify-between w-full h-full bg-white">
                            <input type="date" id="date_${job.id}_${col.key}" value="${job[col.key] ? String(job[col.key]).split('T')[0] : ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input font-mono text-center ${colorClass}" style="width:calc(100% - 26px);">
                            <button type="button" onclick="event.stopPropagation(); openScheduleCalendar('${job.id}', '${col.key}')" class="text-blue-500 hover:text-blue-700 flex items-center justify-center w-[26px] h-[26px] border-l border-slate-200 bg-slate-50 transition-colors cursor-pointer" title="ดูโควต้าปฏิทิน"><i class="fa-solid fa-calendar-check text-[11px]"></i></button>
                        </div>`;
                    } else {
                        cellData = `<input type="date" value="${job[col.key] ? String(job[col.key]).split('T')[0] : ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input font-mono text-center ${colorClass}">`; 
                    }
                    break;

                case 'vin_no': case 'customer_name': case 'phone_number': case 'notes': case 'qt_no': case 'so_no': case 'ivn_no': case 'epc_no': case 'part_status':
                    cellData = `<input type="text" value="${job[col.key] || ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input text-slate-700" placeholder="-">`; break;
                
                case 'customer_type':
                    let ctOpts = allCustomerTypes.map(c => `<option value="${c.type_name}" ${job.customer_type === c.type_name ? 'selected' : ''}>${c.type_name}</option>`).join('');
                    if(job.customer_type && !allCustomerTypes.find(c => c.type_name === job.customer_type)) ctOpts += `<option value="${job.customer_type}" selected>${job.customer_type}</option>`;
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'customer_type', this.value)" class="inline-edit-select"><option value="">- เลือก -</option>${ctOpts}</select>`; break;
                
                case 'payment_type':
                    let ptOpts = allInsurances.map(i => `<option value="${i.insurance_name}" ${job.payment_type === i.insurance_name ? 'selected' : ''}>${i.insurance_name}</option>`).join('');
                    if(job.payment_type && !allInsurances.find(i => i.insurance_name === job.payment_type)) ptOpts += `<option value="${job.payment_type}" selected>${job.payment_type}</option>`;
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'payment_type', this.value)" class="inline-edit-select"><option value="">- เลือก -</option>${ptOpts}</select>`; break;

                case 'damage_level':
                    let dmgOpts = ['เบา', 'กลาง', 'หนัก'].map(d => `<option value="${d}" ${job.damage_level === d ? 'selected' : ''}>${d}</option>`).join('');
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'damage_level', this.value)" class="inline-edit-select ${job.damage_level === 'หนัก' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}"><option value="">- เลือก -</option>${dmgOpts}</select>`; break;
                
                case 'job_status': 
                    let sOpts = safeOptsGlobal; if(!sOpts.includes(`value="${job.job_status||''}"`)) sOpts = `<option value="${job.job_status||''}">${job.job_status||''}</option>` + sOpts; sOpts = sOpts.replace(`value="${job.job_status||''}"`, `value="${job.job_status||''}" selected`); 
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'job_status', this.value)" class="inline-edit-select text-blue-700 font-bold">${sOpts}</select>`; break;
                
                case 'calculated_station': 
                    const stationOptionsHtml = stationLevels.map(st => `<option value="${st}" ${job.calculated_station === st ? 'selected' : ''}>${st}</option>`).join('');
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateStationDropdown('${job.id}', this.value)" class="inline-edit-select text-amber-700 font-bold bg-amber-50">${stationOptionsHtml}</select>`; 
                    break;
                    
                case 'cost_labor': case 'cost_part': case 'cost_external':
                    cellData = `<input type="number" value="${job[col.key] || ''}" onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', '${col.key}', this.value)" class="inline-edit-input text-right" placeholder="0">`; break;
                
                case 'ordered_part_names':
                    let partsHTML = '<div class="px-2 py-1.5 flex flex-col w-full whitespace-normal min-h-[20px]">';
                    if(carParts.length === 0) { partsHTML += '<span class="text-slate-400 italic text-[10px]">- ไม่มีรายการ -</span>'; } 
                    else { 
                        carParts.forEach(p => { 
                            let isC = (p.order_status||'').includes('ครบ') || (p.order_status||'').includes('มีของ'); 
                            partsHTML += `<span class="text-[10px] font-bold ${isC ? 'text-emerald-600' : ((p.order_status||'').includes('รอ') ? 'text-red-500' : 'text-amber-500')} leading-tight" title="${p.part_name}">• ${p.part_name} [${p.order_status||'รอสั่ง'}]</span>`; 
                        }); 
                    }
                    cellData = partsHTML + '</div>'; break;
                
                case 'sa_owner': 
                    let saOptsHtml = '<option value="">- ระบุ SA -</option>';
                    if (branchSAs.length > 0) {
                        saOptsHtml += branchSAs.map(sa => `<option value="${sa}" ${job.sa_owner === sa ? 'selected' : ''}>${sa}</option>`).join('');
                        if(job.sa_owner && !branchSAs.includes(job.sa_owner)) {
                            saOptsHtml += `<option value="${job.sa_owner}" selected>${job.sa_owner}</option>`;
                        }
                    } else {
                        saOptsHtml += `<option value="${job.sa_owner||''}" selected>${job.sa_owner||''}</option>`;
                    }
                    cellData = `<select onclick="event.stopPropagation()" onchange="fastUpdateJob('${job.id}', 'sa_owner', this.value)" class="inline-edit-select text-slate-700 font-bold">${saOptsHtml}</select>`;
                    break;

                default: cellData = `<div class="px-3 py-2 truncate" title="${job[col.key]}">${job[col.key] || '-'}</div>`; break;
            }
            rowHtml += `<td class="${cellClass} p-0">${cellData}</td>`;
        });
        allRowsHtml += rowHtml + '</tr>';
    });
    tbody.innerHTML = allRowsHtml; 
}

// ------------------------------------------
// 📥 4. ส่งออก Excel (Export)
// ------------------------------------------
function exportToExcel() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        showToast('ไม่มีข้อมูลในตารางให้โหลดครับ!', 'error');
        return;
    }

    const exportData = [];
    const exportCols = columnsDef.filter(c => c.key !== 'action');
    
    const headers = exportCols.map(col => col.title);
    exportData.push(headers);
    
    currentFilteredData.forEach(job => {
        const row = exportCols.map(colDef => {
            let val = job[colDef.key];
            if (colDef.key.includes('date') && val) {
                val = formatToThaiDate(val);
            }
            return val || '';
        });
        exportData.push(row);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    const colWidths = exportCols.map(c => ({ wpx: c.width || 120 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Jobs_Data");
    
    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `Rizenic_Jobs_${userBranch}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showToast('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว!');
}