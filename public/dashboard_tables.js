// ==========================================
// 🧑‍💼 ยอดงานรายบุคคล (SA) - เฉพาะงานที่กำลังดำเนินการ
// ==========================================
function renderSASection() {
    const container = document.getElementById('sa_list_container');
    if (!container) return;

    const saCounts = {};
    
    // 🎯 รายการสถานะที่ "ไม่เอา" (ตัดออกจากการคำนวณงานปัจจุบัน)
    const excludedStatuses = [
        '12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', 
        '15.วางบิล Tesla', '16.วางบิล EV ME', '17.รอออกบิล', 
        '18.ลูกค้ายกเลิก', '19.ออกบิลแล้ว', '20.จอดซ่อม TC', 
        '21.พักซ่อม', 'ปิดงาน', 'ส่งมอบแล้ว'
    ];

    // 1. กรองเอาเฉพาะงานที่กำลังดำเนินการจริงๆ
    const activeJobs = filteredJobs.filter(job => {
        const st = (job.job_status || '').trim();
        if (!st) return false; // ถ้าไม่มีสถานะ ไม่นับ
        // เช็กว่าสถานะของรถคันนี้ อยู่ในกลุ่มที่ถูกตัดออกหรือไม่
        const isExcluded = excludedStatuses.some(ex => st.includes(ex));
        return !isExcluded; // ถ้าไม่ถูกตัดออก ถึงจะนับเป็นงาน Active
    });

    // 2. นับยอดงานให้ SA แต่ละคน
    activeJobs.forEach(job => {
        const sa = (job.sa_owner || 'ไม่ระบุ').trim();
        saCounts[sa] = (saCounts[sa] || 0) + 1;
    });

    // 3. เรียงลำดับคนที่มีงานเยอะสุดขึ้นก่อน
    const sortedSA = Object.entries(saCounts).sort((a, b) => b[1] - a[1]);

    if (sortedSA.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 font-bold">ไม่มีงานกำลังดำเนินการ</div>`;
        return;
    }

    // 4. วาดกล่องรายชื่อ (พร้อมกำหนดสีแจ้งเตือนถ้างานล้นมือ)
    container.innerHTML = sortedSA.map(([sa, count]) => {
        let textClass = 'text-blue-600';
        let bgClass = 'bg-blue-50';
        let borderClass = 'border-slate-100 hover:border-blue-300';

        // Heatmap แจ้งเตือน SA งานล้น
        if (count >= 15) {
            textClass = 'text-rose-600';
            bgClass = 'bg-rose-50';
            borderClass = 'border-rose-200 hover:border-rose-400';
        } else if (count >= 10) {
            textClass = 'text-orange-500';
            bgClass = 'bg-orange-50';
            borderClass = 'border-orange-200 hover:border-orange-400';
        }

        return `
        <div onclick="openSAModal('${sa}')" class="flex justify-between items-center bg-white border ${borderClass} p-2.5 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer transform hover:-translate-y-0.5">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full ${bgClass} ${textClass} flex items-center justify-center font-bold text-sm shadow-inner">
                    <i class="fa-solid fa-user-tie"></i>
                </div>
                <span class="font-bold text-slate-700 text-sm">${sa}</span>
            </div>
            <div class="text-right flex items-baseline gap-1">
                <span class="text-xl font-black ${textClass}">${count}</span>
                <span class="text-[10px] text-slate-400 font-bold">คัน</span>
            </div>
        </div>`;
    }).join('');
}

// 🎯 ฟังก์ชันสำหรับคลิกดู Pop-up รถของ SA คนนั้นๆ (ใช้ตัวกรองเดียวกัน)
function openSAModal(saName) {
    const excludedStatuses = [
        '12.ส่งมอบ', '13.วางบิลประกัน', '14.ชำระเงินสด', 
        '15.วางบิล Tesla', '16.วางบิล EV ME', '17.รอออกบิล', 
        '18.ลูกค้ายกเลิก', '19.ออกบิลแล้ว', '20.จอดซ่อม TC', 
        '21.พักซ่อม', 'ปิดงาน', 'ส่งมอบแล้ว'
    ];

    const jobsToShow = filteredJobs.filter(job => {
        const st = (job.job_status || '').trim();
        const sa = (job.sa_owner || 'ไม่ระบุ').trim();
        
        if (sa !== saName) return false;
        if (!st) return false;
        return !excludedStatuses.some(ex => st.includes(ex));
    });

    if(document.getElementById('modal_status_name')) {
        document.getElementById('modal_status_name').innerHTML = `<i class="fa-solid fa-user-tie mr-2"></i> งานที่กำลังดำเนินการของ SA: ${saName}`;
    }
    
    if(typeof renderJobTableInModalGroupedBySA === 'function') {
        renderJobTableInModalGroupedBySA(jobsToShow);
    }
    
    if(document.getElementById('jobListModal')) {
        document.getElementById('jobListModal').classList.remove('hidden');
    }
}



