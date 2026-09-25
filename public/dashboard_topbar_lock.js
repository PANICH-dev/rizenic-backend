(() => {
  const boot = () => {
    const topbar = document.getElementById('dashboard-topbar');
    const spacer = document.getElementById('dashboard-topbar-spacer');
    if (!topbar || !spacer) return;

    let rafId = 0;
    const sync = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const height = Math.ceil(topbar.getBoundingClientRect().height);
        const value = `${height}px`;
        document.documentElement.style.setProperty('--rz-dashboard-topbar-height', value);
        spacer.style.height = value;
        spacer.style.minHeight = value;
        spacer.style.flexBasis = value;
      });
    };

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(sync);
      observer.observe(topbar);
    }
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
