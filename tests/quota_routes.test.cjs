const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {quotaPool}=require('./helpers/quota_pool.cjs');
const day='2026-11-30',other='2026-12-01',branch='Navamin';
const row={id:1,branch_name:branch,arrived_date:day,target_finish_date:day,delivery_date:day,main_part_qty:5,sub_part_qty:2};
const pool=quotaPool([row,{...row,id:2,arrived_date:other,target_finish_date:other,delivery_date:other}],[{id:1,branch_name:branch,quota_type:'default',quota_arrived:1,quota_target:1,quota_delivery:1,quota_main_parts:5,quota_sub_parts:2}]);
const dbPath=require.resolve('../config/db');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const app=express();app.use(express.json());app.use('/api',require('../routes/jobs'));app.use('/api',require('../routes/utils'));let server,base;
test.before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port+'/api';});test.after(()=>server.close());
const request=(path,data,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('Existing full booking can update its status/details without adding demand',async()=>{
 let response=await request('/quota-check',{...row});assert.equal(response.status,200);assert.equal((await response.json()).success,true);
 response=await request('/report/1',{...row,job_status:'10.กำลังซ่อม',notes:'แก้ข้อมูลเดิม'},'PUT');assert.equal(response.status,200);assert.equal(pool.jobs.get('1').notes,'แก้ข้อมูลเดิม');
});
test('New job and all alternative date update paths reject a full destination date',async()=>{
 assert.equal((await request('/report',{branch_name:branch,arrived_date:day})).status,409);
 assert.equal((await request('/report/1/fast-date',{field:'arrived_date',value:other},'PUT')).status,409);
 assert.equal((await request('/report/1/station',{target_finish_date:other,delivery_date:day},'PUT')).status,409);
 assert.equal((await request('/sync-dynamic',{tableName:'rizenicreport',primaryKey:'id',data:[{id:1,target_finish_date:other}]})).status,409);
 assert.equal(pool.jobs.get('1').arrived_date,day);assert.equal(pool.jobs.get('1').target_finish_date,day);
});
test('Sync status-only updates retain reserved dates and quantities',async()=>{
 const response=await request('/sync-dynamic',{tableName:'public.rizenicreport',primaryKey:'id',data:[{id:1,job_status:'11.รถซ่อมเสร็จรอส่งมอบ'}]});assert.equal(response.status,200);assert.equal(pool.jobs.get('1').arrived_date,day);assert.equal(pool.jobs.get('1').main_part_qty,5);
});
test('Import validates identifiers before SQL and cannot use a schema-qualified escape',async()=>{
 assert.equal((await request('/sync-dynamic',{tableName:'rizenicreport;SELECT 1',data:[{id:1}]})).status,400);
 assert.equal((await request('/sync-dynamic',{tableName:'rizenicreport',primaryKey:'id);--',data:[{id:1}]})).status,400);
 assert.equal((await request('/sync-dynamic',{tableName:'rizenicreport',data:[{'bad-column':1}]})).status,400);
});
