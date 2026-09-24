(() => {
  if (!location.pathname.toLowerCase().endsWith('/frmkeyin_inoutcar.aspx')) return;
  if (window.__robotNoSave) return;
  window.__robotNoSave = true;
  const blocked = () => { window.__robotBlockedSaves = (window.__robotBlockedSaves || 0) + 1; };
  const safePostback = () => /^(ddlInsurer|rbStatusCar\$[01])$/.test(
    document.getElementById('__EVENTTARGET')?.value || '');
  document.addEventListener('click', event => {
    if (event.target.closest('#bntSave, input[type="submit"], button[type="submit"]')) {
      event.preventDefault(); event.stopImmediatePropagation(); blocked();
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('submit', event => {
    if (!safePostback() || event.submitter) {
      event.preventDefault(); event.stopImmediatePropagation(); blocked();
    }
  }, true);
  const submit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    if (!safePostback()) { blocked(); throw new Error('Robot fill-only mode: saving is forbidden'); }
    return submit.call(this);
  };
  HTMLFormElement.prototype.requestSubmit = function () {
    blocked(); throw new Error('Robot fill-only mode: saving is forbidden');
  };
  const protect = () => {
    const save = document.getElementById('bntSave');
    if (save && !save.disabled) { save.disabled = true; save.title = 'Robot: fill only; saving is forbidden'; }
  };
  new MutationObserver(protect).observe(document, {childList: true, subtree: true});
  protect();
})();
