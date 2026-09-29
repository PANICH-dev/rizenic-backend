// v9 server-paged data source for jobs.html.
const SA_SERVER_PAGE_SIZE = 50;
const jobsLegacyFilterDataByBranch = filterDataByBranch;
const jobsLegacyOpenSADetail = openSADetail;
const jobsLegacyUpdateHeaderSummaryBadges = updateHeaderSummaryBadges;
let jobsServerLoadedBranch = null;
let jobsServerAbortController = null;
let jobsServerDetailController = null;
let jobsServerDetailPageInfo = null;
let jobsMasterDataPromise = null;
let jobsMasterDataCache = null;
window.jobsServerSaSummary = [];

function jobsOverviewIsManager() {
    return ['BA','Manager','Admin','แอดมิน'].includes(userRole);
}

function jobsCurrentBranchParam(branch, params) {
    if (branch && String(branch).toUpperCase() !== 'ALL') params.set('branch', branch);
}

function fetchJobsMasterDataOnce() {
    if (jobsMasterDataCache) return Promise.resolve(jobsMasterDataCache);
    if (!jobsMasterDataPromise) {
        jobsMasterDataPromise = Promise.allSettled([
            fetch(`${API_BASE_URL}/api/statuses`).then(r => r.ok ? r.json() : []),
            fetch(`${API_BASE_URL}/api/part-statuses`).then(r => r.ok ? r.json() : [])
        ]).then(result => {
            jobsMasterDataCache = result;
            return result;
        }).finally(() => { jobsMasterDataPromise = null; });
    }
    return jobsMasterDataPromise;
}

function jobsPageKeys(reports) {
    const ids = [...new Set((reports || []).map(j => j?.id).filter(v => v != null).map(String))];
    const plates = [...new Set((reports || []).map(j => j?.car_plate).filter(Boolean).map(v => String(v).trim()))];
    return { ids, plates };
}

