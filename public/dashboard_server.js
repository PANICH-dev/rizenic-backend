// v9 server-paged data source for dashboard.html.
const DASHBOARD_SERVER_PAGE_SIZE = 20;
const dashboardLegacyApplyFilters = applyFilters;
const dashboardLegacyRenderStationTable = renderStationTable;
const dashboardLegacyRenderParkedCars = renderParkedCars;
const dashboardLegacyGoStationPage = goDashboardStationPage;
const dashboardLegacyGoParkedPage = goDashboardParkedPage;
const dashboardLegacyRenderKPIs = renderKPIs;
const dashboardLegacyRenderERPStatuses = renderERPStatuses;
const dashboardLegacyRenderStationSummary = renderStationSummary;
const dashboardLegacyRenderSASection = renderSASection;
const dashboardLegacyRenderDailyReport = renderDailyReport;
const dashboardLegacyRenderPartsTracking = renderPartsTracking;
const dashboardLegacyOpenPOExcelFilter = openPOExcelFilter;
let dashboardServerLoadedBranch = null;
let dashboardServerLoadedKey = null;
let dashboardServerLoadController = null;
let dashboardStationController = null;
let dashboardParkedController = null;
let dashboardStationServerPageInfo = null;
let dashboardParkedServerPageInfo = null;
let dashboardServerListSupported = true;
let dashboardAnalyticsSupported = true;
let dashboardPOServerSupported = true;
let dashboardPOController = null;
let dashboardPOServerPageInfo = null;
let dashboardPOFacets = { plate: [], sa: [], status: [], parked: [] };
let dashboardPOFacetsBranch = null;
let dashboardBranchesLoaded = false;
let dashboardStatusesPromise = null;
let dashboardStatusesCache = null;
window.dashboardServerSummary = null;
window.dashboardServerAnalytics = null;
window.dashboardServerBranches = [];

function dashboardIsManager() {
    const role = String(userRole || '').toLowerCase();
    return role.includes('admin') || role.includes('แอดมิน') || role.includes('manager') || role.includes('ba');
}

function dashboardBranchParams(branch) {
    const params = new URLSearchParams();
    if (branch && branch !== 'all') params.set('branch', branch);
    return params;
}

function fetchDashboardStatusesOnce() {
    if (dashboardStatusesCache) return Promise.resolve(dashboardStatusesCache);
    if (!dashboardStatusesPromise) {
        dashboardStatusesPromise = fetch(`${API_BASE_URL}/api/statuses`)
            .then(res => res.ok ? res.json() : [])
            .then(rows => {
                dashboardStatusesCache = Array.isArray(rows) ? rows : [];
                return dashboardStatusesCache;
            })
            .catch(() => [])
            .finally(() => { dashboardStatusesPromise = null; });
    }
    return dashboardStatusesPromise;
}

function dashboardCurrentAnalyticsParams(branch) {
    const params = dashboardBranchParams(branch);
    const start = document.getElementById('dash_start_date')?.value || '';
    const end = document.getElementById('dash_end_date')?.value || '';
    const reportStart = document.getElementById('report_start_date')?.value || start;
    const reportEnd = document.getElementById('report_end_date')?.value || end;
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (reportStart) params.set('report_start', reportStart);
    if (reportEnd) params.set('report_end', reportEnd);
    return params;
}

function dashboardCurrentLoadKey(branch) {
    return `${branch || 'all'}|${dashboardCurrentAnalyticsParams(branch).toString()}`;
}

function hydrateDashboardDateCountsFromAnalytics() {
    const rows = window.dashboardServerAnalytics?.dailySeries;
    if (!Array.isArray(rows)) return;
    dashboardDateCounts = { arrived: new Map(), target: new Map(), delivery: new Map() };
    for (const row of rows) {
        const map = dashboardDateCounts[row.kind];
        if (map && row.date_value) map.set(String(row.date_value), Number(row.count || 0));
    }
}

