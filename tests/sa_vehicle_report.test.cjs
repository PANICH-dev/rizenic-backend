const test=require('node:test'),assert=require('node:assert/strict');
const {buildVehicleReport,groupVehicleVisits,DELIVERED,ARRIVED}=require('../services/sa_activity');
const base={vin_no:'LRW3F7FS6PC123456',car_plate:'TEST123',service_visit_no:'SV001',arrived_date:'2026-11-20',sa_owner:'SA เอ',job_status:'02.รอเสนอประกัน'};
const report=jobs=>buildVehicleReport(jobs,'2026-11-25','Navamin');
test('One vehicle with three jobs stays pending until all confirmations exist',()=>{
 const jobs=[{...base,id:1,insurance_checkin_at:'2026-11-24T00:00:00+07:00'},{...base,id:2,insurance_checkin_at:'2026-11-25T00:00:00+07:00'},{...base,id:3}];
 let r=report(jobs);assert.equal(r.people[0].pending,1);assert.equal(r.people[0].insurance.today,0);assert.deepEqual(r.pending[0].job_ids,[1,2,3]);assert.equal(r.pending[0].confirmed_jobs,2);
 jobs[2].insurance_checkin_at='2026-11-25T00:00:00+07:00';r=report(jobs);assert.equal(r.people[0].insurance.today,1);assert.equal(r.people[0].insurance.month,1);assert.equal(r.people[0].pending,0);assert.equal(r.pending.length,0);
});
test('Separate service visits and old repair dates do not block each other',()=>{
 const jobs=[{...base,id:1,insurance_checkin_at:'2026-11-25T00:00:00+07:00'},{...base,id:2,service_visit_no:'SV002'}];assert.equal(groupVehicleVisits(jobs).length,2);const r=report(jobs);assert.equal(r.people[0].insurance.today,1);assert.equal(r.people[0].pending,1);
 assert.equal(groupVehicleVisits([{...base,id:1,service_visit_no:'',arrived_date:'2026-10-01'},{...base,id:2,service_visit_no:'',arrived_date:'2026-11-20'}]).length,2);
});
test('VIN resolves missing VIN only when plate is unambiguous; missing identity does not merge',()=>{
 assert.equal(groupVehicleVisits([{...base,id:1},{...base,id:2,vin_no:''}]).length,1);
 assert.equal(groupVehicleVisits([{id:1,sa_owner:'A'},{id:2,sa_owner:'A'}]).length,2);
 assert.equal(groupVehicleVisits([{...base,id:1},{...base,id:2,vin_no:'LRW3F7FS6PC999999'},{...base,id:3,vin_no:''}]).length,3);
});
test('Arrival uses eligible work status regardless of parking flag; delivery uses approved statuses once per car',()=>{
 let r=report([{...base,id:1,is_parked:'จอดซ่อม',arrived_date:'2026-11-25',job_status:'13.วางบิลประกัน',delivery_date:'2026-11-25'},{...base,id:2,is_parked:'จอดซ่อม',arrived_date:'2026-11-25',job_status:'19.ออกบิลแล้ว',delivery_date:'2026-11-25'}]);
 assert.deepEqual(r.people[0].arrival,{today:1,month:1});assert.deepEqual(r.people[0].delivery,{today:1,month:1});
 for(const status of DELIVERED){r=report([{...base,id:1,job_status:status,delivery_date:'2026-11-25'}]);assert.equal(r.people[0].delivery.today,1,status);}
 r=report([{...base,id:1,is_parked:'ไม่จอดซ่อม',arrival_checkin_at:'2026-11-25T00:00:00+07:00',job_status:'10.กำลังซ่อม',delivery_checkin_at:'2026-11-25T00:00:00+07:00',delivery_date:'2026-11-25'}]);assert.equal(r.people[0].arrival.month,1);assert.equal(r.people[0].delivery.month,0);
});
test('Pending includes old waiting work and claim numbers; cancelled jobs do not block completion',()=>{
 const r=report([{...base,id:1,contact_date:'2025-01-01',arrived_date:'2025-01-01',claim_no:'CL01, CL02'}]);assert.equal(r.people[0].pending,1);assert.equal(r.pending[0].claims,'CL01, CL02');
 assert.equal(report([{...base,id:1,insurance_checkin_at:'2026-11-25T00:00:00+07:00'},{...base,id:2,job_status:'18.ลูกค้ายกเลิก'}]).people[0].insurance.today,1);
});
test('Last confirming SA receives one credit; completion date uses latest actual submission date',()=>{
 const r=report([{...base,id:1,insurance_checkin_sa:'SA เอ',insurance_checkin_at:'2026-11-25T00:00:00+07:00',insurance_checkin_recorded_at:'2026-11-25T01:00:00Z'},{...base,id:2,insurance_checkin_sa:'SA บี',insurance_checkin_at:'2026-11-24T00:00:00+07:00',insurance_checkin_recorded_at:'2026-11-25T02:00:00Z'}]);assert.equal(r.people.length,1);assert.equal(r.people[0].sa,'SA บี');assert.equal(r.people[0].insurance.today,1);
});
test('Zero rows are hidden, but 0 today / nonzero month and pending-only people remain',()=>{
 const r=report([{...base,id:1,job_status:'10.กำลังซ่อม',is_parked:'จอดซ่อม',arrived_date:'2026-11-01'},{id:2,sa_owner:'ศูนย์'},{...base,id:3,car_plate:'OTHER',vin_no:'',service_visit_no:'OTHER',sa_owner:'ค้างอย่างเดียว'}]);
 assert(!r.people.some(p=>p.sa==='ศูนย์'));assert(r.message.includes('รถเข้าจอด: 0 / 1'));assert(!r.message.includes('เสนอวันนี้: 0'));assert(!r.message.includes('ส่งมอบรถ: 0'));assert(r.message.includes('ค้างอย่างเดียว'));
});

