// =====================================
// 🛠️ HELPER FUNCTIONS
// =====================================
function cleanDate(dStr) {
    if (!dStr) return '';
    let s = String(dStr).trim();
    if (!s || s === 'null' || s === 'undefined' || s === '-') return '';
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    return s;
}

function isTrue(val) {
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase();
    return strVal === 'TRUE' || strVal === '1' || val === true || val === 1;
}

function getCellValue(cell) {
    if(!cell) return '';
    const input = cell.querySelector('input, select');
    if (input) return input.tagName === 'SELECT' ? input.options[input.selectedIndex].text.trim() : input.value.trim();
    return cell.innerText.trim();
}

window.goToEditJob = window.goToEditJob || function(id) {
    sessionStorage.setItem('edit_job_id', id);
    window.location.href = 'index.html';
};

function getSafeJobsData() {
    if (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) return filteredJobs;
    if (typeof allJobs !== 'undefined' && Array.isArray(allJobs) && allJobs.length > 0) return allJobs;
    if (typeof originalRepairJobs !== 'undefined' && Array.isArray(originalRepairJobs) && originalRepairJobs.length > 0) return originalRepairJobs;
    return [];
}

// =====================================
// 📋 TABLES, CALENDAR & LISTS
// =====================================

function renderSASection() {
    const saCounts = {};
    const safeJobs = getSafeJobsData();
    
    safeJobs.forEach(job => {
        const sa = job.sa_owner || "ไม่ระบุ SA";
        saCounts[sa] = (saCounts[sa] || 0) + 1;
    });

    const sortedSAs = Object.keys(saCounts).sort((a, b) => saCounts[b] - saCounts[a]);
    const container = document.getElementById('sa_list_container');
    if(!container) return;
    
    container.innerHTML = sortedSAs.map(sa => `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center hover:border-amber-500 hover:shadow-md transition-all">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black shadow-inner"><i class="fa-solid fa-user-tie"></i></div>
                <div>
                    <p class="text-sm font-bold text-slate-800">${sa}</p>
                    <p class="text-[10px] text-slate-500">จำนวน: <span class="text-amber-600 font-black">${saCounts[sa]}</span> คัน</p>
                </div>
            </div>
            <button onclick="openSAModal('${sa}')" class="px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition shadow-sm border border-amber-200 whitespace-nowrap">
                <i class="fa-solid fa-list-ul"></i> ดูรายการ
            </button>
        </div>
    `).join('');
}

function openSAModal(saName) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `รถทั้งหมดของ SA: ${saName}`;
    const safeJobs = getSafeJobsData();
    const jobsToShow = safeJobs.filter(j => (j.sa_owner || "ไม่ระบุ SA") === saName);
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function computeHighestStationIFS(j) {
    if(!j) return "รอรับรถ";
    if(isTrue(j.station_ready)) return "13.รอส่งมอบ";
    if(isTrue(j.station_pak)) return "12.พักซ่อม";
    if(isTrue(j.station_film)) return "11.ฟิล์ม";
    if(isTrue(j.station_kraj)) return "10.กระจก";
    if(isTrue(j.station_mag)) return "09.ซ่อมแม็ก";
    if(isTrue(j.station_qc)) return "08.เก็บงาน";
    if(isTrue(j.station_kat)) return "06.ขัดสี";
    if(isTrue(j.station_prak)) return "05.ประกอบ";
    if(isTrue(j.station_pon)) return "04.พ่นสี";
    if(isTrue(j.station_puan)) return "03.เตรียมพื้น";
    if(isTrue(j.station_pou)) return "02.โป๊ว";
    if(isTrue(j.station_kho)) return "01.เคาะ";
    return "รอรับรถ";
}