async function fetchDashboardAnalytics(branch, signal) {
    if (!dashboardAnalyticsSupported) return null;
    const params = dashboardCurrentAnalyticsParams(branch);
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/dashboard-analytics?${params.toString()}`, { signal });
        if (res.status === 404) {
            dashboardAnalyticsSupported = false;
            return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('Dashboard analytics failed:', error);
        return null;
    }
}

async function fetchDashboardLegacyFullDataset(branch, signal) {
    const reportParams = dashboardBranchParams(branch);
    reportParams.set('full', '1');
    const partParams = dashboardBranchParams(branch);
    try {
        const [reportRes, partRes, quotaRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/reports?${reportParams.toString()}`, { signal }),
            fetch(`${API_BASE_URL}/api/part-orders?${partParams.toString()}`, { signal }),
            fetch(`${API_BASE_URL}/api/quotas`, { signal })
        ]);
        if (!reportRes.ok || !partRes.ok) return null;
        const [reportsPayload, partsPayload, quotasPayload] = await Promise.all([
            reportRes.json(),
            partRes.json(),
            quotaRes.ok ? quotaRes.json() : Promise.resolve([])
        ]);
        return {
            reports: Array.isArray(reportsPayload) ? reportsPayload : (reportsPayload?.data || []),
            partOrders: Array.isArray(partsPayload) ? partsPayload : (partsPayload?.data || []),
            quotas: Array.isArray(quotasPayload) ? quotasPayload : (quotasPayload?.data || [])
        };
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('Dashboard legacy full-data fallback failed:', error);
        return null;
    }
}

function dashboardPageKeys(reports) {
    const ids = [...new Set((reports || []).map(j => j?.id).filter(v => v != null).map(String))];
    const plates = [...new Set((reports || []).map(j => j?.car_plate).filter(Boolean).map(v => String(v).trim()))];
    return { ids, plates };
}

async function fetchDashboardPageParts(reports, branch, signal) {
    const { ids, plates } = dashboardPageKeys(reports);
    if (!ids.length && !plates.length) return [];
    const params = dashboardBranchParams(branch);
    if (ids.length) params.set('job_ids', ids.join(','));
    if (plates.length) params.set('car_plates', plates.join(','));
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/dashboard-parts?${params.toString()}`, { signal });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload.partOrders) ? payload.partOrders : [];
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('Dashboard current-page parts failed:', error);
        return [];
    }
}

async function fetchDashboardList(kind, page = 1) {
    const isStation = kind === 'station';
    if (!dashboardServerListSupported) {
        if (isStation) dashboardLegacyRenderStationTable(false);
        else dashboardLegacyRenderParkedCars(false);
        return;
    }
    const oldController = isStation ? dashboardStationController : dashboardParkedController;
    if (oldController) oldController.abort();
    const controller = new AbortController();
    if (isStation) dashboardStationController = controller; else dashboardParkedController = controller;
    const branch = document.getElementById('branchFilter')?.value || (dashboardIsManager() ? 'all' : userBranch);
    const params = dashboardBranchParams(branch);
    params.set('kind', kind);
    params.set('page', String(Math.max(1, Number(page) || 1)));
    params.set('limit', String(DASHBOARD_SERVER_PAGE_SIZE));
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/dashboard-list?${params.toString()}`, { signal: controller.signal });
        if (res.status === 404) {
            // A stale pre-v9 Node process can still serve the new static JS from disk.
            // Fall back to the legacy in-memory dataset instead of breaking the tables.
            dashboardServerListSupported = false;
            dashboardStationServerPageInfo = null;
            dashboardParkedServerPageInfo = null;
            if (isStation) dashboardLegacyRenderStationTable(false);
            else dashboardLegacyRenderParkedCars(false);
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const pager = isStation ? stationTablePager : parkedCarsPager;
        const normalized = RizenicPagination.fromServerResponse({
            items: payload.reports || [], page: payload.page, pageSize: payload.pageSize,
            total: payload.total, totalPages: payload.totalPages
        }, pager);
        const items = normalized.items.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
        const oldFiltered = filteredJobs;
        const oldAll = allJobs;
        filteredJobs = items;
        allJobs = items;
        const savedPage = pager.page;
        pager.page = 1;
        if (isStation) dashboardLegacyRenderStationTable(false); else dashboardLegacyRenderParkedCars(false);
        pager.page = savedPage;
        filteredJobs = oldFiltered;
        allJobs = oldAll;
        if (isStation) {
            dashboardStationServerPageInfo = normalized.pageInfo;
            RizenicPagination.renderControls({ anchorId: 'stationTable', containerId: 'dashboard_station_pagination', pageInfo: normalized.pageInfo, noun: 'คัน', onPageChange: goDashboardStationPage });
        } else {
            dashboardParkedServerPageInfo = normalized.pageInfo;
            RizenicPagination.renderControls({ anchorId: 'parkedCarsTable', containerId: 'dashboard_parked_pagination', pageInfo: normalized.pageInfo, noun: 'คัน', onPageChange: goDashboardParkedPage });
        }
    } catch (error) {
        if (error?.name !== 'AbortError') console.error(`Dashboard ${kind} page failed:`, error);
    }
}

