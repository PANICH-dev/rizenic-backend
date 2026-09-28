// Page-scoped server data source for dashboard.html.
const dashboardLegacyApplyFilters = applyFilters;
let dashboardServerLoadedBranch = null;
let dashboardServerLoadController = null;

function dashboardIsManager() {
    const role = String(userRole || '').toLowerCase();
    return role.includes('admin') || role.includes('แอดมิน') || role.includes('manager') || role.includes('ba');
}

async function fetchDashboardServerView(branchOverride = null) {
    if (dashboardServerLoadController) dashboardServerLoadController.abort();
    const requestController = new AbortController();
    dashboardServerLoadController = requestController;
    const isManager = dashboardIsManager();
    const requestedBranch = branchOverride ?? (isManager ? 'all' : userBranch);
    const params = new URLSearchParams();
    if (requestedBranch && requestedBranch !== 'all') params.set('branch', requestedBranch);

    const statusPromise = fetch(`${API_BASE_URL}/api/statuses`, { signal: requestController.signal })
        .then(r => r.ok ? r.json() : [])
        .catch(error => error?.name === 'AbortError' ? [] : []);
    const partsPromise = fetch(`${API_BASE_URL}/api/server/dashboard-parts?${params.toString()}`, { signal: requestController.signal })
        .then(r => r.ok ? r.json() : { partOrders: [] })
        .catch(error => error?.name === 'AbortError' ? { partOrders: [] } : { partOrders: [] });
    const primaryParams = new URLSearchParams(params);
    primaryParams.set('includeParts', '0');
    const res = await fetch(`${API_BASE_URL}/api/server/dashboard?${primaryParams.toString()}`, { signal: requestController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (dashboardServerLoadController !== requestController || requestController.signal.aborted) return;

    allJobs = (Array.isArray(payload.reports) ? payload.reports : []).map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
    allPartOrders = [];
    dashboardServerLoadedBranch = requestedBranch || 'all';
    rebuildDashboardIndexes();

    const filterSelect = document.getElementById('branchFilter');
    if (filterSelect && isManager) {
        const selected = requestedBranch || 'all';
        filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>` + (payload.branches || []).map(b => `<option value="${b}">${b}</option>`).join('');
        filterSelect.value = selected === 'all' || (payload.branches || []).includes(selected) ? selected : 'all';
        filterSelect.disabled = false;
    }

    // Paint all report/KPI widgets immediately; part-order widgets fill in when their parallel request completes.
    dashboardLegacyApplyFilters(false);

    const [statuses, partsPayload] = await Promise.all([statusPromise, partsPromise]);
    if (dashboardServerLoadController !== requestController || requestController.signal.aborted) return;
    allStatuses = Array.isArray(statuses) ? statuses : [];
    globalStatusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
    allPartOrders = Array.isArray(partsPayload?.partOrders) ? partsPayload.partOrders : [];
    rebuildDashboardIndexes();
    refreshDashboardPartViews();
}

fetchDashboardData = async function() {
    try {
        await fetchDashboardServerView(dashboardIsManager() ? 'all' : userBranch);
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('Dashboard server view failed:', error);
        dashboardLegacyApplyFilters(false);
    }
};

applyFilters = async function(includeParts = true) {
    const selectedBranch = document.getElementById('branchFilter')?.value || (dashboardIsManager() ? 'all' : userBranch);
    if (selectedBranch !== dashboardServerLoadedBranch) {
        try {
            await fetchDashboardServerView(selectedBranch);
        } catch (error) {
            if (error?.name !== 'AbortError') console.error('Dashboard branch load failed:', error);
        }
        return;
    }
    dashboardLegacyApplyFilters(includeParts);
};
