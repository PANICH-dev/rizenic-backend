# รันแอปเดิมกับ PostgreSQL local

ใช้ schema เดิมที่สร้างขึ้นใหม่จากชื่อคอลัมน์ใน `Database.zip` และ SQL ใน `app.js` เพื่อให้แอปปัจจุบันทำงานได้ ไม่ใช่ schema ใหม่สำหรับ Spring Boot/React และไม่ใช่สำเนา DDL production ที่ยืนยันครบถ้วน

## เริ่มครั้งแรก

ต้องมี Docker Desktop ที่เปิดอยู่ และ Python 3:

```sh
python3 scripts/prepare-local-db.py ~/Downloads/Database.zip
docker compose --env-file .env.local -f compose.local.yaml up -d --build
```

- แอป: http://localhost:3000
- PostgreSQL: `127.0.0.1:55432`
- Database: `rizenic_db`
- Schema: `rizenic_old` (ตั้ง database search_path ให้แอปเดิมใช้ชื่อตารางที่ไม่ระบุ schema ได้)
- Database user: `rizenic`
- Database password: อ่าน `LOCAL_DB_PASSWORD` จาก `.env.local`
- บัญชีทดสอบ: `local-navamin` และ `local-rangsit` มีสิทธิ์ Admin ของแต่ละสาขา; รหัสผ่านอยู่ใน `.local/login.txt`
- นำเข้าข้อมูลเดิม 5,890 แถวใน 18 ตาราง และเพิ่มบัญชี local 2 แถว โดยคงบัญชีเดิมไว้ทั้งหมด

ไฟล์ `.env` เดิมไม่ได้ถูกใช้ใน Compose นี้ DATABASE_URL ถูกกำหนดให้ชี้ service postgres ของ project `rizenic-local` โดยตรง ทั้งพอร์ตเว็บและฐานข้อมูลเปิดเฉพาะ loopback

## เริ่ม/หยุดครั้งถัดไป

```sh
docker compose --env-file .env.local -f compose.local.yaml up -d
docker compose --env-file .env.local -f compose.local.yaml ps
docker compose --env-file .env.local -f compose.local.yaml stop
```

ข้อมูลคงอยู่ใน named volume `rizenic-local_postgres_data` การหยุดหรือ restart ไม่ได้นำเข้า ZIP ซ้ำ ไม่ควรลบ volume หากต้องการเก็บข้อมูล local ที่แก้ไขไว้

หลังแก้ application code ให้รัน `up -d --build` อีกครั้ง เพราะ image ใช้สำเนาโค้ดตอน build ไม่ใช่ bind mount

เปิด SQL console:

```sh
docker compose --env-file .env.local -f compose.local.yaml exec postgres psql -U rizenic -d rizenic_db
```

## ไฟล์ที่ใช้

- `infrastructure/local/schema.sql`: compatibility DDL แบบตรวจทานได้
- `scripts/prepare-local-db.py`: ตรวจ INSERT-only export แล้วสร้าง bootstrap พร้อม reset identity sequences
- `compose.local.yaml`: PostgreSQL 17 และแอป Node.js 24
- `.local/postgres-init/`: schema และข้อมูลนำเข้า (ไม่ commit)
- `.local/import-manifest.json`: checksum archive และจำนวนข้อมูลต้นทางแต่ละตาราง
- `.local/login.txt`, `.env.local`: รหัสผ่านสำหรับ local (ไม่ commit)

prepare script ปฏิเสธการเขียนทับ local setup ที่มีอยู่ เพื่อป้องกัน credentials ไม่ตรงกับฐานใน volume และไม่รัน SQL arbitrary จาก archive

## ขอบเขต schema และการทดสอบ

- มี 18 ตารางที่พบคอลัมน์ใน INSERT exports; ไม่สร้าง `eclaim_general`, `eclaim_line_items`, `rizenicreports` เพราะไฟล์ว่างและโค้ดปัจจุบันไม่อ้างถึง
- ใช้ identity สำหรับ ID, date สำหรับวัน, numeric สำหรับราคา, boolean สำหรับสถานีซ่อม และ jsonb สำหรับ checklist/preferences ตามข้อมูลและการใช้งานที่พบ
- current_mileage ใช้ numeric เพื่อรองรับค่าเลขไมล์แบบทศนิยมใน export
- inspection_reports.job_id ใช้ text เพื่อรองรับ fallback `JOB-...` ที่หน้าเว็บเดิมสร้างได้
- เพิ่ม unique keys ที่ SQL ON CONFLICT ต้องใช้ และ index สำหรับ query เดิม
- ไม่เพิ่ม foreign keys ที่เดาเอง เพราะข้อมูลเดิมมี reference ที่ไม่ตรง master; ยังไม่ได้แก้/รวมข้อมูลที่ขัดกัน
- เพิ่มตัวเลือก `DATABASE_SSL=false` สำหรับ PostgreSQL local; เมื่อไม่ตั้งค่านี้ แอปยังใช้การตั้งค่า SSL เดิม
- Compose ตั้ง `DISABLE_LINE_NOTIFICATIONS=true` ทำให้ API แจ้งเตือนตอบ 403 ก่อนเรียก LINE เพื่อให้การทดสอบ local ไม่ส่งข้อความเข้ากลุ่มจริง
- Frontend ยังใช้ CDN ตามแอปเดิม จึงต้องมีอินเทอร์เน็ตสำหรับ CSS/กราฟ/ไลบรารีบางรายการ
- ความเข้ากันได้กับแอป local ไม่ได้ยืนยันว่า constraints, defaults และ types ตรง production ทุกจุด ต้องใช้ schema-only dump หากต้องการเทียบ DDL แบบแน่นอน

## ผลตรวจ local วันที่ 2026-09-22

- PostgreSQL และแอปมีสถานะ healthy
- จำนวนข้อมูลตรงกับ ZIP ครบทั้ง 18 ตาราง: 5,890 แถวต้นทาง + บัญชี local 2 แถว
- ล็อกอิน local สำเร็จ และ GET API ทั้ง 18 routes ตอบสำเร็จ
- ทดสอบ identity sequence ทั้ง 16 ตารางด้วย INSERT แล้ว rollback เพื่อยืนยันว่าบันทึกใหม่ไม่ชน ID จาก export
- สร้าง อ่าน แก้ไข และลบใบงานทดสอบผ่าน API สำเร็จ; จำนวนใบงานกลับมา 1,074 แถว
- LINE guard ตอบ 403 ตามการตั้งค่า local โดยไม่ส่งออกไป LINE
- ไม่มี browser ที่เชื่อมกับเครื่องมือใน session นี้ จึงตรวจ HTTP/API แล้ว แต่ไม่ได้ตรวจหน้าจอด้วย browser automation
