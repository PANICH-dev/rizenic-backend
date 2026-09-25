(() => {
  const boot = () => {
    const mainApp = document.getElementById('main-app');
    if (!mainApp) return;

    const topbar = document.getElementById('main-topbar') || mainApp.querySelector(':scope > header');
    if (!topbar) return;

    topbar.id = topbar.id || 'main-topbar';
    topbar.classList.add('rz-lock-topbar');

    let spacer = document.getElementById('main-topbar-spacer') || document.getElementById('rz-topbar-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'rz-topbar-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      topbar.insertAdjacentElement('afterend', spacer);
    }

    let rafId = 0;
    const sync = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const isHidden = mainApp.classList.contains('hidden') || getComputedStyle(mainApp).display === 'none';
        const height = isHidden ? 0 : Math.ceil(topbar.getBoundingClientRect().height);
        const value = `${height}px`;
        document.documentElement.style.setProperty('--rz-topbar-height', value);
        spacer.style.height = value;
        spacer.style.minHeight = value;
        spacer.style.flexBasis = value;
      });
    };

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(sync);
      observer.observe(topbar);
    }

    const visibilityObserver = new MutationObserver(sync);
    visibilityObserver.observe(mainApp, { attributes: true, attributeFilter: ['class', 'style'] });

    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('pageshow', sync, { passive: true });
    sync();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
