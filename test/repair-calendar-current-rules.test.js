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
  assert.match(normal,/09\|10\|11/); assert.match(normal,/department_routing = 'ซ่อม'/);
  const calendar=(await capture(route,{...q,calendar:'1'}))[0].sql;
  assert.doesNotMatch(calendar,/NOT ILIKE|09\|10\|11/);
 }
});
test('repair-board endpoint keeps legacy repair-department scope plus the new 09-11 queue rule',async()=>{
 const sql=(await capture('/api/server/repair-board',{branch:'A'}))[0].sql;
 assert.match(sql,/09\|10\|11/);assert.match(sql,/ยกเลิก/);assert.match(sql,/ส่งมอบแล้ว/);
 assert.match(sql,/department_routing = 'ซ่อม'/);
});


test('non-calendar repair KPI and summary paths preserve legacy eligibility instead of inheriting the 09-11 queue filter',async()=>{
 const summarySql=(await capture('/api/server/repair-summary',{branch:'A'}))[0].sql;
 for(const token of ['ยกเลิก','ส่งมอบแล้ว','12.ส่งมอบ']) assert.match(summarySql,new RegExp(token));
 assert.match(summarySql,/department_routing = 'ซ่อม'/);
 assert.doesNotMatch(summarySql,/09\|10\|11/);

 const drillSql=(await capture('/api/server/repair-kpi-drilldown',{branch:'A',bucket:'arrived',page:'1',limit:'20',known_total:'0'}))[0].sql;
 for(const token of ['ยกเลิก','ส่งมอบแล้ว','12.ส่งมอบ']) assert.match(drillSql,new RegExp(token));
 assert.doesNotMatch(drillSql,/09\|10\|11/);

 const calls=[]; const routes=new Map();
 registerServerSideViews({get:(p,h)=>routes.set(p,h)}, {query:async(sql,values)=>{calls.push({sql,values});return {rows:[]};}});
 const res={status(n){this.code=n;return this;},json(b){this.body=b;}};
 await routes.get('/api/server/repair-page')({query:{branch:'A',page:'1',limit:'50',includeMeta:'1',includeParts:'0'}},res);
 const kpiSql=calls.find(c=>/AS arrived[\s\S]*AS repairing[\s\S]*AS done[\s\S]*AS delayed/.test(c.sql))?.sql || '';
 assert.ok(kpiSql,'missing KPI aggregate query');
 for(const token of ['ยกเลิก','ส่งมอบแล้ว','12.ส่งมอบ']) assert.match(kpiSql,new RegExp(token));
 assert.doesNotMatch(kpiSql,/09\|10\|11/);
});

test('client fallback queue also keeps the old repair-department scope before applying statuses 09-11',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const start=source.indexOf('function runTableFilters(');
 const end=source.indexOf('\nfunction ',start+1);
 const body=source.slice(start,end<0?source.length:end);
 assert.match(body,/job\.department_routing !== 'ซ่อม'/);
 assert.match(body,/\^\(09\|10\|11\)/);
});

