// Turbo server-side paging overrides for Jobs Table.
// Loaded after the legacy table scripts so existing modals/editors remain intact.
let jobsServerTotal = 0;
let jobsServerBranches = [];
let jobsServerSAs = [];
let jobsServerRequestSeq = 0;
let jobsServerAbortController = null;


function setJobsTableLoading(visible, message = 'กำลังโหลดข้อมูล...') {
    const layer = document.getElementById('jobs_table_loading');
    const text = document.getElementById('jobs_table_loading_text');
    const icon = document.getElementById('jobs_table_loading_icon');
    if (!layer) return;

    if (text) text.textContent = message;
    if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin text-3xl text-green-800 mb-3';
    layer.classList.remove('is-error');
    layer.classList.toggle('is-hidden', !visible);
    layer.setAttribute('aria-busy', visible ? 'true' : 'false');
}

function setJobsTableLoadingError(message = 'เกิดข้อผิดพลาดในการโหลดข้อมูล') {
    const layer = document.getElementById('jobs_table_loading');
    const text = document.getElementById('jobs_table_loading_text');
    const icon = document.getElementById('jobs_table_loading_icon');
    if (!layer) return;

    if (text) text.textContent = message;
    if (icon) icon.className = 'fa-solid fa-triangle-exclamation text-3xl text-red-600 mb-3';
    layer.classList.remove('is-hidden');
    layer.classList.add('is-error');
    layer.setAttribute('aria-busy', 'false');
}

function jobsIsManager() {
    return ['BA', 'Manager', 'Admin', 'แอดมิน'].includes(userRole);
}

function jobsActiveFilterPayload() {
    const payload = {};
    Object.entries(activeFilters || {}).forEach(([idx, set]) => {
        const col = columnsDef.find(c => Number(c.idx) === Number(idx));
        if (!col || col.key === 'action' || !set || set.size === 0) return;
        payload[col.key] = Array.from(set);
    });
    return payload;
}

function buildJobsServerParams(paged = true) {
    const params = new URLSearchParams();
    if (paged) {
        params.set('paged', '1');
        params.set('page', String(jobsPager.page));
        params.set('limit', String(jobsPager.pageSize));
    } else {
        params.set('full', '1');
    }

    const branchSelected = document.getElementById('branch_filter_select')?.value || '';
    if (!jobsIsManager()) params.set('branch', userBranch);
    else if (branchSelected && branchSelected !== 'ALL') params.set('branch', branchSelected);

    const search = document.getElementById('search_input')?.value?.trim();
    if (search) params.set('search', search);

    const sa = document.getElementById('sa_filter_select')?.value || '';
    if (sa) params.set('sa_owner', sa);

    const filters = jobsActiveFilterPayload();
    if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters));

    params.set('exclude_statuses', JSON.stringify(excludedStatuses));
    params.set('exclude_billing', '1');
    params.set('exclude_department', 'บัญชี');

    const table = document.getElementById('jobsTable');
    const sortedCol = Number(table?.getAttribute('data-sorted-col') || 0);
    const sortedDir = table?.getAttribute('data-sorted-dir') || '';
    const sortDef = columnsDef.find(c => Number(c.idx) === sortedCol && c.key !== 'action');
    if (sortDef) params.set('sort', sortDef.key);
    if (sortDef && sortedDir) params.set('dir', sortedDir);

    return params;
}