function renderStationSection() {
    const stCounts = { "01.เคาะ":0, "02.โป๊ว":0, "03.เตรียมพื้น":0, "04.พ่นสี":0, "05.ประกอบ":0, "06.ขัดสี":0, "08.เก็บงาน":0, "09.ซ่อมแม็ก":0, "10.กระจก":0, "11.ฟิล์ม":0, "12.พักซ่อม":0, "13.รอส่งมอบ":0, "รอรับรถ":0 };
    
    const safeJobs = getSafeJobsData();
    safeJobs.filter(j => !(j.job_status||'').includes('ส่งมอบแล้ว')).forEach(j => {
        const s = computeHighestStationIFS(j);
        if(stCounts[s] !== undefined) stCounts[s]++;
    });

    const container = document.getElementById('station_list_container');
    if(!container) return;
    
    container.innerHTML = Object.keys(stCounts).map(st => `
        <div onclick="openStationModal('${st}')" class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-orange-500 hover:shadow hover:bg-white transition-all group">
            <span class="text-xs font-bold text-slate-700 group-hover:text-orange-600 transition-colors truncate" title="${st}">${st.replace(/[0-9.]/g, '')}</span>
            <span class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200 text-xs font-black shadow-sm">${stCounts[st]}</span>
        </div>
    `).join('');
}

function openStationModal(stationName) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `สถานีช่าง: ${stationName}`;
    const safeJobs = getSafeJobsData();
    const jobsToShow = safeJobs.filter(j => j.job_status !== '12.ส่งมอบแล้ว' && computeHighestStationIFS(j) === stationName);
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function sortTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    if(!table) return;
    const tbody = table.querySelector('tbody');
    if(!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => icon.className = "fa-solid fa-sort sort-icon");

    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc';
    table.setAttribute(`data-dir-${colIndex}`, dir === 'asc' ? 'desc' : 'asc');
    
    const clickedIcon = table.querySelectorAll('th')[colIndex] ? table.querySelectorAll('th')[colIndex].querySelector('.sort-icon') : null;
    if (clickedIcon) clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-white opacity-100" : "fa-solid fa-sort-up ml-1 text-white opacity-100";

    rows.sort((a, b) => {
        let valA = getCellValue(a.cells[colIndex]); 
        let valB = getCellValue(b.cells[colIndex]);
        let numA = parseFloat(valA.replace(/,/g, '')); 
        let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });
    rows.forEach(row => tbody.appendChild(row));
}

