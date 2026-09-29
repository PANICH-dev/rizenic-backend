// Turbo server-side pagination for repair date maintenance.
let repairDateServerTotal = 0;
const repairDateLegacyRender = renderTable;

function buildRepairDateParams() {
    const params = new URLSearchParams({
        paged: '1',
        page: String(datePager.page),
        limit: String(datePager.pageSize),
        branch: currentBranch,
        department_routing: 'ซ่อม'
    });
    const search = document.getElementById('search_input')?.value?.trim();
    if (search) params.set('search', search);
    const type = document.getElementById('filter_dropdown')?.value || '';
    const missingMap = {
        missing_arrived: 'arrived_date',
        missing_finish: 'repair_finish_date',
        missing_delivery: 'delivery_date'
    };
    if (missingMap[type]) params.set('missing_field', missingMap[type]);
    return params;
}

async function fetchRepairDatePage() {
    const params = buildRepairDateParams();
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const normalized = RizenicPagination.fromServerResponse(payload, datePager);
    repairDateServerTotal = normalized.pageInfo.total;
    allJobs = normalized.items;
    dateFilteredData = normalized.items;
    renderTable(dateFilteredData);
}

fetchJobs = async function () {
    try { await fetchRepairDatePage(); }
    catch (err) { console.error('โหลดข้อมูลพัง:', err); }
};

runFilter = function () {
    datePager.page = 1;
    fetchRepairDatePage().catch(err => console.error('โหลดตัวกรองพัง:', err));
};

goDatePage = function (page) {
    datePager.page = page;
    fetchRepairDatePage().catch(err => console.error('โหลดหน้าถัดไปพัง:', err));
};

renderTable = function (data) {
    repairDateLegacyRender(data);
    const count = document.getElementById('table_row_count');
    if (count) count.innerText = String(repairDateServerTotal);
};
