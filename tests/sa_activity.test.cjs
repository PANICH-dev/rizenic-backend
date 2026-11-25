const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {validDay,bangkokDay,reportFromRows,formatSAReport,REPORT_SQL}=require('../services/sa_activity');
let schemaFailure=false;
const jobs=new Map([['123',{id:123,sa_owner:'SA เอ'}],['124',{id:124,sa_owner:''}]]),sources=[{id:1,name:'ออนไลน์',is_active:true}];
const dbPath=require.resolve('../config/db');
const pool={async query(sql,params=[]){
 if(schemaFailure)throw Object.assign(Error('missing'),{code:'42703'});
 if(sql.startsWith('UPDATE rizenicreport SET')){
  assert(sql.includes('_at IS NULL'));const prefix=sql.match(/SET (\w+)_at=/)[1],job=jobs.get(String(params[2]));
  if(!job||job[prefix+'_at']||!job.sa_owner)return{rows:[]};
  Object.assign(job,{[prefix+'_at']:params[0],[prefix+'_by']:params[1],[prefix+'_sa']:job.sa_owner});return{rows:[{...job}]};
 }
 if(sql.startsWith('SELECT id,')&&sql.includes('FROM rizenicreport'))return{rows:jobs.has(params[0])?[{...jobs.get(params[0])}]:[]};
 if(sql.startsWith('SELECT id,name'))return{rows:sources.map(x=>({...x}))};
 if(sql.startsWith('INSERT INTO customer_sources')){if(sources.some(x=>x.name===params[0]))throw Object.assign(Error('duplicate'),{code:'23505'});const row={id:sources.length+1,name:params[0],is_active:true};sources.push(row);return{rows:[row]};}
 if(sql.startsWith('UPDATE customer_sources')){const row=sources.find(x=>String(x.id)===params[2]);if(!row)return{rows:[]};Object.assign(row,{name:params[0],is_active:params[1]});return{rows:[row]};}
 if(sql.startsWith('WITH jobs')){assert.deepEqual(params,['2026-11-25','Navamin']);return{rows:[{sa:'SA เอ',kind:'insurance',today:1,month:3}]};}
 throw Error('Unexpected query: '+sql.slice(0,60));
}};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const app=express();app.use(express.json());app.use('/api',require('../routes/sa_activity'));
let server,base;
test.before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port+'/api';});
test.after(()=>server.close());
const post=(path,data,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('Thai business dates and invalid calendar dates',()=>{assert(validDay('2024-02-29'));assert(!validDay('2026-02-29'));assert(!validDay('2026-13-01'));assert.equal(bangkokDay(new Date('2026-11-24T17:01:00Z')),'2026-11-25');assert(REPORT_SQL.includes("AT TIME ZONE 'Asia/Bangkok'"));assert(REPORT_SQL.includes('insurance_checkin_sa'));assert(REPORT_SQL.includes('date_trunc'));});
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
test('Report groups SA, day/month and source counts; handles zero activity staff',async()=>{
 const report=reportFromRows([{sa:'เอ',kind:'received',source:'ออนไลน์',today:2,month:8},{sa:'เอ',kind:'received',source:'หน้าร้าน',today:1,month:3},{sa:'เอ',kind:'completed',today:1,month:5,on_time:3,late:1,unknown_target:1},{sa:'เอ',kind:'overdue',month:2},{sa:'บี',kind:'seed'}],'2026-11-25','Navamin');
 assert.deepEqual(report.people.find(x=>x.sa==='เอ').received,{today:3,month:11});assert.equal(report.people.find(x=>x.sa==='เอ').overdue,2);assert.equal(report.people.find(x=>x.sa==='บี').delivery.month,0);assert(formatSAReport(report).includes('ออนไลน์: 2 / 8'));
 const response=await fetch(base+'/sa-performance?date=2026-11-25&branch=Navamin');assert.equal(response.status,200);assert((await response.json()).message.includes('เสนอประกัน: 1 / 3'));
 assert.equal((await fetch(base+'/sa-performance?date=bad&branch=all')).status,400);
});
test('Missing migration returns actionable error without exposing database details',async()=>{schemaFailure=true;const response=await fetch(base+'/customer-sources');assert.equal(response.status,500);assert((await response.json()).error.includes('20261125_sa_activity.sql'));schemaFailure=false;});