test('calendar and normal repair queue normalize invisible status prefixes before numeric status matching',async()=>{
 const calendarCalls=await capture('/api/server/repair-calendar',{year:'2026',month:'9',branch:'A'});
 const calendarSql=calendarCalls.find(c=>/WITH base/.test(c.sql)).sql;
 assert.match(calendarSql,/TRANSLATE\(BTRIM\(COALESCE\(job_status,''\)\),\s*U&'\\200B\\200C\\200D\\2060\\FEFF'/);
 assert.match(calendarSql,/\^\(11\|12\|13\|14\|15\|16\|17\|18\|19\|20\|21\|22\)/);

 const pageSql=(await capture('/api/server/repair-page',{branch:'A',page:'1',limit:'50',includeMeta:'0',includeParts:'0',known_total:'0'}))[0].sql;
 assert.match(pageSql,/TRANSLATE\(BTRIM\(COALESCE\(job_status,''\)\),\s*U&'\\200B\\200C\\200D\\2060\\FEFF'/);
 assert.match(pageSql,/09\|10\|11/);
 assert.match(pageSql,/<> '12\.ส่งมอบ'/);
});
test('done classification includes 11 through 22 with exact numeric prefix boundaries',()=>{
 const ctx=loadFunctions();
 for(let n=11;n<=22;n++) assert.equal(ctx.isJobDone(` ${n}.สถานะ`),true);
 for(const s of ['10.กำลังซ่อม','23.รอตรวจ','110.bad','',null]) assert.equal(ctx.isJobDone(s),false);
});

test('target modal groups status 11-22 as completed even when an invisible prefix exists',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const title={innerHTML:''},content={innerHTML:''},modal={classList:{remove(){}}};
 const ctx=vm.createContext({
  selectedBranchFilter:'A',
  originalRepairJobs:[
   {car_plate:'DONE12',branch_name:'A',target_finish_date:'2026-09-16T00:00:00.000Z',job_status:'\u200B12.รอส่งมอบ'},
   {car_plate:'PENDING10',branch_name:'A',target_finish_date:'2026-09-16T00:00:00.000Z',job_status:'10.กำลังซ่อม'}
  ],
  document:{getElementById:id=>id==='dayListDateTitle'?title:id==='dayListContent'?content:modal},
  formatThaiDate:d=>d,
  generateMiniCardHTML:(j,type)=>`<article data-plate="${j.car_plate}" data-type="${type}">${j.job_status}</article>`
 });
 for (const name of ['isJobDone','openDayListForTarget']) {
  const asyncStart=source.indexOf(`async function ${name}(`);
  const syncStart=source.indexOf(`function ${name}(`);
  const start=asyncStart>=0?asyncStart:syncStart;
  assert.ok(start>=0,`missing ${name}`);
  const nextSync=source.indexOf('\nfunction ',start+1);
  const nextAsync=source.indexOf('\nasync function ',start+1);
  const candidates=[nextSync,nextAsync].filter(v=>v>=0);
  const end=candidates.length?Math.min(...candidates):source.length;
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.openDayListForTarget('2026-09-16');
 assert.match(title.innerHTML,/เสร็จแล้ว 1\/2 คัน/);
 assert.match(content.innerHTML,/กำลังดำเนินการซ่อม \(1 คัน\)/);
 assert.match(content.innerHTML,/ซ่อมเสร็จแล้ว \(1 คัน\)/);
 assert.match(content.innerHTML,/data-plate="DONE12" data-type="target_done"/);
 assert.match(content.innerHTML,/data-plate="PENDING10" data-type="target"/);
});
test('target popup loads the complete calendar date scope from the server instead of the visible table page',async()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const title={innerHTML:''},content={innerHTML:''},modal={classList:{remove(){}}};
 const urls=[];
 const ctx=vm.createContext({
  selectedBranchFilter:'A',API_BASE_URL:'',URLSearchParams,
  originalRepairJobs:[],
  fetch:async url=>{urls.push(String(url));return {ok:true,json:async()=>({
   reports:[
    {id:1,car_plate:'DONE12',branch_name:'A',target_finish_date:'2026-09-16',job_status:'12.รอส่งมอบ'},
    {id:2,car_plate:'PENDING10',branch_name:'A',target_finish_date:'2026-09-16',job_status:'10.กำลังซ่อม'}
   ],partOrders:[],total:2,page:1,totalPages:1
  })};},
  document:{getElementById:id=>id==='dayListDateTitle'?title:id==='dayListContent'?content:modal},
  formatThaiDate:d=>d,
  generateMiniCardHTML:(j,type)=>`<article data-plate="${j.car_plate}" data-type="${type}">${j.job_status}</article>`,
  showToast:()=>{}
 });
 for (const name of ['isJobDone','openDayListForTarget']) {
  const asyncStart=source.indexOf(`async function ${name}(`);
  const syncStart=source.indexOf(`function ${name}(`);
  const start=asyncStart>=0?asyncStart:syncStart;
  assert.ok(start>=0,`missing ${name}`);
  const nextSync=source.indexOf('\nfunction ',start+1);
  const nextAsync=source.indexOf('\nasync function ',start+1);
  const candidates=[nextSync,nextAsync].filter(v=>v>=0);
  const end=candidates.length?Math.min(...candidates):source.length;
  vm.runInContext(source.slice(start,end),ctx);
 }
 await ctx.openDayListForTarget('2026-09-16');
 assert.equal(urls.length,1);
 const url=new URL(urls[0],'http://local');
 assert.equal(url.pathname,'/api/server/repair-page');
 assert.equal(url.searchParams.get('calendar'),'1');
 assert.equal(url.searchParams.get('includeMeta'),'0');
 assert.deepEqual(JSON.parse(url.searchParams.get('filters')),{target_finish_date:['2026-09-16']});
 assert.match(title.innerHTML,/เสร็จแล้ว 1\/2 คัน/);
 assert.match(content.innerHTML,/data-plate="DONE12" data-type="target_done"/);
 assert.match(content.innerHTML,/data-plate="PENDING10" data-type="target"/);
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
 assert.match(grid.innerHTML,/repair-quota-main[^>]*><span>หลัก:<\/span><strong>4<\/strong>/);
 assert.match(grid.innerHTML,/repair-quota-sub[^>]*><span>รอง:<\/span><strong>1<\/strong>/);
 assert.doesNotMatch(grid.innerHTML,/4\/3/);
 assert.doesNotMatch(grid.innerHTML,/1\/8/);
 assert.match(grid.innerHTML,/🔥 เต็ม/);
 assert.match(grid.innerHTML,/repair-overdue-alert/);assert.match(grid.innerHTML,/repair-day-bar-fill-delivery/);assert.match(grid.innerHTML,/style="width:/);
 assert.equal((grid.innerHTML.match(/onclick="clickCalendarDate/g)||[]).length,30);
 ctx.repairCalendarLoaded=false;ctx.renderCalendar();
 assert.match(grid.innerHTML,/กำลังโหลดปฏิทิน/);assert.doesNotMatch(grid.innerHTML,/5\/10/);
 ctx.repairCalendarError=true;ctx.renderCalendar();
 assert.match(grid.innerHTML,/ลองใหม่/);assert.doesNotMatch(grid.innerHTML,/กำลังโหลดปฏิทิน/);
});


test('clicking a target calendar bar opens the target popup instead of navigating to the table',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const start=source.indexOf('function renderCalendar()');
 assert.ok(start>=0,'missing renderCalendar');
 const end=source.indexOf('\nfunction ',start+1);
 const renderSource=source.slice(start,end<0?source.length:end);
 assert.match(renderSource,/repair-day-bar-target[^`]*onclick=\"event\.stopPropagation\(\); openDayListForTarget\('\$\{dateStr\}'\)\"/s);
 assert.doesNotMatch(renderSource,/repair-day-bar-target[^`]*filterBoardByDate\('\$\{dateStr\}',\s*'target'\)/s);
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


test('target progress fill uses completion percentage and reaches 100 percent when done',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[],
  repairCalendarDays:new Map([
   ['2026-09-03',{appointment:0,target:10,done:10,delivery:0,main_parts:0,sub_parts:0,overdue:0}],
   ['2026-09-04',{appointment:0,target:30,done:15,delivery:0,main_parts:0,sub_parts:0,overdue:0}]
  ]),
  getTodayString:()=> '2026-09-29',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/openDayListForTarget\('2026-09-03'\)[\s\S]*?100%[\s\S]*?width:100%[\s\S]*?10\/10/);
 assert.match(grid.innerHTML,/openDayListForTarget\('2026-09-04'\)[\s\S]*?50%[\s\S]*?width:50%[\s\S]*?15\/30/);
});

test('zero part quota is treated as unlimited and does not show full warning',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[{branch_name:'A',quota_type:'default',quota_main_parts:0,quota_sub_parts:0}],
  repairCalendarDays:new Map([['2026-09-29',{appointment:0,target:1,done:0,delivery:0,main_parts:31,sub_parts:17,overdue:0}]]),
  getTodayString:()=> '2026-09-28',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/repair-quota-main[^>]*><span>หลัก:<\/span><strong>31<\/strong>/);
 assert.match(grid.innerHTML,/repair-quota-sub[^>]*><span>รอง:<\/span><strong>17<\/strong>/);
 assert.doesNotMatch(grid.innerHTML,/31\/—/);
 assert.doesNotMatch(grid.innerHTML,/17\/—/);
 assert.doesNotMatch(grid.innerHTML,/🔥 เต็ม/);
 assert.doesNotMatch(grid.innerHTML,/repair-quota-full/);
});


test('calendar shows counts on arrived and delivery while target shows progress fraction',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[],
  repairCalendarDays:new Map([['2026-09-29',{appointment:7,target:10,done:5,delivery:4,main_parts:12,sub_parts:7,overdue:0}]]),
  getTodayString:()=> '2026-09-28',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/repair-day-bar-fill-arrived/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-target/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-delivery/);
 assert.match(grid.innerHTML,/repair-bar-count-arrived[^>]*>7<\/span>/);
 assert.match(grid.innerHTML,/repair-bar-count-target[^>]*>5\/10<\/span>/);
 assert.match(grid.innerHTML,/repair-bar-count-delivery[^>]*>4<\/span>/);
 assert.match(grid.innerHTML,/repair-quota-main[^>]*><span>หลัก:<\/span><strong>12<\/strong>/);
 assert.match(grid.innerHTML,/repair-quota-sub[^>]*><span>รอง:<\/span><strong>7<\/strong>/);
});