function computeHighestStationIFS(j) {
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
    
    filteredJobs.filter(j => !j.job_status?.includes('ส่งมอบแล้ว')).forEach(j => {
        const s = computeHighestStationIFS(j);
        if(stCounts[s] !== undefined) stCounts[s]++;
    });

    const container = document.getElementById('station_list_container');
    container.innerHTML = Object.keys(stCounts).map(st => `
        <div onclick="openStationModal('${st}')" class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center cursor-pointer hover:border-orange-500 hover:shadow hover:bg-white transition-all group">
            <span class="text-xs font-bold text-slate-700 group-hover:text-orange-600 transition-colors truncate" title="${st}">${st.replace(/[0-9.]/g, '')}</span>
            <span class="bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200 text-xs font-black shadow-sm">${stCounts[st]}</span>
        </div>
    `).join('');
}

function openStationModal(stationName) {
    document.getElementById('modal_status_name').innerText = `สถานีช่าง: ${stationName}`;
    const jobsToShow = filteredJobs.filter(j => j.job_status !== '12.ส่งมอบแล้ว' && computeHighestStationIFS(j) === stationName);
    renderJobTableInModalGroupedBySA(jobsToShow);
    document.getElementById('jobListModal').classList.remove('hidden');
}

function sortTable(tableId, colIndex) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => icon.className = "fa-solid fa-sort sort-icon");

    let dir = table.getAttribute(`data-dir-${colIndex}`) || 'asc';
    table.setAttribute(`data-dir-${colIndex}`, dir === 'asc' ? 'desc' : 'asc');
    
    const clickedIcon = table.querySelectorAll('th')[colIndex].querySelector('.sort-icon');
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

