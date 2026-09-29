// Server-side paging/search overlay for Admin master tables.
// Keeps the existing edit/save/delete flows and renders only one 50-row page at a time.
(function () {
    const PAGE_SIZE = 50;
    const controllers = new Map();

    const states = {
        emp_table_body: { resource: 'employees', inputId: 'emp_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalEmp = rows; } },
        car_table_body: { resource: 'car-models', inputId: 'car_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalCar = rows; } },
        ins_table_body: { resource: 'insurances', inputId: 'ins_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalIns = rows; } },
        ctype_table_body: { resource: 'customer-types', inputId: 'ctype_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalCtype = rows; } },
        body_parts_table_body: { resource: 'body-parts', inputId: 'body_parts_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalBodyPart = rows; } },
        main_status_table_body: { resource: 'statuses', inputId: 'main_status_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalMainStatus = rows; } },
        status_table_body: { resource: 'part-statuses', inputId: 'status_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalPartStatus = rows; } },
        quota_table_body: { resource: 'quotas', inputId: 'quota_search_input', pager: RizenicPagination.createState(PAGE_SIZE), assign: rows => { globalQuota = rows; } }
    };

    const renderers = {
        emp_table_body: e => {
            const pagesArr = (e.accessible_pages || '').split(',').filter(Boolean);
            const pagesHTML = pagesArr.length > 0
                ? pagesArr.map(p => `<span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-200 mr-1 mb-1 shadow-sm inline-block">${p}</span>`).join('')
                : '<span class="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200">ไม่มีสิทธิ์</span>';
            return `<tr class="hover:bg-blue-50/30 transition-colors">
                <td class="p-4 font-mono font-bold text-slate-500">${e.employee_code || '-'}</td>
                <td class="p-4 font-black text-[#00320D]">${e.employee_name}</td>
                <td class="p-4 text-slate-600 font-bold">${e.employee_role}</td>
                <td class="p-4 text-slate-600 font-bold">${e.branch_name || '-'}</td>
                <td class="p-4 max-w-[250px] whitespace-normal leading-tight">${pagesHTML}</td>
                <td class="p-4 text-center">
                    <button onclick="editEmp('${e.employee_id}','${e.employee_code || ''}','${e.employee_name}','${e.employee_role}','${e.branch_name}','${e.username}','','${e.accessible_pages || ''}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 hover:border-blue-300 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteData('/api/employees/${e.employee_id}', loadEmp)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 hover:border-red-300 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        },
        car_table_body: c => `<tr class="hover:bg-indigo-50/30 transition-colors"><td class="p-4 font-black text-indigo-900">${c.car_brand}</td><td class="p-4 font-bold text-slate-700">${c.car_model}</td><td class="p-4 text-center"><button onclick="editCar('${c.model_id}', '${c.car_brand}', '${c.car_model}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteData('/api/car-models/${c.model_id}', loadCar)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button></td></tr>`,
        ins_table_body: i => `<tr class="hover:bg-emerald-50/30 transition-colors"><td class="p-4 font-mono font-bold text-slate-400">${i.insurance_code || '-'}</td><td class="p-4 font-black text-emerald-800">${i.insurance_name}</td><td class="p-4 font-bold text-slate-600">${i.insurance_type || '-'}</td><td class="p-4 text-center"><button onclick="editIns('${i.insurance_code}', '${i.insurance_name}', '${i.insurance_type || ''}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteData('/api/insurances/${i.insurance_code}', loadIns)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button></td></tr>`,
        ctype_table_body: c => `<tr class="hover:bg-teal-50/30 transition-colors">
            <td class="p-4 font-mono font-bold text-slate-400">${c.type_code || '-'}</td>
            <td class="p-4 font-black text-teal-800">${c.type_name}</td>
            <td class="p-4 text-center"><button onclick="editCtype('${c.customer_type_id}', '${c.type_code || ''}', '${c.type_name}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteData('/api/customer-types/${c.customer_type_id}', loadCtype)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`,
        body_parts_table_body: p => `<tr class="hover:bg-rose-50/30 transition-colors">
            <td class="p-4 text-center"><span class="px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm ${p.category === 'ชิ้นส่วนหลัก' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">${p.category}</span></td>
            <td class="p-4 font-black text-slate-700">${p.part_name}</td>
            <td class="p-4 text-center"><button onclick="editBodyPart('${p.id}', '${p.category}', '${p.part_name}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteData('/api/body-parts/${p.id}', loadBodyParts)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`,
        main_status_table_body: s => `<tr class="hover:bg-amber-50/30 transition-colors">
            <td class="p-4 font-mono font-bold text-slate-400">${s.status_code}</td>
            <td class="p-4 font-black text-amber-800">${s.status_name}</td>
            <td class="p-4"><span class="px-2.5 py-1 bg-white rounded border border-slate-200 text-xs font-bold shadow-sm text-slate-600">${s.department || '-'}</span></td>
            <td class="p-4 font-mono text-blue-600 font-bold">${s.route_page || '-'}</td>
            <td class="p-4 text-center"><button onclick="editMainStatus('${s.status_code}', '${s.status_name}', '${s.department}', '${s.route_page}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteData('/api/statuses/${s.status_code}', loadMainStatus)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`,
        status_table_body: s => `<tr class="hover:bg-purple-50/30 transition-colors"><td class="p-4 text-center font-mono font-bold text-slate-400">${s.status_id}</td><td class="p-4 font-black text-purple-800">${s.status_name}</td><td class="p-4 text-center"><button onclick="deleteData('/api/part-statuses/${s.status_id}', loadPartStatus)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-trash"></i></button></td></tr>`,
        quota_table_body: q => `<tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4"><span class="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${q.quota_type === 'default' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700 border border-amber-200 shadow-sm'}">${q.quota_type === 'default' ? 'ประจำวัน' : 'วันพิเศษ'}</span></td>
            <td class="p-4 font-black text-[#00320D]">${q.branch_name}</td>
            <td class="p-4 font-mono font-bold text-slate-500">${q.quota_date ? formatThaiDate(q.quota_date) : '-'}</td>
            <td class="p-4 text-center font-black text-blue-600">${q.quota_arrived}</td>
            <td class="p-4 text-center font-black text-amber-600">${q.quota_target}</td>
            <td class="p-4 text-center font-black text-emerald-600">${q.quota_delivery}</td>
            <td class="p-4 text-center font-black text-blue-700 border-l border-slate-200 bg-blue-50/50">${q.quota_main_parts || 0}</td>
            <td class="p-4 text-center font-black text-amber-700 bg-amber-50/50">${q.quota_sub_parts || 0}</td>
            <td class="p-4 text-center"><button onclick="editQuota('${q.id}','${q.quota_type}','${q.quota_date ? q.quota_date.split('T')[0] : ''}','${q.branch_name}','${q.quota_arrived}','${q.quota_target}','${q.quota_delivery}', '${q.quota_main_parts || 0}', '${q.quota_sub_parts || 0}')" class="bg-white border border-slate-300 shadow-sm text-blue-600 hover:bg-blue-50 w-8 h-8 rounded-lg transition-all"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="deleteData('/api/quotas/${q.id}', loadQuota)" class="bg-white border border-slate-300 shadow-sm text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all ml-1"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`
    };

    function currentSearch(state) {
        return document.getElementById(state.inputId)?.value?.trim() || '';
    }

    function renderLoading(tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="p-8 text-center text-slate-400 font-bold">กำลังโหลดข้อมูล...</td></tr>';
    }

    async function fetchAdminPage(tbodyId, requestedPage) {
        const state = states[tbodyId];
        if (!state) return;
        const page = Math.max(1, Number(requestedPage) || Number(state.pager.page) || 1);
        state.pager.page = page;

        const previous = controllers.get(tbodyId);
        if (previous) previous.abort();
        const controller = new AbortController();
        controllers.set(tbodyId, controller);
        renderLoading(tbodyId);

        try {
            const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
            const search = currentSearch(state);
            if (search) params.set('search', search);
            const response = await fetch(`${API_BASE_URL}/api/server/admin/${state.resource}?${params.toString()}`, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            if (controllers.get(tbodyId) !== controller) return;

            const normalized = RizenicPagination.fromServerResponse(payload, state.pager);
            state.assign(normalized.items);
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            const table = tbody.closest('table');
            if (table && !table.id) table.id = `${tbodyId}_table`;

            if (!normalized.items.length) {
                tbody.innerHTML = '<tr><td colspan="99" class="p-8 text-center text-slate-400 font-bold">ไม่พบข้อมูลที่ตรงกับคำค้นหา</td></tr>';
            } else {
                tbody.innerHTML = normalized.items.map(renderers[tbodyId]).join('');
            }

            if (table) {
                RizenicPagination.renderControls({
                    anchorId: table.id,
                    containerId: `${tbodyId}_pagination`,
                    pageInfo: normalized.pageInfo,
                    noun: 'รายการ',
                    onPageChange: nextPage => fetchAdminPage(tbodyId, nextPage)
                });
            }
        } catch (error) {
            if (error?.name === 'AbortError') return;
            const tbody = document.getElementById(tbodyId);
            if (tbody) tbody.innerHTML = '<tr><td colspan="99" class="p-8 text-center text-red-500 font-bold">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</td></tr>';
        } finally {
            if (controllers.get(tbodyId) === controller) controllers.delete(tbodyId);
        }
    }

    function resetAndLoad(tbodyId) {
        const state = states[tbodyId];
        if (!state) return Promise.resolve();
        RizenicPagination.reset(state.pager);
        state.pager.serverMeta = null;
        return fetchAdminPage(tbodyId, 1);
    }

    // Override the original full-list loaders after the legacy script has defined them.
    loadEmp = () => fetchAdminPage('emp_table_body', states.emp_table_body.pager.page);
    loadCar = () => fetchAdminPage('car_table_body', states.car_table_body.pager.page);
    loadIns = () => fetchAdminPage('ins_table_body', states.ins_table_body.pager.page);
    loadCtype = () => fetchAdminPage('ctype_table_body', states.ctype_table_body.pager.page);
    loadBodyParts = () => fetchAdminPage('body_parts_table_body', states.body_parts_table_body.pager.page);
    loadMainStatus = () => fetchAdminPage('main_status_table_body', states.main_status_table_body.pager.page);
    loadPartStatus = () => fetchAdminPage('status_table_body', states.status_table_body.pager.page);
    loadQuota = () => fetchAdminPage('quota_table_body', states.quota_table_body.pager.page);

    // adminPanelLoaders captured the original functions, so replace those references too.
    adminPanelLoaders['emp-panel'] = () => resetAndLoad('emp_table_body');
    adminPanelLoaders['car-panel'] = () => resetAndLoad('car_table_body');
    adminPanelLoaders['ins-panel'] = () => resetAndLoad('ins_table_body');
    adminPanelLoaders['ctype-panel'] = () => resetAndLoad('ctype_table_body');
    adminPanelLoaders['body-parts-panel'] = () => resetAndLoad('body_parts_table_body');
    adminPanelLoaders['main-status-panel'] = () => resetAndLoad('main_status_table_body');
    adminPanelLoaders['status-panel'] = () => resetAndLoad('status_table_body');
    adminPanelLoaders['quota-panel'] = () => resetAndLoad('quota_table_body');

    filterTableDebounced = function (inputId, tbodyId) {
        clearTimeout(searchTimers[inputId]);
        searchTimers[inputId] = setTimeout(() => resetAndLoad(tbodyId), 250);
    };
})();
