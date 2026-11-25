(() => {
 let sequence=0;
 window.previewSAReport=async()=>{
  const request=++sequence,date=document.getElementById('sa_report_date').value,branch=document.getElementById('sa_report_branch').value;
  const output=document.getElementById('sa_report_preview');output.textContent='กำลังโหลดผลงาน SA...';
  try{const response=await fetch('/api/sa-performance?'+new URLSearchParams({date,branch}),{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'โหลดรายงานไม่สำเร็จ');if(request===sequence)output.textContent=result.message;}
  catch(error){if(request===sequence)output.textContent=error.message;}
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const date=document.getElementById('sa_report_date');date.value=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  for(const id of ['sa_report_date','sa_report_branch'])document.getElementById(id).addEventListener('change',()=>{sequence++;document.getElementById('sa_report_preview').textContent='กดดูตัวอย่างเพื่อโหลดข้อมูลตามวันที่และสาขาที่เลือก';});
 });
})();
