// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================
function cleanDate(dStr) {
    if (!dStr) return '';
    let s = String(dStr).trim();
    if (!s || s === 'null' || s === 'undefined' || s === '-') return '';
    
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    
    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
            let d = parts[0].padStart(2, '0');
            let m = parts[1].padStart(2, '0');
            let y = parseInt(parts[2], 10);
            if (y > 2500) y -= 543;
            return `${y}-${m}-${d}`;
        }
    }
    
    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 3) {
            let y = parseInt(parts[0], 10);
            if (y > 2500) y -= 543;
            let m = parts[1].padStart(2, '0');
            let d = parts[2].padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }
    return s;
}

function isTrue(val) {
    if (val === null || val === undefined) return false;
    const strVal = String(val).trim().toUpperCase();
    return strVal === 'TRUE' || strVal === '1' || val === true || val === 1;
}

function computeHighestStationIFS(j) {
    if (!j) return "รอรับรถ";
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

// ==========================================
// 🧑‍💼 ยอดงานรายบุคคล (SA)
// ==========================================
function renderSASection() {
    const container = document.getElementById('sa_list_container');
    if (!container) return;

    const saCounts = {};
    const excludedStatuses = [
        '12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', 
        '15.วางบิล Tesla', '16.วางบิล EV ME', '17.รอออกบิล', 
        '18.ลูกค้ายกเลิก', '19.ออกบิลแล้ว', '20.จอดซ่อม TC', 
        '21.พักซ่อม', 'ปิดงาน', 'ส่งมอบแล้ว'
    ];

    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);

    const activeJobs = jobsData.filter(job => {
        const st = (job.job_status || '').trim();
        if (!st) return false;
        return !excludedStatuses.some(ex => st.includes(ex));
    });

    activeJobs.forEach(job => {
        const sa = (job.sa_owner || 'ไม่ระบุ').trim();
        saCounts[sa] = (saCounts[sa] || 0) + 1;
    });

    const sortedSA = Object.entries(saCounts).sort((a, b) => b[1] - a[1]);

    if (sortedSA.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 font-bold">ไม่มีงานกำลังดำเนินการ</div>`;
        return;
    }

    container.innerHTML = sortedSA.map(([sa, count]) => {
        let textClass = 'text-blue-600';
        let bgClass = 'bg-blue-50';
        let borderClass = 'border-slate-100 hover:border-blue-300';

        if (count >= 15) { textClass = 'text-rose-600'; bgClass = 'bg-rose-50'; borderClass = 'border-rose-200 hover:border-rose-400'; } 
        else if (count >= 10) { textClass = 'text-orange-500'; bgClass = 'bg-orange-50'; borderClass = 'border-orange-200 hover:border-orange-400'; }

        return `
        <div onclick="openSAModal('${sa}')" class="flex justify-between items-center bg-white border ${borderClass} p-2.5 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer transform hover:-translate-y-0.5">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full ${bgClass} ${textClass} flex items-center justify-center font-bold text-sm shadow-inner"><i class="fa-solid fa-user-tie"></i></div>
                <span class="font-bold text-slate-700 text-sm">${sa}</span>
            </div>
            <div class="text-right flex items-baseline gap-1">
                <span class="text-xl font-black ${textClass}">${count}</span>
                <span class="text-[10px] text-slate-400 font-bold">คัน</span>
            </div>
        </div>`;
    }).join('');
}

