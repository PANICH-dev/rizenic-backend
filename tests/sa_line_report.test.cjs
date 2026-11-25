const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),https=require('https'),{EventEmitter}=require('events');
const dbPath=require.resolve('../config/db');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async(sql,params)=>({rows:[{sa:'SA Test',kind:'insurance',today:1,month:3}]})}};
let calls=0,lastPayload;
https.request=(options,callback)=>{
 const request=new EventEmitter();let body='';request.write=chunk=>{body+=chunk;};request.end=()=>{
  calls++;lastPayload=JSON.parse(body);const response=new EventEmitter();response.statusCode=200;callback(response);queueMicrotask(()=>{response.emit('data','{}');response.emit('end');});
 };return request;
};
const app=express();app.use(express.json());app.use('/api',require('../routes/utils'));let server,base;
test.before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});test.after(()=>server.close());
const send=data=>fetch(base+'/api/send-line-notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('New report is one push containing original message and SA message',async()=>{delete process.env.VERCEL_ENV;const response=await send({branch:'Navamin',message:'รายงานเดิม',include_sa_report:true,report_date:'2026-11-25'});assert.equal(response.status,200);assert.equal(lastPayload.messages.length,2);assert.equal(lastPayload.messages[0].text,'รายงานเดิม');assert(lastPayload.messages[1].text.includes('เสนอประกัน: 1 / 3'));});
test('Old clients retain the original one-message payload',async()=>{assert.equal((await send({branch:'Navamin',message:'เดิม'})).status,200);assert.equal(lastPayload.messages.length,1);});
test('Preview environment cannot send to real LINE groups',async()=>{process.env.VERCEL_ENV='preview';const before=calls;assert.equal((await send({branch:'Navamin',message:'ทดสอบ',include_sa_report:true,report_date:'2026-11-25'})).status,409);assert.equal(calls,before);delete process.env.VERCEL_ENV;});
test('Invalid report dates and oversized messages never cause a push',async()=>{const before=calls;assert.equal((await send({branch:'Navamin',message:'ทดสอบ',include_sa_report:true,report_date:'2026-02-30'})).status,400);assert.equal((await send({branch:'Navamin',message:'x'.repeat(5001)})).status,400);assert.equal(calls,before);});
