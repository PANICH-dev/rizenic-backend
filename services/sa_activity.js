const METRICS=['received','insurance','arrival','completed','delivery'];
const DELIVERED=new Set(['12.ส่งมอบ','12.ส่งมอบแล้ว','13.วางบิลประกัน','14.ชำระเงินสด','15.วางบิล Tesla','16.วางบิล EV ME','17.รอออกบิล','19.ออกบิลแล้ว']);
function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function bangkokDay(now=new Date()){return new Date(now.getTime()+7*3600000).toISOString().slice(0,10);}
function dateOnly(value){if(!value)return null;const day=value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);return validDay(day)?day:null;}
function eventDay(value){if(!value)return null;const d=new Date(value);return Number.isFinite(d.getTime())?bangkokDay(d):null;}
const normalize=value=>String(value||'').toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');
const owner=job=>String(job?.sa_owner||'').trim()||'ไม่ระบุ SA';
const waiting=job=>/^0?2\s*\./.test(String(job.job_status||'').trim())||String(job.job_status||'').trim()==='รอเสนอประกัน';
const cancelled=job=>/^18\s*\./.test(String(job.job_status||'').trim());
function groupVehicleVisits(jobs){
 const aliases=new Map(),visits=new Map();
 const vinOf=job=>{const vin=normalize(job.vin_no);return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)?vin:'';};
 for(const job of jobs){const vin=vinOf(job),plate=normalize(job.car_plate);if(vin&&plate){if(!aliases.has(plate))aliases.set(plate,new Set());aliases.get(plate).add(vin);}}
 const vehicle=job=>{const plate=normalize(job.car_plate),vins=aliases.get(plate);return vinOf(job)||(vins?.size===1?[...vins][0]:plate)||'JOB:'+job.id;};
 const visitsByArrival=new Map();
 for(const job of jobs){const visit=normalize(job.service_visit_no),day=dateOnly(job.arrived_date);if(visit&&day){const key=JSON.stringify([vehicle(job),day]);if(!visitsByArrival.has(key))visitsByArrival.set(key,new Set());visitsByArrival.get(key).add(visit);}}
 for(const job of jobs){
  const car=vehicle(job),arrival=dateOnly(job.arrived_date),known=visitsByArrival.get(JSON.stringify([car,arrival]));
  const visit=normalize(job.service_visit_no)||(known?.size===1?[...known][0]:'');
  const round=visit?'VISIT:'+visit:arrival?'ARRIVAL:'+arrival:dateOnly(job.contact_date)?'CONTACT:'+dateOnly(job.contact_date):'JOB:'+job.id;
  const key=JSON.stringify([car,round]);if(!visits.has(key))visits.set(key,[]);visits.get(key).push(job);
 }
 return [...visits.values()];
}
function personHasData(p){return p.pending>0||p.insurance.today>0||METRICS.filter(k=>k!=='insurance').some(k=>p[k].today>0||p[k].month>0)||p.on_time>0||p.late>0||p.unknown_target>0||p.overdue>0;}
function buildVehicleReport(jobs,date,branch){
 const monthStart=date.slice(0,7)+'-01',people=new Map(),pending=[];
 const person=name=>{name=String(name||'').trim()||'ไม่ระบุ SA';if(!people.has(name))people.set(name,{sa:name,...Object.fromEntries(METRICS.map(key=>[key,{today:0,month:0}])),pending:0,on_time:0,late:0,unknown_target:0,overdue:0,sources:[]});return people.get(name);};
 function add(name,kind,day){if(!day||day<monthStart||day>date)return null;const p=person(name);p[kind].month++;if(day===date)p[kind].today++;return p;}
 const active=jobs.filter(job=>!cancelled(job));
 for(const job of jobs){
  const p=add(owner(job),'received',dateOnly(job.contact_date));
  if(p){const name=String(job.customer_source||'').trim()||'ไม่ระบุ';let source=p.sources.find(x=>x.name===name);if(!source){source={name,today:0,month:0};p.sources.push(source);}source.month++;if(dateOnly(job.contact_date)===date)source.today++;}
  const finish=dateOnly(job.repair_finish_date),target=dateOnly(job.target_finish_date),completed=add(owner(job),'completed',finish);
  if(completed){if(!target)completed.unknown_target++;else if(finish<=target)completed.on_time++;else completed.late++;}
  if(target&&target<date&&(!finish||finish>date)&&!DELIVERED.has(String(job.job_status||'').trim())&&String(job.job_status||'').trim()!=='22.ปิดงาน'&&!cancelled(job))person(owner(job)).overdue++;
 }
 for(const group of groupVehicleVisits(active)){
  const confirmed=group.filter(job=>!!eventDay(job.insurance_checkin_at));
  if(confirmed.length===group.length){
   const latest=[...confirmed].sort((a,b)=>new Date(b.insurance_checkin_recorded_at||b.insurance_checkin_at)-new Date(a.insurance_checkin_recorded_at||a.insurance_checkin_at)||Number(b.id)-Number(a.id))[0];
   const completionDay=confirmed.map(job=>eventDay(job.insurance_checkin_at)).sort().at(-1);
   add(latest.insurance_checkin_sa||owner(latest),'insurance',completionDay);
  }else{
   const awaiting=group.filter(waiting);
   if(awaiting.length){
    const representative=[...awaiting].sort((a,b)=>Number(a.id)-Number(b.id))[0],sa=owner(representative);person(sa).pending++;
    pending.push({sa,plate:representative.car_plate||'',vin:representative.vin_no||'',service_visit_no:representative.service_visit_no||'',claims:[...new Set(group.flatMap(j=>String(j.claim_no||'').split(',').map(x=>x.trim()).filter(Boolean)))].join(', '),job_ids:group.map(j=>j.id),total_jobs:group.length,confirmed_jobs:confirmed.length});
   }
  }
  const parked=group.filter(job=>String(job.is_parked||'').trim()==='จอดซ่อม'&&dateOnly(job.arrived_date)).sort((a,b)=>dateOnly(a.arrived_date).localeCompare(dateOnly(b.arrived_date))||Number(a.id)-Number(b.id));
  if(parked.length)add(owner(parked[0]),'arrival',dateOnly(parked[0].arrived_date));
  const delivered=group.filter(job=>DELIVERED.has(String(job.job_status||'').trim())&&dateOnly(job.delivery_date)).sort((a,b)=>dateOnly(a.delivery_date).localeCompare(dateOnly(b.delivery_date))||Number(a.id)-Number(b.id));
  if(delivered.length)add(owner(delivered[0]),'delivery',dateOnly(delivered[0].delivery_date));
 }
 const report={date,month_start:monthStart,branch,people:[...people.values()].filter(personHasData).sort((a,b)=>a.sa.localeCompare(b.sa,'th')),pending};
 return {...report,message:formatSAReport(report)};
}
function formatSAReport(report){
 const lines=['📊 ผลงาน SA — '+(report.branch==='Navamin'?'นวมินทร์':'รังสิต'),'วันที่ '+report.date,'ยอดค้าง: สถานะปัจจุบันทั้งหมด | ตัวเลขคู่: วันนี้ / สะสมเดือน',''];
 const visible=report.people.filter(personHasData);if(!visible.length)lines.push('ไม่มีผลงานหรือรายการค้าง');
 const labels={received:'รับลูกค้า (ใบงาน)',arrival:'รถเข้าจอด',completed:'ซ่อมเสร็จ (ใบงาน)',delivery:'ส่งมอบรถ'};
 for(const p of visible){lines.push('👤 '+p.sa);if(p.pending)lines.push('รอเสนอประกันค้าง: '+p.pending+' คัน');if(p.insurance.today)lines.push('เสนอวันนี้: '+p.insurance.today+' คัน');
  for(const key of Object.keys(labels))if(p[key].today||p[key].month)lines.push(labels[key]+': '+p[key].today+' / '+p[key].month);
  for(const source of p.sources)if(source.today||source.month)lines.push('  '+source.name+': '+source.today+' / '+source.month);
  const quality=[];if(p.on_time)quality.push('ตรงกำหนด '+p.on_time);if(p.late)quality.push('ล่าช้า '+p.late);if(p.unknown_target)quality.push('ไม่มีกำหนด '+p.unknown_target);if(quality.length)lines.push('งานซ่อมเดือนนี้: '+quality.join(' | '));
  if(p.overdue)lines.push('เกินกำหนดและยังไม่เสร็จ: '+p.overdue);lines.push('');
 }
 return lines.join('\n').trim();
}
// Narrow server-side projection: no photos, checklist JSON or customer contact details.
const REPORT_SQL=`WITH jobs AS (
 SELECT id,sa_owner,car_plate,vin_no,service_visit_no,claim_no,customer_source,contact_date::date::text AS contact_date,arrived_date::date::text AS arrived_date,is_parked,insurance_checkin_at,insurance_checkin_recorded_at,insurance_checkin_sa,repair_finish_date::date::text AS repair_finish_date,target_finish_date::date::text AS target_finish_date,delivery_date::date::text AS delivery_date,job_status
 FROM rizenicreport WHERE CASE WHEN branch_name ~* '(รังสิต|rangsit|คลองหลวง)' THEN 'Rangsit' WHEN branch_name ~* '(นวมินทร์|navamin|nawamin)' THEN 'Navamin' ELSE branch_name END=$2
) SELECT * FROM jobs WHERE $1::date IS NOT NULL`;
async function getSAReport(pool,date,branch){const result=await pool.query(REPORT_SQL,[date,branch]);return buildVehicleReport(result.rows,date,branch);}
module.exports={validDay,bangkokDay,buildVehicleReport,groupVehicleVisits,formatSAReport,getSAReport,REPORT_SQL,DELIVERED};