function openSAModal(saName) {
    const excludedStatuses = ['12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', '15.วางบิล Tesla', '16.วางบิล EV ME', '17.รอออกบิล', '18.ลูกค้ายกเลิก', '19.ออกบิลแล้ว', '20.จอดซ่อม TC', '21.พักซ่อม', 'ปิดงาน', 'ส่งมอบแล้ว'];
    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
    
    const jobsToShow = jobsData.filter(job => {
        const st = (job.job_status || '').trim();
        return (job.sa_owner || 'ไม่ระบุ').trim() === saName && st && !excludedStatuses.some(ex => st.includes(ex));
    });

    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerHTML = `<i class="fa-solid fa-user-tie mr-2"></i> งานที่กำลังดำเนินการของ SA: ${saName}`;
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function sortTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => icon.className = "fa-solid fa-sort sort-icon");

    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc';
    table.setAttribute(`data-dir-${colIndex}`, dir === 'asc' ? 'desc' : 'asc');
    
    const clickedIcon = table.querySelectorAll('th')[colIndex] ? table.querySelectorAll('th')[colIndex].querySelector('.sort-icon') : null;
    if (clickedIcon) clickedIcon.className = dir === 'asc' ? "fa-solid fa-sort-down ml-1 text-white opacity-100" : "fa-solid fa-sort-up ml-1 text-white opacity-100";

    rows.sort((a, b) => {
        let valA = a.cells[colIndex] ? a.cells[colIndex].innerText.trim() : ''; 
        let valB = b.cells[colIndex] ? b.cells[colIndex].innerText.trim() : '';
        let numA = parseFloat(valA.replace(/,/g, '')); 
        let numB = parseFloat(valB.replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return dir === 'asc' ? numA - numB : numB - numA;
        return dir === 'asc' ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
    });
    rows.forEach(row => tbody.appendChild(row));
}

function renderStationSection() {
    const container = document.getElementById('station_list_container');
    if (!container) return;

    const stCounts = { "01.เคาะ":0, "02.โป๊ว":0, "03.เตรียมพื้น":0, "04.พ่นสี":0, "05.ประกอบ":0, "06.ขัดสี":0, "08.เก็บงาน":0, "09.ซ่อมแม็ก":0, "10.กระจก":0, "11.ฟิล์ม":0, "12.พักซ่อม":0, "13.รอส่งมอบ":0, "รอรับรถ":0 };
    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
    
    jobsData.filter(j => !(j.job_status||'').includes('ส่งมอบแล้ว')).forEach(j => {
        const s = computeHighestStationIFS(j);
        if(stCounts[s] !== undefined) stCounts[s]++;
    });

    container.innerHTML = Object.keys(stCounts).map(st => `
        <div onclick="openStationModal('${st}')" class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-orange-500 hover:shadow hover:bg-white transition-all group">
            <span class="text-xs font-bold text-slate-700 group-hover:text-orange-600 transition-colors truncate" title="${st}">${st.replace(/[0-9.]/g, '')}</span>
            <span class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200 text-xs font-black shadow-sm">${stCounts[st]}</span>
        </div>
    `).join('');
}

function openStationModal(stationName) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerText = `สถานีช่าง: ${stationName}`;
    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
    const jobsToShow = jobsData.filter(j => j.job_status !== '12.ส่งมอบแล้ว' && computeHighestStationIFS(j) === stationName);
    
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

