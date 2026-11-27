// Project only allowed table fields that exist in this deployment's schema.
// Cache schema metadata, never job records, so refreshes always read current jobs.
const schemas=new WeakMap();
const EXCLUDED_STATUSES=['13.วางบิลประกัน','14.ชำระเงินสด','15.วางบิล Tesla','16.วางบิล EV ME','17.รอออกบิล','18.ลูกค้ายกเลิก','19.ออกบิลแล้ว','20.จอดซ่อม TC','21.พักซ่อม'];
async function tableColumns(pool,keys){
 let cached=schemas.get(pool);if(!cached||cached.expires<=Date.now()){const promise=pool.query("SELECT attname FROM pg_attribute WHERE attrelid='public.rizenicreport'::regclass AND attnum>0 AND NOT attisdropped").then(result=>new Set(result.rows.map(row=>row.attname)));cached={promise,expires:Date.now()+300000};schemas.set(pool,cached);promise.catch(()=>{if(schemas.get(pool)===cached)schemas.delete(pool);});}
 const available=await cached.promise;const selected=[...new Set(keys)].filter(key=>/^[a-z_][a-z_0-9]*$/.test(key)&&available.has(key));if(!selected.includes('id'))throw Error('โครงสร้างตารางใบงานไม่พร้อม');return{columns:selected.map(key=>'"'+key+'"').join(','),available};
}
function inProcessCondition(params,hasBillingDate){
 params.push(EXCLUDED_STATUSES.map(value=>value.slice(0,2)));const prefixes='$'+params.length+'::text[]';params.push(EXCLUDED_STATUSES.map(value=>'%'+value+'%'));const names='$'+params.length+'::text[]';return "NOT (left(COALESCE(job_status,''),2)=ANY("+prefixes+") OR COALESCE(job_status,'') LIKE ANY("+names+")) AND COALESCE(department_routing,'')<>'บัญชี'"+(hasBillingDate?" AND NULLIF(billing_date::text,'') IS NULL":"");
}
module.exports={tableColumns,inProcessCondition};
