/*
 * RIZENIC full-viewport table lock.
 * Keeps the document fixed to one viewport and delegates scrolling to the
 * single visible data-table scroller. Mixed dashboard pages with multiple
 * visible tables are intentionally left in their existing layout.
 */
(function (global) {
    'use strict';

    const MIN_TABLE_HEIGHT = 160;
    let activeHost = null;
    let rafId = 0;

    function calculateHeight({ viewportHeight, top, reservedBelow = 0, gap = 8 }) {
        const available = Number(viewportHeight) - Number(top) - Number(reservedBelow) - Number(gap);
        return Math.max(MIN_TABLE_HEIGHT, Math.floor(Number.isFinite(available) ? available : MIN_TABLE_HEIGHT));
    }

    function isVisible(el) {
        if (!el) return false;
        if (el.hidden) return false;
        if (typeof global.getComputedStyle === 'function') {
            const style = global.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        if (typeof el.getClientRects === 'function') return el.getClientRects().length > 0;
        return true;
    }

    function isModalTable(table) {
        return !!(table && table.closest && table.closest('.fixed, [role="dialog"], .modal, [id$="Modal"]'));
    }

    function fallbackScrollHost(table) {
        if (!table || !table.closest) return null;
        return table.closest('.table-container, #tableContainer, .overflow-auto, .overflow-x-auto');
    }

    function findScrollHost(table) {
        const pager = global.RizenicPagination;
        if (pager && typeof pager.findScrollHost === 'function') {
            return pager.findScrollHost(table) || fallbackScrollHost(table);
        }
        return fallbackScrollHost(table);
    }

    function visibleMainScrollHosts(main) {
        if (!main || !main.querySelectorAll) return [];
        const unique = new Set();
        main.querySelectorAll('table').forEach(table => {
            if (!isVisible(table) || isModalTable(table)) return;
            const host = findScrollHost(table);
            if (host && isVisible(host) && main.contains(host)) unique.add(host);
        });
        return Array.from(unique);
    }

    function closestClipShell(node) {
        let current = node;
        while (current) {
            if (current.classList && current.classList.contains && current.classList.contains('rz-table-clip-shell')) return current;
            current = current.parentElement;
        }
        return null;
    }

    function outerHeight(el) {
        if (!isVisible(el) || typeof el.getBoundingClientRect !== 'function') return 0;
        let height = el.getBoundingClientRect().height || 0;
        if (typeof global.getComputedStyle === 'function') {
            const style = global.getComputedStyle(el);
            height += parseFloat(style.marginTop) || 0;
            height += parseFloat(style.marginBottom) || 0;
        }
        return height;
    }

    function reservedSiblingHeight(host) {
        let total = 0;
        // When the real scroller lives inside a clipping shell, pagination is
        // deliberately mounted after the shell. Reserve those outer siblings
        // so the table viewport never grows underneath/behind the footer.
        const layoutAnchor = closestClipShell(host) || host;
        let node = layoutAnchor ? layoutAnchor.nextElementSibling : null;
        while (node) {
            total += outerHeight(node);
            node = node.nextElementSibling;
        }
        return total;
    }

    function markFlexPath(host, main, enabled) {
        let node = host ? host.parentElement : null;
        while (node && node !== main.parentElement) {
            node.classList.toggle('rz-table-flex-path', enabled);
            if (node === main) break;
            node = node.parentElement;
        }
    }

    function unlock(documentRef) {
        if (!documentRef) return;
        documentRef.documentElement.classList.remove('rz-table-page-lock');
        documentRef.body && documentRef.body.classList.remove('rz-table-page-lock');
        const main = documentRef.querySelector('main');
        if (main) main.classList.remove('rz-table-main-lock');
        if (activeHost) {
            activeHost.classList.remove('rz-table-viewport-scroll');
            activeHost.style.removeProperty('--rz-table-viewport-height');
            markFlexPath(activeHost, main, false);
            activeHost = null;
        }
    }

    function refresh(documentRef = global.document) {
        if (!documentRef || !documentRef.body) return false;
        const main = documentRef.querySelector('main');
        if (!main) return false;

        const hosts = visibleMainScrollHosts(main);

        // The one-page layout is safe only when the active view has one data table.
        // Dashboards with two or more visible tables retain their existing layout.
        if (hosts.length !== 1) {
            unlock(documentRef);
            return false;
        }

        const host = hosts[0];
        if (activeHost && activeHost !== host) {
            activeHost.classList.remove('rz-table-viewport-scroll');
            activeHost.style.removeProperty('--rz-table-viewport-height');
            markFlexPath(activeHost, main, false);
        }
        activeHost = host;

        documentRef.documentElement.classList.add('rz-table-page-lock');
        documentRef.body.classList.add('rz-table-page-lock');
        main.classList.add('rz-table-main-lock');
        host.classList.add('rz-table-viewport-scroll');
        markFlexPath(host, main, true);

        const rect = host.getBoundingClientRect();
        const viewportHeight = global.innerHeight || documentRef.documentElement.clientHeight || 0;
        const height = calculateHeight({
            viewportHeight,
            top: rect.top,
            reservedBelow: reservedSiblingHeight(host),
            gap: 8
        });
        host.style.setProperty('--rz-table-viewport-height', `${height}px`);
        return true;
    }

    function scheduleRefresh() {
        if (rafId && typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(rafId);
        if (typeof global.requestAnimationFrame === 'function') {
            rafId = global.requestAnimationFrame(() => {
                rafId = 0;
                refresh();
            });
        } else {
            refresh();
        }
    }

    function install() {
        if (!global.document) return;
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', scheduleRefresh, { once: true });
        } else {
            scheduleRefresh();
        }
        global.addEventListener && global.addEventListener('load', scheduleRefresh, { once: true });
        global.addEventListener && global.addEventListener('resize', scheduleRefresh, { passive: true });
        global.document.addEventListener('click', () => {
            setTimeout(scheduleRefresh, 0);
            setTimeout(scheduleRefresh, 120);
        }, true);

        if (typeof global.MutationObserver === 'function') {
            const observer = new global.MutationObserver(() => scheduleRefresh());
            observer.observe(global.document.body, { childList: true, subtree: true });
        }
    }

    global.RizenicTableViewport = {
        calculateHeight,
        refresh,
        visibleMainScrollHosts
    };

    install();
})(typeof window !== 'undefined' ? window : globalThis);
