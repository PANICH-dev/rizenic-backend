// ==========================================
// 📅 โมดูลปฏิทินปฏิบัติงาน (Tab 1: Calendar)
// ==========================================

function changeMonth(step) {
    currentMonth += step;
    if(currentMonth > 11) { currentMonth = 0; currentYear++; }
    if(currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar_grid'); 
    if(!grid) return;
    grid.innerHTML = '';
    
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    document.getElementById('calendar_month_title').innerText = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for(let i = 0; i < firstDay; i++) { grid.innerHTML += `<div class="bg-slate-50/50"></div>`; }

    const jobsForCalendar = originalRepairJobs.filter(j => selectedBranchFilter === 'ALL' || j.branch_name === selectedBranchFilter);

    let monthMaxQty = 1; 
    for(let day = 1; day <= totalDays; day++) {
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        const aQty = jobsForCalendar.filter(j => {
            const d = j.arrived_date || j.appointment_date;
            return d && String(d).split('T')[0] === dateStr;
        }).length;

        const tQty = jobsForCalendar.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr).length;
        const dQty = jobsForCalendar.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr).length;
        const maxInDay = Math.max(aQty, tQty, dQty);
        if (maxInDay > monthMaxQty) monthMaxQty = maxInDay;
    }

    const branchQuota = allQuotas.find(q => q.branch_name === (selectedBranchFilter === 'ALL' ? currentBranch : selectedBranchFilter)) || { max_main_parts: 0, max_sub_parts: 0 };
    const maxMain = branchQuota.max_main_parts || 0;
    const maxSub = branchQuota.max_sub_parts || 0;

    for(let day = 1; day <= totalDays; day++) {
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        const arrivedQty = jobsForCalendar.filter(j => {
            const d = j.arrived_date || j.appointment_date;
            return d && String(d).split('T')[0] === dateStr;
        }).length;

        const targetJobsInDay = jobsForCalendar.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr);
        const targetQty = targetJobsInDay.length;
        
        const doneQty = targetJobsInDay.filter(j => isJobDone(j.job_status)).length;
        const deliveryQty = jobsForCalendar.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr).length;

        let sumMainDay = 0, sumSubDay = 0;
        targetJobsInDay.forEach(j => {
            sumMainDay += Number(j.main_part_qty) || (j.main_part_name ? j.main_part_name.split(',').filter(Boolean).length : 0);
            sumSubDay += Number(j.sub_part_qty) || (j.sub_part_name ? j.sub_part_name.split(',').filter(Boolean).length : 0);
        });

        const overdueJobsInDay = jobsForCalendar.filter(j => (j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr) && checkOverdue(j));
        const hasOverdue = overdueJobsInDay.length > 0;
        
        const overMain = maxMain > 0 && sumMainDay > maxMain;
        const overSub = maxSub > 0 && sumSubDay > maxSub;

        let partsInfoHtml = '';
        if(sumMainDay > 0 || sumSubDay > 0) {
            partsInfoHtml = `<div class="text-[11px] font-bold mb-1 leading-tight w-full space-y-1">
                ${sumMainDay > 0 ? `<div class="flex justify-between items-center ${overMain ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'} px-2 py-0.5 rounded border ${overMain ? 'border-red-300' : 'border-blue-200'}" title="ชิ้นส่วนหลัก"><span>หลัก:</span> <span>${sumMainDay}${maxMain > 0 ? '/' + maxMain : ''}</span></div>` : ''}
                ${sumSubDay > 0 ? `<div class="flex justify-between items-center ${overSub ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'} px-2 py-0.5 rounded border ${overSub ? 'border-red-300' : 'border-amber-200'}" title="ชิ้นส่วนรอง"><span>รอง:</span> <span>${sumSubDay}${maxSub > 0 ? '/' + maxSub : ''}</span></div>` : ''}
            </div>`;
        }

        let barBlock = '';
        if(arrivedQty > 0 || targetQty > 0 || deliveryQty > 0) {
            barBlock = `<div class="flex items-end justify-center gap-1.5 w-full h-[65px] mt-auto pb-0.5">`;
            
            if(arrivedQty > 0) { 
                const h = Math.max(25, (arrivedQty / monthMaxQty) * 100); 
                barBlock += `<div class="flex flex-col items-center justify-end h-full w-[20px] cursor-pointer group-hover:scale-105 transition-transform" onclick="event.stopPropagation(); filterBoardByDate('${dateStr}', 'arrived')" title="รถเข้าจอด: ${arrivedQty} คัน">
                    <span class="text-[10px] font-black text-white bg-blue-500 rounded-sm w-5 h-5 flex items-center justify-center mb-1 shadow-sm">${arrivedQty}</span>
                    <div class="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-sm shadow-sm" style="height: ${h}%;"></div>
                </div>`; 
            }
            
            if(targetQty > 0) { 
                const h = Math.max(25, (targetQty / monthMaxQty) * 100); 
                const pctDone = (doneQty / targetQty) * 100;
                const isAllDone = doneQty === targetQty;
                
                barBlock += `<div class="flex flex-col items-center justify-end h-full w-[26px] cursor-pointer group-hover:scale-105 transition-transform" onclick="event.stopPropagation(); openDayListForTarget('${dateStr}')" title="เป้าซ่อมเสร็จ: ${targetQty} คัน (เสร็จแล้ว ${doneQty} คัน)">
                    <span class="text-[9px] font-black ${isAllDone ? 'text-emerald-700 bg-emerald-100 border-emerald-400' : 'text-amber-700 bg-amber-100 border-amber-400'} border rounded-sm w-full h-4 flex items-center justify-center mb-1 shadow-sm z-10">${doneQty}/${targetQty}</span>
                    <div class="w-full bg-slate-200 rounded-sm shadow-inner relative overflow-hidden" style="height: ${h}%;">
                        <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t ${isAllDone ? 'from-emerald-500 to-emerald-400' : 'from-amber-500 to-amber-300'} transition-all duration-500 ease-in-out" style="height: ${pctDone}%;"></div>
                    </div>
                </div>`; 
            }
            
            if(deliveryQty > 0) { 
                const h = Math.max(25, (deliveryQty / monthMaxQty) * 100); 
                barBlock += `<div class="flex flex-col items-center justify-end h-full w-[20px] cursor-pointer group-hover:scale-105 transition-transform" onclick="event.stopPropagation(); filterBoardByDate('${dateStr}', 'delivery')" title="นัดส่งมอบ: ${deliveryQty} คัน">
                    <span class="text-[10px] font-black text-white bg-indigo-500 rounded-sm w-5 h-5 flex items-center justify-center mb-1 shadow-sm">${deliveryQty}</span>
                    <div class="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-sm shadow-sm" style="height: ${h}%;"></div>
                </div>`; 
            }
            barBlock += `</div>`;
        } else { 
            barBlock = `<div class="flex items-center justify-center h-[65px] w-full mt-auto"><span class="text-xs text-slate-300">ว่าง</span></div>`; 
        }

        const todayStr = getTodayString();
        const isToday = dateStr === todayStr;

        grid.innerHTML += `
            <div class="calendar-cell group ${hasOverdue ? 'bg-red-50/50' : ''} ${isToday ? 'today' : ''}" onclick="clickCalendarDate('${dateStr}')">
                <div class="flex justify-between items-start z-10 w-full mb-1">
                    <span class="calendar-day-label">${day}</span>
                    ${hasOverdue ? `<i class="fa-solid fa-circle-exclamation text-red-500 animate-pulse text-sm" title="มีรถดีเลย์ ${overdueJobsInDay.length} คัน!"></i>` : ''}
                </div>
                ${partsInfoHtml}
                <div class="w-full z-10 flex-1 flex flex-col justify-end">${barBlock}</div>
            </div>`;
    }
}

