const test=require('node:test'),assert=require('node:assert/strict');
const {quotaPool}=require('./helpers/quota_pool.cjs');
const {withBooking,increases,booking,limitValue}=require('../services/quota');
const branch='Navamin',day='2026-11-30',other='2026-12-01';
const quota={id:1,branch_name:branch,quota_type:'default',quota_arrived:1,quota_target:1,quota_delivery:1,quota_main_parts:10,quota_sub_parts:5};
const original={id:1,branch_name:branch,arrived_date:day,target_finish_date:day,delivery_date:day,main_part_qty:10,sub_part_qty:5};
test('Unchanged or reduced existing booking can save even when already over capacity',async()=>{
 const pool=quotaPool([original,{...original,id:2}],[quota]);
 await withBooking(pool,1,{...original,main_part_qty:9},async(client,next)=>client.save({...original,...next,notes:'แก้สถานะเท่านั้น'}));
 assert.equal(pool.jobs.get('1').notes,'แก้สถานะเท่านั้น');assert.equal(pool.jobs.get('1').main_part_qty,9);
 assert.equal(pool.calls.filter(x=>x.sql.includes('COUNT(*) FILTER')).length,0);
});
test('New arrival, target, delivery or extra parts cannot exceed a full quota',async()=>{
 for(const changes of [{arrived_date:day},{target_finish_date:day},{delivery_date:day},{target_finish_date:day,main_part_qty:1},{target_finish_date:day,sub_part_qty:1}]){
  const pool=quotaPool([original],[quota]);await assert.rejects(withBooking(pool,null,{branch_name:branch,...changes},()=>assert.fail('write must not happen')),e=>e.status===409);assert.equal(pool.jobs.size,1);assert(pool.calls.some(x=>x.sql==='ROLLBACK'));
 }
 const pool=quotaPool([original],[quota]);await assert.rejects(withBooking(pool,1,{...original,main_part_qty:11},()=>{}),e=>e.status===409);
});
test('Part quota uses target finish date, never arrival date',async()=>{
 const pool=quotaPool([{...original,arrived_date:other,target_finish_date:day}],[{...quota,quota_target:0}]);
 await assert.rejects(withBooking(pool,null,{branch_name:branch,arrived_date:other,target_finish_date:day,main_part_qty:1},()=>{}),e=>e.status===409);
 await withBooking(pool,null,{branch_name:branch,arrived_date:day,target_finish_date:other,main_part_qty:10},()=>{}).catch(error=>{assert.match(error.message,/รถเข้าจอด/);});
 const partOnly=quotaPool([{...original,arrived_date:other,target_finish_date:day}],[{...quota,quota_arrived:0,quota_target:0}]);await withBooking(partOnly,null,{branch_name:branch,arrived_date:day,target_finish_date:other,main_part_qty:10},()=>{});
});
test('Daily override, inherited fields and zero/unlimited match the calendar',()=>{
 assert.equal(limitValue({quota_main_parts:0},quota,'quota_main_parts'),0);
 assert.equal(limitValue({quota_main_parts:null},quota,'quota_main_parts'),10);
 assert.equal(limitValue({quota_target:2},quota,'quota_target'),2);
 assert.equal(limitValue({quota_arrived:''},quota,'quota_arrived'),1);
 assert.throws(()=>booking({main_part_qty:-1}));assert.throws(()=>booking({target_finish_date:'2026-02-30'}));
 assert.deepEqual(increases(original,{...original,job_status:'เปลี่ยนสถานะ'}),[]);
});
test('Concurrent requests for the last slot: exactly one commit, one rejection',async()=>{
 const pool=quotaPool([],[quota]);let id=1;
 const reserve=()=>withBooking(pool,null,{branch_name:branch,arrived_date:day},async(client,next)=>{await new Promise(resolve=>setTimeout(resolve,10));client.save({id:id++,...next});});
 const results=await Promise.allSettled([reserve(),reserve()]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.status===409).length,1);assert.equal(pool.jobs.size,1);
});
test('Moving to a full date fails and preserves the old reservation; failed write rolls back',async()=>{
 const pool=quotaPool([original,{...original,id:2,arrived_date:other}],[quota]);await assert.rejects(withBooking(pool,1,{...original,arrived_date:other},()=>{}),e=>e.status===409);assert.equal(pool.jobs.get('1').arrived_date,day);
 await assert.rejects(withBooking(pool,1,{...original,arrived_date:null},client=>{client.save({...original,arrived_date:null});throw Error('write failed');}));assert.equal(pool.jobs.get('1').arrived_date,day);
});