async function fetchJobsServerPage({ showLoading = true } = {}) {
    const seq = ++jobsServerRequestSeq;
    if (jobsServerAbortController) jobsServerAbortController.abort();
    const requestController = new AbortController();
    jobsServerAbortController = requestController;

    if (showLoading) setJobsTableLoading(true, 'กำลังโหลดข้อมูล...');
    let requestFailed = false;

    try {
        const params = buildJobsServerParams(true);
        const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`, { signal: jobsServerAbortController.signal });
        if (!res.ok) throw new Error(await readApiErrorMessage(res, 'โหลดข้อมูลไม่สำเร็จ'));
        const payload = await res.json();
        if (seq !== jobsServerRequestSeq) return;

        const validPagedPayload = payload && !Array.isArray(payload) && Array.isArray(payload.items);
        if (!validPagedPayload) throw new Error('รูปแบบข้อมูลแบ่งหน้าไม่ถูกต้อง');

        const normalized = RizenicPagination.fromServerResponse(payload, jobsPager);
        jobsServerTotal = normalized.pageInfo.total;
        allJobsData = normalized.items.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) }));
        currentFilteredData = allJobsData;

        // Pull only PO rows that can enrich the visible jobs instead of the entire PO table.
        const poParams = new URLSearchParams();
        const activeBranch = params.get('branch');
        if (activeBranch) poParams.set('branch', activeBranch);
        const jobIds = allJobsData.map(j => j.id).filter(Boolean).map(String);
        const plates = allJobsData.map(j => j.car_plate).filter(Boolean);
        if (jobIds.length) poParams.set('job_ids', jobIds.join(','));
        if (plates.length) poParams.set('car_plates', plates.join(','));
        try {
            const poRes = await fetch(`${API_BASE_URL}/api/part-orders${poParams.toString() ? `?${poParams.toString()}` : ''}`, { signal: jobsServerAbortController.signal });
            allPartOrders = poRes.ok ? await poRes.json() : [];
        } catch (error) {
            if (error?.name === 'AbortError') return;
            allPartOrders = [];
        }

        if (seq !== jobsServerRequestSeq) return;
        renderTable(currentFilteredData);
        const rowCount = document.getElementById('row_count');
        if (rowCount) rowCount.innerText = String(jobsServerTotal);
        restoreTableIndicators();
    } catch (error) {
        if (error?.name === 'AbortError') return;
        requestFailed = true;
        if (seq === jobsServerRequestSeq) {
            setJobsTableLoadingError(error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
        throw error;
    } finally {
        if (jobsServerAbortController === requestController) {
            jobsServerAbortController = null;
            if (showLoading && seq === jobsServerRequestSeq && !requestFailed) {
                setJobsTableLoading(false);
            }
        }
    }
}

async function fetchJobsFacet(field, extra = {}) {
    const params = buildJobsServerParams(false);
    params.delete('full');
    params.delete('sort');
    params.delete('dir');
    params.set('facet', field);
    Object.entries(extra).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') params.delete(k);
        else params.set(k, String(v));
    });
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.values) ? data.values : [];
}

async function refreshJobsBasicFacets() {
    try {
        const branchSelected = document.getElementById('branch_filter_select')?.value || '';
        const branchPromise = jobsIsManager() ? fetchJobsFacet('branch_name', { branch: '' }) : Promise.resolve([userBranch]);
        const saPromise = fetchJobsFacet('sa_owner', jobsIsManager() && branchSelected === 'ALL' ? { branch: '' } : {});
        const [branches, sas] = await Promise.all([branchPromise, saPromise]);
        jobsServerBranches = branches.filter(Boolean);
        jobsServerSAs = sas.filter(Boolean);
        buildBranchDropdown();
        buildSADropdown();
    } catch (_) {}
}

buildBranchDropdown = function () {
    const branchSelect = document.getElementById('branch_filter_select');
    if (!branchSelect) return;
    const saved = branchSelect.value;
    if (jobsIsManager()) {
        const values = jobsServerBranches.length ? jobsServerBranches : [...new Set(allJobsData.map(j => j.branch_name).filter(Boolean))].sort();
        branchSelect.innerHTML = '<option value="ALL">-- ทุกสาขา --</option>' + values.map(b => `<option value="${b}">${b}</option>`).join('');
        branchSelect.value = saved && (saved === 'ALL' || values.includes(saved)) ? saved : 'ALL';
        branchSelect.disabled = false;
    } else {
        branchSelect.innerHTML = `<option value="${userBranch}">${userBranch}</option>`;
        branchSelect.value = userBranch;
        branchSelect.disabled = true;
    }
};

buildSADropdown = function () {
    const saSelect = document.getElementById('sa_filter_select');
    if (!saSelect) return;
    const saved = saSelect.value;
    const values = jobsServerSAs.length ? jobsServerSAs : [...new Set(allJobsData.map(j => j.sa_owner).filter(Boolean))].sort();
    saSelect.innerHTML = '<option value="">-- แสดง SA ทั้งหมด --</option>' + values.map(sa => `<option value="${sa}">${sa}</option>`).join('');
    if (saved && values.includes(saved)) saSelect.value = saved;
};

loadJobsData = async function () {
    setJobsTableLoading(true, 'กำลังโหลดข้อมูล...');
    const secondaryPromise = Promise.allSettled([
        fetch(`${API_BASE_URL}/api/body-parts`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/customer-types`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/insurances`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/employees${jobsIsManager() ? '' : `?branch=${encodeURIComponent(userBranch)}`}`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/car-models`).then(r => r.json())
    ]);
    try {
        const statusPromise = fetch(`${API_BASE_URL}/api/statuses`)
            .then(async statusRes => statusRes.ok ? statusRes.json() : [])
            .catch(() => []);
        const pagePromise = fetchJobsServerPage({ showLoading: true });
        await pagePromise;
        refreshJobsBasicFacets();

        const [statuses, secondary] = await Promise.all([statusPromise, secondaryPromise]);
        globalStatuses = Array.isArray(statuses) ? statuses : [];
        globalStatusOptionsHtml = globalStatuses.map(s => `<option value="${s.status_name}">${s.status_name}</option>`).join('');
        if (secondary[0].status === 'fulfilled') allMasterParts = secondary[0].value;
        if (secondary[1].status === 'fulfilled') allCustomerTypes = secondary[1].value;
        if (secondary[2].status === 'fulfilled') allInsurances = secondary[2].value;
        if (secondary[3].status === 'fulfilled') allEmployees = secondary[3].value;
        if (secondary[4].status === 'fulfilled') allCarModels = secondary[4].value;

        const dlBrands = document.getElementById('dl_car_brands');
        if (dlBrands) dlBrands.innerHTML = [...new Set(allCarModels.map(c => c.car_brand).filter(Boolean))].sort().map(b => `<option value="${b}">`).join('');
        const dlModels = document.getElementById('dl_car_models');
        if (dlModels) dlModels.innerHTML = [...new Set(allCarModels.map(c => c.car_model).filter(Boolean))].sort().map(m => `<option value="${m}">`).join('');
        renderTable(currentFilteredData);
    } catch (error) {
        setJobsTableLoadingError(error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
};

applyFilters = async function (resetPage = true) {
    if (resetPage) jobsPager.page = 1;
    await fetchJobsServerPage({ showLoading: true });
    refreshJobsBasicFacets();
};

goJobsPage = function (page) {
    jobsPager.page = page;
    return fetchJobsServerPage({ showLoading: true }).catch(() => {});
};

sortTable = function (colIndex) {
    const table = document.getElementById('jobsTable');
    const col = columnsDef.find(c => Number(c.idx) === Number(colIndex));
    if (!table || !col || col.key === 'action') return;
    const currentCol = Number(table.getAttribute('data-sorted-col') || 0);
    const currentDir = table.getAttribute('data-sorted-dir') || 'desc';
    const nextDir = currentCol === Number(colIndex) ? (currentDir === 'asc' ? 'desc' : 'asc') : 'asc';
    table.setAttribute('data-sorted-col', String(colIndex));
    table.setAttribute('data-sorted-dir', nextDir);
    jobsPager.page = 1;
    return fetchJobsServerPage({ showLoading: true }).catch(() => {});
};

function jobsEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

async function fetchReportFacetValues(field) {
    return fetchJobsFacet(field);
}

openExcelFilter = async function (e, colIndex, title) {
    e.stopPropagation();
    currentFilterKey = colIndex;
    const colDef = columnsDef.find(c => Number(c.idx) === Number(colIndex));
    if (!colDef || colDef.key === 'action') return;
    document.getElementById('ef_col_name').innerText = title;
    document.getElementById('ef_search').value = '';

    const listDiv = document.getElementById('ef_checkbox_list');
    listDiv.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดตัวเลือก...</div>';
    const values = await fetchReportFacetValues(colDef.key);
    listDiv.innerHTML = values.map(raw => {
        const isChecked = activeFilters[colIndex] ? activeFilters[colIndex].has(raw) : true;
        const display = colDef.key.includes('date') && raw ? formatToThaiDate(raw) : (raw || '(ว่าง)');
        return `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer ef-item transition"><input type="checkbox" value="${jobsEscapeHtml(raw)}" ${isChecked ? 'checked' : ''} class="ef-check accent-[#00320D] w-3.5 h-3.5 rounded"><span class="text-slate-700 text-xs font-medium w-full truncate" title="${jobsEscapeHtml(display)}">${jobsEscapeHtml(display)}</span></label>`;
    }).join('');
    document.getElementById('ef_select_all').checked = Array.from(document.querySelectorAll('.ef-check')).every(cb => cb.checked);

    const modal = document.getElementById('excelFilterModal');
    const rect = e.target.closest('th').getBoundingClientRect();
    modal.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    let left = rect.left + window.scrollX;
    if (left + 260 > window.innerWidth) left = window.innerWidth - 270;
    modal.style.left = left + 'px';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

async function fetchAllJobsForExport() {
    const params = buildJobsServerParams(false);
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) throw new Error(await readApiErrorMessage(res, 'โหลดข้อมูลสำหรับ Export ไม่สำเร็จ'));
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(j => ({ ...j, calculated_station: computeHighestStationIFS(j) })) : [];
}

exportToExcel = async function () {
    try {
        const rows = await fetchAllJobsForExport();
        if (!rows.length) return showToast('ไม่มีข้อมูลในตารางให้โหลดครับ!', 'error');
        await ensureXlsxLoaded();
        const exportCols = columnsDef.filter(c => c.key !== 'action');
        const exportData = [exportCols.map(c => c.title)];
        rows.forEach(job => {
            exportData.push(exportCols.map(col => {
                let val = job[col.key];
                if (col.key.includes('date') && val) val = formatToThaiDate(val);
                return val ?? '';
            }));
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        ws['!cols'] = exportCols.map(c => ({ wpx: c.width || 120 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Jobs_Data');
        XLSX.writeFile(wb, `Rizenic_Jobs_${userBranch}_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว!');
    } catch (error) {
        showToast(error?.message || 'ไม่สามารถดาวน์โหลด Excel ได้', 'error');
    }
};