function openDayListForTarget(dateStr) {
    const targetJobs = originalRepairJobs.filter(j => 
        (selectedBranchFilter === 'ALL' || j.branch_name === selectedBranchFilter) &&
        j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr
    );
    
    const doneJobs = targetJobs.filter(j => isJobDone(j.job_status));
    const pendingJobs = targetJobs.filter(j => !isJobDone(j.job_status));

    const title = `เป้าซ่อมเสร็จ วันที่ ${formatThaiDate(dateStr)}`;
    document.getElementById('dayListDateTitle').innerHTML = `<span class="text-[#00320D]"><i class="fa-solid fa-bullseye text-amber-500"></i> ${title} <span class="text-emerald-600 font-mono ml-2">(เสร็จแล้ว ${doneJobs.length}/${targetJobs.length} คัน)</span></span>`;
    
    let html = '';
    
    if (pendingJobs.length > 0) {
        html += `<h3 class="text-sm font-black text-amber-600 mb-2 border-b border-amber-200 pb-2"><i class="fa-solid fa-spinner fa-spin"></i> กำลังดำเนินการซ่อม (${pendingJobs.length} คัน)</h3>`;
        html += `<div class="bg-amber-50/50 border border-amber-200 rounded-xl overflow-hidden mb-6 shadow-sm"><div class="p-4 space-y-3">`;
        pendingJobs.forEach(j => html += generateMiniCardHTML(j, 'target'));
        html += `</div></div>`;
    }

    if (doneJobs.length > 0) {
        html += `<h3 class="text-sm font-black text-emerald-600 mb-2 border-b border-emerald-200 pb-2"><i class="fa-solid fa-check-double"></i> ซ่อมเสร็จแล้ว (${doneJobs.length} คัน)</h3>`;
        html += `<div class="bg-emerald-50/50 border border-emerald-200 rounded-xl overflow-hidden mb-6 shadow-sm"><div class="p-4 space-y-3">`;
        doneJobs.forEach(j => html += generateMiniCardHTML(j, 'target_done'));
        html += `</div></div>`;
    }

    if (targetJobs.length === 0) {
        html = `<div class="text-center py-10 text-slate-400 font-bold">ไม่มีเป้าซ่อมเสร็จในวันนี้</div>`;
    }

    document.getElementById('dayListContent').innerHTML = html;
    document.getElementById('dayListModal').classList.remove('hidden');
}

