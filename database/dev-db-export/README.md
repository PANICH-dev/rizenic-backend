# Rizenic database export

ไฟล์ชุดนี้เป็น **database snapshot ที่ทดสอบ restore แล้ว** จาก PostgreSQL database `rizenic_db` เมื่อ `2026-10-08` UTC สำหรับส่งให้ developer ใช้สร้างฐานข้อมูล local/staging ใหม่ ประกอบด้วยทั้ง schema `rizenic_new` และ `rizenic_old`:

- `rizenic_db_ddl.sql` — DDL: schema, tables, sequences, indexes, constraints, views และ functions ที่อยู่ในสอง schema
- `rizenic_db_dml.sql` — DML: ข้อมูลจริงและค่า sequence ของสอง schema
- `manifest.txt` — checksum และจำนวนข้อมูลสำหรับตรวจสอบไฟล์

## สิ่งที่ต้องมี

1. PostgreSQL client (`psql`) รุ่นที่รองรับ PostgreSQL ของระบบ หรือ Docker Desktop/Compose
2. สิทธิ์สร้าง database และ user ถ้าจะสร้างฐานข้อมูลใหม่เอง
3. พื้นที่ว่างเพียงพอสำหรับข้อมูล legacy และไฟล์ export ทั้งชุด

## ตรวจสอบไฟล์ก่อน restore

รันจากโฟลเดอร์นี้ และตรวจ checksum ให้ตรงกับ `manifest.txt`:

```bash
cd database/dev-db-export
shasum -a 256 rizenic_db_ddl.sql rizenic_db_dml.sql
cat manifest.txt
```

หาก checksum ไม่ตรง ให้หยุดและขอไฟล์ export ใหม่ ห้าม restore ไฟล์ที่ดาวน์โหลดไม่ครบหรือถูกแก้ไขระหว่างทาง

## วิธีสร้างฐานข้อมูลใหม่ด้วย `psql` (แนะนำสำหรับเครื่องที่ติดตั้ง PostgreSQL)

### 1. สร้าง user และ database

เปลี่ยน password ตัวอย่างเป็นค่าของ environment นั้นก่อนรัน:

```bash
psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 \
  -c "CREATE USER rizenic WITH PASSWORD '<set-local-password>';"
psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE rizenic_test OWNER rizenic;"
```

ถ้ามี user หรือ database อยู่แล้ว ให้ตรวจสอบว่าเป็น instance ที่ต้องการก่อน แล้วข้ามคำสั่งสร้างที่ทำซ้ำได้

### 2. สร้างโครงสร้างก่อนข้อมูล

ต้องรัน DDL ก่อน DML เสมอ เพราะ DDL สร้าง schema, ตาราง, sequence, index, constraint, view และ function ส่วน DML ใส่ข้อมูลและปรับค่า sequence:

```bash
psql -U rizenic -h 127.0.0.1 -p 5432 -d rizenic_test \
  -v ON_ERROR_STOP=1 -f rizenic_db_ddl.sql
psql -U rizenic -h 127.0.0.1 -p 5432 -d rizenic_test \
  -v ON_ERROR_STOP=1 -f rizenic_db_dml.sql
```

### 3. ตรวจสอบผลหลัง restore

```bash
psql -U rizenic -h 127.0.0.1 -p 5432 -d rizenic_test -v ON_ERROR_STOP=1 <<'SQL'
SELECT current_database();
SELECT count(*) AS new_tables
FROM information_schema.tables
WHERE table_schema = 'rizenic_new' AND table_type = 'BASE TABLE';
SELECT count(*) AS old_tables
FROM information_schema.tables
WHERE table_schema = 'rizenic_old' AND table_type = 'BASE TABLE';
SELECT count(*) AS repair_jobs FROM rizenic_new.repair_jobs;
SELECT count(*) AS tesla_refs
FROM rizenic_new.eclaim_vehicle_refs
WHERE lower(coalesce(eclaim_brand_code, '')) = 'etesla';
SELECT count(*) AS chubb_2418
FROM rizenic_new.eclaim_insurer_refs
WHERE external_system = 'ECLAIM' AND external_code = '2418';
SQL
```

ค่าที่ควรได้จาก snapshot นี้คือ `new_tables=57`, `old_tables=18`, `repair_jobs=1087`, `tesla_refs=7` และ `chubb_2418=1` พร้อม views ใน `rizenic_new` จำนวน 3 รายการ (จำนวนข้อมูลอาจเปลี่ยนได้หากสร้าง export ชุดใหม่)

## วิธีสร้าง `rizenic_test` ด้วย Docker Compose

ตัวอย่างนี้ใช้ PostgreSQL container ที่ชื่อ service `postgres` และใช้ user/password ตาม compose ของโปรเจกต์:

```bash
cd /path/to/rizenic-backend
docker compose up -d postgres
docker compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE rizenic_test OWNER rizenic;"
cat database/dev-db-export/rizenic_db_ddl.sql \
  | docker compose exec -T postgres psql -U rizenic -d rizenic_test -v ON_ERROR_STOP=1
cat database/dev-db-export/rizenic_db_dml.sql \
  | docker compose exec -T postgres psql -U rizenic -d rizenic_test -v ON_ERROR_STOP=1
```

ถ้า service ใช้ชื่อหรือ port ต่างจากตัวอย่าง ให้ใช้ชื่อ service และ credentials ใน compose/.env ของ environment นั้นแทน

## ตั้งค่า application ให้ใช้ฐานข้อมูลที่สร้าง

ตัวอย่างสำหรับ Spring Boot:

```bash
export DB_URL='jdbc:postgresql://127.0.0.1:5432/rizenic_test?currentSchema=rizenic_new'
export DB_USERNAME='rizenic'
export DB_PASSWORD='<set-local-password>'
java -jar rizenic-backend-service/target/*.jar --spring.profiles.active=local
```

ก่อนทดสอบ API ให้ตรวจว่า application ชี้ไปที่ `rizenic_test` จริง ไม่ใช่ `rizenic_db` และให้ใช้ `rizenic_new` เป็น default schema

## การ reset แล้ว restore ใหม่

ขั้นตอนนี้ลบข้อมูลใน database เป้าหมายทั้งหมด ใช้เฉพาะ local/test และตรวจชื่อ database ให้แน่ใจก่อน:

```bash
psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE rizenic_test WITH (FORCE);"
psql -U postgres -h 127.0.0.1 -p 5432 -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE rizenic_test OWNER rizenic;"
psql -U rizenic -h 127.0.0.1 -p 5432 -d rizenic_test -v ON_ERROR_STOP=1 -f rizenic_db_ddl.sql
psql -U rizenic -h 127.0.0.1 -p 5432 -d rizenic_test -v ON_ERROR_STOP=1 -f rizenic_db_dml.sql
```

## ข้อกำหนดการใช้งาน snapshot

- ห้ามรัน migration `V001`–`V021` ซ้ำบนฐานข้อมูลที่ restore จาก snapshot นี้ เพราะ snapshot มีโครงสร้างและข้อมูลหลัง migration แล้ว หากต้องการอัปเดตฐานข้อมูลเดิมให้ใช้ migration ตามปกติแทน
- ห้าม restore ลง database ที่มีตารางอยู่แล้ว เพราะ DDL เป็น snapshot สำหรับ database ว่าง
- DML มีข้อมูล legacy และ password hash ของบัญชีผู้ใช้ตามสภาพแวดล้อมที่ export จึงต้องเก็บในช่องทางภายในที่ปลอดภัย และต้อง reset/ทบทวน credential ก่อนใช้ร่วมกันนอก local
