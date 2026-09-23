// Shared client-side pagination for long RIZENIC tables.
// Keeps the existing API/data flow intact and only limits DOM rows per page.
(function (global) {
    const DEFAULT_PAGE_SIZE = 50;

    function createState(pageSize = DEFAULT_PAGE_SIZE) {
        return { page: 1, pageSize: Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE) };
    }

    function reset(state) {
        if (state) state.page = 1;
    }

    function paginate(data, state) {
        const rows = Array.isArray(data) ? data : [];
        const safeState = state || createState();
        const pageSize = Math.max(1, Number(safeState.pageSize) || DEFAULT_PAGE_SIZE);
        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const requestedPage = Math.max(1, Number(safeState.page) || 1);
        const page = Math.min(requestedPage, totalPages);
        safeState.page = page;
        safeState.pageSize = pageSize;

        const startIndex = total === 0 ? 0 : (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, total);

        return {
            items: rows.slice(startIndex, endIndex),
            page,
            pageSize,
            total,
            totalPages,
            startIndex,
            endIndex,
            startNumber: total === 0 ? 0 : startIndex + 1,
            endNumber: endIndex
        };
    }

    function getPageNumbers(page, totalPages) {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
        const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
        const result = [];
        sorted.forEach((p, idx) => {
            if (idx > 0 && p - sorted[idx - 1] > 1) result.push('…');
            result.push(p);
        });
        return result;
    }

    function findScrollHost(anchor) {
        if (!anchor) return null;
        const doc = typeof document !== 'undefined' ? document : null;
        let node = anchor;
        while (node && node.parentElement) {
            node = node.parentElement;
            if (!node || (doc && (node === doc.body || node === doc.documentElement))) break;

            const isKnownTableScroller = node.matches && (
                node.matches('.table-container') ||
                node.matches('#tableContainer') ||
                node.matches('.overflow-auto') ||
                node.matches('.overflow-x-auto')
            );

            let isComputedScroller = false;
            if (typeof window !== 'undefined' && window.getComputedStyle) {
                const style = window.getComputedStyle(node);
                const overflowX = style && style.overflowX;
                const overflowY = style && style.overflowY;
                isComputedScroller = ['auto', 'scroll'].includes(overflowX) || ['auto', 'scroll'].includes(overflowY);
            }

            if (isKnownTableScroller || isComputedScroller) return node;
        }
        return null;
    }

    function closestClipShell(node) {
        let current = node;
        while (current) {
            const isShell = (current.matches && current.matches('.rz-table-clip-shell')) ||
                (current.classList && current.classList.contains && current.classList.contains('rz-table-clip-shell'));
            if (isShell) return current;
            current = current.parentElement;
        }
        return null;
    }

    function ensureContainer(anchorId, containerId) {
        const anchor = document.getElementById(anchorId);
        if (!anchor || !anchor.parentNode) return null;

        const scrollHost = findScrollHost(anchor);
        // Clipped table layouts use an outer non-scrolling shell. Pagination must
        // sit after that shell; mounting it beside the inner scroller causes the
        // shell's overflow:hidden to cut off the footer at the bottom.
        const clipShell = closestClipShell(scrollHost || anchor);
        const mountAnchor = clipShell || scrollHost || anchor;
        const mountParent = mountAnchor.parentNode || anchor.parentNode;
        const mountBefore = mountAnchor.nextSibling;

        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
        }

        // Pagination must live outside the scroll host. This keeps it fixed while the table scrolls.
        const isCorrectlyMounted = container.parentNode === mountParent && mountAnchor.nextSibling === container;
        if (!isCorrectlyMounted) {
            mountParent.insertBefore(container, mountBefore || null);
        }
        return container;
    }

    function renderControls({ anchorId, containerId, pageInfo, onPageChange, noun = 'รายการ' }) {
        if (typeof document === 'undefined' || !pageInfo) return;
        const container = ensureContainer(anchorId, containerId);
        if (!container) return;

        const { page, totalPages, total, startNumber, endNumber } = pageInfo;
        const pageNumbers = getPageNumbers(page, totalPages);
        const disabledPrev = page <= 1;
        const disabledNext = page >= totalPages;

        const numberButtons = pageNumbers.map(p => {
            if (p === '…') return '<span class="px-1 text-slate-400 select-none">…</span>';
            const active = p === page;
            return `<button type="button" data-rz-page="${p}" class="min-w-8 h-8 px-2 rounded-lg border text-xs font-black transition ${active ? 'bg-[#00320D] text-white border-[#00320D] shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}">${p}</button>`;
        }).join('');

        container.className = 'rz-pagination bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500';
        container.innerHTML = `
            <div>แสดง <span class="text-[#00320D] font-black">${startNumber}-${endNumber}</span> จาก <span class="text-[#00320D] font-black">${total}</span> ${noun}</div>
            <div class="flex items-center gap-1.5">
                <button type="button" data-rz-page="${page - 1}" ${disabledPrev ? 'disabled' : ''} class="h-8 px-3 rounded-lg border text-xs font-bold transition ${disabledPrev ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}">‹ ก่อนหน้า</button>
                ${numberButtons}
                <button type="button" data-rz-page="${page + 1}" ${disabledNext ? 'disabled' : ''} class="h-8 px-3 rounded-lg border text-xs font-bold transition ${disabledNext ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}">ถัดไป ›</button>
            </div>`;

        container.querySelectorAll('[data-rz-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                const nextPage = Number(btn.getAttribute('data-rz-page'));
                if (!Number.isFinite(nextPage) || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
                onPageChange(nextPage);
            });
        });
    }

    global.RizenicPagination = {
        DEFAULT_PAGE_SIZE,
        createState,
        reset,
        paginate,
        getPageNumbers,
        findScrollHost,
        renderControls
    };
})(typeof window !== 'undefined' ? window : globalThis);
