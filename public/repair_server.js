'use strict';

const REPAIR_SERVER_PAGE_SIZE = 50;
const repairLegacyRenderRepairListTable = renderRepairListTable;
const repairLegacyUpdateKPIs = updateKPIs;
let repairServerAbortController = null;
let repairPartsAbortController = null;
let repairServerPageInfo = null;
let repairServerKpis = null;
let repairServerFilterTimer = null;
let repairServerMetaBranch = null;
let repairCalendarAbortController = null;
let repairCalendarCacheKey = null;
let repairCalendarError = false;
let repairSummaryAbortController = null;
let repairSummaryCacheKey = null;
let repairKpiDrilldownAbortController = null;
let repairFacetAbortController = null;
const REPAIR_KPI_MODAL_PAGE_SIZE = 20;
const repairKpiDrilldownTotals = Object.create(null);

function repairServerNormalizeSearchDate(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return text;
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function repairServerFiltersPayload(excludeColIdx = null) {
    const out = {};
    for (const [colIdx, selected] of Object.entries(activeFilters || {})) {
        if (excludeColIdx !== null && String(colIdx) === String(excludeColIdx)) continue;
        const col = columnsDef.find(c => String(c.idx) === String(colIdx));
        if (!col || !selected || selected.size === 0) continue;
        out[col.key] = [...selected];
    }
    return out;
}

function repairServerSortField() {
    if (savedSortCol == null) return 'id';
    const col = columnsDef.find(c => String(c.idx) === String(savedSortCol));
    return col?.key || 'id';
}

function renderRepairServerRows(items) {
    currentRepairFilteredData = Array.isArray(items) ? items : [];
    const serverPage = repairPager.page;
    repairPager.page = 1;
    repairLegacyRenderRepairListTable(currentRepairFilteredData);
    repairPager.page = serverPage;
    if (repairServerPageInfo) {
        RizenicPagination.renderControls({
            anchorId: 'repairTable', containerId: 'repair_table_pagination', pageInfo: repairServerPageInfo,
            noun: 'คัน', onPageChange: goRepairPage
        });
    }
    if (savedSortCol !== null) updateRepairSortIndicator(savedSortCol, savedSortDir);
}

updateKPIs = function() {
    // Keep modal source arrays available from the visible page, but counts come from the DB aggregate.
    repairLegacyUpdateKPIs();
    if (!repairServerKpis) return;
    const values = {
        kpi_arrived: repairServerKpis.arrived,
        kpi_repairing: repairServerKpis.repairing,
        kpi_done: repairServerKpis.done,
        kpi_delay: repairServerKpis.delayed
    };
    for (const [id, value] of Object.entries(values)) {
        const el = document.getElementById(id);
        if (el) el.innerText = Number(value || 0);
    }
};

async function fetchRepairPageParts(items, branch, requestController) {
    if (repairPartsAbortController) repairPartsAbortController.abort();
    repairPartsAbortController = new AbortController();
    const ids = [...new Set((items || []).map(j => j.id).filter(v => v != null).map(String))];
    const plates = [...new Set((items || []).map(j => j.car_plate).filter(Boolean).map(v => String(v).trim()))];
    if (!ids.length && !plates.length) return [];
    const params = new URLSearchParams();
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
    if (ids.length) params.set('job_ids', ids.join(','));
    if (plates.length) params.set('car_plates', plates.join(','));
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/repair-parts?${params.toString()}`, { signal: repairPartsAbortController.signal });
        if (!res.ok) return [];
        const payload = await res.json();
        if (repairServerAbortController !== requestController || requestController.signal.aborted) return [];
        return Array.isArray(payload.partOrders) ? payload.partOrders : [];
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('Repair page parts failed:', error);
        return [];
    }
}

function invalidateRepairCalendar() {
    if (repairCalendarAbortController) repairCalendarAbortController.abort();
    repairCalendarCacheKey = null;
    repairCalendarLoaded = false;
    repairCalendarError = false;
    if (document.getElementById('tab-calendar')?.classList.contains('active')) loadRepairCalendarData(true);
}

async function loadRepairCalendarData(force = false) {
    const branch = selectedBranchFilter || 'ALL';
    const cacheKey = `${branch}|${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (!force && repairCalendarCacheKey === cacheKey && repairCalendarLoaded) {
        renderCalendar();
        return;
    }
    if (repairCalendarAbortController) repairCalendarAbortController.abort();
    repairCalendarLoaded = false;
    repairCalendarError = false;
    renderCalendar();
    repairCalendarAbortController = new AbortController();
    const controller = repairCalendarAbortController;
    const params = new URLSearchParams({ year: String(currentYear), month: String(currentMonth + 1) });
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/repair-calendar?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (repairCalendarAbortController !== controller || controller.signal.aborted) return;
        repairCalendarDays = new Map((payload.days || []).map(row => [String(row.date).slice(0, 10), row]));
        repairCalendarLoaded = true;
        repairCalendarCacheKey = cacheKey;
        renderCalendar();
    } catch (error) {
        if (error?.name === 'AbortError' || repairCalendarAbortController !== controller) return;
        console.error('โหลดปฏิทินสถานีไม่สำเร็จ:', error);
        repairCalendarDays = new Map();
        repairCalendarLoaded = false;
        repairCalendarError = true;
        renderCalendar();
        showToast('โหลดปฏิทินไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
}

async function loadRepairSummaryData(force = false) {
    const branch = selectedBranchFilter || 'ALL';
    const cacheKey = String(branch);
    if (!force && repairSummaryCacheKey === cacheKey && repairSummaryLoaded) {
        renderPieChartAndList();
        return;
    }
    if (repairSummaryAbortController) repairSummaryAbortController.abort();
    repairSummaryLoaded = false;
    repairSummaryAbortController = new AbortController();
    const controller = repairSummaryAbortController;
    const params = new URLSearchParams();
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/repair-summary?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (repairSummaryAbortController !== controller || controller.signal.aborted) return;
        repairSummaryJobs = (payload.reports || []).map(job => ({ ...job, calculated_station: computeHighestStationIFS(job) }));
        repairSummaryLoaded = true;
        repairSummaryCacheKey = cacheKey;
        renderPieChartAndList();
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('โหลดสรุปสถานีไม่สำเร็จ:', error);
        repairSummaryJobs = [];
        repairSummaryLoaded = false;
        const breakdown = document.getElementById('station_breakdown_list');
        if (breakdown) breakdown.innerHTML = '<div class="text-center py-10 text-red-500 font-bold">โหลดข้อมูลสรุปสถานีไม่สำเร็จ กรุณาลองใหม่</div>';
        showToast('โหลดสรุปสถานีไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
}

function renderRepairFacetOptions(colIndex, values) {
    const listDiv = document.getElementById('ef_checkbox_list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    const activeSet = activeFilters[colIndex];
    (values || []).forEach(rawValue => {
        const val = rawValue == null ? '' : String(rawValue);
        const isChecked = activeSet ? activeSet.has(val) : true;
        const displayVal = /^\d{4}-\d{2}-\d{2}$/.test(val) ? formatThaiDate(val) : (val === '' ? '(ว่าง)' : val);
        const label = document.createElement('label');
        label.className = 'flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer ef-item transition';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = val;
        input.checked = isChecked;
        input.className = 'ef-check accent-[#00320D] mt-0.5 cursor-pointer w-4 h-4';
        const span = document.createElement('span');
        span.className = 'text-slate-700 font-medium truncate w-full text-sm';
        span.title = displayVal;
        span.textContent = displayVal;
        label.append(input, span);
        listDiv.appendChild(label);
    });
    const selectAll = document.getElementById('ef_select_all');
    if (selectAll) selectAll.checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);
}

openExcelFilter = async function(e, colIndex, title) {
    e.stopPropagation();
    currentFilterCol = colIndex;
    const modal = document.getElementById('excelFilterModal');
    const nameEl = document.getElementById('ef_col_name');
    const searchEl = document.getElementById('ef_search');
    const listDiv = document.getElementById('ef_checkbox_list');
    if (!modal || !listDiv) return;
    if (nameEl) nameEl.innerText = title;
    if (searchEl) searchEl.value = '';
    const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    let leftPos = rect.left + window.scrollX;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    listDiv.innerHTML = '<div class="py-6 text-center text-slate-400 text-xs font-bold"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i> กำลังโหลดตัวกรอง...</div>';

    const col = columnsDef.find(c => String(c.idx) === String(colIndex));
    if (!col) return;
    if (repairFacetAbortController) repairFacetAbortController.abort();
    repairFacetAbortController = new AbortController();
    const controller = repairFacetAbortController;
    const params = new URLSearchParams({ field: col.key });
    const branch = selectedBranchFilter || 'ALL';
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
    if (isCalendarFilterActive) params.set('calendar', '1');
    const search = (document.getElementById('global_search_input')?.value || '').trim();
    if (search) params.set('search', repairServerNormalizeSearchDate(search));
    if (activeKpiFilter) params.set('kpi', activeKpiFilter);
    const filters = repairServerFiltersPayload(colIndex);
    if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters));

    try {
        const res = await fetch(`${API_BASE_URL}/api/server/repair-facet?${params.toString()}`, { signal: controller.signal, rizenicBlocking: false });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (repairFacetAbortController !== controller || controller.signal.aborted) return;
        renderRepairFacetOptions(colIndex, Array.isArray(payload.values) ? payload.values : []);
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('โหลดตัวกรองสถานีจาก Server ไม่สำเร็จ:', error);
        listDiv.innerHTML = '<div class="py-6 text-center text-red-500 text-xs font-bold">โหลดรายการตัวกรองไม่สำเร็จ</div>';
        showToast('โหลดรายการตัวกรองไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
};

function repairKpiModalConfig(type) {
    const configs = {
        arrived: { title: 'รถเข้าจอด (รอซ่อม)', icon: 'fa-car-side', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
        repairing: { title: 'กำลังดำเนินการซ่อม', icon: 'fa-hammer', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        done: { title: 'ซ่อมเสร็จรอส่งมอบ', icon: 'fa-check-double', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        delayed: { title: 'ล่าช้า (Overdue)', icon: 'fa-triangle-exclamation', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' }
    };
    return configs[type] || configs.arrived;
}

function renderRepairKpiDrilldownModal(type, payload) {
    const config = repairKpiModalConfig(type);
    const reports = (payload.reports || []).map(job => ({ ...job, calculated_station: computeHighestStationIFS(job) }));
    const partOrders = Array.isArray(payload.partOrders) ? payload.partOrders : [];
    const total = Number(payload.total || 0);
    const page = Math.max(1, Number(payload.page || 1));
    const totalPages = Math.max(1, Number(payload.totalPages || 1));
    const title = document.getElementById('dayListDateTitle');
    const content = document.getElementById('dayListContent');
    if (!title || !content) return;

    title.innerHTML = `<span class="${config.text}"><i class="fa-solid ${config.icon}"></i> ${config.title} (${total} คัน)</span>`;
    let html = `<div class="${config.bg} border ${config.border} rounded-xl overflow-hidden shadow-sm"><div class="p-4 space-y-3">`;
    if (!reports.length) {
        html += `<div class="text-center py-10 text-slate-400 font-bold">ไม่มีข้อมูลในหมวดนี้</div>`;
    } else {
        reports.forEach(job => { html += generateMiniCardHTML(job, type, partOrders); });
    }
    html += `</div>`;
    if (totalPages > 1) {
        const start = total ? ((page - 1) * REPAIR_KPI_MODAL_PAGE_SIZE) + 1 : 0;
        const end = Math.min(total, page * REPAIR_KPI_MODAL_PAGE_SIZE);
        html += `<div class="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <span class="text-xs font-bold text-slate-500">แสดง ${start}-${end} จาก ${total} คัน</span>
            <div class="flex items-center gap-2">
                <button type="button" ${page <= 1 ? 'disabled' : ''} onclick="openKpiModal('${type}', ${page - 1})" class="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">ก่อนหน้า</button>
                <span class="text-xs font-black text-[#00320D]">${page}/${totalPages}</span>
                <button type="button" ${page >= totalPages ? 'disabled' : ''} onclick="openKpiModal('${type}', ${page + 1})" class="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">ถัดไป</button>
            </div>
        </div>`;
    }
    html += `</div>`;
    content.innerHTML = html;
}

openKpiModal = async function(type = 'arrived', page = 1) {
    const config = repairKpiModalConfig(type);
    const modal = document.getElementById('dayListModal');
    const title = document.getElementById('dayListDateTitle');
    const content = document.getElementById('dayListContent');
    if (!modal || !title || !content) return;

    modal.classList.remove('hidden');
    title.innerHTML = `<span class="${config.text}"><i class="fa-solid ${config.icon}"></i> ${config.title}</span>`;
    content.innerHTML = `<div class="min-h-[260px] flex items-center justify-center text-slate-400 font-bold"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-[#00320D]"></i> กำลังโหลดข้อมูล...</div>`;

    if (repairKpiDrilldownAbortController) repairKpiDrilldownAbortController.abort();
    repairKpiDrilldownAbortController = new AbortController();
    const controller = repairKpiDrilldownAbortController;
    const params = new URLSearchParams({ bucket: type, page: String(Math.max(1, Number(page) || 1)), limit: String(REPAIR_KPI_MODAL_PAGE_SIZE) });
    const branch = selectedBranchFilter || 'ALL';
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
    const totalKey = `${branch}|${type}`;
    const knownTotal = repairKpiDrilldownTotals[totalKey];
    if (page > 1 && Number.isFinite(Number(knownTotal))) params.set('known_total', String(Number(knownTotal)));

    try {
        const res = await fetch(`${API_BASE_URL}/api/server/repair-kpi-drilldown?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (repairKpiDrilldownAbortController !== controller || controller.signal.aborted) return;
        repairKpiDrilldownTotals[totalKey] = Number(payload.total || 0);
        renderRepairKpiDrilldownModal(type, payload);
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('โหลดรายละเอียด KPI สถานีไม่สำเร็จ:', error);
        content.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</div>`;
        showToast('โหลดรายละเอียด KPI ไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
};

async function fetchRepairServerView(branch = selectedBranchFilter, page = repairPager.page || 1, { reuseTotal = false } = {}) {
    if (repairServerAbortController) repairServerAbortController.abort();
    const requestController = new AbortController();
    repairServerAbortController = requestController;
    repairPager.page = Math.max(1, Number(page) || 1);

    const branchKey = branch && String(branch).toUpperCase() !== 'ALL' ? String(branch) : 'ALL';
    const includeMeta = repairServerMetaBranch !== branchKey;
    const params = new URLSearchParams({
        page: String(repairPager.page),
        limit: String(REPAIR_SERVER_PAGE_SIZE),
        includeParts: '1',
        includeMeta: includeMeta ? '1' : '0'
    });
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
    if (isCalendarFilterActive) params.set('calendar', '1');
    const search = (document.getElementById('global_search_input')?.value || '').trim();
    if (search) params.set('search', repairServerNormalizeSearchDate(search));
    if (activeKpiFilter) params.set('kpi', activeKpiFilter);
    const filters = repairServerFiltersPayload();
    if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters));
    const sort = repairServerSortField();
    if (sort) params.set('sort', sort);
    if (savedSortDir) params.set('dir', savedSortDir);
    if (reuseTotal && Number.isFinite(Number(repairServerPageInfo?.total))) params.set('known_total', String(Number(repairServerPageInfo.total)));

    const tbody = document.getElementById('repair_list_body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-12 text-slate-400 font-mono text-sm"><i class="fa-solid fa-circle-notch fa-spin text-[#00320D] text-lg mr-2"></i> กำลังโหลดข้อมูล...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/server/repair-page?${params.toString()}`, { signal: requestController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (repairServerAbortController !== requestController || requestController.signal.aborted) return null;

        const normalized = RizenicPagination.fromServerResponse({
            items: payload.reports || [], page: payload.page, pageSize: payload.pageSize,
            total: payload.total, totalPages: payload.totalPages
        }, repairPager);
        repairServerPageInfo = normalized.pageInfo;
        if (includeMeta) {
            repairServerKpis = payload.kpis || null;
            allQuotas = payload.quotas || [];
            allBodyPartsMaster = payload.bodyParts || [];
            repairServerMetaBranch = branchKey;
        }
        originalRepairJobs = normalized.items.map(job => ({ ...job, calculated_station: computeHighestStationIFS(job) }));
        allPartOrders = Array.isArray(payload.partOrders) ? payload.partOrders : [];

        updateKPIs();
        renderRepairServerRows(originalRepairJobs);
        if (document.getElementById('tab-calendar')?.classList.contains('active')) loadRepairCalendarData();
        if (document.getElementById('tab-summary')?.classList.contains('active')) loadRepairSummaryData();
        return payload;
    } catch (error) {
        if (error?.name === 'AbortError') return null;
        console.error('โหลดข้อมูลหน้าสถานีจาก Server ไม่สำเร็จ:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-12 text-red-500 font-bold">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</td></tr>`;
        return null;
    }
}

fetchJobList = async function() {
    invalidateRepairCalendar();
    return fetchRepairServerView(selectedBranchFilter, repairPager.page || 1);
};

runTableFilters = function(resetPage = true) {
    if (resetPage) repairPager.page = 1;
    clearTimeout(repairServerFilterTimer);
    repairServerFilterTimer = setTimeout(() => fetchRepairServerView(selectedBranchFilter, repairPager.page), 120);
};

goRepairPage = function(page) {
    repairPager.page = page;
    fetchRepairServerView(selectedBranchFilter, page, { reuseTotal: true });
};

sortTableDirectly = function(colIndex, dir) {
    savedSortCol = colIndex;
    savedSortDir = dir;
    repairPager.page = 1;
    updateRepairSortIndicator(colIndex, dir);
    fetchRepairServerView(selectedBranchFilter, 1, { reuseTotal: true });
};

onBranchChange = async function(newBranchVal) {
    selectedBranchFilter = newBranchVal;
    repairPager.page = 1;
    repairCalendarCacheKey = null;
    repairSummaryCacheKey = null;
    repairCalendarDays = new Map();
    repairCalendarLoaded = false;
    repairSummaryJobs = [];
    repairSummaryLoaded = false;
    await fetchRepairServerView(newBranchVal, 1);
    if (document.getElementById('tab-calendar')?.classList.contains('active')) loadRepairCalendarData(true);
    if (document.getElementById('tab-summary')?.classList.contains('active')) loadRepairSummaryData(true);
    showToast(`สลับการแสดงผลเป็น: ${newBranchVal === 'ALL' ? 'ทุกสาขา' : newBranchVal}`, 'info');
};