test('Every eligible arrival status remains counted after the vehicle leaves, but status 08 is excluded',()=>{
 for(const status of ARRIVED){const r=report([{...base,id:1,is_parked:'ไม่จอดซ่อม',job_status:status,arrived_date:'2026-11-25'}]);assert.deepEqual(r.people[0].arrival,{today:1,month:1},status);}
 const r=report([{...base,id:1,is_parked:'จอดซ่อม',job_status:'08.นัดหมายแล้วรอเข้าซ่อม',arrived_date:'2026-11-25'}]);assert.equal(r.people.length,0);
});
test('Report places sources under receipts, hides completed/quality figures and keeps only open overdue work',()=>{
 const r=report([{...base,id:1,job_status:'10.กำลังซ่อม',contact_date:'2026-11-01',customer_source:'ออนไลน์',target_finish_date:'2026-11-24'},{...base,id:2,car_plate:'OTHER',vin_no:'',service_visit_no:'OTHER',sa_owner:'เสร็จแล้วเท่านั้น',job_status:'11.รถซ่อมเสร็จรอส่งมอบ',arrived_date:'2026-10-01',repair_finish_date:'2026-11-25',target_finish_date:'2026-11-24'}]);
 assert(!r.people.some(p=>p.sa==='เสร็จแล้วเท่านั้น'));
 assert(r.message.includes('ค้างเกินกำหนดซ่อม: 1 ใบงาน'));assert(!r.message.includes('ซ่อมเสร็จ'));assert(!r.message.includes('ตรงกำหนด'));assert(!r.message.includes('ล่าช้า'));
 assert(r.message.indexOf('รับลูกค้า')<r.message.indexOf('ออนไลน์'));assert(r.message.indexOf('ออนไลน์')<r.message.indexOf('รถเข้าจอด'));
 assert(r.message.includes('ตัวเลข: วันนี้ / สะสมเดือนถึงวันที่รายงาน'));
});
