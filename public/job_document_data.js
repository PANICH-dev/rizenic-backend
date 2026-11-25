// Canonical claim numbers from the current document sets, falling back to saved job data.
window.JobDocumentData={claims(job){
 const inputs=[...document.querySelectorAll('.pipe-claim')];
 const values=inputs.length?inputs.map(el=>el.value):String(job?.claim_no||document.getElementById('eclaim_claim_no')?.value||'').split(',');
 const seen=new Set();return values.map(value=>String(value||'').trim()).filter(value=>{const key=value.toUpperCase();if(!value||seen.has(key))return false;seen.add(key);return true;}).join(', ');
}};
