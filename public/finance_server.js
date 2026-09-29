// Server-side data controller for finance.html.
let financeServerPageInfo = { page: 1, pageSize: 50, total: 0, totalPages: 1, startNumber: 0, endNumber: 0, items: [] };
let financeServerSortField = 'id';
let financeServerSortDir = 'desc';
let financeServerAbortController = null;
let financeServerMeta = { branches: [], years: [] };
let financeTotalsKey = '';

const financeLegacyRenderTable = renderTable;
const financeLegacyExportToExcel = exportToExcel;

function buildFinanceServerParams({ paged = true, facet = '' } = {}) {
    const params = new URLSearchParams();
    params.set('department_routing', 'บัญชี');
    params.set('exclude_statuses', JSON.stringify(['18.ลูกค้ายกเลิก', 'ปิดงาน']));

    const branch = document.getElementById('branch_filter_select')?.value || (['BA','Manager','Admin','แอดมิน'].includes(userRole) ? 'ALL' : userBranch);
    if (branch && branch !== 'ALL') params.set('branch', branch);

    const search = document.getElementById('search_input')?.value?.trim() || '';
    if (search) params.set('search', search);

    const managedType = document.getElementById('managed_filter_select')?.value || '';
    if (managedType === 'รอจัดการ') params.set('missing_field', 'billing_date');
    else if (managedType === 'จัดการแล้ว') params.set('present_field', 'billing_date');
    else if (managedType === '13.วางบิลประกัน') params.set('job_status', '13.วางบิลประกัน');

    const dateType = document.getElementById('date_filter_type')?.value || '';
    const dateStart = document.getElementById('date_start')?.value || '';
    const dateEnd = document.getElementById('date_end')?.value || '';
    if (managedType !== 'รอจัดการ' && ['billing_date', 'insurance_pay_date', 'insurance_payment_date'].includes(dateType)) {
        if (dateStart || dateEnd) params.set('date_field', dateType);
        if (dateStart) params.set('date_from', dateStart);
        if (dateEnd) params.set('date_to', dateEnd);
    }

    const filterObject = {};
    for (const [idx, values] of Object.entries(activeFilters || {})) {
        const col = columnsDef.find(c => Number(c.idx) === Number(idx));
        if (!col || !values || values.size === 0) continue;
        filterObject[col.key] = Array.from(values);
    }
    if (Object.keys(filterObject).length) params.set('filters', JSON.stringify(filterObject));

    params.set('sort', financeServerSortField);
    params.set('dir', financeServerSortDir);

    if (facet) {
        params.set('facet', facet);
    } else if (paged) {
        params.set('paged', '1');
        params.set('page', String(financePager.page));
        params.set('limit', String(financePager.pageSize));
    } else {
        params.set('full', '1');
    }
    return params;
}

function buildFinanceTotalsKey() {
    const params = buildFinanceServerParams({ paged: false });
    params.delete('full');
    params.delete('sort');
    params.delete('dir');
    return params.toString();
}

async function fetchFinanceTotals({ force = false } = {}) {
    const key = buildFinanceTotalsKey();
    if (!force && key === financeTotalsKey) return;
    const params = new URLSearchParams(key);
    const res = await fetch(`${API_BASE_URL}/api/server/finance-totals?${params.toString()}`);
    if (!res.ok) return;
    const totals = await res.json();
    financeTotalsKey = key;
    const fmt = value => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    if (document.getElementById('sum_labor')) document.getElementById('sum_labor').innerText = fmt(totals.labor);
    if (document.getElementById('sum_part')) document.getElementById('sum_part').innerText = fmt(totals.part);
    if (document.getElementById('sum_ext')) document.getElementById('sum_ext').innerText = fmt(totals.external);
    if (document.getElementById('sum_total')) document.getElementById('sum_total').innerText = fmt(totals.total);
    if (document.getElementById('row_count')) document.getElementById('row_count').innerText = String(totals.count || 0);
}

async function fetchFinanceServerPage({ refreshTotals = true, forceTotals = false } = {}) {
    if (financeServerAbortController) financeServerAbortController.abort();
    financeServerAbortController = new AbortController();
    const params = buildFinanceServerParams({ paged: true });
    const totalsPromise = refreshTotals ? fetchFinanceTotals({ force: forceTotals }).catch(() => {}) : Promise.resolve();
    try {
        const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`, { signal: financeServerAbortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const normalized = RizenicPagination.fromServerResponse(payload, financePager);
        financeServerPageInfo = normalized.pageInfo;
        currentFilteredData = normalized.items;
        allAccJobs = normalized.items;
        renderTable(currentFilteredData);
        await totalsPromise;
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('Finance server paging failed:', error);
        const tbody = document.getElementById('acc_table_body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-10 text-red-500 font-bold">ไม่สามารถโหลดข้อมูลบัญชีได้</td></tr>`;
    }
}

