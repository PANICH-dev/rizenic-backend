const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {validDay,bangkokDay,buildVehicleReport,formatSAReport,REPORT_SQL}=require('../services/sa_activity');
let schemaFailure=false;
const cancellation=[];
const jobs=new Map([['125',{id:125,sa_owner:'SA เอ'}],['123',{id:123,sa_owner:'SA เอ'}],['124',{id:124,sa_owner:''}]]),sources=[{id:1,name:'ออนไลน์',is_active:true}];
const dbPath=require.resolve('../config/db');
const pool={async query(sql,params=[]){
 if(schemaFailure)throw Object.assign(Error('missing'),{code:'42703'});
 if(sql.includes('checkin_cancel_history=')){
  const prefix=sql.match(/(insurance_checkin|arrival_checkin|delivery_checkin)_at=NULL/)[1],job=jobs.get(String(params[3]));
  if(!job||job[prefix+'_at']!==params[4])return{rows:[]};
  cancellation.push({previous_at:job[prefix+'_at'],previous_sa:job[prefix+'_sa'],previous_by:job[prefix+'_by'],actor:params[1],reason:params[2]});
  job[prefix+'_at']=null;job[prefix+'_sa']=null;job[prefix+'_by']=null;if(prefix==='insurance_checkin')job.insurance_checkin_recorded_at=null;return{rows:[{...job}]};
 }
 if(sql.startsWith('UPDATE rizenicreport SET')){
  assert(sql.includes('_at IS NULL'));const prefix=sql.match(/SET (\w+)_at=/)[1],job=jobs.get(String(params[2]));
  if(!job||job[prefix+'_at']||!job.sa_owner)return{rows:[]};
  Object.assign(job,{[prefix+'_at']:params[0],[prefix+'_by']:params[1],[prefix+'_sa']:job.sa_owner});return{rows:[{...job}]};
 }
 if(sql.startsWith('SELECT id,')&&sql.includes('FROM rizenicreport'))return{rows:jobs.has(params[0])?[{...jobs.get(params[0])}]:[]};
 if(sql.startsWith('SELECT id,name'))return{rows:sources.map(x=>({...x}))};
 if(sql.startsWith('INSERT INTO customer_sources')){if(sources.some(x=>x.name===params[0]))throw Object.assign(Error('duplicate'),{code:'23505'});const row={id:sources.length+1,name:params[0],is_active:true};sources.push(row);return{rows:[row]};}
 if(sql.startsWith('UPDATE customer_sources')){const row=sources.find(x=>String(x.id)===params[2]);if(!row)return{rows:[]};Object.assign(row,{name:params[0],is_active:params[1]});return{rows:[row]};}
 if(sql.startsWith('WITH jobs')){assert.deepEqual(params,['2026-11-25','Navamin']);return{rows:[{id:1,sa_owner:'SA เอ',insurance_checkin_sa:'SA เอ',insurance_checkin_at:'2026-11-25T00:00:00+07:00'}]};}
 throw Error('Unexpected query: '+sql.slice(0,60));
}};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const app=express();app.use(express.json());app.use('/api',require('../routes/sa_activity'));
let server,base;
test.before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port+'/api';});
test.after(()=>server.close());
const post=(path,data,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('Thai business dates and invalid calendar dates',()=>{assert(validDay('2024-02-29'));assert(!validDay('2026-02-29'));assert(!validDay('2026-13-01'));assert.equal(bangkokDay(new Date('2026-11-24T17:01:00Z')),'2026-11-25');});
test('First insurance checkin wins, SA from saved job, duplicate requests do not change date or actor',async()=>{
 const values=await Promise.all([post('/report/123/checkin/insurance',{actor:'ผู้กด A',date:'2026-11-24',sa_owner:'ห้ามเชื่อข้อมูลนี้'}),post('/report/123/checkin/insurance',{actor:'ผู้กด B',date:'2026-11-23'})]);
 const results=await Promise.all(values.map(x=>x.json()));assert.equal(results.filter(x=>x.already_checked_in===false).length,1);assert.equal(results.filter(x=>x.already_checked_in===true).length,1);assert.equal(jobs.get('123').insurance_checkin_sa,'SA เอ');assert(jobs.get('123').insurance_checkin_at.endsWith('+07:00'));
 const previous=jobs.get('123').insurance_checkin_at;jobs.get('123').sa_owner='SA บี';await post('/report/123/checkin/insurance',{actor:'ผู้กด C',date:'2026-11-22'});assert.equal(jobs.get('123').insurance_checkin_at,previous);assert.equal(jobs.get('123').insurance_checkin_sa,'SA เอ');
});
test('Arrival/delivery store real time, require saved SA, validate requests and dates',async()=>{
 for(const kind of ['arrival','delivery']){const response=await post('/report/123/checkin/'+kind,{actor:'ผู้กด A',date:'2000-01-01'});assert.equal(response.status,200);assert(jobs.get('123')[kind+'_checkin_at'].startsWith(new Date().toISOString().slice(0,4)));assert.equal(jobs.get('123')[kind+'_checkin_sa'],'SA บี');}
 assert.equal((await post('/report/124/checkin/arrival',{actor:'A'})).status,409);
 assert.equal((await post('/report/999/checkin/arrival',{actor:'A'})).status,404);
 assert.equal((await post('/report/123/checkin/insurance',{actor:'A',date:'2999-01-01'})).status,400);
 assert.equal((await post('/report/123/checkin/bad',{actor:'A'})).status,400);
 assert.equal((await post('/report/123/checkin/toString',{actor:'A'})).status,400);
 assert.equal((await post('/report/123/checkin/arrival',{})).status,400);
});
test('Sources can be created, duplicate rejected, renamed/deactivated without deleting',async()=>{
 const create=await post('/customer-sources',{name:'หน้าร้าน'});assert.equal(create.status,201);assert.equal((await post('/customer-sources',{name:'หน้าร้าน'})).status,409);
 const update=await post('/customer-sources/2',{name:'หน้าร้านใหม่',is_active:false},'PUT');assert.equal(update.status,200);assert.equal(sources[1].is_active,false);
 const response=await fetch(base+'/customer-sources');assert.equal((await response.json()).length,2);
});
test('Report uses vehicle data, source counts and hides empty staff',async()=>{
 const report=buildVehicleReport([{id:1,sa_owner:'เอ',car_plate:'A',contact_date:'2026-11-25',customer_source:'ออนไลน์',repair_finish_date:'2026-11-25',target_finish_date:'2026-11-25'},{id:2,sa_owner:'เอ',car_plate:'B',contact_date:'2026-11-01',customer_source:'หน้าร้าน'},{id:3,sa_owner:'ไม่มีผลงาน'}],'2026-11-25','Navamin');
 assert.deepEqual(report.people.find(x=>x.sa==='เอ').received,{today:1,month:2});assert.equal(report.people.find(x=>x.sa==='เอ').on_time,1);assert(!report.people.some(x=>x.sa==='ไม่มีผลงาน'));assert(formatSAReport(report).includes('ออนไลน์: 1 / 1'));
 const response=await fetch(base+'/sa-performance?date=2026-11-25&branch=Navamin');assert.equal(response.status,200);assert((await response.json()).message.includes('เสนอวันนี้: 1 คัน'));
 assert.equal((await fetch(base+'/sa-performance?date=bad&branch=all')).status,400);
});
test('Missing migration returns actionable error without exposing database details',async()=>{schemaFailure=true;const response=await fetch(base+'/customer-sources');assert.equal(response.status,500);assert((await response.json()).error.includes('20261125_sa_activity.sql'));schemaFailure=false;});

test('Insurance defaults to server time without requiring manual date selection',async()=>{
 const before=Date.now(),response=await post('/report/125/checkin/insurance',{actor:'ผู้กดอัตโนมัติ'});assert.equal(response.status,200);const when=new Date(jobs.get('125').insurance_checkin_at).getTime();assert(when>=before&&when<=Date.now());
});
test('Cancel stores original data, clears active event, allows recheck and rejects stale cancellation',async()=>{
 const expected=jobs.get('125').insurance_checkin_at;let response=await post('/report/125/checkin/insurance/cancel',{actor:'ผู้กดยกเลิก',reason:'กดผิดคัน',expected_at:expected});assert.equal(response.status,200);assert.equal(jobs.get('125').insurance_checkin_at,null);assert.equal(cancellation.at(-1).previous_at,expected);assert.equal(cancellation.at(-1).previous_sa,'SA เอ');assert.equal(cancellation.at(-1).reason,'กดผิดคัน');
 await new Promise(resolve=>setTimeout(resolve,5));response=await post('/report/125/checkin/insurance',{actor:'ผู้กดใหม่'});assert.equal(response.status,200);
 const current=jobs.get('125').insurance_checkin_at;response=await post('/report/125/checkin/insurance/cancel',{actor:'ผู้กดยกเลิก',reason:'หน้าจอเก่า',expected_at:expected});assert.equal(response.status,409);assert.equal(jobs.get('125').insurance_checkin_at,current);
 assert.equal((await post('/report/125/checkin/insurance/cancel',{actor:'A',reason:'',expected_at:current})).status,400);
});
test('Arrival/delivery cancellation does not clear booking dates',async()=>{
 for(const type of ['arrival','delivery']){const job=jobs.get('123');job.arrived_date='2026-12-01';job.delivery_date='2026-12-15';const response=await post('/report/123/checkin/'+type+'/cancel',{actor:'ผู้กดยกเลิก',reason:'กดผิด',expected_at:job[type+'_checkin_at']});assert.equal(response.status,200);assert.equal(job.arrived_date,'2026-12-01');assert.equal(job.delivery_date,'2026-12-15');}
});
test('Cancellation without its history migration fails safely',async()=>{
 schemaFailure=true;const current=jobs.get('125').insurance_checkin_at;const response=await post('/report/125/checkin/insurance/cancel',{actor:'A',reason:'กดผิด',expected_at:current});assert.equal(response.status,500);assert((await response.json()).error.includes('20261125_checkin_cancel.sql'));assert.equal(jobs.get('125').insurance_checkin_at,current);schemaFailure=false;
});
