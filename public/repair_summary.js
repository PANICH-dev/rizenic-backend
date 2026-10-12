// ==========================================
// 📊 โมดูลสรุปสถานี (Tab 2: Donut Chart & Breakdown)
// ==========================================

function renderPieChartAndList() {
    // 🌟 1. แสดง Loader ทันทีก่อนเริ่มประมวลผล เพื่อไม่ให้หน้าจอค้าง
    const breakdownDiv = document.getElementById('station_breakdown_list');
    if (breakdownDiv) {
        breakdownDiv.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm"><i class="fa-solid fa-circle-notch fa-spin text-amber-500 text-2xl mb-2 block"></i> กำลังสรุปข้อมูลสถานี...</div>';
    }

    // 🌟 2. โยนการคำนวณที่หนักไปไว้ใน setTimeout
    setTimeout(() => {
        const counters = { "ส่งจ๊อบ":0, "เคาะ":0, "โป๊ว":0, "เตรียมพื้น":0, "พ่นสี":0, "ประกอบ":0, "ขัดสี":0, "QC":0, "แม็ก":0, "กระจก":0, "ฟิล์ม":0, "พักซ่อม":0, "รอส่งมอบ":0 };
        const stationJobs = {}; 
        Object.keys(counters).forEach(k => stationJobs[k] = []); 

        originalRepairJobs.forEach(j => {
            if (selectedBranchFilter !== 'ALL' && j.branch_name !== selectedBranchFilter) return;

            const st = j.job_status || '';
            if(st.includes('ยกเลิก')) return; 
            if(j.department_routing !== 'ซ่อม') return;

            const fullStation = computeHighestStationIFS(j);
            let key = "ส่งจ๊อบ"; 

            if(fullStation.includes("รอส่งมอบ") || st.includes("11.รถซ่อมเสร็จรอส่งมอบ") || st.includes("12.รอส่งมอบ")) key = "รอส่งมอบ";
            else if(fullStation.includes("เคาะ")) key = "เคาะ"; 
            else if(fullStation.includes("โป๊ว")) key = "โป๊ว"; 
            else if(fullStation.includes("เตรียมพื้น")) key = "เตรียมพื้น"; 
            else if(fullStation.includes("พ่นสี")) key = "พ่นสี"; 
            else if(fullStation.includes("ประกอบ")) key = "ประกอบ"; 
            else if(fullStation.includes("ขัดสี")) key = "ขัดสี"; 
            else if(fullStation.includes("QC")) key = "QC"; 
            else if(fullStation.includes("แม็ก")) key = "แม็ก"; 
            else if(fullStation.includes("กระจก")) key = "กระจก"; 
            else if(fullStation.includes("ฟิล์ม")) key = "ฟิล์ม"; 
            else if(fullStation.includes("พักซ่อม")) key = "พักซ่อม"; 
            
            if(counters[key] !== undefined) { 
                counters[key]++; 
                stationJobs[key].push(j); 
            }
        });

        if(chartInstance) chartInstance.destroy();
        const chartEl = document.getElementById('stationPieChart');
        if(!chartEl) return;
        
        const ctx = chartEl.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counters).filter(k => counters[k] > 0), 
                datasets: [{ 
                    data: Object.values(counters).filter(v => v > 0), 
                    backgroundColor: ['#64748b', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6b7280'],
                    borderWidth: 1, borderColor: '#ffffff', hoverOffset: 12
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { 
                    legend: { position: 'right', labels: { color: '#475569', font: { family: 'Kanit', size: 13 } } },
                    datalabels: { color: '#ffffff', font: { family: 'Kanit', weight: 'bold', size: 13 }, textAlign: 'center', formatter: (val, context) => { return val > 0 ? context.chart.data.labels[context.dataIndex] + '\n' + val + ' คัน' : ''; } }
                }, 
                cutout: '55%',
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const labelName = chartInstance.data.labels[index];
                        
                        if (labelName === 'รอส่งมอบ') {
                            filterBoardByKpi('done');
                        } else {
                            switchTab('tab-board');
                            let filterVal = labelName;
                            if(labelName === 'พักซ่อม') filterVal = '11.พักซ่อม';
                            else if(labelName === 'ฟิล์ม') filterVal = '10.ฟิล์ม';
                            else if(labelName === 'กระจก') filterVal = '09.กระจก';
                            else if(labelName === 'แม็ก') filterVal = '08.แม็ก';
                            else if(labelName === 'QC') filterVal = '07.QC';
                            else if(labelName === 'ขัดสี') filterVal = '06.ขัดสี';
                            else if(labelName === 'ประกอบ') filterVal = '05.ประกอบ';
                            else if(labelName === 'พ่นสี') filterVal = '04.พ่นสี';
                            else if(labelName === 'เตรียมพื้น') filterVal = '03.เตรียมพื้น';
                            else if(labelName === 'โป๊ว') filterVal = '02.โป๊ว';
                            else if(labelName === 'เคาะ') filterVal = '01.เคาะ';
                            else if(labelName === 'ส่งจ๊อบ') filterVal = 'ส่งจ๊อบ'; 

                            document.getElementById('global_search_input').value = filterVal;
                            runTableFilters();
                        }
                    }
                }
            }
        });

        if(!breakdownDiv) return;
        
        let listHTML = '';
        Object.keys(stationJobs).forEach(stationKey => {
            if(stationJobs[stationKey].length > 0) {
                stationJobs[stationKey].sort((a, b) => {
                    let dateA = a.target_finish_date ? new Date(a.target_finish_date).getTime() : Infinity; 
                    let dateB = b.target_finish_date ? new Date(b.target_finish_date).getTime() : Infinity;
                    return dateA - dateB;
                });

                const safeKeyId = stationKey.replace(/[\s\.\/]/g, '_');
                listHTML += `
                    <div class="mb-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-300">
                        <div onclick="document.getElementById('collapse_${safeKeyId}').classList.toggle('hidden'); this.querySelector('.fa-chevron-down').classList.toggle('rotate-180');" class="bg-slate-50 hover:bg-slate-100 px-5 py-4 flex justify-between items-center border-b border-slate-200 cursor-pointer select-none transition-colors">
                            <h4 class="font-bold text-[#00320D] text-base flex items-center gap-2"><i class="fa-solid fa-layer-group text-amber-500"></i> สถานี: ${stationKey}</h4>
                            <div class="flex items-center gap-3">
                                <span class="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full">${stationJobs[stationKey].length} คัน</span>
                                <i class="fa-solid fa-chevron-down text-slate-400 transition-transform duration-300"></i>
                            </div>
                        </div>
                        <div id="collapse_${safeKeyId}" class="divide-y divide-slate-100 hidden">
                `;
                stationJobs[stationKey].forEach(j => {
                    const target = j.target_finish_date ? formatThaiDate(j.target_finish_date) : 'ยังไม่ระบุ'; 
                    const actual = j.repair_finish_date ? j.repair_finish_date.split('T')[0] : '';
                    const isOverdue = checkOverdue(j);
                    listHTML += `
                        <div class="px-5 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center hover:bg-amber-50/40 transition gap-4 ${isOverdue ? 'bg-red-50/50' : ''}">
                            <div>
                                <span class="text-slate-800 font-mono font-bold px-2 py-1 rounded text-sm mr-2 border shadow-sm ${isOverdue ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-slate-300'}">${isOverdue ? '<i class="fa-solid fa-circle-exclamation text-red-500 mr-1"></i>' : ''}${j.car_plate || '-'}</span>
                                <span class="text-slate-600 text-sm font-semibold">${j.car_brand} ${j.car_model || ''}</span>
                            </div>
                            <div class="flex items-center gap-6 w-full lg:w-auto justify-between lg:justify-end">
                                <div class="text-right"><div class="text-[11px] text-slate-500 mb-0.5">เป้าซ่อมเสร็จ</div><div class="text-sm font-mono font-bold ${isOverdue ? 'text-red-500' : (target === 'ยังไม่ระบุ' ? 'text-slate-400' : 'text-blue-600')}">${target}</div></div>
                                <div class="text-right flex items-center gap-3">
                                    <div class="text-right hidden sm:block">
                                        <div class="text-[11px] text-[#00320D] mb-0.5 font-bold"><i class="fa-solid fa-pen text-[9px] text-amber-500"></i> เสร็จจริง</div>
                                        <input type="date" min="${getTodayString()}" value="${actual}" onchange="fastUpdateField('${j.id}', 'repair_finish_date', this.value); setTimeout(renderPieChartAndList, 800);" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-[#00320D] font-bold outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 hover:bg-slate-50 transition cursor-pointer w-[130px] shadow-sm">
                                    </div>
                                    <button onclick="openModal('${j.id}')" class="ml-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-[#00320D] text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 whitespace-nowrap"><i class="fa-solid fa-pen-to-square"></i> อัปเดต</button>
                                </div>
                            </div>
                        </div>`;
                });
                listHTML += `</div></div>`;
            }
        });
        
        breakdownDiv.innerHTML = listHTML || '<div class="text-center py-10 text-slate-500 text-base font-bold">🎉 ไม่มีรถค้างในสถานีเลยครับ!</div>';
        
    }, 15); // ตั้งหน่วง 15ms เพื่อคืนพื้นที่ให้ UI วาดรูปโหลดให้เสร็จก่อน
}