renderTable = function(data) {
    const savedPage = financePager.page;
    financePager.page = 1;
    financeLegacyRenderTable(Array.isArray(data) ? data : []);
    financePager.page = savedPage;
    RizenicPagination.renderControls({
        anchorId: 'accTable', containerId: 'finance_table_pagination', pageInfo: financeServerPageInfo,
        noun: 'งาน', onPageChange: goFinancePage
    });
};

goFinancePage = function(page) {
    financePager.page = page;
    fetchFinanceServerPage({ refreshTotals: false });
};

applyFilters = function(resetPage = true) {
    if (resetPage) financePager.page = 1;
    return fetchFinanceServerPage({ refreshTotals: true, forceTotals: true });
};

sortTable = function(colIndex) {
    const col = columnsDef.find(c => Number(c.idx) === Number(colIndex));
    if (!col) return;
    if (financeServerSortField === col.key) financeServerSortDir = financeServerSortDir === 'asc' ? 'desc' : 'asc';
    else {
        financeServerSortField = col.key;
        financeServerSortDir = 'asc';
    }
    financePager.page = 1;
    const table = document.getElementById('accTable');
    if (table) {
        table.querySelectorAll('.fa-sort, .fa-sort-up, .fa-sort-down').forEach(icon => { icon.className = 'fa-solid fa-sort sort-icon'; });
        const clickedIcon = document.querySelector(`#th_${colIndex} .sort-icon`);
        if (clickedIcon) clickedIcon.className = financeServerSortDir === 'asc' ? 'fa-solid fa-sort-up ml-1 text-amber-400 opacity-100' : 'fa-solid fa-sort-down ml-1 text-amber-400 opacity-100';
    }
    fetchFinanceServerPage({ refreshTotals: false });
};

openExcelFilter = async function(e, colIndex, title) {
    e.stopPropagation();
    currentFilterKey = colIndex;
    document.getElementById('ef_col_name').innerText = title;
    document.getElementById('ef_search').value = '';
    const colDef = columnsDef.find(c => Number(c.idx) === Number(colIndex));
    if (!colDef) return;

    const params = buildFinanceServerParams({ paged: false, facet: colDef.key });
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) return;
    const payload = await res.json();
    const sortedValues = Array.isArray(payload?.values) ? payload.values : [];
    const listDiv = document.getElementById('ef_checkbox_list');
    const activeSet = activeFilters[colIndex];
    listDiv.innerHTML = sortedValues.map(val => {
        const display = String(val ?? '');
        const checked = activeSet ? activeSet.has(display) : true;
        return `<label class="flex items-start gap-2 hover:bg-slate-200 p-1.5 rounded cursor-pointer ef-item transition"><input type="checkbox" value="${display.replace(/"/g, '&quot;')}" ${checked ? 'checked' : ''} class="ef-check accent-[#00320D] mt-0.5 cursor-pointer"><span class="text-slate-800 font-medium truncate w-full" title="${display.replace(/"/g, '&quot;')}">${display === '' ? '(ว่าง)' : display}</span></label>`;
    }).join('');
    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);

    const modal = document.getElementById('excelFilterModal');
    const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    let leftPos = rect.left + window.scrollX;
    if (leftPos + 260 > window.innerWidth) leftPos = window.innerWidth - 270;
    modal.style.left = leftPos + 'px';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

