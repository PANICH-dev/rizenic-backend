/*
 * RIZENIC adaptive two-stage table viewport dock v4.
 *
 * Stage 1: the page scrolls normally while chrome above the active long table
 * leaves the viewport. The table grows by the same amount.
 * Stage 2: once the table header reaches a small safe top gap, the outer page is
 * frozen and vertical wheel/touch movement is transferred to the table itself.
 * Scrolling back to the first row releases the page again.
 *
 * Mixed views with multiple visible data tables keep their existing layout.
 */
(function (global) {
    'use strict';

    const MIN_TABLE_HEIGHT = 160;
    const DOCK_TOP = 8;
    const VIEWPORT_GAP = 8;

    let activeHost = null;
    let activeMain = null;
    let dockTargetY = 0;
    let dockScrollY = 0;
    let docked = false;
    let rafId = 0;
    let touchStartY = null;

    function calculateHeight({ viewportHeight, top, reservedBelow = 0, gap = VIEWPORT_GAP }) {
        const available = Number(viewportHeight) - Number(top) - Number(reservedBelow) - Number(gap);
        return Math.max(MIN_TABLE_HEIGHT, Math.floor(Number.isFinite(available) ? available : MIN_TABLE_HEIGHT));
    }

    function calculateDockGeometry({ viewportHeight, hostTop, reservedBelow = 0, dockTop = DOCK_TOP, gap = VIEWPORT_GAP }) {
        const safeDockTop = Number(dockTop) || 0;
        const safeHostTop = Number(hostTop) || 0;
        const top = Math.max(safeDockTop, safeHostTop);
        const distanceToDock = Math.max(0, Math.ceil(safeHostTop - safeDockTop));
        return {
            height: calculateHeight({ viewportHeight, top, reservedBelow, gap }),
            distanceToDock,
            shouldDock: distanceToDock === 0
        };
    }

    function calculateRunway({ dockTargetY, scrollY }) {
        const target = Number(dockTargetY) || 0;
        const current = Number(scrollY) || 0;
        return Math.max(0, Math.ceil(target - current));
    }

    function calculateDockTargetY({ scrollY, hostTop, dockTop = DOCK_TOP }) {
        const current = Number(scrollY) || 0;
        const top = Number(hostTop) || 0;
        const safeDockTop = Number(dockTop) || 0;
        return Math.max(0, Math.floor(current + top - safeDockTop));
    }

    function resolveScrollTransfer({ docked: isDocked, scrollTop, scrollHeight, clientHeight, deltaY }) {
        const current = Math.max(0, Number(scrollTop) || 0);
        if (!isDocked) return { action: 'page', nextScrollTop: current };

        const delta = Number(deltaY) || 0;
        const maxScrollTop = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));

        if (delta < 0 && current <= 0) {
            return { action: 'undock', nextScrollTop: 0 };
        }

        const next = Math.min(maxScrollTop, Math.max(0, current + delta));
        return { action: 'table', nextScrollTop: next };
    }

    function adaptiveDockDisabled(documentRef) {
        const body = documentRef && documentRef.body;
        return !!(body && body.getAttribute && body.getAttribute('data-rz-table-dock') === 'off');
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

    function isOverlayInteractionTarget(target) {
        return !!(target && target.closest && target.closest('.fixed, [role="dialog"], .modal, [id$="Modal"]'));
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
            if (node.classList && node.classList.toggle) node.classList.toggle('rz-table-flex-path', enabled);
            if (node === main) break;
            node = node.parentElement;
        }
    }

    function currentScrollY() {
        return Number(global.scrollY || global.pageYOffset || 0);
    }

    function viewportHeight(documentRef) {
        return Number(global.innerHeight || (documentRef && documentRef.documentElement && documentRef.documentElement.clientHeight) || 0);
    }

    function setPageScroll(y) {
        if (typeof global.scrollTo === 'function') global.scrollTo(0, Math.max(0, Math.floor(y || 0)));
    }

    function clearDockClasses(documentRef, restoreScroll) {
        if (!documentRef || !documentRef.body) return;
        const html = documentRef.documentElement;
        const body = documentRef.body;
        const wasDocked = docked;
        const restoreY = dockScrollY;

        docked = false;
        html && html.classList.remove('rz-table-page-docked');
        body.classList.remove('rz-table-page-docked');
        body.style && body.style.removeProperty('--rz-table-lock-offset');
        if (activeHost && activeHost.classList) activeHost.classList.remove('rz-table-docked');

        if (wasDocked && restoreScroll !== false) setPageScroll(restoreY);
    }

    function reset(documentRef = global.document) {
        if (!documentRef || !documentRef.body) return;
        clearDockClasses(documentRef, true);
        const html = documentRef.documentElement;
        const body = documentRef.body;
        html && html.classList.remove('rz-table-page-ready');
        body.classList.remove('rz-table-page-ready');
        body.style && body.style.removeProperty('--rz-table-lock-offset');

        if (activeMain) {
            activeMain.classList.remove('rz-table-main-ready');
            activeMain.style.removeProperty('--rz-table-dock-spacer-height');
        }
        if (activeHost) {
            activeHost.classList.remove('rz-table-viewport-scroll', 'rz-table-docked');
            activeHost.style.removeProperty('--rz-table-viewport-height');
            markFlexPath(activeHost, activeMain, false);
        }

        activeHost = null;
        activeMain = null;
        dockTargetY = 0;
        dockScrollY = 0;
        touchStartY = null;
    }

    function dock(documentRef = global.document) {
        if (docked || !activeHost || !documentRef || !documentRef.body) return;
        const html = documentRef.documentElement;
        const body = documentRef.body;

        // Clamp to the exact transition point before freezing the document. A
        // large trackpad/wheel step can otherwise overshoot the viewport top and
        // leave the sticky header partially clipped.
        dockScrollY = Math.max(0, Math.floor(dockTargetY));
        setPageScroll(dockScrollY);

        docked = true;
        body.style.setProperty('--rz-table-lock-offset', `${-dockScrollY}px`);
        html && html.classList.add('rz-table-page-docked');
        body.classList.add('rz-table-page-docked');
        activeHost.classList.add('rz-table-docked');
        updateGeometry(documentRef, true);
    }

    function undockForUpwardScroll(deltaY, documentRef = global.document) {
        if (!docked) return;
        const base = dockScrollY;
        const pageDelta = Math.min(-2, Number(deltaY) || -24);
        clearDockClasses(documentRef, false);
        setPageScroll(Math.max(0, base + pageDelta));
        scheduleRefresh(false);
    }

    function updateGeometry(documentRef = global.document, forceDockTop = false) {
        if (!activeHost || !activeMain || !documentRef) return false;
        const rect = activeHost.getBoundingClientRect();
        const reservedBelow = reservedSiblingHeight(activeHost);
        const geometry = calculateDockGeometry({
            viewportHeight: viewportHeight(documentRef),
            hostTop: forceDockTop ? DOCK_TOP : rect.top,
            reservedBelow,
            dockTop: DOCK_TOP,
            gap: VIEWPORT_GAP
        });

        activeHost.style.setProperty('--rz-table-viewport-height', `${geometry.height}px`);

        // The runway exists only for stage 1. It shrinks exactly as the outer
        // page approaches the dock point and disappears entirely once docked.
        const remaining = docked ? 0 : calculateRunway({ dockTargetY, scrollY: currentScrollY() });
        activeMain.style.setProperty('--rz-table-dock-spacer-height', `${remaining}px`);
        return geometry;
    }

    function syncDockState(documentRef = global.document) {
        if (!activeHost || !activeMain || !documentRef) return false;
        if (docked) return !!updateGeometry(documentRef, true);

        const geometry = updateGeometry(documentRef, false);
        if (!geometry) return false;

        if (currentScrollY() >= dockTargetY || geometry.shouldDock) {
            dock(documentRef);
        }
        return true;
    }

    function activateHost(host, main, documentRef) {
        if (activeHost === host && activeMain === main) return;
        if (activeHost || activeMain) reset(documentRef);

        activeHost = host;
        activeMain = main;
        const html = documentRef.documentElement;
        const body = documentRef.body;

        html && html.classList.add('rz-table-page-ready');
        body.classList.add('rz-table-page-ready');
        main.classList.add('rz-table-main-ready');
        host.classList.add('rz-table-viewport-scroll');
        markFlexPath(host, main, true);

        const rect = host.getBoundingClientRect();
        const scrollY = currentScrollY();
        dockTargetY = calculateDockTargetY({ scrollY, hostTop: rect.top, dockTop: DOCK_TOP });
        main.style.setProperty('--rz-table-dock-spacer-height', `${calculateRunway({ dockTargetY, scrollY })}px`);
    }

    function refresh(documentRef = global.document) {
        if (!documentRef || !documentRef.body) return false;
        if (adaptiveDockDisabled(documentRef)) {
            if (activeHost || activeMain) reset(documentRef);
            return false;
        }
        const main = documentRef.querySelector('main');
        if (!main) return false;
        const hosts = visibleMainScrollHosts(main);

        // Multi-table workspaces keep their established independent scrollers.
        if (hosts.length !== 1) {
            if (activeHost || activeMain) reset(documentRef);
            return false;
        }

        activateHost(hosts[0], main, documentRef);
        return syncDockState(documentRef);
    }

    function scheduleRefresh(rescan = true) {
        if (rafId && typeof global.cancelAnimationFrame === 'function') global.cancelAnimationFrame(rafId);
        const run = () => {
            rafId = 0;
            if (rescan) refresh();
            else syncDockState(global.document);
        };
        if (typeof global.requestAnimationFrame === 'function') rafId = global.requestAnimationFrame(run);
        else run();
    }

    function normalizeWheelDelta(event) {
        const raw = Number(event && event.deltaY) || 0;
        if (!event) return raw;
        if (event.deltaMode === 1) return raw * 16;
        if (event.deltaMode === 2) return raw * Math.max(1, Number(global.innerHeight) || 800);
        return raw;
    }

    function transferVerticalScroll(deltaY, event, documentRef = global.document) {
        if (!docked || !activeHost || !deltaY) return false;
        if (event && isOverlayInteractionTarget(event.target)) return false;

        const decision = resolveScrollTransfer({
            docked,
            scrollTop: activeHost.scrollTop,
            scrollHeight: activeHost.scrollHeight,
            clientHeight: activeHost.clientHeight,
            deltaY
        });

        if (decision.action === 'undock') {
            if (event && event.cancelable !== false && typeof event.preventDefault === 'function') event.preventDefault();
            undockForUpwardScroll(deltaY, documentRef);
            return true;
        }

        if (decision.action === 'table') {
            if (event && event.cancelable !== false && typeof event.preventDefault === 'function') event.preventDefault();
            activeHost.scrollTop = decision.nextScrollTop;
            return true;
        }

        return false;
    }

    function onWheel(event) {
        if (!docked || !activeHost || !event || event.ctrlKey) return;
        const deltaY = normalizeWheelDelta(event);
        if (!deltaY) return;
        transferVerticalScroll(deltaY, event, global.document);
    }

    function onTouchStart(event) {
        const touch = event && event.touches && event.touches[0];
        touchStartY = touch ? Number(touch.clientY) : null;
    }

    function onTouchMove(event) {
        const touch = event && event.touches && event.touches[0];
        if (!touch) return;
        const currentY = Number(touch.clientY);
        if (!Number.isFinite(currentY)) return;

        if (touchStartY == null) {
            touchStartY = currentY;
            return;
        }

        const deltaY = touchStartY - currentY;
        touchStartY = currentY;

        // Before the dock point, preserve native page touch scrolling. Once
        // docked, transfer the same gesture to the table.
        if (!docked || !activeHost) return;
        transferVerticalScroll(deltaY, event, global.document);
    }

    function onTouchEnd() {
        touchStartY = null;
    }

    function install() {
        if (!global.document) return;
        if (adaptiveDockDisabled(global.document)) return;
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', () => scheduleRefresh(true), { once: true });
        } else {
            scheduleRefresh(true);
        }
        global.addEventListener && global.addEventListener('load', () => scheduleRefresh(true), { once: true });
        global.addEventListener && global.addEventListener('resize', () => scheduleRefresh(true), { passive: true });
        global.addEventListener && global.addEventListener('scroll', () => scheduleRefresh(false), { passive: true });
        global.addEventListener && global.addEventListener('wheel', onWheel, { passive: false });
        global.addEventListener && global.addEventListener('touchstart', onTouchStart, { passive: true });
        global.addEventListener && global.addEventListener('touchmove', onTouchMove, { passive: false });
        global.addEventListener && global.addEventListener('touchend', onTouchEnd, { passive: true });
        global.addEventListener && global.addEventListener('touchcancel', onTouchEnd, { passive: true });
        global.document.addEventListener('click', () => {
            setTimeout(() => scheduleRefresh(true), 0);
            setTimeout(() => scheduleRefresh(true), 120);
        }, true);

        if (typeof global.MutationObserver === 'function') {
            const observer = new global.MutationObserver(() => scheduleRefresh(true));
            observer.observe(global.document.body, { childList: true, subtree: true });
        }
    }

    global.RizenicTableViewport = {
        calculateHeight,
        calculateDockGeometry,
        calculateRunway,
        calculateDockTargetY,
        resolveScrollTransfer,
        refresh,
        visibleMainScrollHosts,
        reset
    };

    install();
})(typeof window !== 'undefined' ? window : globalThis);