goDashboardStationPage = function(page) {
    stationTablePager.page = page;
    if (!dashboardServerListSupported) return dashboardLegacyGoStationPage(page);
    fetchDashboardList('station', page);
};

goDashboardParkedPage = function(page) {
    parkedCarsPager.page = page;
    if (!dashboardServerListSupported) return dashboardLegacyGoParkedPage(page);
    fetchDashboardList('parked', page);
};

async function fetchDashboardServerView(branchOverride = null, page = 1) {
    if (dashboardServerLoadController) dashboardServerLoadController.abort();
    const requestController = new AbortController();
    dashboardServerLoadController = requestController;
    const isManager = dashboardIsManager();
    const requestedBranch = branchOverride ?? (isManager ? 'all' : userBranch);
    const params = dashboardBranchParams(requestedBranch);
    params.set('page', String(Math.max(1, Number(page) || 1)));
    params.set('limit', String(DASHBOARD_SERVER_PAGE_SIZE));
    params.set('includeParts', '0');
    const includeBranches = isManager && !dashboardBranchesLoaded;
    params.set('includeBranches', includeBranches ? '1' : '0');
    const startDate = document.getElementById('dash_start_date')?.value;
    const endDate = document.getElementById('dash_end_date')?.value;
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);

    const statusPromise = fetchDashboardStatusesOnce();
    const analyticsPromise = fetchDashboardAnalytics(requestedBranch, requestController.signal);
    const res = await fetch(`${API_BASE_URL}/api/server/dashboard?${params.toString()}`, { signal: requestController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const analytics = await analyticsPromise;
    const legacyFallback = analytics ? null : await fetchDashboardLegacyFullDataset(requestedBranch, requestController.signal);
    if (dashboardServerLoadController !== requestController || requestController.signal.aborted) return;

    const sourceReports = legacyFallback?.reports || (Array.isArray(payload.reports) ? payload.reports : []);
    allJobs = sourceReports.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
    filteredJobs = allJobs.slice();
    allPartOrders = legacyFallback?.partOrders || [];
    filteredPartOrders = allPartOrders.slice();
    window.dashboardServerSummary = payload.summary || null;
    window.dashboardServerAnalytics = analytics || null;
    if (includeBranches) {
        window.dashboardServerBranches = Array.isArray(payload.branches) ? payload.branches.slice() : [];
        dashboardBranchesLoaded = true;
    }
    allQuotas = Array.isArray(analytics?.quotas) ? analytics.quotas : (legacyFallback?.quotas || allQuotas);
    hydrateDashboardDateCountsFromAnalytics();
    dashboardServerLoadedBranch = requestedBranch || 'all';
    dashboardServerLoadedKey = dashboardCurrentLoadKey(requestedBranch);
    rebuildDashboardIndexes();

    const filterSelect = document.getElementById('branchFilter');
    if (filterSelect && isManager) {
        const selected = requestedBranch || 'all';
        const branches = window.dashboardServerBranches || [];
        filterSelect.innerHTML = `<option value="all">-- ทุกสาขา --</option>` + branches.map(b => `<option value="${b}">${b}</option>`).join('');
        filterSelect.value = selected === 'all' || branches.includes(selected) ? selected : 'all';
        filterSelect.disabled = false;
    }

    dashboardLegacyApplyFilters(false);
    if (legacyFallback && typeof renderPartsStatusChart === 'function') renderPartsStatusChart();
    fetchDashboardList('station', 1);
    fetchDashboardList('parked', 1);
    renderPartsTracking(true);

    const statuses = await statusPromise;
    if (dashboardServerLoadController !== requestController || requestController.signal.aborted) return;
    allStatuses = Array.isArray(statuses) ? statuses : [];
    globalStatusOptionsHtml = allStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
}

fetchDashboardData = async function() {
    try {
        await fetchDashboardServerView(dashboardIsManager() ? 'all' : userBranch, 1);
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('Dashboard server view failed:', error);
        dashboardLegacyApplyFilters(false);
    }
};

applyFilters = async function(includeParts = true) {
    const selectedBranch = document.getElementById('branchFilter')?.value || (dashboardIsManager() ? 'all' : userBranch);
    const currentKey = dashboardCurrentLoadKey(selectedBranch);
    if (selectedBranch !== dashboardServerLoadedBranch || currentKey !== dashboardServerLoadedKey) {
        try { await fetchDashboardServerView(selectedBranch, 1); }
        catch (error) { if (error?.name !== 'AbortError') console.error('Dashboard filter load failed:', error); }
        return;
    }
    dashboardLegacyApplyFilters(false);
    if (includeParts) renderPartsTracking(false);
    if (dashboardServerListSupported) {
        fetchDashboardList('station', stationTablePager.page || 1);
        fetchDashboardList('parked', parkedCarsPager.page || 1);
    }
};

renderDailyReport = async function() {
    const selectedBranch = document.getElementById('branchFilter')?.value || (dashboardIsManager() ? 'all' : userBranch);
    const expectedKey = dashboardCurrentLoadKey(selectedBranch);
    if (dashboardAnalyticsSupported && expectedKey !== dashboardServerLoadedKey) {
        const analytics = await fetchDashboardAnalytics(selectedBranch);
        if (analytics) {
            window.dashboardServerAnalytics = analytics;
            allQuotas = Array.isArray(analytics?.quotas) ? analytics.quotas : allQuotas;
            hydrateDashboardDateCountsFromAnalytics();
            dashboardServerLoadedKey = expectedKey;
        }
    }
    return dashboardLegacyRenderDailyReport();
};

function dashboardPOFilterParams(params) {
    for (const key of ['plate','sa','status','parked']) {
        const set = activePOFilters[key];
        if (set && set.size) params.set(key, [...set].join(','));
    }
    if (dashboardPOSearchText) params.set('search', dashboardPOSearchText);
}

async function fetchDashboardPOPage(page = 1) {
    if (!dashboardPOServerSupported) return dashboardLegacyRenderPartsTracking(false);
    if (dashboardPOController) dashboardPOController.abort();
    const controller = new AbortController();
    dashboardPOController = controller;
    const branch = document.getElementById('branchFilter')?.value || (dashboardIsManager() ? 'all' : userBranch);
    const params = dashboardBranchParams(branch);
    params.set('page', String(Math.max(1, Number(page) || 1)));
    params.set('limit', String(dashboardPOPager.pageSize || 20));
    const needsFacets = dashboardPOFacetsBranch !== branch;
    params.set('includeFacets', needsFacets ? '1' : '0');
    dashboardPOFilterParams(params);
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/dashboard-po?${params.toString()}`, { signal: controller.signal });
        if (res.status === 404) {
            dashboardPOServerSupported = false;
            dashboardLegacyRenderPartsTracking(false);
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (payload.facets) {
            dashboardPOFacets = payload.facets;
            dashboardPOFacetsBranch = branch;
        }
        const normalized = RizenicPagination.fromServerResponse({
            items: payload.entries || [], page: payload.page, pageSize: payload.pageSize,
            total: payload.total, totalPages: payload.totalPages
        }, dashboardPOPager);
        dashboardPOServerPageInfo = normalized.pageInfo;

        const savedJobs = allJobs;
        const savedFilteredJobs = filteredJobs;
        const savedAllParts = allPartOrders;
        const savedFilteredParts = filteredPartOrders;
        const savedJobByPlate = jobByPlate;
        const currentItems = [];
        const currentJobs = [];
        normalized.items.forEach(entry => {
            currentJobs.push({ car_plate: entry.plate, sa_owner: entry.group?.saName || 'ไม่ระบุ', is_parked: entry.group?.isParked || 'ไม่ระบุ' });
            (entry.group?.items || []).forEach(item => currentItems.push(item));
        });
        allJobs = currentJobs;
        filteredJobs = currentJobs;
        allPartOrders = currentItems;
        filteredPartOrders = currentItems;
        rebuildDashboardIndexes();
        const savedPage = dashboardPOPager.page;
        dashboardPOPager.page = 1;
        dashboardLegacyRenderPartsTracking(false);
        dashboardPOPager.page = savedPage;
        allJobs = savedJobs;
        filteredJobs = savedFilteredJobs;
        allPartOrders = savedAllParts;
        filteredPartOrders = savedFilteredParts;
        jobByPlate = savedJobByPlate;

        RizenicPagination.renderControls({
            anchorId: 'partsTrackingTable', containerId: 'dashboard_po_pagination', pageInfo: normalized.pageInfo,
            noun: 'คัน', onPageChange: goDashboardPOPage
        });
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('Dashboard PO page failed:', error);
    }
}

renderPartsTracking = function(resetPage = false) {
    if (resetPage) RizenicPagination.reset(dashboardPOPager);
    return fetchDashboardPOPage(dashboardPOPager.page || 1);
};

goDashboardPOPage = function(page) {
    dashboardPOPager.page = page;
    return fetchDashboardPOPage(page);
};

openPOExcelFilter = function(e, colKey, title) {
    const options = dashboardPOFacets?.[colKey];
    if (!dashboardPOServerSupported || !Array.isArray(options) || !options.length) return dashboardLegacyOpenPOExcelFilter(e, colKey, title);
    e.stopPropagation();
    currentPOFilterKey = colKey;
    document.getElementById('po_ef_col_name').innerText = title;
    document.getElementById('po_ef_search').value = '';
    const listDiv = document.getElementById('po_ef_checkbox_list');
    listDiv.innerHTML = options.map(val => {
        const checked = activePOFilters[colKey] ? activePOFilters[colKey].has(val) : true;
        return `<label class="flex items-start gap-2 hover:bg-slate-100 p-1.5 rounded cursor-pointer po-ef-item transition"><input type="checkbox" value="${val}" ${checked ? 'checked' : ''} class="po-ef-check accent-[#00320D] mt-0.5 cursor-pointer w-4 h-4"><span class="text-slate-700 font-medium truncate w-full text-sm" title="${val}">${val}</span></label>`;
    }).join('');
    const selAll = document.getElementById('po_ef_select_all');
    if (selAll) selAll.checked = Array.from(document.querySelectorAll('.po-ef-check')).every(cb => cb.checked);
    const modal = document.getElementById('poExcelFilterModal');
    const th = e.target.closest('th');
    if (th) {
        const rect = th.getBoundingClientRect();
        modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        let leftPos = rect.left + window.scrollX;
        if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
        modal.style.left = leftPos + 'px';
    }
    modal.classList.remove('hidden'); modal.classList.add('flex');
};



renderKPIs = function(start, end) {
    dashboardLegacyRenderKPIs(start, end);
    const s = window.dashboardServerSummary;
    if (!s) return;
    const values = {
        stat_contacted: s.contacted,
        stat_parked: s.parked_range,
        stat_delivered: s.delivered,
        stat_billed: s.billed
    };
    for (const [id, value] of Object.entries(values)) {
        const el = document.getElementById(id);
        if (el) el.innerText = Number(value || 0);
    }
    const money = v => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (document.getElementById('sum_labor')) document.getElementById('sum_labor').innerText = money(s.sum_labor);
    if (document.getElementById('sum_parts')) document.getElementById('sum_parts').innerText = money(s.sum_parts);
    if (document.getElementById('sum_outsource')) document.getElementById('sum_outsource').innerText = money(s.sum_outsource);
};

renderERPStatuses = function(jobs) {
    const rows = window.dashboardServerSummary?.statusCounts;
    if (!Array.isArray(rows)) return dashboardLegacyRenderERPStatuses(jobs);
    const statusCounts = Object.fromEntries(rows.map(row => [row.label || 'ไม่ระบุสถานะ', Number(row.count || 0)]));
    const grid = document.getElementById('erp_status_grid');
    if (!grid) return;
    const exactOrder = ['01','02','03','04','05','06','07','08','09','23','10','11','12','13','14','15','16','17','18','19','20','21','22'];
    const sortedStatuses = Object.entries(statusCounts).filter(([, count]) => count > 0).sort((a,b) => {
        const ai = exactOrder.indexOf(String(a[0]).substring(0,2));
        const bi = exactOrder.indexOf(String(b[0]).substring(0,2));
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    if (!sortedStatuses.length) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-6 font-bold">ไม่มีงานค้าง</div>'; return; }
    grid.innerHTML = sortedStatuses.map(([st,count]) => {
        const cleanStatus = st.replace(/^[0-9.]+\s*/, '');
        let bgClass='bg-white border-slate-200', textClass='text-blue-700', iconClass='text-slate-300', pulse='';
        if (count >= 10) { bgClass='bg-rose-50 border-rose-300'; textClass='text-rose-700'; iconClass='text-rose-500'; pulse='animate-pulse'; }
        else if (count >= 5) { bgClass='bg-orange-50 border-orange-300'; textClass='text-orange-700'; iconClass='text-orange-500'; }
        return `<div onclick="openStatusModal('${st.replace(/'/g,"\\'")}')" class="${bgClass} border shadow-sm rounded-lg p-3 flex flex-col justify-between hover:shadow-md transition cursor-pointer transform hover:-translate-y-1"><span class="text-[10px] sm:text-xs font-bold text-slate-600 truncate mb-2" title="${st}">${cleanStatus}</span><div class="flex justify-between items-end"><i class="fa-solid fa-car-side ${iconClass} text-lg"></i><span class="text-xl sm:text-2xl font-black ${textClass} leading-none ${pulse}">${count}</span></div></div>`;
    }).join('');
};

