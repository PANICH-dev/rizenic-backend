let currentSchedMonth = new Date().getMonth();
let currentSchedYear = new Date().getFullYear();
let allSchedJobs = [];
let allSchedQuotas = [];
let currentTargetField = 'all'; 

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