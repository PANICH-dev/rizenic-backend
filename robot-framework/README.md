# RIZENIC Robot Framework

## Monitor JSON แล้วล็อกอิน E-Claim

```sh
.venv/bin/python -m robot --outputdir results/eclaim-monitor monitor_eclaim.robot
```

ตรวจ `job-json-input/*.json` ทุก 2 วินาที รวมไฟล์ที่มีอยู่ก่อนเริ่มรัน รอไฟล์คงที่สองรอบและอ่าน JSON ได้ จากนั้นล็อกอินและเปิด `/eclaim/frmKeyIn_InOutCar.aspx` โดยตรงด้วยพารามิเตอร์เซสชันปัจจุบัน ไม่ใช้ URL เซสชันเก่าที่ hardcode ตรวจว่าพบช่องบริษัทประกันและทะเบียนรถแล้วเปิด Chrome ค้างไว้ ยังไม่กรอกหรือบันทึกใบรับรถ ไม่ย้ายหรือลบ JSON และไม่ logout การรันใหม่อาจพบไฟล์เดิมอีกครั้ง

บัญชีอยู่ใน `.local/eclaim-credentials.json` ซึ่งถูก ignore โดย Git และจำกัดสิทธิ์อ่านเขียนเฉพาะเจ้าของไฟล์ หรือกำหนด `ECLAIM_USERNAME` และ `ECLAIM_PASSWORD` ผ่าน environment เพื่อใช้แทนค่าในไฟล์

เส้นทางหลักเปิดฟอร์มโดยตรงหลังล็อกอิน จึงไม่ต้องผ่านหน้าข่าวสารหรือแจ้งค่าบริการ ตัวช่วยปิดแจ้งเตือนยังมีไว้สำหรับเส้นทางผ่านหน้าหลัก แต่ไม่ได้เรียกในเทสต์นี้

ปรับโฟลเดอร์และเวลารอด้วย `--variable WATCH_DIR:/path/to/job-json-input --variable POLL_SECONDS:2 --variable WATCH_TIMEOUT:60` ก่อนชื่อไฟล์เทสต์ ค่า `WATCH_TIMEOUT:0` คือรอไม่จำกัด หยุดด้วย Ctrl+C

เทสต์เปิด Chrome แล้วล็อกอินที่ `http://localhost:3001/index.html` ด้วยผู้ใช้ `local-navamin` รอ 10 วินาทีหลังล็อกอินสำเร็จ แล้วล็อกเอาต์และตรวจว่ากลับมาหน้าล็อกอิน

## ติดตั้ง

ต้องติดตั้ง Python 3 และ Google Chrome และเปิดเว็บกับ backend ให้พร้อมก่อนรัน

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

## รันเทสต์

```sh
.venv/bin/python -m robot --outputdir results login_logout.robot
```

ใช้รหัสผ่าน local ตามที่ระบุไว้ในเทสต์ หรือกำหนดผ่าน environment variable `RIZENIC_PASSWORD` เพื่อเปลี่ยนรหัสผ่าน สามารถปรับ URL และเวลารอด้วย `--variable URL:http://localhost:3001/index.html --variable 'DELAY:10 seconds'` ก่อนชื่อไฟล์เทสต์

ดูผลที่ `results/report.html` และรายละเอียดที่ `results/log.html` ครั้งแรก Selenium อาจต้องใช้อินเทอร์เน็ตเพื่อดาวน์โหลด ChromeDriver
# Repair job JSON outbox

## กรอกใบงานแบบหน่วงเวลาและ Submit

```sh
.venv/bin/python -m robot --outputdir results/fill-repair-job fill_repair_job.robot
```

ล็อกอินด้วย `local-navamin` แล้วกรอกข้อมูลตัวอย่างในหน้าประเมินงานซ่อม รวมเอกสาร ชิ้นส่วนตัวถัง รายการอะไหล่ วันที่ สถานะ และ E-Claim หน่วงแต่ละขั้นตอน 0.2 วินาที จากนั้นกด Submit ครั้งเดียว ตรวจข้อความสำเร็จ และเปิด Chrome ค้างไว้โดยไม่ logout การรันแต่ละครั้งจะสร้างใบงานทดสอบใหม่

ปรับเวลาหน่วงด้วย `--variable 'STEP_DELAY:2 seconds'` หรือกรอกอย่างเดียวโดยไม่ Submit ด้วย `--variable SUBMIT:False` (ใส่ก่อนชื่อไฟล์เทสต์)

ข้อมูล BL เป็น read-only ส่วน PO Tracking และสถานีช่างเป็นข้อมูลแสดงผลจากระบบ จึงไม่แก้ไขส่วนเหล่านี้ ราคาหรือข้อมูลคลังอะไหล่ที่เป็น read-only มาจากรายการอะไหล่ที่เลือก


When a repair job is saved from the React Service Advisor page, the backend writes a
Robot Framework input file to `job-json-input/repair-job-{job_id}.json`.

The output directory is configurable with `ROBOT_OUTBOX_PATH`. When it is omitted,
the backend walks upward from its working directory and uses the first
`robot-framework/job-json-input` directory it finds. This works when the service is
started from the repository root or from `rizenic-backend-service`. Set the variable
explicitly when the backend and Robot run in separate containers or hosts:

```bash
ROBOT_OUTBOX_PATH=/projects/rizenic-backend/robot-framework/job-json-input
```

Files are written atomically and include `schema_version`, `event_type`, `status`,
`job_id`, customer, vehicle, documents, workflow, dates, repair parts, E-Claim,
inspection, and `legacy_fields` data.
