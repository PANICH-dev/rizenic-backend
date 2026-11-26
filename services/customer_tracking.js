const ARRIVED=new Set([9,10,11,12,13,14,15,16,17,19]);
const DELIVERED=new Set([12,13,14,15,16,17,19]);
const PHASES=['preparing','arrived','repair','qc','ready','delivered'];
const truth=value=>value===true||value===1||String(value).toLowerCase()==='true'||value==='1';
function normalizePlate(value){return String(value||'').replace(/[^a-zA-Z0-9ก-ฮ]/g,'').toUpperCase();}
function normalizePhone(value){let n=String(value||'').replace(/\D/g,'');if(n.startsWith('66')&&[10,11].includes(n.length))n='0'+n.slice(2);else if(n.length===9&&/^[689]/.test(n))n='0'+n;return n;}
function state(job){
 const code=Number(String(job.job_status||'').match(/^\s*(\d+)/)?.[1]);
 if(code===18)return{phase:'cancelled',label:'ยกเลิกรอบบริการ',detail:'กรุณาติดต่อผู้ดูแลหากต้องการนัดหมายใหม่'};
 if(DELIVERED.has(code)||job.delivery_checkin_at)return{phase:'delivered',label:'ส่งมอบรถแล้ว',detail:'ขอบคุณที่ไว้วางใจ RIZENIC'};
 if(code===22)return{phase:'closed',label:'ปิดรอบบริการแล้ว',detail:'ติดต่อผู้ดูแลเมื่อต้องการสอบถามรายละเอียดรอบบริการนี้'};
 if(code===21)return{phase:'paused',label:'พักงานซ่อม',detail:'ผู้ดูแลพร้อมให้ข้อมูลเกี่ยวกับขั้นตอนถัดไป'};
 if(code===11||truth(job.station_ready))return{phase:'ready',label:'พร้อมนัดรับรถ',detail:'กรุณายืนยันวันและเวลารับรถกับผู้ดูแลก่อนเดินทาง'};
 if(truth(job.station_qc)||job.repair_finish_date)return{phase:'qc',label:'ตรวจสอบคุณภาพงานซ่อม',detail:'อยู่ระหว่างตรวจสอบความเรียบร้อยก่อนส่งมอบ'};
 if(code===10||code===23){const stations=[['station_prak','ประกอบชิ้นส่วน'],['station_pon','พ่นสีและเคลือบเงา'],['station_puan','เตรียมพื้นผิว'],['station_pou','แต่งผิวตัวถัง'],['station_kho','ซ่อมตัวถัง']];const current=stations.find(([key])=>truth(job[key]));return{phase:'repair',label:'กำลังซ่อม'+(current?' · '+current[1]:''),detail:'ทีมช่างกำลังดำเนินงานตามรายการซ่อม'};}
 if(code===9||job.arrival_checkin_at)return{phase:'arrived',label:'รับรถเข้าอู่แล้ว',detail:'กำลังเตรียมรถและจัดลำดับงานก่อนเริ่มซ่อม'};
 const labels={1:['รับเรื่องแล้ว','ผู้ดูแลกำลังตรวจสอบข้อมูลการรับบริการ'],2:['เตรียมเสนอประกัน','อยู่ระหว่างจัดเตรียมข้อมูลการซ่อม'],3:['รอประกันอนุมัติ','ผู้ดูแลกำลังติดตามผลอนุมัติ'],4:['รอยืนยันรายการซ่อม','กรุณาติดต่อผู้ดูแลเพื่อยืนยันรายละเอียด'],5:['อนุมัติรายการซ่อมแล้ว','กำลังเตรียมขั้นตอนเข้ารับบริการ'],6:['เตรียมอะไหล่','กำลังดำเนินการจัดหาอะไหล่สำหรับงานซ่อม'],7:['เตรียมนัดหมายเข้าซ่อม','ผู้ดูแลจะยืนยันวันและเวลานัดหมาย'],8:['นัดหมายเข้าซ่อมแล้ว','กรุณายืนยันเวลานำรถเข้ารับบริการกับผู้ดูแล']};
 const label=labels[code]||['กำลังตรวจสอบข้อมูล','กรุณาติดต่อผู้ดูแลเพื่อสอบถามความคืบหน้า'];return{phase:'preparing',label:label[0],detail:label[1]};
}
function company(branch){const name=String(branch||'').trim();if(/รังสิต|rangsit/i.test(name))return{name:'บริษัท ไรเซน เอนเนอร์จี จำกัด (สาขารังสิต)',branch:'รังสิต',phone:'090-956-1115',address:'47/1 ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12110'};if(/นวมินทร์|navamin|สำนักงานใหญ่/i.test(name))return{name:'บริษัท ไรเซน เอนเนอร์จี จำกัด',branch:'นวมินทร์',phone:'098-151-5155',address:'50/5-6 ซอยนวมินทร์ 151 แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพมหานคร 10230'};return{name:'RIZENIC',branch:name||'ศูนย์บริการ',phone:null,address:null};}
const day=value=>value?String(value instanceof Date?value.toISOString():value).slice(0,10):null;
function buildTracking(rows,employees=[]){
 const people=new Map(employees.map(e=>[String(e.employee_id),e.employee_name]));const groups=new Map();
 for(const job of rows){const identity=String(job.vin_no||normalizePlate(job.car_plate)).trim().toUpperCase(),visit=String(job.service_visit_no||'').trim().toUpperCase(),date=day(job.arrived_date)||day(job.appointment_date)||day(job.contact_date);const key=identity+'|'+String(job.branch_name||'').trim()+'|'+(visit?'visit:'+visit:date?'date:'+date:'job:'+job.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(job);}
 return [...groups.values()].map(jobs=>{
  jobs.sort((a,b)=>Number(b.id)-Number(a.id));const latest=jobs[0],active=jobs.filter(j=>state(j).phase!=='cancelled');const states=(active.length?active:jobs).map(state);
  const unfinished=states.filter(s=>!['closed','delivered','cancelled'].includes(s.phase));let current=states.find(s=>s.phase==='paused');if(!current&&unfinished.length)current=unfinished.reduce((slowest,s)=>PHASES.indexOf(s.phase)<PHASES.indexOf(slowest.phase)?s:slowest,unfinished[0]);if(!current)current=states.find(s=>s.phase==='closed')||states[0];
  const effective=active.length?active:jobs;const dates=(key,which='max')=>{const values=effective.map(j=>day(j[key])).filter(Boolean).sort();return values.length?(which==='min'?values[0]:values.at(-1)):null;};
  const arrived=effective.filter(j=>j.arrival_checkin_at||ARRIVED.has(Number(String(j.job_status||'').match(/^\s*(\d+)/)?.[1])));
  const actualArrival=arrived.map(j=>day(j.arrival_checkin_at)||day(j.arrived_date)).filter(Boolean).sort()[0]||null;
  const primary=[...new Set(effective.map(j=>people.get(String(j.sa_owner_employee_id))||String(j.sa_owner||'').trim()).filter(Boolean))];
  const collaborators=[...new Set(effective.flatMap(j=>(j.sa_collaborator_employee_ids||[]).map(id=>people.get(String(id)))).filter(n=>n&&!primary.includes(n)))];
  const delivered=current.phase==='delivered';const actualDelivery=delivered?dates('delivery_checkin_at'):null;
  return{id:String(latest.id),jobCount:jobs.length,plate:latest.car_plate||'',brand:latest.car_brand||'',model:latest.car_model||'',vinSuffix:String(latest.vin_no||'').slice(-6),company:company(latest.branch_name),primary,collaborators,phase:current.phase,status:current.label,next:current.detail,arrivalActual:actualArrival,arrivalAppointment:dates('appointment_date','min')||(!actualArrival?dates('arrived_date','min'):null),repairTarget:dates('target_finish_date'),deliveryAppointment:dates('delivery_date'),deliveryActual:actualDelivery,contactDate:dates('contact_date','min'),jobs:jobs.map(j=>({id:String(j.id),status:state(j).label,phase:state(j).phase}))};
 }).sort((a,b)=>Number(b.id)-Number(a.id));
}
module.exports={normalizePlate,normalizePhone,state,buildTracking};
