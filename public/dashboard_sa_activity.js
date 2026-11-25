(() => {
 let sequence=0;
 window.previewSAReport=async()=>{
  const request=++sequence,date=document.getElementById('sa_report_date').value,branch=document.getElementById('sa_report_branch').value;
  const output=document.getElementById('sa_report_preview');document.getElementById('sa_pending_jobs').replaceChildren();output.textContent='กำลังโหลดผลงาน SA...';
  try{const response=await fetch('/api/sa-performance?'+new URLSearchParams({date,branch}),{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'โหลดรายงานไม่สำเร็จ');if(request===sequence){
   output.textContent=result.message;
   const details=document.getElementById('sa_pending_jobs');details.replaceChildren();
   if(result.pending?.length){
    const title=document.createElement('h4');title.textContent='รถรอเสนอประกันค้างทั้งหมด — ไม่จำกัดเดือน';title.className='font-bold my-3';details.append(title);
    const table=document.createElement('table');table.className='w-full text-sm text-left';const head=table.createTHead().insertRow();
    ['SA','ทะเบียน','เลขที่เคลม','ยืนยันแล้ว / Job ทั้งหมด','เลขใบงาน'].forEach(label=>{const cell=document.createElement('th');cell.textContent=label;cell.className='p-2 border-b';head.append(cell);});
    const body=table.createTBody();for(const item of result.pending){const row=body.insertRow();[item.sa,item.plate,item.claims,item.confirmed_jobs+' / '+item.total_jobs,item.job_ids.join(', ')].forEach(value=>{const cell=row.insertCell();cell.textContent=value;cell.className='p-2 border-b align-top';});}details.append(table);
   }
  }}
  catch(error){if(request===sequence)output.textContent=error.message;}
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const date=document.getElementById('sa_report_date');date.value=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  for(const id of ['sa_report_date','sa_report_branch'])document.getElementById(id).addEventListener('change',()=>{sequence++;document.getElementById('sa_pending_jobs').replaceChildren();document.getElementById('sa_report_preview').textContent='กดดูตัวอย่างเพื่อโหลดข้อมูลตามวันที่และสาขาที่เลือก';});
 });
})();
