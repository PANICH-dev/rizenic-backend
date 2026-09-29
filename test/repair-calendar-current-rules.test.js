const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { registerServerSideViews } = require('../server_side_views');
async function capture(route, query) {
 const calls=[]; const routes=new Map();
 registerServerSideViews({get:(p,h)=>routes.set(p,h)}, {query:async(sql,values)=>{calls.push({sql,values});return {rows:[]};}});
 const res={status(n){this.code=n;return this;},json(b){this.body=b;}};
 await routes.get(route)({query},res);
 assert.ok(!res.code || res.code===200);
 return calls;
}
function loadFunctions() {
 const s=fs.readFileSync('public/repair.js','utf8');
 const ctx=vm.createContext({selectedBranchFilter:'A',allQuotas:[],document:{getElementById:()=>({innerHTML:'',innerText:''})}});
 for(const name of ['isJobDone','repairQuotaForCalendarDate']) {
  const start=s.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const end=s.indexOf('\nfunction ',start+1);
  vm.runInContext(s.slice(start,end<0?s.length:end),ctx);
 }
 return ctx;
}
test('calendar count keeps delivered/cancelled rows, uses quantity fields, and includes status 22',async()=>{
 const calls=await capture('/api/server/repair-calendar',{year:'2026',month:'9',branch:'A'});
 const sql=calls.find(c=>/WITH base/.test(c.sql)).sql;
 assert.doesNotMatch(sql,/NOT ILIKE|<> '12\.ส่งมอบ'/);
 assert.match(sql,/22/); assert.match(sql,/18/);
 assert.doesNotMatch(sql,/string_to_array/);
 assert.match(sql,/Asia\/Bangkok/);
 assert.match(sql,/FROM events WHERE day >=/);
});
test('normal repair page and facet use only 09-11 while calendar drilldown keeps all statuses',async()=>{
 for(const route of ['/api/server/repair-page','/api/server/repair-facet']) {
  const q={branch:'A',field:'job_status',includeMeta:'0',includeParts:'0'};
  const normal=(await capture(route,q))[0].sql;
  assert.match(normal,/09\|10\|11/); assert.doesNotMatch(normal,/department_routing = 'ซ่อม'/);
  const calendar=(await capture(route,{...q,calendar:'1'}))[0].sql;
  assert.doesNotMatch(calendar,/NOT ILIKE|09\|10\|11/);
 }
});
test('repair-board endpoint excludes cancellations and completed delivery, regardless of department',async()=>{
 const sql=(await capture('/api/server/repair-board',{branch:'A'}))[0].sql;
 assert.match(sql,/09\|10\|11/);assert.match(sql,/ยกเลิก/);assert.match(sql,/ส่งมอบแล้ว/);
 assert.doesNotMatch(sql,/department_routing/);
});
test('done classification includes 11 through 22 with exact numeric prefix boundaries',()=>{
 const ctx=loadFunctions();
 for(let n=11;n<=22;n++) assert.equal(ctx.isJobDone(` ${n}.สถานะ`),true);
 for(const s of ['10.กำลังซ่อม','23.รอตรวจ','110.bad','',null]) assert.equal(ctx.isJobDone(s),false);
});
test('quota chooses special day over default, respects branch and configured zero',()=>{
 const ctx=loadFunctions();
 ctx.allQuotas=[{branch_name:'A',quota_type:'default',quota_main_parts:10,quota_sub_parts:8},{branch_name:'A',quota_type:'special',quota_date:'2026-09-29',quota_main_parts:0,quota_sub_parts:2},{branch_name:'B',quota_type:'default',quota_main_parts:20,quota_sub_parts:3}];
 assert.equal(ctx.repairQuotaForCalendarDate('2026-09-29').main,0);
 assert.equal(ctx.repairQuotaForCalendarDate('2026-09-30').main,10);
 ctx.selectedBranchFilter='ALL';
 assert.equal(ctx.repairQuotaForCalendarDate('2026-09-29').main,20);
 ctx.selectedBranchFilter='C';
 assert.equal(ctx.repairQuotaForCalendarDate('2026-09-29').configured,false);
});

test('calendar rendering shows 5/10 progress, correct quota warning and green delivery bar',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[{branch_name:'A',quota_type:'default',quota_main_parts:3,quota_sub_parts:8}],
  repairCalendarDays:new Map([['2026-09-29',{appointment:7,target:10,done:5,delivery:2,main_parts:4,sub_parts:1,overdue:1}]]),
  getTodayString:()=> '2026-09-29',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/5\/10/);assert.match(grid.innerHTML,/50%/);
 assert.match(grid.innerHTML,/4\/3/);assert.match(grid.innerHTML,/🔥 เต็ม/);
 assert.match(grid.innerHTML,/repair-overdue-alert/);assert.match(grid.innerHTML,/repair-day-bar-fill-delivery/);assert.match(grid.innerHTML,/style="width:/);
 assert.equal((grid.innerHTML.match(/onclick="clickCalendarDate/g)||[]).length,30);
 ctx.repairCalendarLoaded=false;ctx.renderCalendar();
 assert.match(grid.innerHTML,/กำลังโหลดปฏิทิน/);assert.doesNotMatch(grid.innerHTML,/5\/10/);
 ctx.repairCalendarError=true;ctx.renderCalendar();
 assert.match(grid.innerHTML,/ลองใหม่/);assert.doesNotMatch(grid.innerHTML,/กำลังโหลดปฏิทิน/);
});


test('completed target stays orange and never reuses delivery green styling',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[],
  repairCalendarDays:new Map([['2026-09-29',{appointment:0,target:10,done:10,delivery:0,main_parts:0,sub_parts:0,overdue:0}]]),
  getTodayString:()=> '2026-09-28',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/10\/10/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-target/);
 assert.doesNotMatch(grid.innerHTML,/repair-day-bar-fill-target is-done/);
 assert.doesNotMatch(grid.innerHTML,/repair-bar-count-target is-done/);
 assert.doesNotMatch(grid.innerHTML,/repair-day-bar-line-target is-done/);
});
