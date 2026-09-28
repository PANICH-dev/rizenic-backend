// Page-scoped server data source for jobs.html.
const jobsLegacyFilterDataByBranch = filterDataByBranch;
let jobsServerLoadedBranch = null;
let jobsServerAbortController = null;

function jobsOverviewIsManager() {
    return ['BA','Manager','Admin','แอดมิน'].includes(userRole);
}

async function fetchJobsServerView(branch) {
    if (jobsServerAbortController) jobsServerAbortController.abort();
    const requestController = new AbortController();
    jobsServerAbortController = requestController;
    const params = new URLSearchParams();
    if (branch && branch !== 'ALL') params.set('branch', branch);

    const secondaryPromise = Promise.allSettled([
        fetch(`${API_BASE_URL}/api/statuses`, { signal: requestController.signal }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE_URL}/api/part-statuses`, { signal: requestController.signal }).then(r => r.ok ? r.json() : [])
    ]);
    const partsPromise = fetch(`${API_BASE_URL}/api/server/sa-parts?${params.toString()}`, { signal: requestController.signal })
        .then(r => r.ok ? r.json() : { partOrders: [] })
        .catch(error => error?.name === 'AbortError' ? { partOrders: [] } : { partOrders: [] });
    const primaryParams = new URLSearchParams(params);
    primaryParams.set('includeParts', '0');

    const res = await fetch(`${API_BASE_URL}/api/server/sa-overview?${primaryParams.toString()}`, { signal: requestController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (jobsServerAbortController !== requestController || requestController.signal.aborted) return;
    masterJobsData = Array.isArray(payload.reports) ? payload.reports : [];
    allPartOrders = [];
    rebuildPartOrdersByPlate();
    selectedBranchFilter = branch || 'ALL';
    jobsServerLoadedBranch = selectedBranchFilter;

    const branchSelect = document.getElementById('branch_filter');
    if (branchSelect) {
        const manager = jobsOverviewIsManager();
        branchSelect.innerHTML = (manager ? `<option value="ALL">🏢 รวมทุกสาขา</option>` : '') + (payload.branches || []).map(b => `<option value="${b}">${b}</option>`).join('');
        if (!manager) selectedBranchFilter = userBranch;
        branchSelect.value = selectedBranchFilter;
        branchSelect.disabled = !manager;
    }

    // First usable paint uses reports only; part tracking/status metadata arrive in parallel.
    jobsLegacyFilterDataByBranch();
    const [secondary, partsPayload] = await Promise.all([secondaryPromise, partsPromise]);
    if (jobsServerAbortController !== requestController || requestController.signal.aborted) return;
    allPartOrders = Array.isArray(partsPayload?.partOrders) ? partsPayload.partOrders : [];
    rebuildPartOrdersByPlate();
    if (secondary[0].status === 'fulfilled') {
        const statuses = secondary[0].value || [];
        globalStatusOptionsHtml = statuses.length ? statuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('') : `<option value="09.จอดรอเข้าซ่อม">09.จอดรอเข้าซ่อม</option>`;
    }
    if (secondary[1].status === 'fulfilled') allStatuses = secondary[1].value || [];
    jobsLegacyFilterDataByBranch();
}

loadJobsData = async function() {
    try {
        const initialBranch = jobsOverviewIsManager() ? 'ALL' : userBranch;
        await fetchJobsServerView(initialBranch);
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.error('SA server overview failed:', error);
            showToast('มีปัญหาในการโหลดข้อมูล', 'error');
        }
    }
};

onBranchChange = async function() {
    const selected = document.getElementById('branch_filter')?.value || 'ALL';
    if (selected === jobsServerLoadedBranch) {
        selectedBranchFilter = selected;
        jobsLegacyFilterDataByBranch();
        return;
    }
    try {
        await fetchJobsServerView(selected);
    } catch (error) {
        if (error?.name !== 'AbortError') showToast('เปลี่ยนสาขาไม่สำเร็จ', 'error');
    }
};

if (window.RizenicPartsLookup && !window.__jobsPartLookupBound) {
    window.__jobsPartLookupBound = true;
    window.RizenicPartsLookup.bindDatalist({
        selector: 'input[list="master_parts_datalist"]',
        branch: () => userBranch || 'สำนักงานใหญ่',
        onItems: items => { allMasterPartsCache = items; }
    });
}
