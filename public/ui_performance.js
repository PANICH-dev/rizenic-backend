(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.boot(root);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const TARGET_TBODIES = new Set([
    // Admin master tables
    'emp_table_body', 'car_table_body', 'ins_table_body', 'ctype_table_body',
    'body_parts_table_body', 'main_status_table_body', 'status_table_body', 'quota_table_body',
    // Dashboard tables (15 rows/page)
    'parts_tracking_body', 'station_table_body', 'parked_cars_body',
    // Finance / history
    'acc_table_body', 'historyTableBody',
    // SA / Jobs lists (exclude editable entry tables and bulk-import tables)
    'track_parts_body', 'sa_parked_body', 'sa_po_body', 'kd_tbody',
    // Parts / repair lists
    'sa_alerts_body', 'master_table_body', 'repair_list_body', 'date_list_body', 'report_list_body'
  ]);

  const LEGACY_COUNT_IDS = ['row_count', 'table_row_count', 'resultCount'];

  const ADAPTIVE_TABLE_PATHS = new Set([
    '/', '/index.html', '/admin.html', '/history.html', '/jobs.html', '/parts.html',
    '/repair.html', '/finance.html'
  ]);

  const DOCK_GATED_TABLE_PATHS = new Set([
    '/repair.html', '/finance.html'
  ]);

  function pageSizeForPath(pathname) {
    const path = String(pathname || '').toLowerCase().replace(/\/+$/, '');
    return /(?:^|\/)dashboard(?:\.html)?$/.test(path) ? 15 : 30;
  }

  function pageSizeOptionsForPath(pathname) {
    const options = [];
    for (let size = 10; size <= 150; size += 10) options.push(size);
    const defaultSize = pageSizeForPath(pathname);
    if (!options.includes(defaultSize)) {
      options.push(defaultSize);
      options.sort(function (a, b) { return a - b; });
    }
    return options;
  }

  function getPageBounds(totalRows, requestedPage, pageSize) {
    const size = Math.max(1, Number(pageSize) || 1);
    const total = Math.max(0, Number(totalRows) || 0);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const rawPage = Number(requestedPage) || 1;
    const page = Math.min(totalPages, Math.max(1, rawPage));
    const start = total === 0 ? 0 : (page - 1) * size;
    const end = Math.min(total, start + size);
    return { totalPages, page, start, end };
  }


  function getPageTokens(totalPages, requestedPage) {
    const total = Math.max(1, Number(totalPages) || 1);
    const page = Math.min(total, Math.max(1, Number(requestedPage) || 1));
    if (total <= 7) return Array.from({ length: total }, function (_, index) { return index + 1; });

    if (page <= 4) return [1, 2, 3, 4, 5, 6, '…', total];
    if (page >= total - 3) return [1, '…', total - 5, total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', page - 2, page - 1, page, page + 1, page + 2, '…', total];
  }

  function isSearchControl(element) {
    if (!element || String(element.tagName || '').toUpperCase() !== 'INPUT') return false;
    const type = String(element.type || '').toLowerCase();
    if (type === 'search') return true;

    const id = String(element.id || '').toLowerCase();
    const name = String(element.name || '').toLowerCase();
    if (id.includes('search') || name.includes('search')) return true;

    const inline = ['oninput', 'onkeyup', 'onkeydown', 'onkeypress']
      .map(function (attr) { return String(element.getAttribute && element.getAttribute(attr) || ''); })
      .join(' ');
    return /(?:search|filter)[A-Za-z0-9_]*\s*\(/i.test(inline);
  }

  function boot(win) {
    const doc = win.document;
    const states = new Map();
    let refreshQueued = false;

    const path = String(win.location && win.location.pathname || '').toLowerCase();
    const normalizedPath = (path.replace(/\/+$/, '') || '/');
    const isAdaptiveTablePage = ADAPTIVE_TABLE_PATHS.has(normalizedPath);
    const isDockGatedTablePage = DOCK_GATED_TABLE_PATHS.has(normalizedPath);
    doc.documentElement.classList.add('ui-initial-loading');
    if (/(?:^|\/)dashboard(?:\.html)?$/.test(path.replace(/\/+$/, ''))) {
      doc.documentElement.classList.add('ui-dashboard-page');
    }
    if (/(?:^|\/)repair(?:\.html)?$/.test(path.replace(/\/+$/, ''))) {
      doc.documentElement.classList.add('ui-repair-page');
    }
    if (normalizedPath === '/jobs_table.html') doc.documentElement.classList.add('ui-jobs-table-page');
    if (normalizedPath === '/parts.html') doc.documentElement.classList.add('ui-parts-page');
    if (normalizedPath === '/repair_export.html') doc.documentElement.classList.add('ui-repair-export-page');
    if (normalizedPath === '/repair_date_update.html') doc.documentElement.classList.add('ui-repair-date-page');

    // Hide the login surface before first paint when this tab already has a valid
    // client session. Individual pages still own the real auth/permission flow.
    try {
      if (win.sessionStorage && win.sessionStorage.getItem('isLoggedIn') === 'true') {
        doc.documentElement.classList.add('ui-authenticated-session');
      }
    } catch (_) {
      // Storage can be unavailable in hardened/private contexts; leave legacy flow intact.
    }

    // ------------------------------------------------------------
    // Blocking loading layer for initial paint and GET /api/* reads.
    // Request URL, method, result and business flow remain untouched.
    // ------------------------------------------------------------
    const nativeFetch = typeof win.fetch === 'function' ? win.fetch.bind(win) : null;
    const lazyScriptLoads = new Map();

    function loadScriptOnce(src, globalName) {
      if (!src) return Promise.reject(new Error('script src is required'));
      if (globalName && win[globalName]) return Promise.resolve(win[globalName]);
      if (lazyScriptLoads.has(src)) return lazyScriptLoads.get(src);

      const promise = new Promise(function (resolve, reject) {
        const script = doc.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = function () { resolve(globalName ? win[globalName] : true); };
        script.onerror = function () {
          lazyScriptLoads.delete(src);
          reject(new Error('โหลด script ไม่สำเร็จ: ' + src));
        };
        (doc.head || doc.documentElement).appendChild(script);
      });
      lazyScriptLoads.set(src, promise);
      return promise;
    }

    let pendingReads = 0;
    const pendingTasks = new Set();
    let nextTaskId = 1;
    let initialPhase = true;
    let domReady = doc.readyState !== 'loading';

    function setInteractionBlocked(blocked) {
      if (!doc.body) return;
      if (blocked) {
        doc.body.inert = true;
        doc.body.setAttribute('data-ui-loading-blocked', 'true');
        doc.body.setAttribute('aria-busy', 'true');
      } else {
        doc.body.inert = false;
        doc.body.removeAttribute('data-ui-loading-blocked');
        doc.body.removeAttribute('aria-busy');
      }
    }

    function ensureLoader() {
      if (!doc.body) return null;
      let el = doc.getElementById('ui-global-data-loader');
      if (el) return el;
      el = doc.createElement('div');
      el.id = 'ui-global-data-loader';
      el.className = 'ui-global-loader';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="ui-global-loader__card" role="status" aria-label="กำลังโหลดข้อมูล"><span class="ui-global-loader__spinner" aria-hidden="true"></span></div>';
      doc.body.appendChild(el);
      return el;
    }

    function activePendingCount() {
      return pendingReads + pendingTasks.size;
    }

    function showLoader() {
      const el = ensureLoader();
      if (!el || activePendingCount() <= 0 || initialPhase) return;
      setInteractionBlocked(true);
      el.classList.add('is-visible');
      el.setAttribute('aria-hidden', 'false');
    }

    function hideLoader() {
      const el = doc.getElementById('ui-global-data-loader');
      if (el) {
        el.classList.remove('is-visible');
        el.setAttribute('aria-hidden', 'true');
      }
      if (!initialPhase && activePendingCount() === 0) setInteractionBlocked(false);
    }

    function finishInitialIfReady() {
      if (!initialPhase || !domReady || activePendingCount() !== 0) return;
      initialPhase = false;
      doc.documentElement.classList.remove('ui-initial-loading');
      hideLoader();
      setInteractionBlocked(false);
    }

    function beginRead() {
      pendingReads += 1;
      if (doc.body) setInteractionBlocked(true);
      if (!initialPhase) showLoader();
    }

    function settlePendingIfReady() {
      if (activePendingCount() !== 0) return;
      if (initialPhase) finishInitialIfReady();
      else hideLoader();
    }

    function endRead() {
      pendingReads = Math.max(0, pendingReads - 1);
      settlePendingIfReady();
    }

    function beginTask(label) {
      const token = 'ui-task-' + (nextTaskId++);
      pendingTasks.add(token);
      if (doc.body) setInteractionBlocked(true);
      if (!initialPhase) showLoader();
      return token;
    }

    function endTask(token) {
      if (token) pendingTasks.delete(token);
      settlePendingIfReady();
    }

    function scheduleInitialReadyCheck() {
      // Run after every DOMContentLoaded listener had a chance to start its
      // critical API reads. Slow images/fonts/scripts must not keep the UI inert.
      win.setTimeout(finishInitialIfReady, 0);
    }

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', function () {
        domReady = true;
        if (initialPhase) setInteractionBlocked(true);
        ensureLoader();
        scheduleInitialReadyCheck();
      }, { once: true });
    } else {
      domReady = true;
      setInteractionBlocked(true);
      ensureLoader();
      scheduleInitialReadyCheck();
    }

    function finishReadAfterPaint() {
      win.requestAnimationFrame(function () {
        win.requestAnimationFrame(endRead);
      });
    }

    function wrapTrackedResponseBody(response) {
      if (!response || typeof response !== 'object') {
        finishReadAfterPaint();
        return response;
      }

      let settled = false;
      let fallbackTimer = null;
      function settleOnce() {
        if (settled) return;
        settled = true;
        if (fallbackTimer) win.clearTimeout(fallbackTimer);
        finishReadAfterPaint();
      }

      if (response.status === 204 || response.body === null) {
        settleOnce();
        return response;
      }

      const bodyMethods = ['json', 'text', 'blob', 'arrayBuffer', 'formData'];
      fallbackTimer = win.setTimeout(settleOnce, 5000);
      if (typeof Proxy !== 'function') return response;

      return new Proxy(response, {
        get: function (target, prop) {
          if (bodyMethods.includes(prop) && typeof target[prop] === 'function') {
            return function () {
              let result;
              try {
                result = target[prop].apply(target, arguments);
              } catch (error) {
                settleOnce();
                throw error;
              }
              return Promise.resolve(result).finally(settleOnce);
            };
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    }

    if (nativeFetch && !win.__RIZENIC_UI_FETCH_WRAPPED__) {
      win.__RIZENIC_UI_FETCH_WRAPPED__ = true;
      win.fetch = function (input, init) {
        const requestMethod = String(
          (init && init.method) ||
          (win.Request && input instanceof win.Request ? input.method : 'GET') ||
          'GET'
        ).toUpperCase();
        const requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const backgroundRead = Boolean(init && init.uiBackground);
        const trackRead = requestMethod === 'GET' && /\/api\//.test(requestUrl) && !backgroundRead;
        if (trackRead) beginRead();
        let promise;
        try {
          promise = nativeFetch(input, init);
        } catch (error) {
          if (trackRead) endRead();
          throw error;
        }
        if (!trackRead) return promise;
        return Promise.resolve(promise).then(
          function (response) { return wrapTrackedResponseBody(response); },
          function (error) { endRead(); throw error; }
        );
      };
    }

    // Search fields keep accepting text, but existing live-search handlers are held
    // until Enter. This does not alter the actual search/filter functions.
    function guardSearchEvent(event) {
      if (!isSearchControl(event.target)) return;
      if (event.key === 'Enter') {
        if (event.type === 'keyup') {
          win.setTimeout(function () { queueRefresh(true); }, 0);
        }
        return;
      }
      event.stopImmediatePropagation();
    }

    doc.addEventListener('input', guardSearchEvent, true);
    doc.addEventListener('keydown', guardSearchEvent, true);
    doc.addEventListener('keypress', guardSearchEvent, true);
    doc.addEventListener('keyup', guardSearchEvent, true);

    function isPlaceholderRow(row) {
      if (!row || row.tagName !== 'TR') return true;
      if (row.cells.length !== 1) return false;
      const cell = row.cells[0];
      return Number(cell.colSpan || 1) > 1;
    }

    function isExternallyVisible(row) {
      // `hidden` belongs to this pagination layer, so do not use it here.
      if (row.classList.contains('hidden')) return false;
      if (row.style && row.style.display === 'none') return false;
      return true;
    }

    function getStickyTopOffset() {
      let top = 0;
      doc.querySelectorAll('header').forEach(function (header) {
        if (!header || !header.getBoundingClientRect) return;
        const rect = header.getBoundingClientRect();
        if (rect.height <= 0 || rect.bottom <= 0 || rect.top > 2) return;
        top = Math.max(top, rect.bottom);
      });
      return Math.max(0, Math.min(180, Math.round(top)));
    }

    function hideLegacyCountBadges() {
      LEGACY_COUNT_IDS.forEach(function (id) {
        const counter = doc.getElementById(id);
        if (!counter) return;
        const holder = counter.parentElement || counter;
        holder.classList.add('ui-legacy-count-hidden');
        holder.setAttribute('aria-hidden', 'true');
      });
    }

    function setupStableHoverMenus() {
      doc.querySelectorAll('.group.relative').forEach(function (group) {
        if (group.dataset.uiStableMenu === 'true') return;
        const menu = Array.from(group.children || []).find(function (child) {
          return child.classList && child.classList.contains('absolute') &&
            child.classList.contains('hidden') && child.classList.contains('group-hover:block');
        });
        if (!menu) return;

        group.dataset.uiStableMenu = 'true';
        group.classList.add('ui-stable-menu-group');
        menu.classList.add('ui-stable-hover-menu');
        let closeTimer = null;

        function openMenu() {
          if (closeTimer) win.clearTimeout(closeTimer);
          closeTimer = null;
          group.classList.add('ui-menu-open');
        }

        function scheduleClose() {
          if (closeTimer) win.clearTimeout(closeTimer);
          closeTimer = win.setTimeout(function () {
            group.classList.remove('ui-menu-open');
            closeTimer = null;
          }, 220);
        }

        group.addEventListener('pointerenter', openMenu);
        group.addEventListener('pointerleave', scheduleClose);
        menu.addEventListener('pointerenter', openMenu);
        menu.addEventListener('pointerleave', scheduleClose);
        group.addEventListener('focusin', openMenu);
        group.addEventListener('focusout', scheduleClose);
      });
    }

    function paginationAnchor(table) {
      if (!table) return null;
      const parent = table.parentElement;
      if (!parent) return table;
      const classes = parent.classList;
      const isTableScrollWrapper = classes.contains('overflow-x-auto') ||
        classes.contains('overflow-auto') ||
        classes.contains('custom-scrollbar') ||
        classes.contains('table-container') ||
        classes.contains('table-wrapper');
      return isTableScrollWrapper ? parent : table;
    }

    function configureTableScrollHost(table, adaptive, dockGated) {
      const host = paginationAnchor(table);
      if (!host || host === table) return null;
      host.classList.add('ui-table-scroll-host');
      host.classList.toggle('ui-table-adaptive-host', Boolean(adaptive));
      host.classList.toggle('ui-table-dock-gated', Boolean(dockGated));
      return host;
    }


    function syncTableViewport(state) {
      if (!state || !state.scrollHost || !state.controls) return;
      const rect = state.scrollHost.getBoundingClientRect();
      const viewportHeight = Number(win.innerHeight) || 800;
      const pagerHeight = Math.max(56, Number(state.controls.offsetHeight) || 56);
      const stickyTop = state.dockGated ? 0 : (state.adaptive ? getStickyTopOffset() : 0);
      const top = state.adaptive
        ? Math.max(stickyTop, Math.round(rect.top || 0))
        : Math.max(0, Math.round(rect.top || 0));
      // Dock-gated pages must reserve the final docked viewport height from
      // first paint. If we shrink the table to its current lower position,
      // the outer <main> has no real scroll distance and the sticky host can
      // never reach the top. Keeping the final height inside the same
      // containing block gives the browser a native scroll runway without
      // synthetic spacers or wheel interception.
      const viewportTop = state.dockGated ? stickyTop : top;
      const available = Math.max(220, viewportHeight - viewportTop - pagerHeight - 12);
      state.scrollHost.style.setProperty('--ui-table-viewport-height', available + 'px');
      if (state.adaptive) state.scrollHost.style.setProperty('--ui-table-sticky-top', stickyTop + 'px');
      if (state.dockGated) {
        const docked = rect.top <= stickyTop + 1;
        state.scrollHost.classList.toggle('ui-table-docked', docked);
      }
    }


    function buildControls(state) {
      const controls = doc.createElement('div');
      controls.className = 'ui-pagination';
      const sizeOptions = state.pageSizeOptions.map(function (size) {
        return '<option value="' + size + '"' + (size === state.pageSize ? ' selected' : '') + '>' + size + '</option>';
      }).join('');
      controls.innerHTML = [
        '<div class="ui-pagination__meta">',
        '<span data-ui-range>0–0</span><span class="ui-pagination__sep">/</span><span data-ui-total>0 รายการ</span>',
        '<label class="ui-pagination__size">แสดง <select data-ui-page-size aria-label="จำนวนแถวต่อหน้า">' + sizeOptions + '</select> แถว</label>',
        '</div>',
        '<div class="ui-pagination__actions">',
        '<button type="button" class="ui-page-btn" data-ui-prev aria-label="หน้าก่อนหน้า">‹</button>',
        '<span class="ui-pagination__numbers" data-ui-pages aria-label="เลขหน้า"></span>',
        '<button type="button" class="ui-page-btn" data-ui-next aria-label="หน้าถัดไป">›</button>',
        '</div>'
      ].join('');

      controls.querySelector('[data-ui-prev]').addEventListener('click', function () {
        state.page -= 1;
        renderState(state);
      });
      controls.querySelector('[data-ui-next]').addEventListener('click', function () {
        state.page += 1;
        renderState(state);
      });
      controls.querySelector('[data-ui-pages]').addEventListener('click', function (event) {
        const button = event.target.closest('[data-ui-page-number]');
        if (!button) return;
        state.page = Number(button.getAttribute('data-ui-page-number')) || 1;
        renderState(state);
      });
      const select = controls.querySelector('[data-ui-page-size]');
      select.addEventListener('change', function () {
        state.pageSize = Math.max(1, Number(select.value) || state.pageSize);
        state.page = 1;
        renderState(state);
      });
      return controls;
    }

    function renderPageNumbers(state, bounds) {
      const holder = state.controls.querySelector('[data-ui-pages]');
      if (!holder) return;
      holder.innerHTML = '';
      getPageTokens(bounds.totalPages, bounds.page).forEach(function (token) {
        if (token === '…') {
          const ellipsis = doc.createElement('span');
          ellipsis.className = 'ui-page-ellipsis';
          ellipsis.textContent = '…';
          holder.appendChild(ellipsis);
          return;
        }
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'ui-page-number' + (token === bounds.page ? ' is-active' : '');
        button.textContent = String(token);
        button.setAttribute('data-ui-page-number', String(token));
        button.setAttribute('aria-label', 'หน้า ' + token);
        if (token === bounds.page) button.setAttribute('aria-current', 'page');
        holder.appendChild(button);
      });
    }

    function renderState(state) {
      const tbody = state.tbody;
      if (!tbody || !tbody.isConnected) return;
      syncTableViewport(state);

      const allRows = Array.from(tbody.children).filter(function (node) { return node.tagName === 'TR'; });
      const dataRows = allRows.filter(function (row) { return !isPlaceholderRow(row); });
      const visibleRows = dataRows.filter(isExternallyVisible);
      const bounds = getPageBounds(visibleRows.length, state.page, state.pageSize);
      state.page = bounds.page;

      const visibleSet = new Set(visibleRows.slice(bounds.start, bounds.end));
      dataRows.forEach(function (row) {
        if (!isExternallyVisible(row)) {
          row.hidden = true;
        } else {
          row.hidden = !visibleSet.has(row);
        }
      });

      // Empty/loading/error rows must always remain visible.
      allRows.filter(isPlaceholderRow).forEach(function (row) { row.hidden = false; });

      const controls = state.controls;
      controls.querySelector('[data-ui-range]').textContent = visibleRows.length
        ? (bounds.start + 1) + '–' + bounds.end
        : '0–0';
      controls.querySelector('[data-ui-total]').textContent = visibleRows.length + ' รายการ';
      controls.querySelector('[data-ui-prev]').disabled = bounds.page <= 1;
      controls.querySelector('[data-ui-next]').disabled = bounds.page >= bounds.totalPages;
      renderPageNumbers(state, bounds);
    }

    function setupTbody(tbody) {
      if (!tbody || states.has(tbody) || !TARGET_TBODIES.has(tbody.id)) return;
      const table = tbody.closest('table');
      if (!table) return;

      const state = {
        tbody: tbody,
        table: table,
        page: 1,
        pageSize: pageSizeForPath(win.location.pathname),
        pageSizeOptions: pageSizeOptionsForPath(win.location.pathname),
        controls: null,
        observer: null,
        scrollHost: null,
        adaptive: isAdaptiveTablePage,
        dockGated: isDockGatedTablePage,
      };

      table.dataset.uiPaginated = 'true';
      table.classList.add('ui-data-table');
      state.scrollHost = configureTableScrollHost(table, state.adaptive, state.dockGated);
      state.controls = buildControls(state);
      const anchor = paginationAnchor(table);
      anchor.insertAdjacentElement('afterend', state.controls);

      state.observer = new MutationObserver(function () {
        state.page = 1;
        queueRefresh();
      });
      state.observer.observe(tbody, { childList: true });
      states.set(tbody, state);
      renderState(state);
    }

    function discoverTables() {
      TARGET_TBODIES.forEach(function (id) {
        const tbody = doc.getElementById(id);
        if (tbody) setupTbody(tbody);
      });
    }

    function refreshAll(resetPage) {
      states.forEach(function (state) {
        if (resetPage) state.page = 1;
        renderState(state);
      });
    }

    function queueRefresh(resetPage) {
      if (refreshQueued) return;
      refreshQueued = true;
      win.requestAnimationFrame(function () {
        refreshQueued = false;
        discoverTables();
        refreshAll(Boolean(resetPage));
      });
    }

    function initVisualPerformance() {
      hideLegacyCountBadges();
      setupStableHoverMenus();
      discoverTables();
      // Image decoding is presentation-only and prevents large images from blocking paint.
      doc.querySelectorAll('img:not([decoding])').forEach(function (img) {
        img.decoding = 'async';
        if (!img.closest('header, nav, aside') && !img.classList.contains('logo')) img.loading = 'lazy';
      });
    }

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', initVisualPerformance, { once: true });
    } else {
      initVisualPerformance();
    }

    // Native table scrolling is intentional: do not intercept wheel/touch events.
    // The scroll host and sticky header are CSS-only so trackpads, mice and scrollbars
    // behave consistently across every table page.

    let adaptiveSyncQueued = false;
    function scheduleAdaptiveViewportSync() {
      if (!isAdaptiveTablePage || adaptiveSyncQueued) return;
      adaptiveSyncQueued = true;
      win.requestAnimationFrame(function () {
        adaptiveSyncQueued = false;
        states.forEach(function (state) {
          if (state.adaptive) syncTableViewport(state);
        });
      });
    }

    doc.addEventListener('scroll', scheduleAdaptiveViewportSync, true);

    win.addEventListener('resize', function () {
      states.forEach(function (state) {
        if (state.table) state.scrollHost = configureTableScrollHost(state.table, state.adaptive, state.dockGated);
        syncTableViewport(state);
      });
    });

    // Existing filters/sorts remain the source of truth. Re-page only after they run.
    doc.addEventListener('change', function () {
      win.setTimeout(function () { queueRefresh(true); }, 0);
    }, true);
    doc.addEventListener('click', function (event) {
      if (event.target.closest('button, [role="button"], th')) {
        win.setTimeout(function () { queueRefresh(false); }, 0);
      }
    }, true);

    win.addEventListener('ui:refresh-pagination', function () { queueRefresh(true); });
    win.RizenicUIPerformance = {
      refresh: function () { queueRefresh(true); },
      pendingReads: function () { return pendingReads; },
      beginTask: beginTask,
      endTask: endTask,
      loadScript: loadScriptOnce
    };
  }

  return {
    TARGET_TBODIES: TARGET_TBODIES,
    pageSizeForPath: pageSizeForPath,
    pageSizeOptionsForPath: pageSizeOptionsForPath,
    getPageBounds: getPageBounds,
    getPageTokens: getPageTokens,
    isSearchControl: isSearchControl,
    LEGACY_COUNT_IDS: LEGACY_COUNT_IDS,
    boot: boot
  };
});
