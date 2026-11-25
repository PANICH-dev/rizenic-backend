(() => {
 let job=null,busy=false,sources=[];
 const PREFIX={insurance:'insurance_checkin',arrival:'arrival_checkin',delivery:'delivery_checkin'};
 const LABEL={insurance:'ยืนยันเสนอประกัน',arrival:'ยืนยันรถเข้าจอด',delivery:'ยืนยันส่งมอบรถ'};
 const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 function showSource(value=null){
  const select=document.getElementById('customer_source');if(!select)return;
  const selected=value??select.value;select.replaceChildren(new Option('-- เลือกแหล่งที่มา --',''));
  sources.filter(source=>source.is_active).forEach(source=>select.add(new Option(source.name,source.name)));
  if(selected&&![...select.options].some(option=>option.value===selected))select.add(new Option(selected+' (ข้อมูลเดิม)',selected));
  select.value=selected;
 }
 function paint(){
  document.querySelectorAll('.checkin-action').forEach(button=>{
   const kind=button.dataset.kind,prefix=PREFIX[kind],checked=job?.[prefix+'_at'];
   button.disabled=busy||!!checked||!job?.id;button.textContent=checked?'✓ เช็กอินแล้ว':kind==='insurance'&&job?.id?'ยืนยันเสนอประกัน Job #'+job.id:LABEL[kind];
   const container=button.closest('[data-checkin-group]');const status=container?.querySelector('.checkin-status');
   if(status){
    const format=value=>new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'});
    const timestamp=kind==='insurance'?job?.insurance_checkin_recorded_at:checked;
    const dateText=kind==='insurance'&&checked?'เสนอวันที่ '+new Date(checked).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})+' | ':'';
    status.textContent=checked?dateText+(timestamp?'เช็กอิน '+format(timestamp):'ไม่พบเวลาเช็กอินเดิม')+' | SA '+(job[prefix+'_sa']||'')+' | ผู้บันทึก '+(job[prefix+'_by']||''):job?.id?'ยังไม่เช็กอิน':'บันทึกใบงานก่อนเช็กอิน';
   }
   if(container){
    let cancel=container.querySelector('.checkin-cancel');
    if(!cancel){cancel=document.createElement('button');cancel.type='button';cancel.className='checkin-cancel rounded border border-rose-300 text-rose-700 text-xs px-2 py-1';cancel.textContent='ยกเลิกเช็กอิน';cancel.onclick=()=>cancelCheckin(kind);container.append(cancel);}
    cancel.hidden=!checked;cancel.disabled=busy;
   }
  });
  document.querySelectorAll('.insurance-event-date').forEach(input=>{
   input.max=today();input.disabled=busy||!!job?.insurance_checkin_at;
   if(job?.insurance_checkin_at)input.value=new Date(new Date(job.insurance_checkin_at).getTime()+7*3600000).toISOString().slice(0,10);
   else if(!input.value)input.value=today();
  });
 }
 async function checkin(kind,button){
  if(busy||!PREFIX[kind])return;
  const id=document.getElementById('sa_report_id')?.value;
  if(!id||String(job?.id)!==String(id)){alert('กรุณาบันทึกใบงานก่อนเช็กอิน');return;}
  const owner=document.getElementById('sa_owner_input')?.value.trim();
  if(!owner||owner!==String(job.sa_owner||'').trim()){alert('กรุณาบันทึกการเปลี่ยน SA ก่อนเช็กอิน');return;}
  const actor=sessionStorage.getItem('emp_name');if(!actor){alert('กรุณาเข้าสู่ระบบก่อนเช็กอิน');return;}
  const date=button.closest('[data-checkin-group]')?.querySelector('.insurance-event-date')?.value;
  if(kind==='insurance'&&(!date||date>today())){alert('เลือกวันที่เสนอประกันจริง โดยต้องไม่เกินวันนี้');return;}
  busy=true;paint();
  try{
   const response=await fetch('/api/report/'+encodeURIComponent(id)+'/checkin/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,date})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'เช็กอินไม่สำเร็จ');
   if(String(document.getElementById('sa_report_id')?.value)===String(id)){job={...job,...result.data};paint();}
  }catch(error){alert(error.message);}finally{busy=false;paint();}
 }
 async function cancelCheckin(kind){
  if(busy||!PREFIX[kind]||!job?.[PREFIX[kind]+'_at'])return;
  const id=document.getElementById('sa_report_id')?.value,expected=job[PREFIX[kind]+'_at'],actor=sessionStorage.getItem('emp_name');
  if(!id||String(job.id)!==String(id)||!actor){alert('กรุณาเปิดใบงานและเข้าสู่ระบบก่อนยกเลิก');return;}
  const reason=prompt('ระบุเหตุผลที่ยกเลิกเช็กอิน (ระบบจะเก็บประวัติเดิมไว้)');
  if(reason===null)return;if(!reason.trim()||reason.trim().length>500){alert('กรุณาระบุเหตุผลไม่เกิน 500 ตัวอักษร');return;}
  busy=true;paint();
  try{
   const response=await fetch('/api/report/'+encodeURIComponent(id)+'/checkin/'+kind+'/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,reason:reason.trim(),expected_at:expected})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'ยกเลิกไม่สำเร็จ');
   if(String(document.getElementById('sa_report_id')?.value)===String(id)){job={...job,...result.data};if(kind==='insurance')document.querySelectorAll('.insurance-event-date').forEach(input=>input.value=today());}
  }catch(error){alert(error.message);}finally{busy=false;paint();}
 }
 window.SAActivity={checkin,cancelCheckin,paint,setJob(value){job=value;document.querySelectorAll('.insurance-event-date').forEach(input=>input.value='');showSource(value?.customer_source||'');paint();},getJob(){return job;}};
 document.addEventListener('DOMContentLoaded',async()=>{
  paint();
  try{const response=await fetch('/api/customer-sources',{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'โหลดแหล่งที่มาไม่สำเร็จ');sources=result;showSource(job?.customer_source||'');}
  catch(error){const status=document.getElementById('customer_source_status');if(status)status.textContent=error.message;}
 });
})();