updateDashboard = async function() {
    const filterMonth = document.getElementById('month_filter_select')?.value || '';
    const filterYear = document.getElementById('year_filter_select')?.value || '';
    const filterBranch = document.getElementById('branch_filter_select')?.value || 'ALL';
    const params = new URLSearchParams();
    if (filterBranch !== 'ALL') params.set('branch', filterBranch);
    if (filterYear) params.set('year', filterYear);
    if (filterMonth) params.set('month', filterMonth);
    try {
        const res = await fetch(`${API_BASE_URL}/api/server/finance-summary?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const summary = await res.json();
        const unmanaged = Number(summary.unmanaged || 0);
        const managed = Number(summary.managed || 0);
        document.getElementById('stat_unmanaged').innerText = unmanaged;
        document.getElementById('stat_managed').innerText = managed;
        const monthNames = ['', 'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        document.getElementById('managed_date_label').innerText = `นับเฉพาะบิลของ ${filterMonth ? monthNames[Number(filterMonth)] : 'ทุกเดือน'} ${filterYear || 'ทุกปี'}`;
        if (donutChart) donutChart.destroy();
        const canvas = document.getElementById('jobDonutChart');
        if (canvas) donutChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['งานรอจัดการ (ยังไม่ออกบิล)', 'งานจัดการแล้ว (ออกบิลแล้ว)'], datasets: [{ data: [unmanaged, managed], backgroundColor: ['#f43f5e', '#10b981'], borderWidth: 0, hoverOffset: 10 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { font: { family: 'Kanit' } } } } }
        });
    } catch (error) {
        console.error('Finance summary failed:', error);
    }
};

function buildFinanceBranchDropdownFromMeta() {
    const branchSelect = document.getElementById('branch_filter_select');
    if (!branchSelect) return;
    const manager = ['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole);
    if (manager) {
        const saved = branchSelect.value || 'ALL';
        branchSelect.innerHTML = '<option value="ALL">-- ทุกสาขา --</option>' + financeServerMeta.branches.map(b => `<option value="${b}">${b}</option>`).join('');
        branchSelect.value = financeServerMeta.branches.includes(saved) || saved === 'ALL' ? saved : 'ALL';
        branchSelect.disabled = false;
    } else {
        branchSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`;
        branchSelect.value = userBranch;
        branchSelect.disabled = true;
    }
}

function buildFinanceYearDropdownFromMeta() {
    const ySelect = document.getElementById('year_filter_select');
    if (!ySelect) return;
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear, ...financeServerMeta.years]);
    const saved = ySelect.dataset.initialized ? ySelect.value : String(currentYear);
    ySelect.innerHTML = '<option value="">ทุกปี</option>' + [...years].sort((a,b) => b-a).map(y => `<option value="${y}">${y}</option>`).join('');
    ySelect.value = years.has(Number(saved)) ? saved : String(currentYear);
    ySelect.dataset.initialized = 'true';
}

function primeFinanceFilterDefaults() {
    const manager = ['Manager', 'Admin', 'BA', 'แอดมิน'].includes(userRole);
    const branchSelect = document.getElementById('branch_filter_select');
    if (branchSelect && !manager) {
        branchSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`;
        branchSelect.value = userBranch;
        branchSelect.disabled = true;
    }

    const yearSelect = document.getElementById('year_filter_select');
    if (yearSelect && !yearSelect.dataset.initialized) {
        const currentYear = String(new Date().getFullYear());
        if (![...yearSelect.options].some(option => option.value === currentYear)) {
            yearSelect.insertAdjacentHTML('beforeend', `<option value="${currentYear}">${currentYear}</option>`);
        }
        yearSelect.value = currentYear;
        yearSelect.dataset.initialized = 'true';
    }
}

loadAccountingData = async function() {
    try {
        primeFinanceFilterDefaults();
        const dashboardActive = document.getElementById('tab-dashboard')?.classList.contains('active');
        const summaryPromise = dashboardActive ? updateDashboard() : applyFilters();
        const metaPromise = Promise.all([
            fetch(`${API_BASE_URL}/api/server/finance-meta`),
            fetch(`${API_BASE_URL}/api/statuses`)
        ]).then(async ([metaRes, statusRes]) => {
            const [meta, allStats] = await Promise.all([
                metaRes.ok ? metaRes.json() : Promise.resolve(null),
                statusRes.ok ? statusRes.json() : Promise.resolve([])
            ]);
            if (meta) financeServerMeta = meta;
            accStatuses = (Array.isArray(allStats) ? allStats : []).filter(s => s.department === 'บัญชี').map(s => s.status_name);
            buildFinanceBranchDropdownFromMeta();
            buildFinanceYearDropdownFromMeta();
        });
        await Promise.all([metaPromise, summaryPromise]);
    } catch (error) {
        console.error('Finance bootstrap failed:', error);
        const tbody = document.getElementById('acc_table_body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="${columnsDef.length}" class="text-center py-10 text-red-500 font-bold">ไม่สามารถเชื่อมต่อข้อมูลบัญชีได้</td></tr>`;
    }
};

exportToExcel = async function() {
    try {
        const params = buildFinanceServerParams({ paged: false });
        const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const exportRows = await res.json();
        const oldRows = currentFilteredData;
        currentFilteredData = Array.isArray(exportRows) ? exportRows : [];
        await financeLegacyExportToExcel();
        currentFilteredData = oldRows;
    } catch (error) {
        console.error('Finance export failed:', error);
        showToast('โหลดข้อมูลสำหรับ Excel ไม่สำเร็จ', 'error');
    }
};
