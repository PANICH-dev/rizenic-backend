# Database export เทียบกับโค้ดปัจจุบัน

ตรวจเมื่อ 2026-09-22 จาก `/Users/zengcode/Downloads/Database.zip`, `app.js` และ HTML/JavaScript ใน `public/`

## ขอบเขตและข้อจำกัด

- อ่าน export และโค้ดแบบ static ไม่ได้เชื่อมต่อฐานจริง รัน SQL หรือเปลี่ยนข้อมูล
- ZIP มี SQL 21 ไฟล์: มี INSERT 18 ไฟล์ อีก 3 ไฟล์ว่าง ไม่มี DDL จึงยืนยัน type, FK, PK, index, default, trigger และ nullable ไม่ได้
- อ่าน VALUES ด้วย parser ที่รองรับ quoted strings และ doubled quotes ตรวจจำนวนค่าต่อแถวให้ตรงคอลัมน์ และยืนยันหนึ่งแถวต่อคำสั่ง INSERT จึงรายงานจำนวนแถวได้
- จำนวนที่รายงานเป็น snapshot ใน ZIP ไม่ใช่ยอดปัจจุบันของระบบ production
- คำว่า “ไม่พบการใช้งาน” หมายถึงใน repository นี้ ไม่รวมระบบภายนอก และ API `/api/sync-dynamic` อาจเขียนตาราง/คอลัมน์ตาม payload ได้
- เอกสารนี้ไม่เก็บข้อมูลรายบุคคล รหัสผ่าน token หรือข้อมูลรายแถว

## ตารางที่พบ

| ตาราง | แถว | คอลัมน์ | การใช้งานใน backend |
|---|---:|---:|---|
| customers | 5 | 4 | ไม่พบ SQL ระบุชื่อตารางโดยตรง |
| inspection_reports | 5 | 21 | POST/GET inspection |
| rizeniccarmodelmaster | 141 | 3 | car-models |
| rizeniccustomertypemaster | 5 | 3 | customer-types |
| rizenicemployeemaster | 26 | 10 | login, employees |
| rizenicinsurancemaster | 20 | 3 | insurances |
| rizenicpartsmaster | 1,512 | 8 | parts |
| rizenicreport | 1,074 | 62 | reports, report, station, fast-date, quotas |
| rizenicstatusmaster | 23 | 4 | statuses, routing จากสถานะ |
| rizenic_body_parts | 45 | 3 | body-parts |
| rizenic_part_inbound | 506 | 11 | part-inbound, parts-inventory |
| rizenic_part_locations | 1,837 | 5 | JOIN และเขียนผ่าน parts |
| rizenic_part_orders | 645 | 23 | part-orders, รับเข้าปรับยอดสั่งซื้อ |
| rizenic_part_outbound | 1 | 16 | part-outbound, parts-inventory |
| rizenic_part_status_master | 6 | 3 | part-statuses |
| rizenic_quotas | 16 | 12 | quotas, ตรวจโควต้าชิ้นส่วน |
| rizenic_routing_master | 4 | 2 | ไม่พบ SQL ระบุชื่อตารางโดยตรง |
| user_column_preferences | 19 | 5 | user-preferences |

`eclaim_general.sql`, `eclaim_line_items.sql`, `rizenicreports.sql` ว่าง: ไม่ได้แปลว่ารู้ schema หรือยืนยันว่าตารางจริงไม่มีข้อมูล

ตารางที่ SQL แบบระบุชื่อใน backend อ้างถึงมีอยู่ใน export ทั้งหมด และไม่พบคอลัมน์จากรายการ INSERT/UPDATE SET แบบระบุชื่อที่ขาดจาก export การตรวจนี้ไม่ได้ยืนยัน runtime compatibility ทั้งหมด โดยเฉพาะ type, constraints, defaults และ SQL dynamic

## ประเด็นที่ต้องแก้หรือกำหนด mapping

### 1. เลขเคลม: หน้าเว็บส่ง แต่ API สร้างใบงานไม่บันทึก