function renderStationTable() {
    const tbody = document.getElementById('station_table_body');
    const activeStations = ["01.เคาะ", "02.โป๊ว", "03.เตรียมพื้น", "04.พ่นสี", "05.ประกอบ", "06.ขัดสี", "08.เก็บงาน", "09.ซ่อมแม็ก", "10.กระจก", "11.ฟิล์ม"];
    
    const inRepairCars = filteredJobs.filter(j => {
        if((j.job_status||'').includes('ส่งมอบแล้ว') || (j.job_status||'').includes('12.ส่งมอบ')) return false;
        return activeStations.includes(computeHighestStationIFS(j));
    });
    
    if(inRepairCars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-slate-50">ไม่มีรถกำลังดำเนินการในสถานีช่างขณะนี้ 🎉</td></tr>`;
        return;
    }

    inRepairCars.sort((a,b) => new Date(a.target_finish_date||'9999') - new Date(b.target_finish_date||'9999'));

    const today = new Date(); today.setHours(0,0,0,0);

    tbody.innerHTML = inRepairCars.map(j => {
        const target = j.target_finish_date ? j.target_finish_date.split('T')[0] : '-';
        const actual = j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '-';
        const delivery = j.delivery_date ? j.delivery_date.split('T')[0] : '-';
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
                <td class="px-4 py-3 text-xs font-bold text-slate-700">${j.car_brand} ${j.car_model || ''}</td>
                <td class="px-4 py-3 text-xs font-medium text-slate-600 truncate max-w-[150px]" title="${j.customer_name}">${j.customer_name || '-'}</td>
                <td class="px-4 py-3 text-xs font-bold text-slate-700"><span class="bg-slate-100 px-2 py-1 rounded shadow-sm border border-slate-200">${j.job_status || '-'}</span></td>
                <td class="px-4 py-3 text-xs font-black text-orange-600 bg-orange-50/30"><i class="fa-solid fa-wrench"></i> ${station.replace(/[0-9.]/g, '')}</td>
                <td class="px-4 py-3 font-mono text-xs text-blue-600 text-center font-bold">${target}</td>
                <td class="px-4 py-3 font-mono text-xs text-emerald-600 text-center font-bold">${actual}</td>
                <td class="px-4 py-3 font-mono text-xs text-purple-600 text-center font-bold">${delivery}</td>
                <td class="px-4 py-3 text-center"><button class="bg-white text-orange-600 border border-orange-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition shadow-sm whitespace-nowrap"><i class="fa-solid fa-folder-open"></i> ดูใบงาน</button></td>
            </tr>
        `;
    }).join('');
}

function renderParkedCars() {
    const tbody = document.getElementById('parked_cars_body');
    const parkedStatuses = ["08.นัดหมายแล้วรอเข้าซ่อม", "09.จอดรอเข้าซ่อม", "10.กำลังซ่อม", "11.รถซ่อมเสร็จรอส่งมอบ", "20.จอดซ่อม TC", "21.พักซ่อม"];
    
    const parkedCars = filteredJobs.filter(j => parkedStatuses.some(p => (j.job_status || '').includes(p)));
    
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
                <td class="font-bold text-slate-800 px-4 py-3 text-xs">${j.car_brand} ${j.car_model || ''}</td>
                <td class="truncate max-w-[150px] font-medium text-slate-700 px-4 py-3 text-xs" title="${j.customer_name}">${j.customer_name || '-'}</td>
                <td class="font-bold text-orange-600 text-xs px-4 py-3"><i class="fa-solid fa-wrench"></i> ${computeHighestStationIFS(j).replace(/[0-9.]/g, '')}</td>
                <td class="font-mono text-xs text-blue-600 text-center font-bold px-4 py-3">${j.target_finish_date ? j.target_finish_date.split('T')[0] : '-'}</td>
                <td class="font-mono text-xs text-emerald-600 text-center font-bold px-4 py-3">${j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '-'}</td>
                <td class="font-mono text-xs text-purple-600 text-center font-bold px-4 py-3">${j.delivery_date ? j.delivery_date.split('T')[0] : '-'}</td>
                <td class="font-bold text-slate-600 text-[11px] px-4 py-3"><span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm">${j.job_status || '-'}</span></td>
                <td class="text-center px-4 py-3"><button class="bg-[#00320D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> ดูข้อมูล</button></td>
            </tr>
        `;
    }).join('');
}


