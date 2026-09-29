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

function repairServerFiltersPayload() {
    const out = {};
    for (const [colIdx, selected] of Object.entries(activeFilters || {})) {
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
    const search = (document.getElementById('global_search_input')?.value || '').trim();
    if (search) params.set('search', search);
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
        renderCalendar();
        if (document.getElementById('tab-summary')?.classList.contains('active')) renderPieChartAndList();
        return payload;
    } catch (error) {
        if (error?.name === 'AbortError') return null;
        console.error('โหลดข้อมูลหน้าสถานีจาก Server ไม่สำเร็จ:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-12 text-red-500 font-bold">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</td></tr>`;
        return null;
    }
}

fetchJobList = async function() {
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
    await fetchRepairServerView(newBranchVal, 1);
    showToast(`สลับการแสดงผลเป็น: ${newBranchVal === 'ALL' ? 'ทุกสาขา' : newBranchVal}`, 'info');
};