- `public/sa_core.js:635` ตรวจว่ากรอกเคลม และ `:698` ใส่ `formData.claim_no`
- `app.js:481` POST `/api/report` ไม่มี claim_no ใน INSERT แต่ PUT `/api/report/:id` ที่ `:547` รองรับ
- export มี claim_no ที่ไม่ว่าง 481 ใบงาน
- ผลจากโค้ด: สร้างใบงานผ่านเส้นทางนี้ไม่ได้บันทึกค่าที่ส่งมาในคอลัมน์ claim_no โดยตรง ส่วน database trigger/default ยังตรวจไม่ได้
- ระบบใหม่ควรมีสัญญา request/response ที่ตรงกัน และรองรับหลายเลขเคลมตามที่ UI เดิมอนุญาต

### 2. ใบสั่งอะไหล่ใช้ตัวเชื่อมใบงานสองชื่อ

- 374 แถวมี job_id และ 271 แถวมี report_id ไม่มีแถวที่มีทั้งคู่หรือไม่มีทั้งคู่
- ทั้ง 645 ตัวเชื่อมพบ id ปลายทางใน rizenicreport; แต่มี 2 แถวที่ branch_name ไม่ตรงกับใบงาน
- backend `app.js:710` และ `:729` เขียน job_id ไม่ได้เขียน report_id
- `public/js/parts_ui.js:90` และ `public/sa_parts.js:144` รองรับทั้งสองชื่อ
- `public/jobs_table_ui.js:314` จัดกลุ่มด้วย job_id แล้ว fallback ด้วยทะเบียน/เลขเอกสาร ส่วน `public/repair.js:945` ใช้ job_id ก่อน fallback จึงไม่ได้ใช้ report_id อย่างสม่ำเสมอ
- การมี fallback ไม่ได้ยืนยันว่าทุกรายการหาย แต่เพิ่มความเสี่ยงจับคู่งานต่างกันในแต่ละหน้า
- migration ควรรวมเป็น repair_job_id โดย mapping legacy job_id/report_id และแยก 2 กรณีสาขาไม่ตรงให้ตรวจสอบก่อน ไม่แก้สาขาอัตโนมัติ

### 3. เบอร์โทรสองคอลัมน์ไม่ได้ตรงกัน

| การตรวจ | จำนวนใบงาน |
|---|---:|
| phone_number มีค่า | 1,063 |
| customer_phone มีค่า | 141 |
| มีทั้งคู่แต่ข้อความค่าต่างกัน | 139 |
| มีเฉพาะ phone_number | 922 |

- หน้า SA เขียน phone_number (`public/sa_core.js:691`) แต่หน้าประวัติค้นหา/แสดง customer_phone (`public/history.js:67`, `:90`, `:155`)
- จึงมี 922 ใบงานที่มี phone_number แต่หน้าประวัติไม่ได้ใช้ค่านั้น
- ค่าต่างกันเป็นการเทียบข้อความตรง ๆ ยังไม่ได้สรุปว่าเป็นคนละหมายเลขจริง อาจมีรูปแบบการเก็บต่างกัน
- migration ต้องเก็บค่าเดิมทั้งคู่และกำหนดกฎ normalize/เลือกค่าหลัก ไม่ทับข้อมูลโดยใช้ COALESCE อย่างเดียว

### 4. เลขเอกสารเก่าและใหม่มีทั้งข้อมูลตกค้างและค่าขัดกัน

| คู่คอลัมน์ | มีทั้งคู่ | ค่าต่างกันในแถวที่มีทั้งคู่ | มีเฉพาะคอลัมน์เก่า |
|---|---:|---:|---:|
| qt_no / quotation_no | 429 | 32 | 15 |
| so_no / job_order_no | 188 | 19 | 1 |

- หน้า SA เขียน qt_no/so_no; parts_ui บางจุดรองรับ fallback quotation_no/job_order_no
- ถ้าย้ายเฉพาะชื่อใหม่จะไม่เก็บเลข QT เก่า 15 แถว และเลข SO เก่า 1 แถว
- UI รวมหลายเลขด้วย comma (`public/sa_core.js:698`–`:701`) ส่วนหน้าอะไหล่บางจุดเลือกเลขแรก (`public/js/parts_ui.js:489`)
- ค่าที่ต่างกันอาจเป็นหลายเลข/รูปแบบต่างกัน ต้องตรวจเชิงความหมายก่อนเลือกหรือแตกเป็นตารางเอกสาร