test('calendar bar lengths use only the three daily metrics, while target fill represents completed target work',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[],
  repairCalendarDays:new Map([['2026-09-01',{appointment:1,target:6,done:6,delivery:4,main_parts:12,sub_parts:7,overdue:0}]]),
  getTodayString:()=> '2026-09-29',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/repair-day-bar-fill-arrived" style="width:17%"/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-target" style="width:100%"/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-delivery" style="width:67%"/);
 assert.match(grid.innerHTML,/repair-bar-count-target[^>]*>6\/6<\/span>/);
});

test('calendar target bar combines daily scaling with completion progress',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const grid={innerHTML:'',style:{setProperty(){}},dataset:{}},title={innerText:''};
 const ctx=vm.createContext({
  currentYear:2026,currentMonth:8,repairCalendarLoaded:true,selectedBranchFilter:'A',
  allQuotas:[],
  repairCalendarDays:new Map([['2026-09-01',{appointment:1,target:10,done:5,delivery:4,main_parts:0,sub_parts:0,overdue:0}]]),
  getTodayString:()=> '2026-09-29',document:{getElementById:id=>id==='calendar_grid'?grid:title}
 });
 for (const name of ['repairQuotaForCalendarDate','renderCalendar']) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  vm.runInContext(source.slice(start,end),ctx);
 }
 ctx.renderCalendar();
 assert.match(grid.innerHTML,/repair-day-bar-fill-arrived" style="width:10%"/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-target" style="width:50%"/);
 assert.match(grid.innerHTML,/repair-day-bar-fill-delivery" style="width:40%"/);
 assert.match(grid.innerHTML,/repair-bar-count-target[^>]*>5\/10<\/span>/);
});