renderStationSummary = function(jobs) {
    const rows = window.dashboardServerSummary?.stationCounts;
    if (!Array.isArray(rows)) return dashboardLegacyRenderStationSummary(jobs);
    const counts = Object.fromEntries(rows.map(row => [row.label, Number(row.count || 0)]));
    for (const station of ['01.เคาะ','02.โป๊ว','03.เตรียมพื้น','04.พ่นสี','05.ประกอบ','06.ขัดสี','07.QC','08.แม็ก','09.กระจก','10.ฟิล์ม','11.พักซ่อม','12.รอส่งมอบ']) {
        const el = document.getElementById(`stat_${station.substring(0,2)}`);
        if (!el) continue;
        const count = counts[station] || 0;
        el.innerText = count;
        if (count >= 10) el.classList.add('text-red-500','animate-pulse'); else el.classList.remove('text-red-500','animate-pulse');
    }
};

renderSASection = function() {
    const rows = window.dashboardServerSummary?.saCounts;
    if (!Array.isArray(rows)) return dashboardLegacyRenderSASection();
    const container = document.getElementById('sa_list_container');
    if (!container) return;
    if (!rows.length) { container.innerHTML = '<div class="text-center text-slate-400 py-6 font-bold">ไม่มีงานที่กำลังดำเนินการ</div>'; return; }
    container.innerHTML = rows.map(row => `<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center hover:border-amber-500 hover:shadow-md transition-all"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black shadow-inner"><i class="fa-solid fa-user-tie"></i></div><div><p class="text-sm font-bold text-slate-800">${row.label}</p><p class="text-[10px] text-slate-500">จำนวน: <span class="text-amber-600 font-black">${Number(row.count || 0)}</span> คัน</p></div></div><button onclick="openSAModal('${String(row.label).replace(/'/g,"\\'")}')" class="px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition shadow-sm border border-amber-200 whitespace-nowrap"><i class="fa-solid fa-list-ul"></i> ดูรายการ</button></div>`).join('');
};