// ==========================================
// 🗓️ ปฏิทินปฏิบัติงาน (แสดงหลอดโควต้ารถเข้า + อะไหล่ + เป้าเสร็จ + ส่งมอบ)
// ==========================================
function renderCalendarByRange(startStr, endStr) {
    const grid = document.getElementById('calendar_grid');
    if (!grid) return;

    if (!startStr || !endStr) {
        grid.innerHTML = `<div class="col-span-7 text-center py-10 text-slate-400 font-bold">กรุณาเลือกช่วงเวลา</div>`;
        return;
    }
    
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    // ปรับให้เริ่มที่วันอาทิตย์ (เพื่อให้ลง Grid 7 ช่องพอดี)
    const startCalendar = new Date(startDate);
    startCalendar.setDate(startCalendar.getDate() - startCalendar.getDay());
    
    // ปรับให้จบที่วันเสาร์
    const endCalendar = new Date(endDate);
    if (endCalendar.getDay() !== 6) {
        endCalendar.setDate(endCalendar.getDate() + (6 - endCalendar.getDay()));
    }

    let html = '';
    let current = new Date(startCalendar);
    const todayStr = new Date().toISOString().split('T')[0];

    while (current <= endCalendar) {
        const dateStr = current.toISOString().split('T')[0];
        const isOutOfRange = current < startDate || current > endDate;
        const isToday = dateStr === todayStr;

        if (isOutOfRange) {
            html += `<div class="bg-slate-100 border border-slate-200 rounded-xl p-2 opacity-50"></div>`;
        } else {
            // ดึงข้อมูลรถของวันนี้
            const arrivedJobs = filteredJobs.filter(j => j.arrived_date && j.arrived_date.split('T')[0] === dateStr);
            const targetJobs = filteredJobs.filter(j => j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr);
            const deliveredJobs = filteredJobs.filter(j => j.delivery_date && j.delivery_date.split('T')[0] === dateStr);
            
            // 🎯 จำลองข้อมูลโควต้า (ดึงจาก allQuotas ถ้ามี หรือใช้ค่าเริ่มต้น: รถ 5 คัน / อะไหล่ 10 ชิ้น)
            const quotaData = allQuotas.find(q => q.quota_date && q.quota_date.split('T')[0] === dateStr) || {};
            const intakeLimit = parseInt(quotaData.intake_quota || 5); 
            const partsLimit = parseInt(quotaData.parts_quota || 10);  
            
            // 1. คำนวณหลอด Progress Bar รถเข้า
            const arrivedCount = arrivedJobs.length;
            let intakePercent = (arrivedCount / intakeLimit) * 100;
            if (intakePercent > 100) intakePercent = 100;
            
            // เปลี่ยนสีหลอดตามความหนาแน่น
            let intakeColor = 'bg-blue-500';
            let intakeText = 'text-blue-600';
            if (arrivedCount >= intakeLimit) {
                intakeColor = 'bg-rose-500'; // เต็มโควต้า
                intakeText = 'text-rose-600';
            } else if (arrivedCount >= intakeLimit - 1) {
                intakeColor = 'bg-orange-500'; // ใกล้เต็ม
                intakeText = 'text-orange-600';
            }

            // 2. คำนวณยอดอะไหล่
            const partsCount = filteredPartOrders.filter(p => p.order_date && p.order_date.split('T')[0] === dateStr).length;
            const partsText = partsCount >= partsLimit ? 'text-rose-600' : 'text-purple-600';

            // ตกแต่งช่องปฏิทิน
            let cellClass = "bg-white border border-slate-200 rounded-xl p-2 min-h-[140px] flex flex-col justify-start hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer relative";
            if (isToday) cellClass += " ring-2 ring-amber-400 bg-amber-50/20";

            html += `
            <div class="${cellClass}" onclick="openCalendarModal('${dateStr}')">
                <div class="flex justify-between items-start mb-1.5 px-1">
                    <span class="text-sm font-black ${isToday ? 'text-amber-600 bg-amber-100 px-2 py-0.5 rounded shadow-sm' : 'text-slate-400'}">${current.getDate()}</span>
                </div>
                
                <div class="flex-1 flex flex-col gap-1.5 w-full">
                    
                    <!-- 🚘 หลอดรับรถเข้า (Intake Quota) -->
                    <div class="bg-slate-50 p-1.5 rounded-lg border border-slate-100 shadow-inner">
                        <div class="flex justify-between items-center text-[10px] font-bold mb-1">
                            <span class="text-slate-600 flex items-center gap-1"><i class="fa-solid fa-arrow-right-to-bracket text-blue-500"></i> รถเข้า</span>
                            <span class="${intakeText} font-black">${arrivedCount}/${intakeLimit}</span>
                        </div>
                        <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div class="${intakeColor} h-1.5 rounded-full transition-all duration-500" style="width: ${intakePercent}%"></div>
                        </div>
                    </div>

                    <!-- 📦 โควต้าสั่งอะไหล่ (Parts Quota) -->
                    <div class="flex justify-between items-center text-[10px] font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-100 shadow-inner">
                        <span class="text-slate-600 flex items-center gap-1"><i class="fa-solid fa-boxes-stacked text-purple-500"></i> อะไหล่</span>
                        <span class="${partsText} font-black">${partsCount}/${partsLimit}</span>
                    </div>

                    <!-- 🎯 เป้าเสร็จ & ส่งมอบ -->
                    <div class="grid grid-cols-2 gap-1.5 mt-auto">
                        <div class="bg-gradient-to-b from-amber-50 to-white text-amber-700 py-1 rounded-lg border border-amber-200 flex flex-col items-center shadow-sm">
                            <span class="text-[9px] font-bold opacity-80">เป้าเสร็จ</span>
                            <span class="text-sm font-black">${targetJobs.length}</span>
                        </div>
                        <div class="bg-gradient-to-b from-emerald-50 to-white text-emerald-700 py-1 rounded-lg border border-emerald-200 flex flex-col items-center shadow-sm">
                            <span class="text-[9px] font-bold opacity-80">ส่งมอบ</span>
                            <span class="text-sm font-black">${deliveredJobs.length}</span>
                        </div>
                    </div>

                </div>
            </div>
            `;
        }
        current.setDate(current.getDate() + 1);
    }
    grid.innerHTML = html;
}

