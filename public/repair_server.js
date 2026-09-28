'use strict';

let repairServerAbortController = null;

async function fetchRepairServerView(branch = selectedBranchFilter) {
    if (repairServerAbortController) repairServerAbortController.abort();
    const requestController = new AbortController();
    repairServerAbortController = requestController;

    const params = new URLSearchParams();
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);

    const tbody = document.getElementById('repair_list_body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-12 text-slate-400 font-mono text-sm"><i class="fa-solid fa-circle-notch fa-spin text-[#00320D] text-lg mr-2"></i> กำลังโหลดข้อมูล...</td></tr>`;
    }

    try {
        const partsPromise = fetch(`${API_BASE_URL}/api/server/repair-parts?${params.toString()}`, {
            signal: requestController.signal
        }).then(r => r.ok ? r.json() : { partOrders: [] })
          .catch(error => error?.name === 'AbortError' ? { partOrders: [] } : { partOrders: [] });
        const primaryParams = new URLSearchParams(params);
        primaryParams.set('includeParts', '0');
        const res = await fetch(`${API_BASE_URL}/api/server/repair-page?${primaryParams.toString()}`, {
            signal: requestController.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (repairServerAbortController !== requestController || requestController.signal.aborted) return null;

        originalRepairJobs = (payload.reports || []).map(job => ({
            ...job,
            calculated_station: computeHighestStationIFS(job)
        }));
        allPartOrders = [];
        allQuotas = payload.quotas || [];
        allBodyPartsMaster = payload.bodyParts || [];

        updateKPIs();
        runTableFilters();
        renderCalendar();
        if (document.getElementById('tab-summary')?.classList.contains('active')) renderPieChartAndList();

        // Part-order data is secondary. Re-render dependent cells/widgets only after it arrives.
        const partsPayload = await partsPromise;
        if (repairServerAbortController !== requestController || requestController.signal.aborted) return null;
        allPartOrders = Array.isArray(partsPayload?.partOrders) ? partsPayload.partOrders : [];
        updateKPIs();
        runTableFilters();
        if (document.getElementById('tab-summary')?.classList.contains('active')) renderPieChartAndList();
        return { ...payload, partOrders: allPartOrders };
    } catch (error) {
        if (error.name === 'AbortError') return null;
        console.error('โหลดข้อมูลหน้าสถานีจาก Server ไม่สำเร็จ:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-12 text-red-500 font-bold">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</td></tr>`;
        return null;
    }
}

fetchJobList = async function() {
    return fetchRepairServerView(selectedBranchFilter);
};

onBranchChange = async function(newBranchVal) {
    selectedBranchFilter = newBranchVal;
    repairPager.page = 1;
    await fetchRepairServerView(newBranchVal);
    showToast(`สลับการแสดงผลเป็น: ${newBranchVal === 'ALL' ? 'ทุกสาขา' : newBranchVal}`, 'info');
};