async function fetchJobsPageParts(reports, branch, signal) {
    const { ids, plates } = jobsPageKeys(reports);
    if (!ids.length && !plates.length) return [];
    const params = new URLSearchParams();
    jobsCurrentBranchParam(branch, params);
    if (ids.length) params.set('job_ids', ids.join(','));
    if (plates.length) params.set('car_plates', plates.join(','));
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/sa-parts?${params.toString()}`, { signal });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload.partOrders) ? payload.partOrders : [];
    } catch (error) {
        if (error?.name !== 'AbortError') console.error('SA current-page parts failed:', error);
        return [];
    }
}

updateHeaderSummaryBadges = function(jobs) {
    if (!Array.isArray(window.jobsServerSaSummary) || !window.jobsServerSaSummary.length || currentViewSA) {
        return jobsLegacyUpdateHeaderSummaryBadges(jobs);
    }
    const total = key => window.jobsServerSaSummary.reduce((sum, row) => sum + Number(row[key] || 0), 0);
    const values = {
        badge_wait_bill: total('wait_bill'),
        badge_billed: total('billed'),
        badge_main_parts: total('main_parts'),
        badge_sub_parts: total('sub_parts')
    };
    for (const [id, value] of Object.entries(values)) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }
};

async function fetchJobsServerView(branch, page = 1) {
    if (jobsServerAbortController) jobsServerAbortController.abort();
    const requestController = new AbortController();
    jobsServerAbortController = requestController;
    const params = new URLSearchParams({ page: String(Math.max(1, Number(page) || 1)), limit: String(SA_SERVER_PAGE_SIZE), includeParts: '1' });
    jobsCurrentBranchParam(branch, params);

    const secondaryPromise = fetchJobsMasterDataOnce();

    const res = await fetch(`${API_BASE_URL}/api/server/sa-overview?${params.toString()}`, { signal: requestController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (jobsServerAbortController !== requestController || requestController.signal.aborted) return;

    masterJobsData = Array.isArray(payload.reports) ? payload.reports : [];
    allJobsData = masterJobsData;
    window.jobsServerSaSummary = Array.isArray(payload.saSummary) ? payload.saSummary : [];
    allPartOrders = Array.isArray(payload.partOrders) ? payload.partOrders : [];
    rebuildPartOrdersByPlate();
    selectedBranchFilter = branch || 'ALL';
    jobsServerLoadedBranch = selectedBranchFilter;
    currentViewSA = '';

    const branchSelect = document.getElementById('branch_filter');
    if (branchSelect) {
        const manager = jobsOverviewIsManager();
        branchSelect.innerHTML = (manager ? `<option value="ALL">🏢 รวมทุกสาขา</option>` : '') + (payload.branches || []).map(b => `<option value="${b}">${b}</option>`).join('');
        if (!manager) selectedBranchFilter = userBranch;
        branchSelect.value = selectedBranchFilter;
        branchSelect.disabled = !manager;
    }

    jobsLegacyFilterDataByBranch();
    const secondary = await secondaryPromise;
    if (jobsServerAbortController !== requestController || requestController.signal.aborted) return;
    if (secondary[0].status === 'fulfilled') {
        const statuses = secondary[0].value || [];
        globalStatusOptionsHtml = statuses.length ? statuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('') : `<option value="09.จอดรอเข้าซ่อม">09.จอดรอเข้าซ่อม</option>`;
    }
    if (secondary[1].status === 'fulfilled') allStatuses = secondary[1].value || [];
}

async function fetchSADetailPage(saName, page = 1, { reuseTotal = false } = {}) {
    if (jobsServerDetailController) jobsServerDetailController.abort();
    const requestController = new AbortController();
    jobsServerDetailController = requestController;
    const params = new URLSearchParams({
        sa_owner: saName,
        page: String(Math.max(1, Number(page) || 1)),
        limit: String(SA_SERVER_PAGE_SIZE),
        includeParts: '1',
        includeMeta: '0'
    });
    jobsCurrentBranchParam(selectedBranchFilter, params);
    if (reuseTotal && Number.isFinite(Number(jobsServerDetailPageInfo?.total))) params.set('known_total', String(Number(jobsServerDetailPageInfo.total)));
    const res = await fetch(`${API_BASE_URL}/api/server/sa-overview?${params.toString()}`, { signal: requestController.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (jobsServerDetailController !== requestController || requestController.signal.aborted) return;
    const normalized = RizenicPagination.fromServerResponse({
        items: payload.reports || [], page: payload.page, pageSize: payload.pageSize,
        total: payload.total, totalPages: payload.totalPages
    }, parkedPager);
    jobsServerDetailPageInfo = normalized.pageInfo;
    poPager.page = normalized.pageInfo.page;
    allJobsData = normalized.items;
    masterJobsData = normalized.items;
    allPartOrders = Array.isArray(payload.partOrders) ? payload.partOrders : [];
    rebuildPartOrdersByPlate();
    currentViewSA = saName;

    const savedParked = parkedPager.page;
    const savedPO = poPager.page;
    parkedPager.page = 1;
    poPager.page = 1;
    jobsLegacyOpenSADetail(saName);
    parkedPager.page = savedParked;
    poPager.page = savedPO;
    if (jobsServerDetailPageInfo) {
        RizenicPagination.renderControls({ anchorId: 'parkedTable', containerId: 'parked_table_pagination', pageInfo: jobsServerDetailPageInfo, noun: 'งาน', onPageChange: goParkedPage });
        RizenicPagination.renderControls({ anchorId: 'poTable', containerId: 'po_table_pagination', pageInfo: jobsServerDetailPageInfo, noun: 'งาน', onPageChange: goPOPage });
    }
}

openSADetail = function(saName) {
    fetchSADetailPage(saName, 1).catch(error => {
        if (error?.name !== 'AbortError') showToast('โหลดรายละเอียด SA ไม่สำเร็จ', 'error');
    });
};

goParkedPage = function(page) {
    fetchSADetailPage(currentViewSA, page, { reuseTotal: true }).catch(() => {});
};

goPOPage = function(page) {
    fetchSADetailPage(currentViewSA, page, { reuseTotal: true }).catch(() => {});
};

globalSearchCar = async function() {
    const plate = document.getElementById('global_search_plate')?.value.trim();
    if (!plate) return;
    const params = new URLSearchParams({ page: '1', limit: String(SA_SERVER_PAGE_SIZE), search: plate, includeParts: '0', includeMeta: '0' });
    jobsCurrentBranchParam(selectedBranchFilter, params);
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/sa-overview?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const matchedJobs = Array.isArray(payload.reports) ? payload.reports : [];
        if (!matchedJobs.length) showToast('ไม่พบรถทะเบียน: ' + plate, 'error');
        else if (matchedJobs.length === 1) { showToast('🚀 กำลังพุ่งไป...', 'info'); setTimeout(() => goToEditJob(matchedJobs[0].id), 300); }
        else {
            document.getElementById('modal_status_name').innerText = `ค้นหาทะเบียน: ${plate}`;
            renderJobTableInModal(matchedJobs, 'general');
            document.getElementById('jobListModal').classList.remove('hidden');
        }
    } catch (_) { showToast('ค้นหาทะเบียนไม่สำเร็จ', 'error'); }
};

loadJobsData = async function() {
    try {
        const initialBranch = jobsOverviewIsManager() ? 'ALL' : userBranch;
        await fetchJobsServerView(initialBranch, 1);
    } catch (error) {
        if (error?.name !== 'AbortError') {
            console.error('SA server overview failed:', error);
            showToast('มีปัญหาในการโหลดข้อมูล', 'error');
        }
    }
};

onBranchChange = async function() {
    const selected = document.getElementById('branch_filter')?.value || 'ALL';
    try {
        await fetchJobsServerView(selected, 1);
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

function startJobsServerInitialLoad() {
    if (!window.RIZENIC_JOBS_SERVER_MODE) return;
    if (sessionStorage.getItem('isLoggedIn') !== 'true') return;
    loadJobsData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startJobsServerInitialLoad, { once: true });
} else {
    startJobsServerInitialLoad();
}
