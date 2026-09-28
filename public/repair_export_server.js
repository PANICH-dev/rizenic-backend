// Turbo server-side pagination for repair report/export.
let repairExportServerTotal = 0;
let repairExportInitialized = false;
const repairExportLegacyRender = renderTable;

function buildRepairExportParams(paged = true) {
    const params = new URLSearchParams({
        branch: currentBranch,
        department_routing: 'ซ่อม',
        date_field: document.getElementById('date_type').value,
        date_from: document.getElementById('start_date').value,
        date_to: document.getElementById('end_date').value
    });
    if (paged) {
        params.set('paged', '1');
        params.set('page', String(reportPager.page));
        params.set('limit', String(reportPager.pageSize));
    } else {
        params.set('full', '1');
    }
    return params;
}

async function fetchRepairExportPage() {
    const params = buildRepairExportParams(true);
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const normalized = RizenicPagination.fromServerResponse(payload, reportPager);
    repairExportServerTotal = normalized.pageInfo.total;
    allJobs = normalized.items;
    filteredJobs = normalized.items;
    renderTable(filteredJobs);
}

fetchJobs = async function () {
    if (!repairExportInitialized) {
        const today = new Date();
        document.getElementById('start_date').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        document.getElementById('end_date').value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        repairExportInitialized = true;
    }
    reportPager.page = 1;
    try { await fetchRepairExportPage(); }
    catch (err) { console.error('Error fetching repair report:', err); }
};

runReport = function () {
    reportPager.page = 1;
    fetchRepairExportPage().catch(err => console.error('Error filtering repair report:', err));
};

goReportPage = function (page) {
    reportPager.page = page;
    fetchRepairExportPage().catch(err => console.error('Error loading repair report page:', err));
};

renderTable = function (data) {
    repairExportLegacyRender(data);
    const count = document.getElementById('table_row_count');
    if (count) count.innerText = String(repairExportServerTotal);
};

async function fetchRepairExportRows() {
    const params = buildRepairExportParams(false);
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
}

exportToExcel = async function () {
    try {
        const rows = await fetchRepairExportRows();
        if (!rows.length) return alert('ไม่มีข้อมูลให้ดาวน์โหลดครับ!');
        await ensureXlsxLoaded();
        const exportData = rows.map((j, index) => ({
            'ลำดับ': index + 1,
            'ทะเบียนรถ': j.car_plate || '-',
            'ยี่ห้อ': j.car_brand || '-',
            'รุ่น': j.car_model || '-',
            'สีรถ': j.car_color || '-',
            'SA ผู้ดูแล': j.sa_owner || '-',
            'สถานะ (ERP)': j.job_status || '-',
            'วันที่รถเข้าจอด': formatThaiDate(j.arrived_date),
            'เป้าซ่อมเสร็จ': formatThaiDate(j.target_finish_date),
            'วันซ่อมเสร็จจริง': formatThaiDate(j.repair_finish_date),
            'วันที่ส่งมอบลูกค้า': formatThaiDate(j.delivery_date),
            'ชิ้นส่วนหลัก': j.main_part_name || '-',
            'ชิ้นส่วนรอง': j.sub_part_name || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RepairReport');
        const dateTypeStr = document.getElementById('date_type').options[document.getElementById('date_type').selectedIndex].text;
        XLSX.writeFile(wb, `รายงานรถซ่อม_${dateTypeStr}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('❌ ' + (error.message || 'ไม่สามารถโหลดข้อมูล Export ได้'));
    }
};
