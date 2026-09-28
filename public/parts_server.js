// Page-scoped server data source for parts.html.
const PARTS_MASTER_PAGE_SIZE = 50;
let partsMasterAbortController = null;
let partsMasterSearchTimer = null;
let partsMasterSuggestAbortController = null;
const partsMasterLookupCache = new Map();

function renderMasterServerRows(items, pageInfo) {
    const tbody = document.getElementById('master_table_body');
    if (!tbody) return;
    const table = document.getElementById('masterTable');
    if (table) {
        RizenicPagination.renderControls({
            anchorId: 'masterTable',
            containerId: 'master_table_pagination',
            pageInfo,
            noun: 'รายการ',
            onPageChange: page => fetchMasterPartsPage(page)
        });
    }
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 font-bold bg-white">${masterPartsSearchText ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ไม่มีข้อมูลมาสเตอร์อะไหล่'}</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(m => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="font-mono text-blue-700 font-bold px-4 py-2.5">${m.part_no}</td>
            <td class="font-bold text-slate-800 px-4 py-2.5">${m.part_name}</td>
            <td class="font-mono text-slate-500 px-4 py-2.5">${m.part_main_no || '-'}</td>
            <td class="text-slate-600 text-xs font-bold px-4 py-2.5">${m.car_model || '-'}</td>
            <td class="px-4 py-2.5"><span class="bg-slate-100 text-[#00320D] border border-slate-200 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm">${m.part_category || m.part_type || 'หลัก'}</span></td>
            <td class="text-right font-mono font-bold text-slate-700 px-4 py-2.5">${parseFloat(m.unit_price || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}</td>
            <td class="text-center font-bold text-slate-600 px-4 py-2.5">${m.location || '-'}</td>
            <td class="text-center px-4 py-2.5"><button onclick="editMaster('${m.part_no}')" class="text-blue-500 hover:text-blue-700 px-2 transition"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteMaster('${m.part_id}')" class="text-slate-300 hover:text-red-500 px-2 transition"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

async function fetchMasterPartsPage(page = 1) {
    if (partsMasterAbortController) partsMasterAbortController.abort();
    partsMasterAbortController = new AbortController();
    masterPartsPager.page = Math.max(1, Number(page) || 1);
    const params = new URLSearchParams({
        branch: userBranch || 'สำนักงานใหญ่',
        page: String(masterPartsPager.page),
        limit: String(PARTS_MASTER_PAGE_SIZE)
    });
    if (masterPartsSearchText) params.set('search', masterPartsSearchText);

    const tbody = document.getElementById('master_table_body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-400 font-bold bg-white">กำลังโหลดข้อมูล...</td></tr>';
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/parts-master?${params.toString()}`, { signal: partsMasterAbortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const normalized = RizenicPagination.fromServerResponse(payload, masterPartsPager);
        allMasterPartsCache = normalized.items;
        for (const item of normalized.items) {
            if (item?.part_no) partsMasterLookupCache.set(String(item.part_no).trim().toUpperCase(), item);
        }
        renderMasterServerRows(normalized.items, normalized.pageInfo);
        return normalized.items;
    } catch (error) {
        if (error?.name === 'AbortError') return [];
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-red-500 font-bold bg-white">โหลดข้อมูลมาสเตอร์ไม่สำเร็จ</td></tr>';
        return [];
    }
}

goMasterPartsPage = function(page) {
    fetchMasterPartsPage(page);
};

renderMasterTable = function() {
    return fetchMasterPartsPage(masterPartsPager.page || 1);
};

searchMasterTable = function(value) {
    masterPartsSearchText = String(value || '').trim();
    clearTimeout(partsMasterSearchTimer);
    partsMasterSearchTimer = setTimeout(() => {
        RizenicPagination.reset(masterPartsPager);
        masterPartsPager.serverMeta = null;
        fetchMasterPartsPage(1);
    }, 250);
};

async function fetchMasterPartExact(partNo) {
    const key = String(partNo || '').trim().toUpperCase();
    if (!key) return null;
    if (partsMasterLookupCache.has(key)) return partsMasterLookupCache.get(key);
    try {
        const res = await fetch(`${API_BASE_URL}/api/parts/check/${encodeURIComponent(key)}?branch=${encodeURIComponent(userBranch || 'สำนักงานใหญ่')}`);
        if (!res.ok) return null;
        const item = await res.json();
        if (item?.part_no) partsMasterLookupCache.set(key, item);
        return item || null;
    } catch (_) {
        return null;
    }
}

autoFillDynName = async function(inputEl) {
    const partNo = inputEl.value.trim().toUpperCase();
    if (!partNo) return;
    const tr = inputEl.closest('tr');
    if (!tr) return;
    const matched = await fetchMasterPartExact(partNo);
    if (!matched || inputEl.value.trim().toUpperCase() !== partNo) return;
    tr.querySelector('.dyn-name').value = matched.part_name || '';
    tr.querySelector('.dyn-main').value = matched.part_main_no || '';
    const typeInp = tr.querySelector('.dyn-type');
    if (typeInp) typeInp.value = matched.part_category || matched.part_type || 'หลัก';
};

// Remote suggestions: no need to keep the entire master-parts table in browser memory.
document.addEventListener('input', function(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.getAttribute('list') !== 'master_parts_datalist') return;
    const keyword = input.value.trim();
    const datalist = document.getElementById('master_parts_datalist');
    if (!datalist) return;
    clearTimeout(input.__partsSuggestTimer);
    if (keyword.length < 2) {
        datalist.innerHTML = '';
        return;
    }
    input.__partsSuggestTimer = setTimeout(async () => {
        if (partsMasterSuggestAbortController) partsMasterSuggestAbortController.abort();
        partsMasterSuggestAbortController = new AbortController();
        const params = new URLSearchParams({ branch: userBranch || 'สำนักงานใหญ่', page: '1', limit: '20', search: keyword });
        try {
            const res = await fetch(`${API_BASE_URL}/api/server/parts-master?${params.toString()}`, { signal: partsMasterSuggestAbortController.signal });
            if (!res.ok) return;
            const payload = await res.json();
            const items = Array.isArray(payload.items) ? payload.items : [];
            items.forEach(item => {
                if (item?.part_no) partsMasterLookupCache.set(String(item.part_no).trim().toUpperCase(), item);
            });
            datalist.innerHTML = items.map(p => `<option value="${p.part_no}">${p.part_name} (MAIN: ${p.part_main_no || '-'})</option>`).join('');
        } catch (error) {
            if (error?.name !== 'AbortError') console.error('Master parts suggestion failed:', error);
        }
    }, 200);
});

loadAllData = async function() {
    const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);
    const params = new URLSearchParams();
    if (!isManager) params.set('branch', userBranch);
    try {
        const masterPromise = fetchMasterPartsPage(1);
        const alertRes = await fetch(`${API_BASE_URL}/api/server/parts-alerts?${params.toString()}`);
        if (!alertRes.ok) throw new Error(`HTTP ${alertRes.status}`);
        const payload = await alertRes.json();
        allReports = Array.isArray(payload.reports) ? payload.reports : [];
        allPartOrders = Array.isArray(payload.partOrders) ? payload.partOrders : [];
        rebuildPartOrderIndexes();
        if (typeof renderSAAlerts === 'function') renderSAAlerts();
        await masterPromise;
    } catch (error) {
        console.error('Parts server view failed:', error);
    }
};

// v9: SA Alerts are truly paged on the server. Only the visible 50 jobs and their PO rows live in the browser.
const PARTS_ALERT_PAGE_SIZE = 50;
const partsLegacyRenderSAAlerts = renderSAAlerts;
let partsAlertsAbortController = null;
let partsAlertsSearchTimer = null;
let partsAlertsServerPageInfo = null;

function renderPartsAlertsServerPage() {
    const savedPage = saAlertsPager.page;
    saAlertsPager.page = 1;
    partsLegacyRenderSAAlerts();
    saAlertsPager.page = savedPage;
    if (partsAlertsServerPageInfo) {
        RizenicPagination.renderControls({
            anchorId: 'saTable', containerId: 'sa_alerts_pagination', pageInfo: partsAlertsServerPageInfo,
            noun: 'รายการ', onPageChange: goSAAlertsPage
        });
        const badge = document.getElementById('alert_count');
        if (badge) {
            badge.innerText = partsAlertsServerPageInfo.total;
            badge.classList.toggle('hidden', partsAlertsServerPageInfo.total === 0);
        }
    }
}

async function fetchPartsAlertsPage(page = 1) {
    if (partsAlertsAbortController) partsAlertsAbortController.abort();
    partsAlertsAbortController = new AbortController();
    saAlertsPager.page = Math.max(1, Number(page) || 1);
    const isManager = ['BA','Manager','Admin','แอดมิน'].includes(userRole);
    const params = new URLSearchParams({ page: String(saAlertsPager.page), limit: String(PARTS_ALERT_PAGE_SIZE) });
    if (!isManager) params.set('branch', userBranch);
    if (saAlertsSearchText) params.set('search', saAlertsSearchText);
    const tbody = document.getElementById('sa_alerts_body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center py-10 text-slate-400 font-bold bg-white"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>กำลังโหลดข้อมูล...</td></tr>';
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/parts-alerts?${params.toString()}`, { signal: partsAlertsAbortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const normalized = RizenicPagination.fromServerResponse({
            items: payload.reports || [], page: payload.page, pageSize: payload.pageSize,
            total: payload.total, totalPages: payload.totalPages
        }, saAlertsPager);
        partsAlertsServerPageInfo = normalized.pageInfo;
        allReports = normalized.items;
        allPartOrders = Array.isArray(payload.partOrders) ? payload.partOrders : [];
        rebuildPartOrderIndexes();
        renderPartsAlertsServerPage();
        return normalized.items;
    } catch (error) {
        if (error?.name === 'AbortError') return [];
        if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center py-10 text-red-500 font-bold bg-white">โหลดรายการจาก SA ไม่สำเร็จ</td></tr>';
        return [];
    }
}

searchSAAlerts = function(value) {
    saAlertsSearchText = String(value || '').trim().toLowerCase();
    clearTimeout(partsAlertsSearchTimer);
    partsAlertsSearchTimer = setTimeout(() => fetchPartsAlertsPage(1), 250);
};

goSAAlertsPage = function(page) {
    fetchPartsAlertsPage(page);
};

renderSAAlerts = function() {
    if (partsAlertsServerPageInfo) return renderPartsAlertsServerPage();
    return fetchPartsAlertsPage(saAlertsPager.page || 1);
};

loadAllData = async function() {
    const masterPromise = fetchMasterPartsPage(1);
    await Promise.all([fetchPartsAlertsPage(1), masterPromise]);
};
