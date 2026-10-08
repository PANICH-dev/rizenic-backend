(() => {
  if (!location.pathname.toLowerCase().endsWith('/frmkeyin_inoutcar.aspx')) return;
  if (window.__robotNoSave) return;
  window.__robotNoSave = true;
  const blocked = () => { window.__robotBlockedSaves = (window.__robotBlockedSaves || 0) + 1; };
  const inVehicleSelector = target => Boolean(target?.closest?.('#frame_select'));
  const safePostback = () => /^(ddlInsurer|rbStatusCar\$[01]|drpCVechType|drpCmfg|drpCModel|drpDstYear|drpCTrimLevel|drpCVechTypeUnlisted|drpCmfgUnlisted|drpCModelUnlisted|drpEngsizeUnlisted|radHavePart)$/.test(
    document.getElementById('__EVENTTARGET')?.value || '');
  document.addEventListener('click', event => {
    if (!inVehicleSelector(event.target) && event.target.closest('#bntSave, input[type="submit"], button[type="submit"]')) {
      event.preventDefault(); event.stopImmediatePropagation(); blocked();
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('submit', event => {
    if ((!safePostback() && !inVehicleSelector(event.submitter || event.target)) || (event.submitter && !inVehicleSelector(event.submitter))) {
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
