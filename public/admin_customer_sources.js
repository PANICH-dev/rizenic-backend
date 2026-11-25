(() => {
 let loading=false;
 const table=()=>document.getElementById('customer-source-rows');
 const status=text=>{document.getElementById('customer-source-admin-status').textContent=text;};
 async function request(url,options){const response=await fetch(url,options);const result=await response.json();if(!response.ok)throw Error(result.error||'ดำเนินการไม่สำเร็จ');return result;}
 async function load(){
  try{
   const rows=await request('/api/customer-sources');table().replaceChildren();
   for(const source of rows){
    const row=document.createElement('tr');row.className='border-b';
    const nameCell=row.insertCell();const name=document.createElement('input');name.className='minimal-input';name.value=source.name;name.maxLength=100;name.setAttribute('aria-label','ชื่อแหล่งที่มา '+source.name);nameCell.append(name);
    const active=row.insertCell();active.textContent=source.is_active?'เปิดใช้งาน':'ปิดใช้งาน';
    const actions=row.insertCell();
    const save=document.createElement('button');save.textContent='บันทึกชื่อ';save.className='px-3 py-2 text-emerald-800';
    const toggle=document.createElement('button');toggle.textContent=source.is_active?'ปิดใช้งาน':'เปิดใช้งาน';toggle.className='px-3 py-2 text-amber-800';
    const update=async enabled=>{if(loading)return;loading=true;save.disabled=toggle.disabled=true;try{await request('/api/customer-sources/'+source.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value.trim(),is_active:enabled})});await load();status('บันทึกแล้ว ข้อมูลในใบงานเดิมยังคงชื่อเดิม');}catch(error){status(error.message);}finally{loading=false;save.disabled=toggle.disabled=false;}};
    save.onclick=()=>update(source.is_active);toggle.onclick=()=>update(!source.is_active);actions.append(save,toggle);table().append(row);
   }
  }catch(error){status(error.message);}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  if(sessionStorage.getItem('isLoggedIn')!=='true'||!(sessionStorage.getItem('accessible_pages')||'').split(',').includes('admin'))return;
  load();document.getElementById('customer-source-form').onsubmit=async event=>{
   event.preventDefault();if(loading)return;loading=true;const button=event.submitter;if(button)button.disabled=true;
   try{await request('/api/customer-sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('new_customer_source').value.trim()})});document.getElementById('new_customer_source').value='';await load();status('เพิ่มแหล่งที่มาแล้ว');}
   catch(error){status(error.message);}finally{loading=false;if(button)button.disabled=false;}
  };
 });
})();