test('clicking the empty area of a calendar day keeps the legacy date-search behavior',()=>{
 const source=fs.readFileSync('public/repair.js','utf8');
 const start=source.indexOf('function clickCalendarDate(');
 const end=source.indexOf('\nfunction ',start+1);
 assert.ok(start>=0,'missing clickCalendarDate');
 let tab='',ran=0;
 const input={value:''};
 const ctx=vm.createContext({
  activeFilters:{old:new Set(['x'])},activeKpiFilter:'old',isCalendarFilterActive:false,
  switchTab:id=>{tab=id;},
  formatThaiDate:d=>`TH:${d}`,
  runTableFilters:()=>{ran++;},
  document:{getElementById:id=>id==='global_search_input'?input:null}
 });
 vm.runInContext(source.slice(start,end<0?source.length:end),ctx);
 ctx.clickCalendarDate('2026-09-29');
 assert.equal(tab,'tab-board');
 assert.equal(input.value,'TH:2026-09-29');
 assert.equal(ran,1);
 assert.deepEqual(Object.keys(ctx.activeFilters),[]);
 assert.equal(ctx.activeKpiFilter,null);
 assert.equal(ctx.isCalendarFilterActive,true);
});

test('server-side repair search keeps legacy day-click behavior by searching date columns too',async()=>{
 const calls=await capture('/api/server/repair-page',{branch:'A',page:'1',limit:'50',includeMeta:'0',includeParts:'0',known_total:'0',search:'2026-09-29'});
 const sql=calls[0].sql;
 for (const field of ['appointment_date','arrived_date','target_finish_date','repair_finish_date','delivery_date']) {
  assert.match(sql,new RegExp(`COALESCE\\(${field}::text, ''\\)`));
 }
});

test('server adapter converts legacy Thai display date search to ISO before requesting a repair page',()=>{
 const source=fs.readFileSync('public/repair_server.js','utf8');
 const start=source.indexOf('function repairServerNormalizeSearchDate(');
 const end=source.indexOf('\nfunction ',start+1);
 assert.ok(start>=0,'missing repairServerNormalizeSearchDate');
 const ctx=vm.createContext({});
 vm.runInContext(source.slice(start,end<0?source.length:end),ctx);
 assert.equal(ctx.repairServerNormalizeSearchDate('29/09/2026'),'2026-09-29');
 assert.equal(ctx.repairServerNormalizeSearchDate('2026-09-29'),'2026-09-29');
 assert.match(source,/params\.set\('search',\s*repairServerNormalizeSearchDate\(search\)\)/);
});