### 5. มีธุรกรรมอ้างรหัสอะไหล่ที่ไม่มีใน master

| ตาราง | จำนวนแถวที่ part_no ไม่ว่างแต่ไม่พบใน rizenicpartsmaster |
|---|---:|
| rizenic_part_locations | 2 |
| rizenic_part_orders | 17 |
| rizenic_part_inbound | 1 |
| rizenic_part_outbound | 0 |

- เป็นจำนวนแถว ไม่ใช่จำนวนรหัสที่ไม่ซ้ำ; เปรียบเทียบตรงตามค่าที่เก็บ
- เมื่อ schema ใหม่บังคับ FK ต้อง resolve ด้วย mapping/รายการรอตรวจสอบก่อน และรักษาข้อความรายการเดิมไว้
- อย่าทิ้งธุรกรรมหรือสร้างรหัสรวมเดียวเพื่อให้ FK ผ่าน

### 6. ยอดรับเข้ากับยอดรับในใบสั่งซื้อยังใช้เป็นยอดเดียวกันไม่ได้

- export: SUM(qty_received) ของใบสั่งอะไหล่ = 0 ขณะที่ SUM(qty) ของรับเข้า = 3,165
- ทั้งใบสั่งซื้อ 645 แถวและรับเข้า 506 แถวอยู่ Navamin ใน snapshot นี้
- backend `app.js:792` เพิ่มรับเข้าแล้วค้นใบสั่งซื้อด้วย epc_no + part_no, LIMIT 1 ไม่กรองสาขา และไม่ได้รวมสองขั้นตอนใน transaction
- ผลรวมต่างกันไม่ได้พิสูจน์ว่าเป็นข้อมูลผิด เพราะรับเข้าอาจเป็นคนละขอบเขต/การนำเข้า หรือเป็น stock นอกใบสั่งซื้อ ต้อง reconcile เป็นรายการ
- เบิกออกมีเพียง 1 แถว จึงยังไม่ควรถือว่า export เป็นประวัติสต็อกที่ครบถ้วน
- ระบบใหม่ควรมี receipt line เชื่อม order line ชัดเจน พร้อมแยกยอดตั้งต้น/รับนอกใบสั่งซื้อเมื่อยืนยันกฎธุรกิจแล้ว

### 7. ฟิลด์และตารางที่มีข้อมูลแต่ไม่ได้ถูกจัดการครบในโค้ด

- customers มี 5 แถว แต่ใบงานเก็บชื่อ/โทรเอง ไม่พบ API เชื่อม customer_id; ห้ามถือว่าตารางนี้เป็นรายชื่อลูกค้าครบทุกใบงาน
- rizenic_routing_master มี 4 แถว แต่ routing ปัจจุบันใช้ rizenicstatusmaster.department และข้อความ department_routing
- expected_finish_date มีค่า 296 ใบงาน แต่ไม่มีการอ้างชื่อใน backend; target_finish_date มีค่า 667 ใบงาน ต้องกำหนดความหมายวันแต่ละชนิดก่อนรวม
- quota_color_parts มีครบ 16 แถวแต่ค่าเป็นศูนย์ทั้งหมด; backend ใช้ quota_main_parts/ quota_sub_parts
- employee_phone มีใน export แต่ employee CRUD ไม่รับฟิลด์นี้; is_active มีในฐาน แต่ login ไม่ตรวจค่า
- complain_note และ order_time ไม่มีค่าที่ไม่ว่างใน snapshot และไม่พบการใช้ชื่อใน backend
- inspection_reports มี fuel_gauge_image และลายเซ็นส่งมอบ แต่ API INSERT ไม่รับ; snapshot ฟิลด์เหล่านี้รวมถึงลายเซ็นรับรถและ claim_no ไม่มีค่าที่ไม่ว่าง
- API outbound ไม่เขียน job_id แม้ export มีคอลัมน์นี้ (แถวที่มีอยู่เป็นค่าว่าง)
- GET หลายจุด SELECT * จึงอาจส่งคอลัมน์ที่ไม่ได้เขียนชื่อในโค้ดออกไปด้วย คำว่าไม่รองรับการเขียนจึงไม่เท่ากับอ่านไม่ได้

