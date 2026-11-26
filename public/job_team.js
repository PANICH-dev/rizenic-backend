(() => {
 let employees=[];
 const text=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const arrived=j=>/^(09|10|11|12|13|14|15|16|17|19)\./.test(j.job_status||'');
 const delivered=j=>/^(12|13|14|15|16|17|19)\./.test(j.job_status||'');
 const names=j=>(j.sa_collaborator_employee_ids||[]).map(id=>employees.find(e=>String(e.employee_id)===String(id))?.employee_name||('รหัส '+id));
 const primary=j=>employees.find(e=>String(e.employee_id)===String(j.sa_owner_employee_id))?.employee_name||j.sa_owner||'ไม่ระบุ SA';
 async function request(url,options){const response=await fetch(url,options);let data;try{data=await response.json();}catch{throw Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง');}if(!response.ok||data?.success===false||data?.error)throw Error(data.error||'บันทึกไม่สำเร็จ');return data;}
 window.JobTeam={text,today,arrived,delivered,names,primary,request,setEmployees(value){employees=Array.isArray(value)?value:[];},decorate(job){return{...job,sa_owner:primary(job),sa_collaborators:names(job).join(', ')};},matches(job,name,mode='main'){return(mode!=='shared'&&primary(job)===name)||(mode!=='main'&&names(job).includes(name));}};
})();