// ==========================================
// 🛠️ 1. ตารางรายการรถในสถานีซ่อม (กำลังดำเนินการ) 
// ==========================================
function renderStationTable() {
    const tbody = document.getElementById('station_table_body');
    if(!tbody) return;
    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    
    const safeJobs = getSafeJobsData();
    
    // 🎯 กรองเฉพาะรถที่เข้าสถานีซ่อม โดยเอาเฉพาะรถที่ยังไม่ถูกส่งมอบ
    const inRepairCars = safeJobs.filter(j => {
        const st = (j.job_status || '').trim();
        if(st.includes('ส่งมอบแล้ว') || st.includes('12.ส่งมอบ') || st.includes('ปิดงาน')) return false;
        return activeStations.includes(computeHighestStationIFS(j));
    });
    
    if(inRepairCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-slate-50">ไม่มีรถกำลังดำเนินการในสถานีช่างขณะนี้ 🎉</td></tr>`;
        return;
    }

    inRepairCars.sort((a,b) => new Date(a.target_finish_date||'9999') - new Date(b.target_finish_date||'9999'));

    const today = new Date(); today.setHours(0,0,0,0);

    tbody.innerHTML = inRepairCars.map(j => {
        const target = j.target_finish_date ? cleanDate(j.target_finish_date) : '-';
        const actual = j.repair_finish_date ? cleanDate(j.repair_finish_date) : '-';
        const delivery = j.delivery_date ? cleanDate(j.delivery_date) : '-';
        const station = computeHighestStationIFS(j);
        
        let overdueWarning = '';
        if (j.delivery_date && today > new Date(j.delivery_date).setHours(0,0,0,0)) {
            overdueWarning = `<i class="fa-solid fa-triangle-exclamation text-red-500 animate-pulse ml-1" title="เลยกำหนดส่งมอบ!"></i>`;
        } else if (j.target_finish_date && today > new Date(j.target_finish_date).setHours(0,0,0,0)) {
            overdueWarning = `<i class="fa-solid fa-clock text-amber-500 animate-pulse ml-1" title="เลยเป้าซ่อมเสร็จ!"></i>`;
        }
        
        return `
            <tr class="cursor-pointer hover:bg-orange-50/50 transition-colors border-b border-slate-100" onclick="goToEditJob('${j.id}')">
                <td class="px-4 py-3 font-black text-orange-700"><span class="bg-orange-50 px-2.5 py-1 rounded border border-orange-200 shadow-inner">${j.car_plate || '-'}${overdueWarning}</span></td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700">${j.car_brand || ''} ${j.car_model || ''}</td>
                <td class="px-4 py-3 text-xs font-medium text-slate-600 truncate max-w-[150px]" title="${j.customer_name}">${j.customer_name || '-'}</td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700"><span class="bg-slate-100 px-2 py-1 rounded shadow-sm border border-slate-200">${j.job_status || '-'}</span></td>
                <td class="px-4 py-3 text-xs font-black text-orange-600 bg-orange-50/30"><i class="fa-solid fa-wrench"></i> ${station.replace(/[0-9.]/g, '')}</td>
                <td class="px-4 py-3 font-mono text-xs text-blue-600 text-center font-bold">${target}</td>
                <td class="px-4 py-3 font-mono text-xs text-emerald-600 text-center font-bold">${actual}</td>
                <td class="px-4 py-3 font-mono text-xs text-purple-600 text-center font-bold">${delivery}</td>
                <td class="px-4 py-3 text-center"><button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> ดูข้อมูล</button></td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 🚗 2. รายการรถกำลังจอดซ่อมในศูนย์ (ตามสถานะ ERP)
// ==========================================
function renderParkedCars() {
    const tbody = document.getElementById('parked_cars_body');
    if(!tbody) return;
    
    const safeJobs = getSafeJobsData();
    
    // 🎯 กรองเอาเฉพาะรถที่มีฟิลด์ is_parked ระบุว่า "จอดซ่อม" (หรือมีคำว่าจอดซ่อม)
    const parkedCars = safeJobs.filter(j => {
        const pk = String(j.is_parked || '').trim();
        return pk === 'จอดซ่อม' || pk.includes('จอด');
    });
    
    if(parkedCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400 font-bold bg-slate-50"><i class="fa-solid fa-car-tunnel text-3xl mb-3 block opacity-50"></i>ไม่มีรถจอดซ่อมในศูนย์ขณะนี้ 🎉</td></tr>`;
        return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    parkedCars.sort((a,b) => new Date(a.arrived_date) - new Date(b.arrived_date)); 

    tbody.innerHTML = parkedCars.map(j => {
        const arrDate = new Date(j.arrived_date); arrDate.setHours(0,0,0,0);
        const diffDays = j.arrived_date ? Math.floor(Math.abs(today - arrDate) / (1000 * 60 * 60 * 24)) : 0;
        let dayBadge = diffDays > 14 ? 'bg-red-100 text-red-700 border-red-400 font-black shadow-sm animate-pulse' : (diffDays > 7 ? 'bg-amber-100 text-amber-700 border-amber-400 font-bold shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-300 font-bold shadow-sm');
        
        return `
            <tr class="cursor-pointer hover:bg-amber-50/80 transition-colors border-b border-slate-100" onclick="goToEditJob('${j.id}')">
                <td class="text-center px-4 py-3"><span class="px-3 py-1 rounded-lg border ${dayBadge}">${diffDays}</span></td>
                <td class="font-black text-amber-700 px-4 py-3"><span class="bg-amber-50 px-2.5 py-1 rounded border border-amber-300 shadow-inner">${j.car_plate || '-'}</span></td>
                <td class="font-bold text-slate-800 px-4 py-3 text-xs">${j.car_brand || ''} ${j.car_model || ''}</td>
                <td class="truncate max-w-[150px] font-medium text-slate-700 px-4 py-3 text-xs" title="${j.customer_name}">${j.customer_name || '-'}</td>
                <td class="font-bold text-orange-600 text-xs px-4 py-3"><i class="fa-solid fa-wrench"></i> ${computeHighestStationIFS(j).replace(/[0-9.]/g, '')}</td>
                <td class="font-mono text-xs text-blue-600 text-center font-bold px-4 py-3">${j.target_finish_date ? cleanDate(j.target_finish_date) : '-'}</td>
                <td class="font-mono text-xs text-emerald-600 text-center font-bold px-4 py-3">${j.repair_finish_date ? cleanDate(j.repair_finish_date) : '-'}</td>
                <td class="font-mono text-xs text-purple-600 text-center font-bold px-4 py-3">${j.delivery_date ? cleanDate(j.delivery_date) : '-'}</td>
                <td class="font-bold text-slate-600 text-[11px] px-4 py-3"><span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm">${j.job_status || '-'}</span></td>
                <td class="text-center px-4 py-3"><button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-sm w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> ดูข้อมูล</button></td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 🗓️ 3. ปฏิทินปฏิบัติงาน (ดึงโควต้าเป๊ะๆ 100% ตาม repair.js)
// ==========================================
function renderCalendarByRange(startDate, endDate) {
    const grid = document.getElementById('calendar_grid'); 
    if(!grid) return;
    grid.innerHTML = '';
    if(!startDate || !endDate) return;

    const start = new Date(startDate); const end = new Date(endDate);
    if(isNaN(start) || isNaN(end) || start > end) {
        grid.innerHTML = `<div class="col-span-7 text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-xl">วันที่ไม่ถูกต้อง</div>`; return;
    }
    if(Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) > 31) {
        grid.innerHTML = `<div class="col-span-7 text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-xl">รองรับสูงสุด 31 วัน</div>`; return;
    }

    for(let i = 0; i < start.getDay(); i++) grid.innerHTML += `<div class="bg-slate-50/50 rounded-xl border border-transparent"></div>`; 

    const safeFilteredJobs = getSafeJobsData();

    let maxCount = 1; const daysData = [];
    let currentDay = new Date(start);
    while(currentDay <= end) {
        const dateStr = `${currentDay.getFullYear()}-${String(currentDay.getMonth()+1).padStart(2,'0')}-${String(currentDay.getDate()).padStart(2,'0')}`;
        const arr = safeFilteredJobs.filter(j => j.arrived_date && cleanDate(j.arrived_date) === dateStr);
        const tar = safeFilteredJobs.filter(j => j.target_finish_date && cleanDate(j.target_finish_date) === dateStr);
        const del = safeFilteredJobs.filter(j => j.delivery_date && cleanDate(j.delivery_date) === dateStr);
        
        maxCount = Math.max(maxCount, arr.length, tar.length, del.length);
        daysData.push({ day: currentDay.getDate(), dateStr, arrJobs: arr, tarJobs: tar, delJobs: del });
        currentDay.setDate(currentDay.getDate() + 1);
    }

    const branchFilterEl = document.getElementById('branchFilter');
    const branchVal = branchFilterEl ? branchFilterEl.value : 'all';
    const safeAllJobs = typeof allJobs !== 'undefined' && Array.isArray(allJobs) ? allJobs : safeFilteredJobs;
    const branchesToCheck = branchVal === 'all' ? [...new Set(safeAllJobs.map(j => j.branch_name).filter(b => b))] : [branchVal];
    const safeAllQuotas = typeof allQuotas !== 'undefined' && Array.isArray(allQuotas) ? allQuotas : [];

    daysData.forEach(d => {
        let barBlock = '';
        if(d.arrJobs.length > 0 || d.tarJobs.length > 0 || d.delJobs.length > 0) {
            barBlock = `<div class="flex items-end justify-center gap-1.5 w-full h-[60px] mt-auto pb-1">`;
            
            if(d.arrJobs.length > 0) barBlock += `<div class="flex flex-col items-center justify-end h-full group/bar cursor-pointer w-[20px]" onclick="openJobListModalCalendar('${d.dateStr}', 'arrived')" title="รถเข้าจอด: ${d.arrJobs.length}"><span class="text-[9px] font-black text-blue-700 mb-0.5 z-10 bg-white/90 rounded-sm min-w-[16px] h-4 flex items-center justify-center shadow-sm border border-blue-200">${d.arrJobs.length}</span><div class="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-md transition-all group-hover/bar:brightness-110 shadow-sm border border-blue-700/20" style="height: ${Math.max(20, (d.arrJobs.length/maxCount)*100)}%;"></div></div>`;
            
            const doneQty = d.tarJobs.filter(j => {
                const st = j.job_status || '';
                return ['11', '12', '13', '14', '15', '16', '17', '19', '20', '21'].some(p => String(st).startsWith(p));
            }).length;
            const isAllDone = doneQty === d.tarJobs.length && d.tarJobs.length > 0;
            const pctDone = d.tarJobs.length > 0 ? (doneQty / d.tarJobs.length) * 100 : 0;

            if(d.tarJobs.length > 0) barBlock += `<div class="flex flex-col items-center justify-end h-full group/bar cursor-pointer w-[28px]" onclick="openJobListModalCalendar('${d.dateStr}', 'target')" title="เป้าซ่อมเสร็จ: ${d.tarJobs.length} (เสร็จแล้ว ${doneQty})"><span class="text-[9px] font-black ${isAllDone ? 'text-emerald-700 bg-emerald-100 border-emerald-400' : 'text-amber-700 bg-amber-100 border-amber-400'} mb-0.5 z-10 bg-white/90 rounded-sm w-full h-4 flex items-center justify-center shadow-sm border">${doneQty}/${d.tarJobs.length}</span><div class="w-full bg-slate-200 rounded-sm shadow-inner relative overflow-hidden" style="height: ${Math.max(20, (d.tarJobs.length/maxCount)*100)}%;"><div class="absolute bottom-0 left-0 w-full bg-gradient-to-t ${isAllDone ? 'from-emerald-500 to-emerald-400' : 'from-amber-500 to-amber-300'} transition-all duration-500 ease-in-out" style="height: ${pctDone}%;"></div></div></div>`;
            
            if(d.delJobs.length > 0) barBlock += `<div class="flex flex-col items-center justify-end h-full group/bar cursor-pointer w-[20px]" onclick="openJobListModalCalendar('${d.dateStr}', 'delivery')" title="นัดส่งมอบ: ${d.delJobs.length}"><span class="text-[9px] font-black text-emerald-700 mb-0.5 z-10 bg-white/90 rounded-sm min-w-[16px] h-4 flex items-center justify-center shadow-sm border border-emerald-200">${d.delJobs.length}</span><div class="w-full bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-md transition-all group-hover/bar:brightness-110 shadow-sm border border-emerald-600/20" style="height: ${Math.max(20, (d.delJobs.length/maxCount)*100)}%;"></div></div>`;
            barBlock += `</div>`;
        } else {
            barBlock = `<div class="flex items-center justify-center h-[60px] w-full mt-auto"><span class="text-[10px] font-bold text-slate-300">ว่าง</span></div>`;
        }

        // 🎯 ดึงโควต้าชิ้นหลัก ชิ้นรอง ตามตรรกะของ repair_3.js เป๊ะๆ
        let maxMain = 0; let maxSub = 0;
        branchesToCheck.forEach(b => {
            const branchQuotas = safeAllQuotas.filter(q => q.branch_name === b);
            const specialQ = branchQuotas.find(q => q.quota_type === 'special' && q.quota_date && cleanDate(q.quota_date) === d.dateStr);
            const defaultQ = branchQuotas.find(q => q.quota_type === 'default');
            
            maxMain += specialQ ? (parseInt(specialQ.quota_main_parts)||0) : (defaultQ ? (parseInt(defaultQ.quota_main_parts)||0) : 0);
            maxSub += specialQ ? (parseInt(specialQ.quota_sub_parts)||0) : (defaultQ ? (parseInt(defaultQ.quota_sub_parts)||0) : 0);
        });

        // คำนวณชิ้นส่วนของงานซ่อม
        const mainSum = d.tarJobs.reduce((sum, j) => sum + (parseInt(j.main_part_qty) || ((j.main_part_name && String(j.main_part_name).trim() !== '-' && String(j.main_part_name).trim() !== '') ? String(j.main_part_name).split(',').filter(Boolean).length : 0)), 0);
        const subSum = d.tarJobs.reduce((sum, j) => sum + (parseInt(j.sub_part_qty) || ((j.sub_part_name && String(j.sub_part_name).trim() !== '-' && String(j.sub_part_name).trim() !== '') ? String(j.sub_part_name).split(',').filter(Boolean).length : 0)), 0);

        let quotaHTML = '';
        if (maxMain > 0 || maxSub > 0) {
            quotaHTML = `<div class="w-full mt-1 pt-1 border-t border-slate-100 flex flex-col gap-1">`;
            if (maxMain > 0) {
                let pct = Math.min((mainSum / maxMain) * 100, 100);
                quotaHTML += `<div title="เป้าหมายชิ้นส่วนหลัก"><div class="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5"><span>ชิ้นหลัก</span><span class="${pct>=100?'text-rose-600':''}">${mainSum}/${maxMain}</span></div><div class="h-1.5 rounded-full bg-slate-200"><div class="h-full rounded-full ${pct>=100?'bg-rose-500':(pct>=80?'bg-amber-500':'bg-blue-500')} transition-all" style="width: ${pct}%"></div></div></div>`;
            }
            if (maxSub > 0) {
                let pct = Math.min((subSum / maxSub) * 100, 100);
                quotaHTML += `<div title="เป้าหมายชิ้นส่วนรอง"><div class="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5"><span>ชิ้นรอง</span><span class="${pct>=100?'text-rose-600':''}">${subSum}/${maxSub}</span></div><div class="h-1.5 rounded-full bg-slate-200"><div class="h-full rounded-full ${pct>=100?'bg-rose-500':(pct>=80?'bg-amber-500':'bg-amber-400')} transition-all" style="width: ${pct}%"></div></div></div>`;
            }
            quotaHTML += `</div>`;
        }

        const todayObj = new Date();
        const todayStrLocal = `${todayObj.getFullYear()}-${String(todayObj.getMonth()+1).padStart(2,'0')}-${String(todayObj.getDate()).padStart(2,'0')}`;
        const isToday = d.dateStr === todayStrLocal;
        const isFull = (maxMain > 0 && mainSum >= maxMain) || (maxSub > 0 && subSum >= maxSub);

        const hasOverdue = d.tarJobs.some(j => {
            if (j.repair_finish_date) return false;
            const targetDate = new Date(j.target_finish_date);
            const today = new Date();
            targetDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
            return targetDate < today;
        });

        grid.innerHTML += `
            <div class="calendar-cell ${isToday ? 'today ring-2 ring-amber-400 bg-amber-50/20' : 'bg-white'} border border-slate-200 rounded-xl p-3 flex flex-col hover:border-amber-400 hover:shadow-lg transition-all relative min-h-[150px] ${isFull ? 'border-rose-300 bg-rose-50/20' : ''} ${hasOverdue ? 'bg-red-50/20' : ''}">
                <div class="flex justify-between items-start w-full mb-1">
                    <span class="text-sm font-black text-slate-600 ${isToday ? 'text-amber-600 bg-amber-100 px-1.5 rounded' : ''} font-mono">${d.day}</span>
                    <div class="flex gap-1">
                        ${hasOverdue ? `<i class="fa-solid fa-circle-exclamation text-red-500 animate-pulse text-[10px]" title="มีรถดีเลย์!"></i>` : ''}
                        ${isFull ? `<span class="text-[9px] font-black bg-rose-500 text-white px-1 py-0.5 rounded shadow-sm animate-pulse border border-rose-600">เต็ม</span>` : ''}
                    </div>
                </div>
                <div class="flex-1 flex flex-col justify-end w-full">${barBlock}${quotaHTML}</div>
            </div>`;
    });
}

function openJobListModalCalendar(dateStr, type) {
    let typeLabel = ""; let jobsToShow = [];
    const safeFilteredJobs = getSafeJobsData();
    
    if(type === 'arrived') { typeLabel = "รถเข้าจอด"; jobsToShow = safeFilteredJobs.filter(j => j.arrived_date && cleanDate(j.arrived_date) === dateStr); }
    else if(type === 'target') { typeLabel = "กำหนดเสร็จ"; jobsToShow = safeFilteredJobs.filter(j => j.target_finish_date && cleanDate(j.target_finish_date) === dateStr); }
    else if(type === 'delivery') { typeLabel = "วันส่งมอบ"; jobsToShow = safeFilteredJobs.filter(j => j.delivery_date && cleanDate(j.delivery_date) === dateStr); }

    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `วันที่ ${new Date(dateStr).toLocaleDateString('th-TH')} (${typeLabel})`;
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

window.toggleSAAccordion = window.toggleSAAccordion || function(id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon_' + id);
    if(!el || !icon) return;
    if(el.classList.contains('hidden')) { el.classList.remove('hidden'); icon.classList.add('rotate-90'); } 
    else { el.classList.add('hidden'); icon.classList.remove('rotate-90'); }
}

function renderJobTableInModalGroupedBySA(jobs) {
    const container = document.getElementById('modal_job_container');
    if(!container) return;
    if (jobs.length === 0) { container.innerHTML = `<div class="text-center py-10 text-slate-500 font-bold bg-white m-4 rounded-xl shadow-sm">ไม่มีข้อมูล</div>`; return; }

    const groupedBySA = {};
    jobs.forEach(j => {
        const sa = j.sa_owner || 'ไม่ระบุ SA';
        if(!groupedBySA[sa]) groupedBySA[sa] = [];
        groupedBySA[sa].push(j);
    });

    let finalHtml = '';
    const safeOptionsData = typeof globalStatusOptionsHtml !== 'undefined' ? globalStatusOptionsHtml : '';

    Object.keys(groupedBySA).sort().forEach((sa, index) => {
        const groupId = `sa_group_${index}`;
        finalHtml += `
            <div class="bg-slate-100 px-4 py-3 border-y border-slate-300 flex items-center justify-between sticky top-0 z-10 shadow-sm cursor-pointer hover:bg-slate-200 transition" onclick="toggleSAAccordion('${groupId}')">
                <span class="font-black text-[#00320D] text-sm flex items-center gap-2"><i class="fa-solid fa-chevron-right transition-transform duration-200 text-slate-400" id="icon_${groupId}"></i> <i class="fa-solid fa-user-tie text-amber-500"></i> SA: ${sa}</span>
                <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-300">${groupedBySA[sa].length} คัน</span>
            </div>
            <div id="${groupId}" class="hidden">
                <table class="excel-table w-full border-none mb-2">
                    <thead class="bg-white text-slate-500 text-[10px] uppercase border-b border-slate-200">
                        <tr><th class="px-4 py-2 font-bold text-left w-32">ทะเบียนรถ</th><th class="px-4 py-2 font-bold text-left w-48">ลูกค้า</th><th class="px-4 py-2 font-bold text-left w-48">ชิ้นส่วนที่ทำสี / สถานะอะไหล่</th><th class="px-4 py-2 font-bold text-left w-40">สถานะซ่อม (ERP)</th><th class="px-4 py-2 font-bold text-center w-20">จัดการ</th></tr>
                    </thead><tbody class="text-sm divide-y divide-slate-100 bg-white">
        `;
        groupedBySA[sa].forEach(j => {
            let safeStatus = j.job_status || '';
            let safeOptions = safeOptionsData;
            if(!safeOptions.includes(`value="${safeStatus}"`)) { safeOptions = `<option value="${safeStatus}">${safeStatus}</option>` + safeOptions; } 
            safeOptions = safeOptions.replace(`value="${safeStatus}"`, `value="${safeStatus}" selected`); 

            finalHtml += `
                <tr class="hover:bg-emerald-50/50 transition cursor-pointer" onclick="goToEditJob('${j.id}')">
                    <td class="px-4 py-3 font-bold text-[#00320D] align-top"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td>
                    <td class="px-4 py-3 align-top"><div class="font-bold text-slate-800 text-[11px] leading-tight mb-1">${j.car_brand || ''} <span class="text-slate-500 font-medium">${j.car_model || ''}</span></div><div class="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">${j.customer_name || '-'}</div></td>
                    <td class="px-4 py-3 text-[11px] font-bold text-slate-700 align-top"><div class="text-blue-600 mb-0.5"><i class="fa-solid fa-layer-group text-blue-400 mr-1"></i> หลัก: ${j.main_part_name || '-'}</div><div class="text-amber-600 mb-1"><i class="fa-solid fa-puzzle-piece text-amber-400 mr-1"></i> รอง: ${j.sub_part_name || '-'}</div><div class="text-purple-600 pt-1 border-t border-slate-100"><i class="fa-solid fa-box text-purple-400 mr-1"></i> อะไหล่: <span class="bg-purple-50 px-1.5 py-0.5 rounded shadow-sm border border-purple-200">${j.part_status || '-'}</span></div></td>
                    <td class="px-4 py-3 text-[10px] font-bold text-slate-700 align-top"><select onclick="event.stopPropagation()" onchange="if(typeof fastUpdateJob === 'function') fastUpdateJob('${j.id}', 'job_status', this.value)" class="bg-slate-50 border border-slate-300 rounded px-2 py-1 outline-none focus:border-amber-500 w-full cursor-pointer font-bold text-[#00320D]">${safeOptions}</select></td>
                    <td class="px-4 py-3 text-center align-top"><button onclick="event.stopPropagation(); goToEditJob('${j.id}')" class="bg-[#00320D] text-[#ffffff] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> เปิด</button></td>
                </tr>`;
        });
        finalHtml += `</tbody></table></div>`;
    });
    container.innerHTML = finalHtml;
}