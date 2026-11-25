const METRICS = ['received','insurance','arrival','completed','delivery'];
function validDay(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function bangkokDay(now=new Date()){return new Date(now.getTime()+7*3600000).toISOString().slice(0,10);}
function reportFromRows(rows,date,branch){
 const people=new Map();
 for(const row of rows){
  const name=row.sa||'ไม่ระบุ SA';
  if(!people.has(name))people.set(name,{sa:name,...Object.fromEntries(METRICS.map(key=>[key,{today:0,month:0}])),on_time:0,late:0,unknown_target:0,overdue:0,sources:[]});
  const person=people.get(name),today=Number(row.today)||0,month=Number(row.month)||0;
  if(row.kind==='overdue'){person.overdue=month;continue;}
  if(!METRICS.includes(row.kind))continue;
  person[row.kind].today+=today;person[row.kind].month+=month;
  if(row.kind==='received')person.sources.push({name:row.source||'ไม่ระบุ',today,month});
  if(row.kind==='completed'){person.on_time+=Number(row.on_time)||0;person.late+=Number(row.late)||0;person.unknown_target+=Number(row.unknown_target)||0;}
 }
 return {date,month_start:date.slice(0,7)+'-01',branch,people:[...people.values()].sort((a,b)=>a.sa.localeCompare(b.sa,'th'))};
}
function formatSAReport(report){
 const labels={received:'รับลูกค้า',insurance:'เสนอประกัน',arrival:'รถเข้าจอดจริง',completed:'ซ่อมเสร็จ',delivery:'ส่งมอบจริง'};
 const lines=['📊 ผลงาน SA — '+(report.branch==='Navamin'?'นวมินทร์':'รังสิต'),'วันที่ '+report.date,'ตัวเลข: วันนี้ / สะสมเดือนถึงวันที่รายงาน',''];
 if(!report.people.length)lines.push('ไม่มีผลงานในช่วงนี้');
 for(const person of report.people){
  lines.push('👤 '+person.sa);
  for(const key of METRICS)lines.push(labels[key]+': '+person[key].today+' / '+person[key].month);
  for(const source of person.sources)lines.push('  '+source.name+': '+source.today+' / '+source.month);
  lines.push('ซ่อมตรงกำหนดเดือนนี้: '+person.on_time+' | ล่าช้า: '+person.late+' | ไม่มีกำหนด: '+person.unknown_target);
  lines.push('เกินกำหนดและยังไม่เสร็จ: '+person.overdue,'');
 }
 return lines.join('\n').trim();
}
// Aggregate counts inside PostgreSQL; do not return customer details to the dashboard report.
const REPORT_SQL = `WITH jobs AS (
 SELECT sa_owner,customer_source,contact_date,insurance_checkin_at,insurance_checkin_sa,arrival_checkin_at,arrival_checkin_sa,repair_finish_date,target_finish_date,delivery_checkin_at,delivery_checkin_sa,job_status FROM rizenicreport WHERE CASE
 WHEN branch_name ~* '(รังสิต|rangsit|คลองหลวง)' THEN 'Rangsit'
 WHEN branch_name ~* '(นวมินทร์|navamin|nawamin)' THEN 'Navamin' ELSE branch_name END=$2
), events AS (
 SELECT COALESCE(NULLIF(btrim(sa_owner),''),'ไม่ระบุ SA') sa,'received' kind,COALESCE(NULLIF(btrim(customer_source),''),'ไม่ระบุ') source,contact_date::date event_day,NULL::date target_day FROM jobs
 UNION ALL SELECT COALESCE(NULLIF(btrim(insurance_checkin_sa),''),NULLIF(btrim(sa_owner),''),'ไม่ระบุ SA'),'insurance','',(insurance_checkin_at AT TIME ZONE 'Asia/Bangkok')::date,NULL::date FROM jobs
 UNION ALL SELECT COALESCE(NULLIF(btrim(arrival_checkin_sa),''),NULLIF(btrim(sa_owner),''),'ไม่ระบุ SA'),'arrival','',(arrival_checkin_at AT TIME ZONE 'Asia/Bangkok')::date,NULL::date FROM jobs
 UNION ALL SELECT COALESCE(NULLIF(btrim(sa_owner),''),'ไม่ระบุ SA'),'completed','',repair_finish_date::date,target_finish_date::date FROM jobs
 UNION ALL SELECT COALESCE(NULLIF(btrim(delivery_checkin_sa),''),NULLIF(btrim(sa_owner),''),'ไม่ระบุ SA'),'delivery','',(delivery_checkin_at AT TIME ZONE 'Asia/Bangkok')::date,NULL::date FROM jobs
)
SELECT sa,kind,source,COUNT(*) FILTER(WHERE event_day=$1::date)::int today,COUNT(*)::int AS month,
 COUNT(*) FILTER(WHERE kind='completed' AND event_day<=target_day)::int on_time,
 COUNT(*) FILTER(WHERE kind='completed' AND event_day>target_day)::int late,
 COUNT(*) FILTER(WHERE kind='completed' AND target_day IS NULL)::int unknown_target
FROM events WHERE event_day BETWEEN date_trunc('month',$1::date)::date AND $1::date GROUP BY sa,kind,source
UNION ALL
SELECT COALESCE(NULLIF(btrim(sa_owner),''),'ไม่ระบุ SA'),'overdue','',0,COUNT(*)::int,0,0,0 FROM jobs
WHERE target_finish_date::date<$1::date AND (repair_finish_date IS NULL OR repair_finish_date::date>$1::date)
AND COALESCE(job_status,'') NOT IN ('12.ส่งมอบ','12.ส่งมอบแล้ว','18.ลูกค้ายกเลิก','22.ปิดงาน') GROUP BY sa_owner
UNION ALL
SELECT DISTINCT employee_name,'seed','',0,0,0,0,0 FROM rizenicemployeemaster
WHERE employee_role ILIKE '%SA%' AND NULLIF(btrim(employee_name),'') IS NOT NULL
AND CASE WHEN branch_name ~* '(รังสิต|rangsit|คลองหลวง)' THEN 'Rangsit' WHEN branch_name ~* '(นวมินทร์|navamin|nawamin)' THEN 'Navamin' ELSE branch_name END=$2`;
async function getSAReport(pool,date,branch){const result=await pool.query(REPORT_SQL,[date,branch]);const report=reportFromRows(result.rows,date,branch);return {...report,message:formatSAReport(report)};}
module.exports={validDay,bangkokDay,reportFromRows,formatSAReport,getSAReport,REPORT_SQL};
