(function () {
  'use strict';
  const cache = new Map();
  let controller = null;
  const apiBase = window.location.origin;
  const keyOf = value => String(value || '').trim().toUpperCase();
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function suggest(keyword, branch, limit = 20) {
    const q = String(keyword || '').trim();
    if (q.length < 2) return [];
    if (controller) controller.abort();
    controller = new AbortController();
    const params = new URLSearchParams({ page: '1', limit: String(Math.max(1, Math.min(limit, 50))), search: q });
    if (branch) params.set('branch', branch);
    try {
      const res = await fetch(`${apiBase}/api/server/parts-master?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) return [];
      const payload = await res.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      items.forEach(item => { if (item?.part_no) cache.set(keyOf(item.part_no), item); });
      return items;
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('Part suggestion failed:', error);
      return [];
    }
  }

  async function exact(partNo, branch) {
    const key = keyOf(partNo);
    if (!key) return null;
    if (cache.has(key)) return cache.get(key);
    try {
      const params = new URLSearchParams();
      if (branch) params.set('branch', branch);
      const res = await fetch(`${apiBase}/api/parts/check/${encodeURIComponent(key)}?${params.toString()}`);
      if (!res.ok) return null;
      const item = await res.json();
      if (item?.part_no) cache.set(key, item);
      return item || null;
    } catch (_) {
      return null;
    }
  }

  function bindDatalist({ selector = 'input[list="master_parts_datalist"]', branch = () => '', onItems } = {}) {
    document.addEventListener('input', event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.matches(selector)) return;
      clearTimeout(input.__rzPartSuggestTimer);
      const keyword = input.value.trim();
      const list = document.getElementById('master_parts_datalist');
      if (!list) return;
      if (keyword.length < 2) { list.innerHTML = ''; return; }
      input.__rzPartSuggestTimer = setTimeout(async () => {
        const items = await suggest(keyword, typeof branch === 'function' ? branch() : branch, 20);
        if (input.value.trim() !== keyword) return;
        list.innerHTML = items.map(item => `<option value="${escapeHtml(item.part_no || '')}">${escapeHtml(item.part_name || '')} (MAIN: ${escapeHtml(item.part_main_no || '-')})</option>`).join('');
        if (typeof onItems === 'function') onItems(items);
      }, 180);
    });
  }

  window.RizenicPartsLookup = { suggest, exact, bindDatalist, cache };
})();