// ==========================================
// 🛠️ ตารางรายการรถในสถานีซ่อม (กำลังดำเนินการ)
// ==========================================
function renderStationTable() {
    const tbody = document.getElementById('station_table_body');
    if (!tbody) return;
    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    
    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
    
    const inRepairCars = jobsData.filter(j => {
        const st = (j.job_status || '').trim();
        const isParked = j.is_parked === 'จอดซ่อม' || 
                         (j.is_parked !== 'ไม่จอดซ่อม' && !['13.วางบิลประกัน','14.ชำระเงินสด','15.วางบิล Tesla','16.วางบิล EV ME','17.รอออกบิล','18.ลูกค้ายกเลิก','19.ออกบิลแล้ว','20.จอดซ่อม TC','21.พักซ่อม','22.ปิดงาน'].some(ex => st.includes(ex)));
        
        if (st.includes('ส่งมอบแล้ว') || st.includes('12.ส่งมอบ')) return false;
        return isParked && activeStations.includes(computeHighestStationIFS(j));
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
        if (j.delivery_date && today > new Date(j.delivery_date).setHours(0,0,0,0)) overdueWarning = `<i class="fa-solid fa-triangle-exclamation text-red-500 animate-pulse ml-1"></i>`;
        else if (j.target_finish_date && today > new Date(j.target_finish_date).setHours(0,0,0,0)) overdueWarning = `<i class="fa-solid fa-clock text-amber-500 animate-pulse ml-1"></i>`;
        
        return `
            <tr class="cursor-pointer hover:bg-orange-50/50 transition-colors border-b border-slate-100" onclick="sessionStorage.setItem('edit_job_id', '${j.id}'); window.location.href='index.html';">
                <td class="px-4 py-3 font-black text-orange-700"><span class="bg-orange-50 px-2.5 py-1 rounded border border-orange-200 shadow-inner">${j.car_plate || '-'}${overdueWarning}</span></td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700">${j.car_brand || ''} ${j.car_model || ''}</td>
                <td class="px-4 py-3 text-xs font-medium text-slate-600 truncate max-w-[150px]">${j.customer_name || '-'}</td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700"><span class="bg-slate-100 px-2 py-1 rounded shadow-sm border border-slate-200">${j.job_status || '-'}</span></td>
                <td class="px-4 py-3 text-xs font-black text-orange-600 bg-orange-50/30"><i class="fa-solid fa-wrench"></i> ${station.replace(/[0-9.]/g, '')}</td>
                <td class="px-4 py-3 font-mono text-xs text-blue-600 text-center font-bold">${target}</td>
                <td class="px-4 py-3 font-mono text-xs text-emerald-600 text-center font-bold">${actual}</td>
                <td class="px-4 py-3 font-mono text-xs text-purple-600 text-center font-bold">${delivery}</td>
                <td class="px-4 py-3 text-center">
                    <button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap" onclick="event.stopPropagation(); sessionStorage.setItem('edit_job_id', '${j.id}'); window.location.href='index.html';">
                        <i class="fa-solid fa-pen"></i> ดูข้อมูล
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderParkedCars() {
    const tbody = document.getElementById('parked_cars_body');
    if (!tbody) return;
    const parkedStatuses = ["08.นัดหมายแล้วรอเข้าซ่อม", "09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", "20.จอดซ่อม TC", "21.พักซ่อม"];
    
    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
        
    const parkedCars = jobsData.filter(j => parkedStatuses.some(p => (j.job_status || '').includes(p)));
    
    if(parkedCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400 font-bold bg-slate-50">ไม่มีรถจอดซ่อมในศูนย์ขณะนี้ 🎉</td></tr>`;
        return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    parkedCars.sort((a,b) => new Date(a.arrived_date) - new Date(b.arrived_date)); 

    tbody.innerHTML = parkedCars.map(j => {
        const arrDate = new Date(j.arrived_date); arrDate.setHours(0,0,0,0);
        const diffDays = j.arrived_date ? Math.floor(Math.abs(today - arrDate) / (1000 * 60 * 60 * 24)) : 0;
        let dayBadge = diffDays > 14 ? 'bg-red-100 text-red-700 border-red-400 font-black shadow-sm animate-pulse' : (diffDays > 7 ? 'bg-amber-100 text-amber-700 border-amber-400 font-bold shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-300 font-bold shadow-sm');
        
        return `
            <tr class="cursor-pointer hover:bg-amber-50/80 transition-colors border-b border-slate-100" onclick="sessionStorage.setItem('edit_job_id', '${j.id}'); window.location.href='index.html';">
                <td class="text-center px-4 py-3"><span class="px-3 py-1 rounded-lg border ${dayBadge}">${diffDays}</span></td>
                <td class="font-black text-amber-700 px-4 py-3"><span class="bg-amber-50 px-2.5 py-1 rounded border border-amber-300 shadow-inner">${j.car_plate || '-'}</span></td>
                <td class="font-bold text-slate-800 px-4 py-3 text-xs">${j.car_brand || ''} ${j.car_model || ''}</td>
                <td class="truncate max-w-[150px] font-medium text-slate-700 px-4 py-3 text-xs">${j.customer_name || '-'}</td>
                <td class="font-bold text-orange-600 text-xs px-4 py-3"><i class="fa-solid fa-wrench"></i> ${computeHighestStationIFS(j).replace(/[0-9.]/g, '')}</td>
                <td class="font-mono text-xs text-blue-600 text-center font-bold px-4 py-3">${j.target_finish_date ? cleanDate(j.target_finish_date) : '-'}</td>
                <td class="font-mono text-xs text-emerald-600 text-center font-bold px-4 py-3">${j.repair_finish_date ? cleanDate(j.repair_finish_date) : '-'}</td>
                <td class="font-mono text-xs text-purple-600 text-center font-bold px-4 py-3">${j.delivery_date ? cleanDate(j.delivery_date) : '-'}</td>
                <td class="font-bold text-slate-600 text-[11px] px-4 py-3"><span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm">${j.job_status || '-'}</span></td>
                <td class="text-center px-4 py-3">
                    <button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap" onclick="event.stopPropagation(); sessionStorage.setItem('edit_job_id', '${j.id}'); window.location.href='index.html';">
                        <i class="fa-solid fa-pen"></i> ดูข้อมูล
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 🗓️ ปฏิทินปฏิบัติงาน (ดีไซน์ ds3_3.jpg / ds3_2.jpg กราฟแท่งแนวตั้ง)
// ==========================================
function renderCalendarByRange(startStr, endStr) {
    const grid = document.getElementById('calendar_grid');
    if (!grid) return;

    if (!startStr || !endStr) {
        grid.innerHTML = `<div class="col-span-7 text-center py-10 text-slate-400 font-bold">กรุณาเลือกช่วงเวลา</div>`;
        return;
    }
    
    // Parse วันที่ตามเวลา Local เพื่อความแม่นยำ 100%
    const sParts = startStr.split('-');
    const eParts = endStr.split('-');
    const startDate = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
    const endDate = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));

    const startCalendar = new Date(startDate);
    startCalendar.setDate(startCalendar.getDate() - startCalendar.getDay());
    
    const endCalendar = new Date(endDate);
    if (endCalendar.getDay() !== 6) {
        endCalendar.setDate(endCalendar.getDate() + (6 - endCalendar.getDay()));
    }

    let html = '';
    let current = new Date(startCalendar);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
        
    const quotasData = (typeof allQuotas !== 'undefined' && Array.isArray(allQuotas)) ? allQuotas : [];

    while (current <= endCalendar) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const isOutOfRange = current < startDate || current > endDate;
        const isToday = dateStr === todayStr;

        if (isOutOfRange) {
            html += `<div class="bg-slate-50/50 border border-slate-100 rounded-xl p-3 min-h-[160px] opacity-40"></div>`;
        } else {
            // 🎯 กรองข้อมูลด้วย cleanDate ให้ตรงกับ YYYY-MM-DD
            const arrJobs = jobsData.filter(j => cleanDate(j.arrived_date) === dateStr || cleanDate(j.appointment_date) === dateStr);
            const tarJobs = jobsData.filter(j => cleanDate(j.target_finish_date) === dateStr);
            const delJobs = jobsData.filter(j => cleanDate(j.delivery_date) === dateStr);
            
            let mainCount = 0; 
            let subCount = 0;
            const uniqueJobsForDay = new Map();
            [...arrJobs, ...tarJobs, ...delJobs].forEach(j => { if(j && j.id) uniqueJobsForDay.set(j.id, j); });
            
            // คำนวณจำนวนชิ้นส่วนจริงตามตรรกะใน repair.js
            uniqueJobsForDay.forEach(j => {
                let mQty = Number(j.main_part_qty) || (j.main_part_name ? String(j.main_part_name).split(',').filter(Boolean).length : 0);
                let sQty = Number(j.sub_part_qty) || (j.sub_part_name ? String(j.sub_part_name).split(',').filter(Boolean).length : 0);
                mainCount += mQty;
                subCount += sQty;
            });

            const q = quotasData.find(x => cleanDate(x.quota_date) === dateStr) || {};
            
            const limitIn = parseInt(q.intake_quota || 50, 10);
            const limitTar = parseInt(q.target_quota || 30, 10);
            const limitDel = parseInt(q.delivery_quota || 30, 10);
            const limitParts = parseInt(q.max_main_parts || q.parts_quota || 50, 10);
            const limitSubParts = parseInt(q.max_sub_parts || q.sub_parts_quota || 30, 10); 

            const countIn = arrJobs.length;
            const countTar = tarJobs.length;
            const countDel = delJobs.length;

            const hIn = countIn > 0 ? Math.max(Math.min((countIn / limitIn) * 100, 100), 15) : 0;
            const hTar = countTar > 0 ? Math.max(Math.min((countTar / limitTar) * 100, 100), 15) : 0;
            const hDel = countDel > 0 ? Math.max(Math.min((countDel / limitDel) * 100, 100), 15) : 0;
            
            const pctMain = limitParts > 0 ? Math.min((mainCount / limitParts) * 100, 100) : 0;
            const pctSub = limitSubParts > 0 ? Math.min((subCount / limitSubParts) * 100, 100) : 0;

            let cellClass = "bg-white border border-slate-200 rounded-xl p-3 min-h-[180px] flex flex-col hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer relative";
            if (isToday) cellClass += " ring-2 ring-blue-500 bg-blue-50/10";

            const hasAnyData = countIn > 0 || countTar > 0 || countDel > 0;

            html += `
            <div class="${cellClass}" onclick="openCalendarModal('${dateStr}')">
                <div class="absolute top-2 right-3 text-xs font-bold ${isToday ? 'text-blue-600' : 'text-slate-600'}">
                    ${current.getDate()}
                </div>
                
                <div class="h-4"></div>

                <!-- 📊 กราฟแท่งแนวตั้ง 3 แท่ง (เข้าจอด, เป้าเสร็จ, ส่งมอบ) -->
                <div class="flex-1 flex justify-center items-end gap-3 pb-4">
                    ${hasAnyData ? `
                        <!-- เข้าจอด (น้ำเงิน) -->
                        <div class="flex flex-col items-center justify-end h-[65px] w-3">
                            ${countIn > 0 ? `<span class="text-[9px] font-bold text-blue-600 bg-white border border-blue-200 rounded px-1 mb-1 shadow-sm leading-tight z-10">${countIn}</span>` : ''}
                            <div class="w-full bg-blue-500 rounded-t-sm transition-all duration-300" style="height: ${hIn}%;"></div>
                        </div>
                        
                        <!-- เป้าเสร็จ (เหลือง/ส้ม) -->
                        <div class="flex flex-col items-center justify-end h-[65px] w-3">
                            ${countTar > 0 ? `<span class="text-[9px] font-bold text-amber-500 bg-white border border-amber-200 rounded px-1 mb-1 shadow-sm leading-tight z-10">${countTar}</span>` : ''}
                            <div class="w-full bg-amber-400 rounded-t-sm transition-all duration-300" style="height: ${hTar}%;"></div>
                        </div>
                        
                        <!-- ส่งมอบ (เขียว) -->
                        <div class="flex flex-col items-center justify-end h-[65px] w-3">
                            ${countDel > 0 ? `<span class="text-[9px] font-bold text-emerald-500 bg-white border border-emerald-200 rounded px-1 mb-1 shadow-sm leading-tight z-10">${countDel}</span>` : ''}
                            <div class="w-full bg-emerald-400 rounded-t-sm transition-all duration-300" style="height: ${hDel}%;"></div>
                        </div>
                    ` : `
                        <div class="h-[65px] flex items-center justify-center text-slate-300 text-xs font-bold opacity-60">ว่าง</div>
                    `}
                </div>

                <!-- 🧩 หลอดชิ้นส่วนหลัก/รอง ด้านล่างสุด -->
                <div class="mt-auto space-y-2 w-full">
                    <div>
                        <div class="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5">
                            <span>ชิ้นหลัก</span>
                            <span>${mainCount}/${limitParts}</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1">
                            <div class="bg-blue-500 h-1 rounded-full transition-all duration-300" style="width: ${pctMain}%;"></div>
                        </div>
                    </div>
                    <div>
                        <div class="flex justify-between text-[9px] font-bold text-slate-500 mb-0.5">
                            <span>ชิ้นรอง</span>
                            <span>${subCount}/${limitSubParts}</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1">
                            <div class="bg-amber-400 h-1 rounded-full transition-all duration-300" style="width: ${pctSub}%;"></div>
                        </div>
                    </div>
                </div>

            </div>`;
        }
        current.setDate(current.getDate() + 1);
    }
    grid.innerHTML = html;
}

function openCalendarModal(dateStr) {
    if(document.getElementById('modal_status_name')) document.getElementById('modal_status_name').innerHTML = `<i class="fa-solid fa-calendar-day mr-2"></i> แผนปฏิบัติงานประจำวันที่: ${dateStr}`;
    const jobsData = (typeof filteredJobs !== 'undefined' && Array.isArray(filteredJobs) && filteredJobs.length > 0) 
        ? filteredJobs 
        : ((typeof allJobs !== 'undefined' && Array.isArray(allJobs)) ? allJobs : []);
        
    const jobsToShow = jobsData.filter(j => {
        return (j.arrived_date && cleanDate(j.arrived_date) === dateStr) || 
               (j.target_finish_date && cleanDate(j.target_finish_date) === dateStr) || 
               (j.delivery_date && cleanDate(j.delivery_date) === dateStr);
    });
    if(typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
    if(document.getElementById('jobListModal')) document.getElementById('jobListModal').classList.remove('hidden');
}

function renderJobTableInModalGroupedBySA(jobs) {
    const container = document.getElementById('modal_job_container');
    if (!container) return;
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
            <div class="bg-slate-100 px-4 py-3 border-y border-slate-300 flex items-center justify-between sticky top-0 z-10 shadow-sm cursor-pointer hover:bg-slate-200 transition" onclick="document.getElementById('${groupId}').classList.toggle('hidden')">
                <span class="font-black text-[#00320D] text-sm flex items-center gap-2"><i class="fa-solid fa-chevron-down text-slate-400"></i> <i class="fa-solid fa-user-tie text-amber-500"></i> SA: ${sa}</span>
                <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-300">${groupedBySA[sa].length} คัน</span>
            </div>
            <div id="${groupId}">
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
                <tr class="hover:bg-emerald-50/50 transition cursor-pointer" onclick="sessionStorage.setItem('edit_job_id', '${j.id}'); window.location.href='index.html';">
                    <td class="px-4 py-3 font-bold text-[#00320D] align-top"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td>
                    <td class="px-4 py-3 align-top"><div class="font-bold text-slate-800 text-[11px] leading-tight mb-1">${j.car_brand || ''} <span class="text-slate-500 font-medium">${j.car_model || ''}</span></div><div class="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">${j.customer_name || '-'}</div></td>
                    <td class="px-4 py-3 text-[11px] font-bold text-slate-700 align-top"><div class="text-blue-600 mb-0.5"><i class="fa-solid fa-layer-group text-blue-400 mr-1"></i> หลัก: ${j.main_part_name || '-'}</div><div class="text-amber-600 mb-1"><i class="fa-solid fa-puzzle-piece text-amber-400 mr-1"></i> รอง: ${j.sub_part_name || '-'}</div><div class="text-purple-600 pt-1 border-t border-slate-100"><i class="fa-solid fa-box text-purple-400 mr-1"></i> อะไหล่: <span class="bg-purple-50 px-1.5 py-0.5 rounded shadow-sm border border-purple-200">${j.part_status || '-'}</span></div></td>
                    <td class="px-4 py-3 text-[10px] font-bold text-slate-700 align-top"><select onclick="event.stopPropagation()" onchange="if(typeof fastUpdateJob === 'function') fastUpdateJob('${j.id}', 'job_status', this.value)" class="bg-slate-50 border border-slate-300 rounded px-2 py-1 outline-none focus:border-amber-500 w-full cursor-pointer font-bold text-[#00320D]">${safeOptions}</select></td>
                    <td class="px-4 py-3 text-center align-top">
                        <button onclick="event.stopPropagation(); sessionStorage.setItem('edit_job_id', '${j.id}'); window.location.href='index.html';" class="bg-[#00320D] text-[#ffffff] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> เปิด</button>
                    </td>
                </tr>`;
        });
        finalHtml += `</tbody></table></div>`;
    });
    container.innerHTML = finalHtml;
}