// 🎯 ฟังก์ชันสำหรับคลิกดูรายละเอียดรถทุกประเภทในวันนั้น
function openCalendarModal(dateStr) {
    if(document.getElementById('modal_status_name')) {
        document.getElementById('modal_status_name').innerHTML = `<i class="fa-solid fa-calendar-day mr-2"></i> แผนปฏิบัติงานประจำวันที่: ${dateStr}`;
    }
    
    // ดึงงานที่มีความเคลื่อนไหวในวันนั้นมาโชว์ทั้งหมด (รถเข้า, เป้าเสร็จ, ส่งมอบ)
    const jobsToShow = filteredJobs.filter(j => {
        const arr = j.arrived_date && j.arrived_date.split('T')[0] === dateStr;
        const tar = j.target_finish_date && j.target_finish_date.split('T')[0] === dateStr;
        const del = j.delivery_date && j.delivery_date.split('T')[0] === dateStr;
        return arr || tar || del;
    });

    if(typeof renderJobTableInModalGroupedBySA === 'function') {
        renderJobTableInModalGroupedBySA(jobsToShow);
    }
    if(document.getElementById('jobListModal')) {
        document.getElementById('jobListModal').classList.remove('hidden');
    }
}

function renderJobTableInModalGroupedBySA(jobs) {
    const container = document.getElementById('modal_job_container');
    if (jobs.length === 0) { container.innerHTML = `<div class="text-center py-10 text-slate-500 font-bold bg-white m-4 rounded-xl shadow-sm">ไม่มีข้อมูล</div>`; return; }

    const groupedBySA = {};
    jobs.forEach(j => {
        const sa = j.sa_owner || 'ไม่ระบุ SA';
        if(!groupedBySA[sa]) groupedBySA[sa] = [];
        groupedBySA[sa].push(j);
    });

    let finalHtml = '';
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
            let safeOptions = globalStatusOptionsHtml;
            if(!safeOptions.includes(`value="${safeStatus}"`)) { safeOptions = `<option value="${safeStatus}">${safeStatus}</option>` + safeOptions; } 
            safeOptions = safeOptions.replace(`value="${safeStatus}"`, `value="${safeStatus}" selected`); 

            finalHtml += `
                <tr class="hover:bg-emerald-50/50 transition cursor-pointer" onclick="goToEditJob('${j.id}')">
                    <td class="px-4 py-3 font-bold text-[#00320D] align-top"><span class="bg-slate-100 border border-slate-300 px-2.5 py-1 rounded font-mono text-xs shadow-inner whitespace-nowrap">${j.car_plate || '-'}</span></td>
                    <td class="px-4 py-3 align-top"><div class="font-bold text-slate-800 text-[11px] leading-tight mb-1">${j.car_brand} <span class="text-slate-500 font-medium">${j.car_model || ''}</span></div><div class="text-[11px] font-bold text-slate-700 truncate max-w-[150px]" title="${j.customer_name}">${j.customer_name || '-'}</div></td>
                    <td class="px-4 py-3 text-[11px] font-bold text-slate-700 align-top"><div class="text-blue-600 mb-0.5"><i class="fa-solid fa-layer-group text-blue-400 mr-1"></i> หลัก: ${j.main_part_name || '-'}</div><div class="text-amber-600 mb-1"><i class="fa-solid fa-puzzle-piece text-amber-400 mr-1"></i> รอง: ${j.sub_part_name || '-'}</div><div class="text-purple-600 pt-1 border-t border-slate-100"><i class="fa-solid fa-box text-purple-400 mr-1"></i> อะไหล่: <span class="bg-purple-50 px-1.5 py-0.5 rounded shadow-sm border border-purple-200">${j.part_status || '-'}</span></div></td>
                    <td class="px-4 py-3 text-[10px] font-bold text-slate-700 align-top"><select onclick="event.stopPropagation()" onchange="fastUpdateJob('${j.id}', 'job_status', this.value)" class="bg-slate-50 border border-slate-300 rounded px-2 py-1 outline-none focus:border-amber-500 w-full cursor-pointer font-bold text-[#00320D]">${safeOptions}</select></td>
                    <td class="px-4 py-3 text-center align-top"><button onclick="event.stopPropagation(); goToEditJob('${j.id}')" class="bg-[#00320D] text-[#ffffff] px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition shadow-md w-full whitespace-nowrap"><i class="fa-solid fa-pen"></i> เปิด</button></td>
                </tr>`;
        });
        finalHtml += `</tbody></table></div>`;
    });
    container.innerHTML = finalHtml;
}