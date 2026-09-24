# rizenic-backend-service

โครง Spring Boot สำหรับทยอยย้าย API ของ Rizenic ERP จาก Express

- Java 21, Spring Boot 4.1.1, Maven
- Spring MVC, Spring Data JPA, JdbcClient, PostgreSQL และ Actuator
- local เชื่อม database `rizenic_db`, schema `rizenic_new` ผ่านพอร์ต `55432`
- แยก Controller → Service → Repository ตาม feature package
- ไม่สร้าง/แก้ schema อัตโนมัติ และไม่มีรหัสผ่านฝังใน source

## รัน local

เริ่ม PostgreSQL ด้วย Compose ของโปรเจกต์หลักก่อน แล้วรันจากโฟลเดอร์ service:

```sh
cd rizenic-backend-service
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

local profile อ่าน `../.env.local` ที่สร้างไว้สำหรับ Docker เพื่อใช้ `LOCAL_DB_PASSWORD` เดียวกัน ต้องรันด้วย working directory เป็นโฟลเดอร์ service (รวมถึงเมื่อรันจาก IDE)

Service ฟังที่ `127.0.0.1:8080`; Node.js เดิมยังรันที่ `localhost:3000`

```sh
curl http://localhost:8080/actuator/health
curl http://localhost:8080/api/v1/migration/validation
curl http://localhost:8080/api/v1/statuses
```

## ขอบเขต Module 1

| Endpoint | หน้าที่ |
|---|---|
| GET /actuator/health | ตรวจสถานะ service และการเชื่อมต่อ DB |
| GET /api/v1/statuses | สถานะงาน โดยคง field names เดิม |
| GET /api/v1/car-models | ยี่ห้อและรุ่นรถจาก `car_brands`/`car_models` |
| GET /api/v1/customer-types | ประเภทลูกค้า |
| GET /api/v1/insurances | บริษัทประกัน |
| GET /api/v1/body-parts | ชิ้นส่วนตัวถัง |
| GET /api/v1/employees | พนักงานที่ active |
| GET /api/v1/migration/validation | ตรวจ schema และ reconciliation counts |

ทุก master endpoint มี alias `/api/...` เพื่อให้ frontend เดิมทดสอบได้ โดย API ใหม่ให้ใช้ `/api/v1/...` เป็นหลัก

## Module 2: Parts & Inventory

รองรับ parts master, part statuses, orders, inbound receipts, outbound issues และ inventory balances ผ่าน `rizenic_new` โดยการรับเข้าและเบิกจ่ายจะเขียน `stock_movements` ใน transaction เดียวกัน และ outbound จะตรวจ `quantity_available` ก่อนบันทึก

## Module 3: Core Repair Jobs

รองรับ reports/jobs ผ่าน `repair_jobs` และ master relations ใหม่ โดยมี flat response compatibility สำหรับ customer, vehicle, status, department, documents และ financial summary พร้อม create/update transaction, station upsert, fast-date whitelist และ archive แทนการลบข้อมูลจริง

Module 1 ครอบคลุม master-data read APIs และ migration validation แล้ว ส่วน API ธุรกิจที่เหลือ, login/authorization และการสลับ frontend จะทำในโมดูลถัดไป

## Build

```sh
mvn verify
java -jar target/rizenic-backend-service-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

เมื่อไม่ใช้ local profile ให้กำหนด `DB_URL` (รูปแบบ JDBC), `DB_USERNAME` และ `DB_PASSWORD` เอง สามารถเปลี่ยนพอร์ตด้วย `SERVER_PORT`

## แนวทางย้ายต่อ

ใช้ `../app.js` เป็นแหล่งอ้างอิง API และ `../docs/database-code-comparison.md` เป็นรายการความต่างระหว่างโค้ดกับข้อมูล เริ่มย้ายเป็นโมดูลพร้อมเทียบ response และกฎธุรกิจ ก่อนสลับหน้าเว็บมาใช้ Java

อ้างอิง: [Spring Boot requirements](https://docs.spring.io/spring-boot/system-requirements.html), [SQL/JdbcClient support](https://docs.spring.io/spring-boot/reference/data/sql.html)

## Module 4: Inspections, Quotas and User Preferences

Module 4 รองรับ endpoint เดิมผ่านทั้ง `/api/...` และ `/api/v1/...`:

- `POST/GET /inspection` เก็บใบตรวจสภาพใน `inspections` พร้อม checklist แบบ JSONB, รองรับ `vehicle_id` สำหรับ walk-in และเก็บรูป/ลายเซ็นเป็นไฟล์ local พร้อม metadata ใน `attachments`/`inspection_attachments`
- `GET/POST/PUT/DELETE /quotas` แปลงข้อมูล quota เดิมเป็นกฎใน `branch_capacity_rules` และทำ upsert ภายใน transaction
- `GET/POST /user-preferences` เก็บ `hidden_columns` และ `row_highlights` ใน `user_preferences` ตามบัญชีพนักงาน

การเชื่อมต่อใช้ `rizenic_new` และ `ddl-auto=validate`; ไฟล์แนบใช้ `ATTACHMENT_STORAGE_PATH` (ค่าเริ่มต้น `./data/attachments`).

## Module 5: Authentication and External Integrations

- `POST /login` ตรวจสอบ BCrypt password และคืน session token, employee, roles และ branches
- bearer token ที่ส่งมาใน `Authorization` header จะถูกตรวจสอบและหมดอายุภายใน 8 ชั่วโมง
- ทุก response มี `X-Request-Id`
- `POST /sync-dynamic` รองรับเฉพาะตาราง master ที่ whitelist ไว้, ตรวจสอบชื่อ column และบันทึก audit event โดยไม่เปิด arbitrary SQL
- `POST /send-line-notify` ใช้ LINE token/group จาก environment variables (`LINE_NAVAMIN_TOKEN`, `LINE_NAVAMIN_GROUP`, `LINE_RANGSIT_TOKEN`, `LINE_RANGSIT_GROUP`) และปิดได้ด้วย `DISABLE_LINE_NOTIFICATIONS=true`

## Module 6: Frontend API v1 Cutover

Frontend เดิมเป็น vanilla HTML/JavaScript จึงเพิ่ม `public/js/api-v1-client.js` เป็น fetch compatibility layer โดยแปลง `/api/...` เป็น `/api/v1/...`, เก็บ token ใน `sessionStorage`, แนบ Bearer token และ `X-Request-Id` ทุกคำขอ และแจ้ง `rizenic:auth-expired` เมื่อได้รับ HTTP 401 ตั้ง `RIZENIC_API_MODE=legacy` ได้ระหว่าง rollback

เพิ่ม CORS สำหรับ React/Vite ที่ `FRONTEND_ORIGINS` (ค่าเริ่มต้น `http://localhost:3000,http://localhost:5173`) และเปิด `X-Request-Id` ให้ frontend อ่านได้