### 8. ต้องแยกโค้ดที่หน้าเว็บโหลดจริงจากไฟล์เก่า

- parts.html:244–245 โหลด js/parts_core.js และ js/parts_ui.js ซึ่งอ่าน reports, part-orders และ parts
- js/parts.js มี flow รับเข้า/เบิกออก/คลัง แต่ parts.html ไม่ได้โหลดไฟล์นั้น; js/parts_excel.js ก็ไม่ได้ถูกโหลดโดยหน้านี้
- jobs_table.html โหลด jobs_table_core.js, jobs_table_ui.js, jobs_table_modals.js ไม่ใช่ jobs_table.js
- inspection.html ถูกโหลดเป็น fragment จาก sa_inspection.js ไม่ใช่หน้า standalone ที่ยืนยัน flow ได้ด้วยการอ่านชื่อไฟล์อย่างเดียว
- การย้ายต้องตัดสิน scope จากหน้าใช้งานจริง ร่วมกับข้อมูล/API และผู้ใช้งาน ไม่ย้ายทุกไฟล์โดยถือว่าเป็น feature ที่ active ทั้งหมด

## Constraints ที่โค้ดคาดหวัง แต่ dump ยังยืนยันไม่ได้

ON CONFLICT ใน backend ต้องการ unique/exclusion constraint หรือ unique index ที่เหมาะสมสำหรับ:

- rizenicpartsmaster(part_no)
- rizenic_part_locations(part_no, branch_name)
- rizenicstatusmaster(status_code)
- user_column_preferences(emp_name)

snapshot ไม่พบกลุ่มค่าซ้ำสำหรับชุดคีย์เหล่านี้ แต่ไม่ได้พิสูจน์ว่าฐานจริงมี constraint แล้ว

## ข้อเสนอสำหรับ migration

1. ขอ schema-only dump และยืนยันความครบถ้วนของ export ก่อนสรุป DDL ใหม่
2. เก็บ source table + legacy ID และข้อมูลต้นฉบับในพื้นที่ migration ที่ควบคุมสิทธิ์
3. รวมตัวเชื่อม job_id/report_id ด้วยตาราง mapping; ตรวจสาขาที่ขัดกันและรหัสอะไหล่ที่หา master ไม่พบ
4. กำหนดกฎลูกค้า/รถ/เบอร์โทร/เอกสารหลายเลขกับผู้ใช้งาน เก็บ conflicting values ให้ตรวจย้อนกลับได้
5. แยก customer, vehicle, repair job, documents, part order lines, receipts, stock movements และ reservations ตามกฎที่ยืนยัน
6. ทดลอง migration แบบรันซ้ำได้ ตรวจจำนวนใบงาน 1,074 และใบสั่งอะไหล่ 645 พร้อมความสัมพันธ์ ยอดเงิน และการเคลื่อนไหวรายสาขา โดยใช้ snapshot เดียวกัน
7. ตรวจ UI/API สร้างและแก้ไขให้รับข้อมูลชุดเดียวกัน รวมถึงสิทธิ์สาขาและ transaction ก่อน cutover

สร้าง schema ใหม่ `rizenic_db.rizenic_new` แบบโครงสร้างอย่างเดียวแล้ว โดยใช้ [V001__initial_schema.sql](/Users/zengcode/projects/rizenic-backend/database/rizenic_new/V001__initial_schema.sql) ส่วน `rizenic_old` และข้อมูลที่ใช้กับแอปเดิมยังคงเดิม เอกสารนี้เป็นหลักฐานสำหรับการออกแบบและการย้ายข้อมูลขั้นต่อไป
