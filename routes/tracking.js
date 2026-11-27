const crypto=require('crypto');
const {hash,authenticateEmployee}=require('../services/tracking_sessions');
const TRACKING_FIELDS=`id,car_plate,car_brand,car_model,vin_no,branch_name,sa_owner,sa_owner_employee_id,sa_collaborator_employee_ids,service_visit_no,job_status,
 contact_date::date::text AS contact_date,appointment_date::date::text AS appointment_date,arrived_date::date::text AS arrived_date,target_finish_date::date::text AS target_finish_date,repair_finish_date::date::text AS repair_finish_date,delivery_date::date::text AS delivery_date,arrival_checkin_at,delivery_checkin_at,station_kho,station_pou,station_puan,station_pon,station_prak,station_kat,station_qc,station_ready,station_mag,station_kraj,station_film,station_pak`;
const express=require('express'),pool=require('../config/db');
const {normalizePlate,normalizePhone,buildTracking}=require('../services/customer_tracking');const router=express.Router();
// Best-effort burst protection per running instance; it is not a distributed rate limit.
const buckets=new Map();
router.post('/tracking/lookup',async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('Pragma','no-cache');
 const plate=typeof req.body?.plate==='string'&&req.body.plate.length<=100?normalizePlate(req.body.plate):'',phone=typeof req.body?.phone==='string'&&req.body.phone.length<=100?normalizePhone(req.body.phone):'';
 if(!plate||plate.length>30||phone.length<9||phone.length>15)return res.status(400).json({error:'กรุณากรอกทะเบียนรถและเบอร์โทรศัพท์เต็มให้ถูกต้อง'});
 const ip=req.ip||'unknown',now=Date.now(),bucket=buckets.get(ip);if(bucket&&bucket.until>now&&bucket.count>=60)return res.status(429).set('Retry-After','60').json({error:'มีการตรวจสอบหลายครั้ง กรุณารอสักครู่แล้วลองใหม่'});if(!bucket||bucket.until<=now)buckets.set(ip,{count:1,until:now+60000});else bucket.count++;if(buckets.size>10000)for(const [key,value]of buckets)if(value.until<=now)buckets.delete(key);
 try{
 const result=await pool.query(`SELECT ${TRACKING_FIELDS}
 FROM public.rizenicreport r WHERE upper(regexp_replace(coalesce(r.car_plate,''),'[^a-zA-Z0-9ก-ฮ]','','g'))=$1 AND EXISTS(
 SELECT 1 FROM unnest(ARRAY[r.phone_number::text,CASE WHEN NULLIF(btrim(r.phone_number::text),'') IS NULL THEN to_jsonb(r)->>'customer_phone' ELSE NULL END]) AS phones(raw_phone)
 CROSS JOIN LATERAL regexp_split_to_table(coalesce(raw_phone,''),'[,;/[:cntrl:]]+') AS numbers(raw_number)
 CROSS JOIN LATERAL (SELECT regexp_replace(raw_number,'[^0-9]','','g') AS digits) AS cleaned
 WHERE CASE WHEN digits LIKE '66%' AND length(digits) IN (10,11) THEN '0'||substring(digits FROM 3)
 WHEN length(digits)=9 AND digits ~ '^[689]' THEN '0'||digits ELSE digits END=$2)
 ORDER BY id DESC`,[plate,phone]);
 if(!result.rows.length)return res.status(404).json({error:'ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบทะเบียนและเบอร์โทร หรือติดต่อศูนย์บริการ'});
 const ids=[...new Set(result.rows.flatMap(j=>[j.sa_owner_employee_id,...(j.sa_collaborator_employee_ids||[])]).filter(v=>v!=null).map(String))];
 const employees=ids.length?(await pool.query('SELECT employee_id::text AS employee_id,employee_name FROM public.rizenicemployeemaster WHERE employee_id::text=ANY($1::text[])',[ids])).rows:[];
 res.json({visits:buildTracking(result.rows,employees),checkedAt:new Date().toISOString()});
 }catch(error){console.error('Tracking lookup failed:',error.code||'unexpected');res.status(500).json({error:'ขณะนี้ตรวจสอบข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง'});}
});async function publicVisits(rows){const ids=[...new Set(rows.flatMap(j=>[j.sa_owner_employee_id,...(j.sa_collaborator_employee_ids||[])]).filter(v=>v!=null).map(String))];const employees=ids.length?(await pool.query('SELECT employee_id::text AS employee_id,employee_name FROM public.rizenicemployeemaster WHERE employee_id::text=ANY($1::text[])',[ids])).rows:[];return buildTracking(rows,employees);}
function branchKey(value){const name=String(value||'').trim().toLowerCase();if(/นวมินทร์|navamin|สำนักงานใหญ่/.test(name))return 'navamin';if(/รังสิต|rangsit/.test(name))return 'rangsit';return name;}
router.post('/report/:id/tracking-links',async(req,res)=>{
 res.set('Cache-Control','no-store');try{
 if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'เลขใบงานไม่ถูกต้อง'});
 const employee=await authenticateEmployee(pool,req.get('Authorization'));if(!employee)return res.status(401).json({error:'กรุณาเข้าสู่ระบบพนักงานใหม่เพื่อสร้างลิงก์ติดตาม'});
 const anchor=(await pool.query('SELECT '+TRACKING_FIELDS+' FROM public.rizenicreport WHERE id=$1',[req.params.id])).rows[0];if(!anchor)return res.status(404).json({error:'ไม่พบใบงาน'});
 const manager=/(^|[^a-z])(manager|admin|ba)([^a-z]|$)/i.test(employee.employee_role||'')||String(employee.employee_role||'').includes('แอดมิน');
 if(!manager&&branchKey(employee.branch_name)!==branchKey(anchor.branch_name))return res.status(403).json({error:'สร้างลิงก์ได้เฉพาะใบงานในสาขาที่รับผิดชอบ'});
 const vin=String(anchor.vin_no||'').trim().toUpperCase();if(!vin&&!normalizePlate(anchor.car_plate))return res.status(400).json({error:'กรุณาบันทึกทะเบียนรถหรือ VIN ก่อนสร้างลิงก์'});
 const candidates=(await pool.query('SELECT '+TRACKING_FIELDS+" FROM public.rizenicreport WHERE branch_name IS NOT DISTINCT FROM $1 AND (($2<>'' AND upper(btrim(vin_no))=$2) OR ($2='' AND upper(regexp_replace(coalesce(car_plate,''),'[^a-zA-Z0-9ก-ฮ]','','g'))=$3)) ORDER BY id DESC",[anchor.branch_name,vin,normalizePlate(anchor.car_plate)])).rows;
 const visits=buildTracking(candidates),visit=visits.find(v=>v.jobs.some(j=>j.id===String(anchor.id)));if(!visit)return res.status(409).json({error:'ข้อมูลรอบบริการเปลี่ยน กรุณาเปิดใบงานใหม่'});
 const token=crypto.randomBytes(32).toString('base64url');const created=(await pool.query("INSERT INTO public.customer_tracking_links(token_hash,anchor_job_id,job_ids,created_by) VALUES($1,$2,$3::bigint[],$4) RETURNING expires_at",[hash(token),anchor.id,visit.jobs.map(j=>j.id),employee.employee_id])).rows[0];
 res.status(201).json({path:'/tracking.html?t='+token,expiresAt:created.expires_at});
 }catch(error){console.error('Tracking link create failed:',error.code||'unexpected');res.status(500).json({error:error.code==='42P01'?'กรุณารัน migrations/20261126_customer_tracking.sql ใน Neon ก่อนใช้งาน':'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่'});}
});
router.get('/tracking/shared/:token',async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('Pragma','no-cache');const token=req.params.token;if(!/^[A-Za-z0-9_-]{43}$/.test(token))return res.status(404).json({error:'ไม่พบลิงก์ติดตามนี้ กรุณาติดต่อศูนย์บริการ'});
 try{const link=(await pool.query('SELECT job_ids,expires_at,revoked_at,expires_at<=CURRENT_TIMESTAMP AS expired FROM public.customer_tracking_links WHERE token_hash=$1',[hash(token)])).rows[0];if(!link)return res.status(404).json({error:'ไม่พบลิงก์ติดตามนี้ กรุณาติดต่อศูนย์บริการ'});
 if(link.expired||link.revoked_at)return res.status(410).json({code:'TRACKING_LINK_EXPIRED',error:'ลิงก์ติดตามงานนี้หมดอายุแล้ว กรุณาติดต่อศูนย์บริการเพื่อขอลิงก์ใหม่'});
 const rows=(await pool.query('SELECT '+TRACKING_FIELDS+' FROM public.rizenicreport WHERE id=ANY($1::bigint[]) ORDER BY id DESC',[link.job_ids])).rows;if(!rows.length)return res.status(404).json({error:'ไม่มีข้อมูลรอบบริการนี้แล้ว กรุณาติดต่อศูนย์บริการ'});
 res.json({visits:await publicVisits(rows),checkedAt:new Date().toISOString(),expiresAt:link.expires_at});
 }catch(error){console.error('Tracking link read failed:',error.code||'unexpected');res.status(500).json({error:'ตรวจสอบลิงก์ไม่ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง'});}
});
module.exports=router;