// v12: Drill-downs must use complete branch data, never the current 20-row dashboard page.
let dashboardDrilldownSnapshot = null;
let dashboardDrilldownSnapshotBranch = null;
let dashboardDrilldownSnapshotPromise = null;

function dashboardSelectedBranch() {
    return document.getElementById('branchFilter')?.value || (dashboardIsManager() ? 'all' : userBranch);
}

async function fetchDashboardDrilldownSnapshot(force = false) {
    const branch = dashboardSelectedBranch();
    if (!force && dashboardDrilldownSnapshot && dashboardDrilldownSnapshotBranch === branch) return dashboardDrilldownSnapshot;
    if (!force && dashboardDrilldownSnapshotPromise && dashboardDrilldownSnapshotBranch === branch) return dashboardDrilldownSnapshotPromise;
    dashboardDrilldownSnapshotBranch = branch;
    const params = dashboardBranchParams(branch);
    dashboardDrilldownSnapshotPromise = (async () => {
        const res = await fetch(`${API_BASE_URL}/api/server/dashboard-drilldown-snapshot?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const snapshot = {
            reports: Array.isArray(payload.reports) ? payload.reports.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) })) : [],
            partOrders: Array.isArray(payload.partOrders) ? payload.partOrders : []
        };
        dashboardDrilldownSnapshot = snapshot;
        return snapshot;
    })();
    try {
        return await dashboardDrilldownSnapshotPromise;
    } finally {
        dashboardDrilldownSnapshotPromise = null;
    }
}

async function dashboardWithFullData(callback) {
    let snapshot;
    try {
        snapshot = await fetchDashboardDrilldownSnapshot();
    } catch (error) {
        console.error('Dashboard drill-down snapshot failed:', error);
        // Correctness fallback: use the legacy full endpoint instead of the current 20-row page.
        const branch = dashboardSelectedBranch();
        const fallback = await fetchDashboardLegacyFullDataset(branch);
        snapshot = {
            reports: Array.isArray(fallback?.reports) ? fallback.reports.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) })) : [],
            partOrders: Array.isArray(fallback?.partOrders) ? fallback.partOrders : []
        };
    }

    const saved = {
        allJobs, filteredJobs, allPartOrders, filteredPartOrders,
        jobByPlate, dashboardDateCounts, dashboardPartOrdersByJobId, dashboardPartOrdersByPlate
    };
    try {
        allJobs = snapshot.reports;
        filteredJobs = snapshot.reports;
        allPartOrders = snapshot.partOrders;
        filteredPartOrders = snapshot.partOrders;
        rebuildDashboardIndexes();
        rebuildDashboardRenderIndexes();
        return callback();
    } finally {
        allJobs = saved.allJobs;
        filteredJobs = saved.filteredJobs;
        allPartOrders = saved.allPartOrders;
        filteredPartOrders = saved.filteredPartOrders;
        jobByPlate = saved.jobByPlate;
        dashboardDateCounts = saved.dashboardDateCounts;
        dashboardPartOrdersByJobId = saved.dashboardPartOrdersByJobId;
        dashboardPartOrdersByPlate = saved.dashboardPartOrdersByPlate;
    }
}

function wrapDashboardDrilldown(name) {
    const original = globalThis[name];
    if (typeof original !== 'function' || original.__dashboardFullDataWrapped) return;
    const wrapped = async function(...args) {
        return dashboardWithFullData(() => original.apply(this, args));
    };
    wrapped.__dashboardFullDataWrapped = true;
    globalThis[name] = wrapped;
}

wrapDashboardDrilldown('openReportModal');
wrapDashboardDrilldown('openStatusModal');
wrapDashboardDrilldown('openDailyLineModal');
wrapDashboardDrilldown('openPaymentModal');
wrapDashboardDrilldown('openDamageModal');
wrapDashboardDrilldown('openPartsStatusModal');
wrapDashboardDrilldown('openMechanicModal');
wrapDashboardDrilldown('openSAModal');
wrapDashboardDrilldown('openStationModal');
wrapDashboardDrilldown('openCalendarModal');

// Explicit handler used by the three bars inside each calendar day.
globalThis.openJobListModalCalendar = async function(dateStr, type) {
    return dashboardWithFullData(() => {
        let jobsToShow = [];
        if (type === 'arrived') jobsToShow = filteredJobs.filter(j => cleanDate(j.arrived_date) === dateStr);
        else if (type === 'target') jobsToShow = filteredJobs.filter(j => cleanDate(j.target_finish_date) === dateStr);
        else if (type === 'delivery') jobsToShow = filteredJobs.filter(j => cleanDate(j.delivery_date) === dateStr);
        else jobsToShow = filteredJobs.filter(j => cleanDate(j.arrived_date) === dateStr || cleanDate(j.target_finish_date) === dateStr || cleanDate(j.delivery_date) === dateStr);

        const labels = { arrived: 'รถเข้าจอด', target: 'เป้าซ่อมเสร็จ', delivery: 'นัดส่งมอบ' };
        const title = labels[type] || 'รายการรถ';
        const titleEl = document.getElementById('modal_status_name');
        if (titleEl) titleEl.innerText = `${title} วันที่ ${new Date(dateStr).toLocaleDateString('th-TH')} (${jobsToShow.length} คัน)`;
        if (typeof renderJobTableInModalGroupedBySA === 'function') renderJobTableInModalGroupedBySA(jobsToShow);
        document.getElementById('jobListModal')?.classList.remove('hidden');
    });
};
