// Turbo server-side search/pagination for history.html.
let historyServerTotal = 0;
const historyLegacyRenderHistoryResults = renderHistoryResults;

async function fetchHistoryServerPage() {
    const keyword = document.getElementById('searchInput').value.trim();
    const params = new URLSearchParams({
        paged: '1',
        page: String(historyPager.page),
        limit: String(historyPager.pageSize),
        search: keyword,
        sort: 'history_date',
        dir: 'desc'
    });
    const res = await fetch(`${API_BASE_URL}/api/reports?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const normalized = RizenicPagination.fromServerResponse(payload, historyPager);
    historyServerTotal = normalized.pageInfo.total;
    historyResults = normalized.items;
    allJobsData = normalized.items;
    renderHistoryResults();
}

loadData = async function () {
    const btn = document.querySelector('button[onclick="searchHistory()"]');
    if (btn) btn.disabled = false;
    const searchQ = new URLSearchParams(window.location.search).get('q');
    if (searchQ) {
        document.getElementById('searchInput').value = searchQ;
        await searchHistory();
    }
};

searchHistory = async function () {
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) { alert('กรุณาพิมพ์คำค้นหาก่อนครับ'); return; }
    historyPager.page = 1;
    try { await fetchHistoryServerPage(); }
    catch (error) { console.error('History server search failed:', error); }
};

goHistoryPage = function (page) {
    historyPager.page = page;
    fetchHistoryServerPage().catch(error => console.error('History page load failed:', error));
};

renderHistoryResults = function () {
    historyLegacyRenderHistoryResults();
    const count = document.getElementById('resultCount');
    if (count) count.innerText = String(historyServerTotal);
};
