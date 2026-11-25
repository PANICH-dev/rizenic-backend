const express=require('express');
const pool=require('../config/db');
const {validDay,bangkokDay,getSAReport}=require('../services/sa_activity');
const router=express.Router();
const EVENTS={insurance:'insurance_checkin',arrival:'arrival_checkin',delivery:'delivery_checkin'};
const schemaError=error=>['42703','42P01'].includes(error.code);
function failure(res,error){return res.status(500).json({error:schemaError(error)?'กรุณารัน SQL 20261125_sa_activity.sql ก่อนใช้ระบบผลงาน SA':'ไม่สามารถดำเนินการได้ กรุณาลองใหม่',error_code:error.code||'UNKNOWN',error_position:error.position});}
router.get('/customer-sources',async(req,res)=>{
 try{res.json((await pool.query('SELECT id,name,is_active FROM customer_sources ORDER BY name')).rows);}catch(error){failure(res,error);}
});
router.post('/customer-sources',async(req,res)=>{
 const name=typeof req.body.name==='string'?req.body.name.trim():'';
 if(!name||name.length>100)return res.status(400).json({error:'ระบุชื่อแหล่งที่มาไม่เกิน 100 ตัวอักษร'});
 try{const result=await pool.query('INSERT INTO customer_sources(name) VALUES($1) RETURNING id,name,is_active',[name]);res.status(201).json(result.rows[0]);}
 catch(error){if(error.code==='23505')return res.status(409).json({error:'มีแหล่งที่มาชื่อนี้แล้ว'});failure(res,error);}
});
router.put('/customer-sources/:id',async(req,res)=>{
 const name=typeof req.body.name==='string'?req.body.name.trim():'';
 if(!/^[1-9]\d*$/.test(req.params.id)||!name||name.length>100||typeof req.body.is_active!=='boolean')return res.status(400).json({error:'ข้อมูลแหล่งที่มาไม่ถูกต้อง'});
 try{const result=await pool.query('UPDATE customer_sources SET name=$1,is_active=$2 WHERE id=$3 RETURNING id,name,is_active',[name,req.body.is_active,req.params.id]);
 if(!result.rows.length)return res.status(404).json({error:'ไม่พบแหล่งที่มา'});res.json(result.rows[0]);}
 catch(error){if(error.code==='23505')return res.status(409).json({error:'มีแหล่งที่มาชื่อนี้แล้ว'});failure(res,error);}
});
router.post('/report/:id/checkin/:type',async(req,res)=>{
 const prefix=Object.hasOwn(EVENTS,req.params.type)?EVENTS[req.params.type]:null;
 const actor=typeof req.body.actor==='string'?req.body.actor.trim():'';
 if(!prefix||!/^[1-9]\d*$/.test(req.params.id)||!actor||actor.length>150)return res.status(400).json({error:'ข้อมูลเช็กอินหรือผู้บันทึกไม่ถูกต้อง'});
 const insurance=req.params.type==='insurance';
 if(insurance&&(!validDay(req.body.date)||req.body.date>bangkokDay()))return res.status(400).json({error:'เลือกวันที่เสนอประกันจริง และต้องไม่เกินวันนี้'});
 const date=insurance?req.body.date+'T00:00:00+07:00':new Date().toISOString();
 const columns=`id,${prefix}_at,${prefix}_sa,${prefix}_by${insurance?',insurance_checkin_recorded_at':''}`;
 try{
  // Only the first request can change a check-in. The SA comes from the saved job, never the request body.
  const result=await pool.query(`UPDATE rizenicreport SET ${prefix}_at=$1,${prefix}_sa=sa_owner,${prefix}_by=$2${insurance?',insurance_checkin_recorded_at=CURRENT_TIMESTAMP':''}
   WHERE id=$3 AND ${prefix}_at IS NULL AND NULLIF(btrim(sa_owner),'') IS NOT NULL RETURNING ${columns}`,[date,actor,req.params.id]);
  if(result.rows.length)return res.json({success:true,already_checked_in:false,data:result.rows[0]});
  const existing=await pool.query(`SELECT ${columns},sa_owner FROM rizenicreport WHERE id=$1`,[req.params.id]);
  if(!existing.rows.length)return res.status(404).json({error:'ไม่พบใบงาน'});
  if(!existing.rows[0][prefix+'_at'])return res.status(409).json({error:'กรุณาระบุ SA และบันทึกใบงานก่อนเช็กอิน'});
  res.json({success:true,already_checked_in:true,data:existing.rows[0]});
 }catch(error){failure(res,error);}
});
router.get('/sa-performance',async(req,res)=>{
 const date=req.query.date||bangkokDay(),branch=req.query.branch;
 if(!validDay(date)||!['Navamin','Rangsit'].includes(branch))return res.status(400).json({error:'วันที่หรือสาขาไม่ถูกต้อง'});
 try{res.json(await getSAReport(pool,date,branch));}catch(error){failure(res,error);}
});
module.exports=router;