function filterBoardByDate(dateStr, type) {
    switchTab('tab-board');
    activeFilters = {}; 
    activeKpiFilter = null;
    isCalendarFilterActive = true; 
    
    let colIdx;
    if (type === 'arrived') {
        const col = columnsDef.find(c => c.key === 'arrived_date' || c.key === 'appointment_date');
        if (col) colIdx = col.idx;
    }
    if (type === 'target') colIdx = columnsDef.find(c => c.key === 'target_finish_date').idx;
    if (type === 'delivery') colIdx = columnsDef.find(c => c.key === 'delivery_date').idx;
    
    if (colIdx !== undefined) activeFilters[colIdx] = new Set([dateStr]);
    
    document.querySelectorAll('.filter-icon').forEach(icon => icon.classList.remove('active'));
    const thIcon = document.getElementById(`th_${colIdx}`)?.querySelector('.filter-icon');
    if (thIcon) thIcon.classList.add('active');
    
    runTableFilters();
}

function clickCalendarDate(dateString) {
    switchTab('tab-board');
    activeFilters = {}; 
    activeKpiFilter = null;
    isCalendarFilterActive = true; 
    document.getElementById('global_search_input').value = formatThaiDate(dateString);
    runTableFilters();
}

function generateMiniCardHTML(j, type) {
    const isOverdue = checkOverdue(j);
    const station = computeHighestStationIFS(j);
    const mainPartsStr = j.main_part_name && j.main_part_name.trim() !== '' ? j.main_part_name : '-';
    const subPartsStr = j.sub_part_name && j.sub_part_name.trim() !== '' ? j.sub_part_name : '-';
    
    const carParts = allPartOrders.filter(po => {
        if (po.order_status === 'ยกเลิก') return false;
        if (po.job_id) return String(po.job_id) === String(j.id); 
        if (po.car_plate !== j.car_plate) return false;
        if (j.qt_no && po.qt_no && j.qt_no.includes(po.qt_no)) return true;
        if (j.so_no && po.so_no && j.so_no.includes(po.so_no)) return true;
        return (!po.qt_no && !po.so_no);
    });
    
    let partsHTML = '';
    if(carParts.length > 0) {
        partsHTML = carParts.map(p => {
            let isComplete = p.order_status && p.order_status.includes('ครบ'); 
            let colorClass = isComplete ? 'text-emerald-600' : ((p.order_status && (p.order_status.includes('รอ') || p.order_status.includes('Back Order'))) ? 'text-rose-500' : 'text-amber-600');
            return `<span class="${colorClass} text-xs block font-bold mb-0.5"><i class="fa-solid ${isComplete ? 'fa-check' : 'fa-clock'}"></i> ${p.part_name}</span>`;
        }).join('');
    } else { partsHTML = '<span class="text-slate-400 text-[11px] italic">- ไม่มีสั่งเบิก -</span>'; }

    let dateLabel = '';
    if(type === 'arrived') dateLabel = `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded border border-blue-200 font-bold"><i class="fa-solid fa-car"></i> รถเข้าจอด (รอซ่อม)</span>`;
    else if(type === 'target') dateLabel = `<span class="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded border border-amber-200 font-bold"><i class="fa-solid fa-bullseye"></i> เป้าซ่อม</span>`;
    else if(type === 'target_done') dateLabel = `<span class="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded border border-emerald-200 font-bold"><i class="fa-solid fa-check-double"></i> ซ่อมเสร็จแล้ว</span>`;
    else if(type === 'delivery') dateLabel = `<span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded border border-indigo-200 font-bold"><i class="fa-solid fa-car-side"></i> นัดส่งมอบ</span>`;
    else if(type === 'repairing') dateLabel = `<span class="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded border border-amber-200 font-bold"><i class="fa-solid fa-hammer"></i> กำลังดำเนินการซ่อม</span>`;
    else if(type === 'done') dateLabel = `<span class="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded border border-emerald-200 font-bold"><i class="fa-solid fa-check-double"></i> ซ่อมเสร็จ</span>`;
    else if(type === 'delayed') dateLabel = `<span class="bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded border border-rose-200 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> ล่าช้า (Overdue)</span>`;

    return `
        <div class="bg-white border ${isOverdue ? 'border-red-300 shadow-sm bg-red-50/20' : 'border-slate-200 hover:border-amber-400 shadow-sm'} rounded-xl p-4 mb-3 transition w-full">
            <div class="flex justify-between items-start mb-3">
                <div class="font-bold ${isOverdue ? 'text-red-600' : 'text-slate-800'} text-base">
                    <span class="${isOverdue ? 'bg-red-500 text-white border-red-600' : 'text-[#00320D] bg-slate-100 border-slate-300'} px-2 py-1 rounded font-mono mr-1 border text-sm">${isOverdue ? '<i class="fa-solid fa-circle-exclamation mr-1"></i>' : ''}${j.car_plate || '-'}</span> 
                    ${j.car_brand} <span class="text-slate-500 font-medium">${j.car_model || ''}</span>
                </div>
                <div class="text-right">${dateLabel}</div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                <div><p class="text-[11px] font-black text-blue-600 mb-1">ชิ้นหลักทำสี:</p><p class="text-xs text-slate-700 font-medium leading-relaxed">${mainPartsStr}</p></div>
                <div class="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3"><p class="text-[11px] font-black text-amber-600 mb-1">ชิ้นรองทำสี:</p><p class="text-xs text-slate-700 font-medium leading-relaxed">${subPartsStr}</p></div>
                <div class="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3"><p class="text-[11px] font-black text-purple-600 mb-1">สถานะสั่งอะไหล่:</p><div>${partsHTML}</div></div>
            </div>
            <div class="flex justify-between items-center mt-1">
                <div class="text-xs text-slate-600 font-bold">สถานีล่าสุด: <span class="text-amber-600 ml-1 text-sm">${station}</span></div>
                <button onclick="closeDayListModal(); switchTab('tab-board'); document.getElementById('global_search_input').value='${j.car_plate}'; runTableFilters(); openModal('${j.id}');" class="px-4 py-1.5 bg-[#00320D] hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition"><i class="fa-solid fa-sliders"></i> อัปเดต</button>
            </div>
        </div>
    `;
}

function closeDayListModal() { document.getElementById('dayListModal').classList.add('hidden'); }