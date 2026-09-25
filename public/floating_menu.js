(() => {
  'use strict';

  const GAP = 6;
  const VIEWPORT_MARGIN = 10;
  let active = null;
  let closeTimer = null;

  function clearCloseTimer() {
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  function closeMenu(config = active) {
    if (!config) return;
    clearCloseTimer();
    config.panel.classList.add('hidden');
    config.trigger.setAttribute('aria-expanded', 'false');
    config.pinned = false;
    if (active === config) active = null;
  }

  function scheduleClose(config) {
    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      if (!config.pinned) closeMenu(config);
    }, 240);
  }

  function positionMenu(config) {
    const { trigger, panel } = config;
    if (panel.classList.contains('hidden')) return;

    panel.style.position = 'fixed';
    panel.style.zIndex = '10050';
    panel.style.visibility = 'hidden';
    panel.style.left = '0px';
    panel.style.top = '0px';
    panel.style.maxHeight = '';
    panel.style.overflowY = '';

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width || 240;
    const naturalHeight = panelRect.height || 200;
    const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = triggerRect.top - VIEWPORT_MARGIN;
    const openAbove = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
    const availableHeight = Math.max(140, (openAbove ? spaceAbove : spaceBelow) - GAP);
    const visibleHeight = Math.min(naturalHeight, availableHeight);

    let top = openAbove
      ? triggerRect.top - visibleHeight - GAP
      : triggerRect.bottom + GAP;
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - visibleHeight - VIEWPORT_MARGIN));

    let left = triggerRect.right - panelWidth;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.maxHeight = `${Math.floor(availableHeight)}px`;
    panel.style.overflowY = naturalHeight > availableHeight ? 'auto' : 'visible';
    panel.style.visibility = 'visible';
    panel.dataset.rzOpenDirection = openAbove ? 'up' : 'down';
  }

  function openMenu(config, pinned = false) {
    if (active && active !== config) closeMenu(active);
    clearCloseTimer();
    config.pinned = pinned || config.pinned;
    config.panel.classList.remove('hidden');
    config.trigger.setAttribute('aria-expanded', 'true');
    active = config;
    positionMenu(config);
  }

  function initFloatingMenu(wrapper) {
    const trigger = wrapper.querySelector('[data-rz-menu-trigger]');
    const panel = wrapper.querySelector('[data-rz-menu-panel]');
    if (!trigger || !panel || panel.dataset.rzFloatingReady === '1') return;

    panel.dataset.rzFloatingReady = '1';
    const config = { wrapper, trigger, panel, pinned: false };

    // Portal out of header/table stacking contexts so sticky headers can never cover the menu.
    document.body.appendChild(panel);

    trigger.addEventListener('mouseenter', () => openMenu(config, false));
    trigger.addEventListener('mouseleave', () => scheduleClose(config));
    panel.addEventListener('mouseenter', () => { clearCloseTimer(); openMenu(config, config.pinned); });
    panel.addEventListener('mouseleave', () => scheduleClose(config));

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (active === config && config.pinned) closeMenu(config);
      else openMenu(config, true);
    });

    panel.addEventListener('click', (event) => event.stopPropagation());
  }

  function repositionActive() {
    if (active) positionMenu(active);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-rz-floating-menu]').forEach(initFloatingMenu);
  });

  document.addEventListener('click', (event) => {
    if (!active) return;
    if (active.trigger.contains(event.target) || active.panel.contains(event.target)) return;
    closeMenu(active);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', repositionActive, { passive: true });
  window.addEventListener('scroll', repositionActive, { passive: true, capture: true });
})();
