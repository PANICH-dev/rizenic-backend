let deliveryJobId = '';
let deliveryLoading = false;
let deliverySaving = false;
let deliveryLoadFailed = false;
let deliverySequence = 0;
const DELIVERY_PARTS = ['กันชนหน้า','ฝากระโปรงหน้า','แผงหน้าทั้งชุด','บังโคลนหน้าซ้าย','บังโคลนหน้าขวา','เสากระจกบังลมหน้าซ้าย','เสากระจกบังลมหน้าขวา','กระจกมองข้างซ้าย','กระจกมองข้างขวา','ประตูหน้าซ้าย','ประตูหน้าขวา','ประตูหลังซ้าย','ประตูหลังขวา','บันไดซ้าย','บันไดขวา','บังโคลนหลังซ้าย','บังโคลนหลังขวา','ฝาปิดท้าย','กันชนหลัง','แผงตั้งท้าย','หลังคา','กระจกบังลมหน้า','กระจกบังลมหลัง','ล้อแม็กหน้าซ้าย','ล้อแม็กหน้าขวา','ล้อแม็กหลังซ้าย','ล้อแม็กหลังขวา','ระบบแอร์','ระบบวิทยุ','ระบบไฟ','ช่วงล่าง','ยางรถยนต์','ความสะอาดภายใน','ความสะอาดภายนอก','หน้าจอแจ้งเตือน Alert'];
const DELIVERY_CABIN = ['พวงมาลัย','วิทยุ','ลำโพง','ที่จุดบุหรี่','กุญแจรีโมท / คีย์การ์ด','ล็อคเกียร์','พรมปูพื้น','เบาะ','คอนโซล'];
const DELIVERY_TRUNK = ['ยางอะไหล่','แม่แรง','ชุดถุงเครื่องมือ','แผ่นปิดฝาท้าย','สายชาร์จ','สายพ่วงแบตเตอรี่','อื่น ๆ','',''];
function deliveryFields() { return [...document.querySelectorAll('#deliveryPrintArea [data-delivery]')]; }
async function loadDeliveryTemplate() {
 if(document.getElementById('deliveryInspectionModal'))return;
 const res=await fetch('delivery_inspection.html?v=20261124.5',{cache:'no-store'});
 if(!res.ok)throw Error('โหลดแบบฟอร์มไม่สำเร็จ');
 document.body.insertAdjacentHTML('beforeend',await res.text());
 const parts=document.getElementById('deliveryParts');
 DELIVERY_PARTS.forEach((name,index)=>{
  const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.dataset.delivery='part_'+index;
  const note=document.createElement('input');note.dataset.delivery='part_note_'+index;note.setAttribute('aria-label','หมายเหตุ '+name);
  label.append(check,document.createTextNode(name),note);parts.append(label);
 });
 const inventory=document.getElementById('deliveryInventory');
 DELIVERY_CABIN.forEach((name,index)=>{
  const row=inventory.insertRow();row.insertCell().textContent=name;
  const left=document.createElement('input');left.dataset.delivery='cabin_'+index;left.setAttribute('aria-label','จำนวน/สภาพ '+name);row.insertCell().append(left);
  row.insertCell().textContent=DELIVERY_TRUNK[index];const right=document.createElement('input');right.dataset.delivery='trunk_'+index;right.setAttribute('aria-label','จำนวน/สภาพท้ายรถ '+(DELIVERY_TRUNK[index]||index));row.insertCell().append(right);
 });
 document.querySelectorAll('#deliveryPrintArea input[type="date"]').forEach(input=>{
  const text=document.createElement('span');text.className='delivery-date-print';input.after(text);
 });
 const canvas=document.getElementById('deliveryCanvas');canvas.style.touchAction='none';canvas.onpointerdown=event=>{
  event.preventDefault();const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height;
  const ctx=canvas.getContext('2d');ctx.strokeStyle='#b91c1c';ctx.lineWidth=4;ctx.beginPath();
  if(document.getElementById('deliveryMarkTool').value==='O')ctx.arc(x,y,15,0,Math.PI*2);
  else {ctx.moveTo(x-12,y-12);ctx.lineTo(x+12,y+12);ctx.moveTo(x+12,y-12);ctx.lineTo(x-12,y+12);}ctx.stroke();
 };
}
async function openDeliveryInspection() {
 if(deliverySaving || deliveryLoading)return;
 const jobId=document.getElementById('sa_report_id')?.value;
 if(!jobId){alert('กรุณาบันทึกใบงานหลักก่อนเปิดใบตรวจส่งมอบ');return;}
 const seq=++deliverySequence;deliveryLoading=true;deliveryLoadFailed=false;
 try {
  await loadDeliveryTemplate();
  const response=await fetch(API_BASE_URL+'/api/report/'+encodeURIComponent(jobId),{cache:'no-store'});
  if(!response.ok)throw Error('โหลดใบงานไม่สำเร็จ');const job=await response.json();
  if(seq!==deliverySequence)return;
  deliveryJobId=jobId;
  deliveryFields().forEach(el=>{if(el.type==='checkbox')el.checked=false;else el.value='';});clearDeliveryDiagram();
  const value=id=>document.getElementById(id)?.value;
  const pipeline=selector=>[...document.querySelectorAll(selector)].map(el=>el.value.trim()).filter(Boolean).join(', ');
  const fields={car_plate:value('car_plate')??job.car_plate,car_brand:value('car_brand')??job.car_brand,car_model:value('car_model')??job.car_model,vin_no:value('vin_no')??job.vin_no,car_color:value('car_color')??job.car_color,model_year:value('model_year')??job.model_year,delivery_date:(value('delivery_date')??job.delivery_date??'').slice(0,10),reference_no:[pipeline('.pipe-qt')||job.qt_no,pipeline('.pipe-so')||job.so_no].filter(Boolean).join(' / '),sa_name:job.sa_owner||''};
  deliveryFields().forEach(el=>{if(fields[el.dataset.delivery]!==undefined)el.value=fields[el.dataset.delivery]??'';});
  const branch=job.branch_name||sessionStorage.getItem('emp_branch')||'';
  const company=COMPANY_MASTERS[/รังสิต|rangsit|คลองหลวง/i.test(branch)?'raisen_rangsit':'raisen_navamin'];
  const companyBox=document.getElementById('deliveryCompany');companyBox.replaceChildren();
  [company.name,'เลขผู้เสียภาษี '+company.taxId,company.address,'โทรศัพท์ '+company.phone].forEach(text=>{const line=document.createElement('div');line.textContent=text;companyBox.append(line);});
  document.getElementById('deliveryInspectionModal').hidden=false;deliveryStatus('กำลังโหลดข้อมูลเดิม...');
  const saved=await fetch(API_BASE_URL+'/api/delivery-inspection/'+encodeURIComponent(jobId),{cache:'no-store'});
  if(seq!==deliverySequence)return;
  if(saved.status!==404){
   if(!saved.ok)throw Error('โหลดใบตรวจส่งมอบเดิมไม่สำเร็จ');const data=(await saved.json()).form_data;
   if(data?.fields)deliveryFields().forEach(el=>{const val=data.fields[el.dataset.delivery];if(val===undefined)return;if(el.type==='checkbox')el.checked=val===true;else el.value=val;});
   if(data?.diagram)await restoreDeliveryDiagram(data.diagram,seq);
  }
  deliveryStatus('พร้อมใช้งาน');
 }catch(error){deliveryLoadFailed=true;deliveryStatus(error.message);alert(error.message+' กรุณาลองเปิดใหม่ก่อนบันทึก');}
 finally{deliveryLoading=false;}
}
function deliveryStatus(text){const el=document.getElementById('deliveryStatus');if(el)el.textContent=text;}
function clearDeliveryDiagram(){const canvas=document.getElementById('deliveryCanvas');canvas?.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
async function restoreDeliveryDiagram(src,seq){
 await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{if(seq===deliverySequence){const c=document.getElementById('deliveryCanvas');c.getContext('2d').drawImage(image,0,0,c.width,c.height);}resolve();};image.onerror=()=>reject(Error('โหลดรอยแก้ไขไม่สำเร็จ'));image.src=src;});
}
async function saveDeliveryInspection(){
 if(deliveryLoading||deliverySaving||deliveryLoadFailed||!deliveryJobId)return;
 deliverySaving=true;const button=document.getElementById('deliverySave');button.disabled=true;deliveryStatus('กำลังบันทึก...');
 try{
  const fields={};deliveryFields().forEach(el=>fields[el.dataset.delivery]=el.type==='checkbox'?el.checked:el.value);
  const res=await fetch(API_BASE_URL+'/api/delivery-inspection/'+encodeURIComponent(deliveryJobId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({form_data:{version:1,fields,diagram:document.getElementById('deliveryCanvas').toDataURL('image/png')}})});
  if(!res.ok)throw Error('บันทึกไม่สำเร็จ');deliveryStatus('บันทึกแล้ว');
 }catch(error){deliveryStatus(error.message);alert(error.message);}finally{deliverySaving=false;button.disabled=false;}
}
function closeDeliveryInspection(){if(deliverySaving)return;deliverySequence++;document.getElementById('deliveryInspectionModal').hidden=true;document.body.classList.remove('printing-delivery');}
function printDeliveryInspection(){document.body.classList.add('printing-delivery');window.addEventListener('afterprint',()=>document.body.classList.remove('printing-delivery'),{once:true});window.print();}

window.addEventListener('beforeprint',()=>{
 document.querySelectorAll('#deliveryPrintArea input[type="date"]').forEach(input=>{
  if(input.nextElementSibling?.classList.contains('delivery-date-print'))input.nextElementSibling.textContent=input.value?input.value.split('-').reverse().join('/'):'....... / ....... / ........';
 });
});
