const QUOTA_LOCK=7252511;
const QUOTA_FIELDS=['branch_name','arrived_date','target_finish_date','delivery_date','main_part_qty','sub_part_qty'];
const SPECS=[
 {date:'arrived_date',key:'arrived',quota:'quota_arrived',label:'รถเข้าจอด (คัน)'},
 {date:'target_finish_date',key:'target',quota:'quota_target',label:'กำหนดซ่อมเสร็จ (คัน)'},
 {date:'delivery_date',key:'delivery',quota:'quota_delivery',label:'ส่งมอบรถ (คัน)'},
 {date:'target_finish_date',key:'main',quota:'quota_main_parts',qty:'main_part_qty',label:'ชิ้นงานหลัก'},
 {date:'target_finish_date',key:'sub',quota:'quota_sub_parts',qty:'sub_part_qty',label:'ชิ้นงานรอง'}
];
function quotaError(message,status=400){return Object.assign(new Error(message),{status});}
function day(value){
 if(value==null||value==='')return null;
 const text=value instanceof Date?value.toISOString():String(value);const result=text.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(new Date(result+'T00:00:00Z').getTime())||new Date(result+'T00:00:00Z').toISOString().slice(0,10)!==result)throw quotaError('วันที่จองไม่ถูกต้อง');
 return result;
}
function qty(value){if(value==null||value==='')return 0;const number=Number(value);if(!Number.isSafeInteger(number)||number<0)throw quotaError('จำนวนชิ้นงานต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');return number;}
function booking(row={}){return{branch_name:String(row.branch_name||'').trim()||'สำนักงานใหญ่',arrived_date:day(row.arrived_date),target_finish_date:day(row.target_finish_date),delivery_date:day(row.delivery_date),main_part_qty:qty(row.main_part_qty),sub_part_qty:qty(row.sub_part_qty)};}
function limitValue(special,base,field){
 const fields=['quota_arrived','quota_target','quota_delivery'].includes(field)?[field,'quota_cars']:[field];
 for(const key of fields){for(const row of [special,base])if(row&&row[key]!==undefined&&row[key]!==null&&row[key]!=='')return parseInt(row[key],10)||0;}
 return 0;
}
function increases(previous,next){
 const before=previous?booking(previous):null,after=booking(next);
 return SPECS.filter(spec=>after[spec.date]&&(spec.qty?after[spec.qty]:1)>0).filter(spec=>{
  const same=before&&before.branch_name===after.branch_name&&before[spec.date]===after[spec.date];
  return !same||(spec.qty&&after[spec.qty]>before[spec.qty]);
 });
}
async function lockQuota(client){await client.query('SELECT pg_advisory_xact_lock($1)',[QUOTA_LOCK]);}
async function loadBooking(client,id){
 const result=await client.query('SELECT id,branch_name,arrived_date::date::text AS arrived_date,target_finish_date::date::text AS target_finish_date,delivery_date::date::text AS delivery_date,main_part_qty,sub_part_qty FROM rizenicreport WHERE id=$1 FOR UPDATE',[id]);
 if(!result.rows.length)throw quotaError('ไม่พบใบงาน',404);return result.rows[0];
}
async function validateQuota(client,previous,next,excludeId=null){
 const after=booking(next),changed=increases(previous,after);if(!changed.length)return;
 const quotas=(await client.query('SELECT * FROM rizenic_quotas WHERE branch_name=$1 ORDER BY id DESC',[after.branch_name])).rows;
 const base=quotas.find(q=>q.quota_type==='default');const usage=new Map();
 for(const spec of changed){
  const date=after[spec.date],special=quotas.find(q=>q.quota_type==='special'&&day(q.quota_date)===date),max=limitValue(special,base,spec.quota);if(max<=0)continue;
  if(!usage.has(date)){
   const result=await client.query(`SELECT COUNT(*) FILTER(WHERE arrived_date::date=$2::date)::int AS arrived,
    COUNT(*) FILTER(WHERE target_finish_date::date=$2::date)::int AS target,COUNT(*) FILTER(WHERE delivery_date::date=$2::date)::int AS delivery,
    COALESCE(SUM(main_part_qty) FILTER(WHERE target_finish_date::date=$2::date),0) AS main,
    COALESCE(SUM(sub_part_qty) FILTER(WHERE target_finish_date::date=$2::date),0) AS sub
    FROM rizenicreport WHERE branch_name=$1 AND ($3::bigint IS NULL OR id<>$3::bigint)`,[after.branch_name,date,excludeId]);usage.set(date,result.rows[0]);
  }
  const used=Number(usage.get(date)[spec.key])||0,requested=spec.qty?after[spec.qty]:1;
  if(used+requested>max)throw quotaError(`โควต้า${spec.label} วันที่ ${date} เต็มแล้ว (ใช้แล้ว ${used} / เพดาน ${max}, ใบงานนี้ ${requested})`,409);
 }
}
async function quotaTransaction(pool,callback){
 const client=await pool.connect();try{await client.query('BEGIN');await lockQuota(client);const result=await callback(client);await client.query('COMMIT');return result;}
 catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
}
async function withBooking(pool,id,proposed,write){return quotaTransaction(pool,async client=>{const previous=id?await loadBooking(client,id):null;const next=booking(typeof proposed==='function'?proposed(previous):proposed);await validateQuota(client,previous,next,id);return write(client,next,previous);});}
module.exports={quotaError,QUOTA_FIELDS,SPECS,booking,increases,limitValue,lockQuota,loadBooking,validateQuota,quotaTransaction,withBooking};
