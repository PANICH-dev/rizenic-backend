# คู่มือและคำสั่งสำหรับการ Refactor สู่ Clean Architecture & SOLID Principles
> เอกสารสำหรับ AI / Codex ในการปรับปรุงโครงสร้าง `rizenic-backend-service` ให้เป็นไปตามมาตรฐาน Clean Architecture และ SOLID Principles โดยคงความเข้ากันได้กับระบบเดิม (Zero Regression) 100%

---

## 1. เป้าหมายและข้อกำหนดสำคัญ (Mission & Non-Negotiable Constraints)

### 🎯 เป้าหมาย (Goal):
ยกระดับสถาปัตยกรรมของ `rizenic-backend-service` จาก **Transaction Script / Smart Repository (Monolithic SQL)** ไปสู่ **Clean Architecture & SOLID Principles** เพื่อให้อ่านง่าย ทดสอบได้ด้วย Unit Test และรองรับการขยายตัวในอนาคต

### ⚠️ ข้อกำหนดห้ามละเมิดเด็ดขาด (Non-Negotiable Constraints):
1. **Zero Frontend Regression**: API Contracts ทั้งหมด (`/api/...` และ `/api/v1/...`) ต้องคืนค่า JSON ที่มีฟิลด์และชนิดข้อมูลตรงตามที่ Frontend คาดหวัง 100%:
   - `id`: ต้องมีในทุก Response ของ Job
   - `is_parked`: ต้องคืนค่าสตริงภาษาไทย `"จอดซ่อม"` หรือ `"ไม่จอดซ่อม"` (หรือ `null`)
   - `station_*`: ต้องคืน Boolean ทั้ง 12 สถานีซ่อม โดยสถานะที่เสร็จต้องตรวจพบครบ 512 ใบงาน
   - `repair_finish_date` (ช่างซ่อมเสร็จ) และ `actual_finish_date` (ปิดงาน/ส่งมอบจริง) ต้องแยกคอลัมน์กัน
   - `department_routing`: เมื่อเปลี่ยน `job_status` ต้องคืนค่าแผนกอัตโนมัติ
2. **ห้ามแตะต้อง DDL หรือ Migration สคริปต์**: ห้ามแก้ไฟล์ใน `database/` หรือโครงสร้างตารางของ `rizenic_new` และ `rizenic_old`
3. **ห้ามทิ้งข้อมูลทดสอบค้างในฐานข้อมูล**: หลังรันเทสต์ ต้องล้างข้อมูลทดสอบออกเสมอ

---

## 2. ปัญหาทางสถาปัตยกรรมปัจจุบันที่ต้องแก้ไข (Identified Architectural Defects)

### 1. การละเมิด Single Responsibility Principle (SRP)
- **`JobsRepository.java`**: เป็น God Class ทำหน้าที่ปนเปกัน 8 อย่าง:
  - ค้นหาและบันทึกลูกค้า + Identity Keys
  - ค้นหาและบันทึกรถ + ป้องกันรถซ้ำ
  - ค้นหาสาขาและจัดการ Fallback
  - จัดการเอกสาร QT, SO, BL, Claim
  - จัดการชิ้นงานซ่อม (`job_repair_items`)
  - จัดการข้อมูลการเงิน (`job_financial_summaries`)
  - จัดการสถานะสถานีช่าง 12 จุด (`job_station_progress`)
  - จัดการ Fast Update Router
- **`PartsRepository.java`**: รวมแค็ตตาล็อกอะไหล่, สั่งซื้อ, รับเข้า, เบิกจ่าย, และคำนวณยอดสต็อกไว้ในไฟล์เดียว

### 2. การละเมิด Open/Closed Principle (OCP)
- ฟังก์ชัน `fast()` ใน `JobsRepository` ใช้ `if-else` / `switch-case` ยักษ์ ทุกครั้งที่มีฟิลด์ใหม่ ต้องแก้ฟังก์ชันเดิม เสี่ยงต่อ Regression Bug

### 3. การละเมิด Dependency Inversion Principle (DIP)
- Service เชื่อมโยงตรงไปยัง Repository (Concrete Class) ที่ฝัง SQL Native และ Schema Name (`rizenic_new.*`) ไม่มี Interface/Port คั่นกลาง

### 4. Code Style & Maintainability Smells
- **Minified / Dense One-liner Code**: คลาสใน `jobs`, `parts`, และ `operations` ถูกเขียนแบบบีบอัดรวมหลายคำสั่งใน 1 บรรทัด ทำให้อ่านยาก ดีบักไม่ได้ และตรวจสอบ Git Diff ลำบาก
- **Untyped Maps (`Map<String, Object>`)**: ใช้ Map ข้ามทุกเลเยอร์ ขาด Type Safety และไม่สามารถทำ Compile-time Validation ได้
- **ขาด Centralized Exception Handling**: คอนโทรลเลอร์ใช้ try-catch เอง ขาด `@RestControllerAdvice`
- **การตั้งชื่อ `operations`**: ไม่ได้สะท้อนโดเมนธุรกิจ (ควรแยกเป็น `inspection`, `quota`, `preferences`)
- **ขาด Automated Tests**: มีเทสต์ครอบคลุมเพียง 1 ไฟล์ในทั้งระบบ

---

## 3. โครงสร้างสถาปัตยกรรมเป้าหมาย (Target Clean Architecture Blueprint)

```text
com.rizenic.backend/
├── common/                                 <-- สิ่งที่แชร์ร่วมกันทั้งระบบ
│   ├── exception/
│   │   ├── EntityNotFoundException.java
│   │   ├── ValidationException.java
│   │   └── GlobalExceptionHandler.java     <-- @RestControllerAdvice
│   └── valueobject/
│       ├── PhoneNumber.java
│       └── PlateNumber.java
│
├── jobs/                                   <-- Bounded Context: Repair Jobs
│   ├── domain/                             <-- Core Business Logic & Rules
│   │   ├── model/
│   │   │   ├── RepairJob.java
│   │   │   ├── Vehicle.java
│   │   │   ├── Customer.java
│   │   │   └── StationProgress.java
│   │   └── repository/                     <-- Driven Ports (Interfaces)
│   │       ├── RepairJobRepository.java
│   │       ├── VehicleRepository.java
│   │       ├── CustomerRepository.java
│   │       └── JobDocumentRepository.java
│   ├── application/                        <-- Use Cases / Application Services
│   │   ├── dto/
│   │   │   ├── JobResponse.java            <-- Java 21 Record
│   │   │   ├── JobCreateRequest.java
│   │   │   ├── JobUpdateRequest.java
│   │   │   └── FastUpdateRequest.java
│   │   ├── service/
│   │   │   ├── JobQueryService.java
│   │   │   ├── JobCommandService.java
│   │   │   └── JobStationService.java
│   │   └── strategy/                       <-- Strategy Pattern สำหรับ Fast Update (OCP)
│   │       ├── JobFieldUpdateStrategy.java
│   │       ├── JobStatusUpdateStrategy.java
│   │       ├── FinancialUpdateStrategy.java
│   │       └── VehicleFieldUpdateStrategy.java
│   └── infrastructure/                     <-- Adapters
│       ├── web/
│       │   └── JobsController.java
│       └── persistence/
│           ├── JdbcRepairJobRepositoryAdapter.java
│           ├── JdbcVehicleRepositoryAdapter.java
│           └── JdbcCustomerRepositoryAdapter.java
│
├── parts/                                  <-- Bounded Context: Parts & Inventory
│   ├── application/
│   │   ├── PartCatalogService.java
│   │   ├── PartOrderService.java
│   │   ├── PartReceiptService.java
│   │   ├── PartOutboundService.java
│   │   └── InventoryService.java
│   ├── infrastructure/
│   │   ├── web/PartsController.java
│   │   └── persistence/JdbcPartsRepositoryAdapter.java
│   └── dto/PartsDtos.java
│
├── inspection/                             <-- เดิมอยู่ใน operations
├── quota/                                  <-- เดิมอยู่ใน operations
└── preference/                             <-- เดิมอยู่ใน operations
```

---

## 4. แผนปฏิบัติการ Refactoring ทีละขั้นตอน (Step-by-Step Tasks for Codex)

### ขั้นตอนที่ 1: จัด Format โค้ดและสร้าง Global Exception Handler (Quick Win)
1. **จัด Format โค้ดทั้งหมด** ตาม Google Java Style Guide (แตกบรรทัด Loop, If-Else, Method Signature, Class Body ให้เป็นระเบียบ)
2. สร้างคลาส `GlobalExceptionHandler.java` ภายใต้ `com.rizenic.backend.common.exception`:
   - จัดการ `NoSuchElementException` / `EntityNotFoundException` -> คืน HTTP 404 พร้อม JSON `{"error": "..."}`
   - จัดการ `IllegalArgumentException` / `ValidationException` -> คืน HTTP 400 พร้อม JSON `{"error": "..."}`
   - จัดการ Exception ทั่วไป -> คืน HTTP 500 พร้อม Log ที่ชัดเจน
3. นำ try-catch บล็อกออกจาก Controllers ทั้งหมด

### ขั้นตอนที่ 2: สร้าง Strongly-Typed Record DTOs สำหรับ Job API
สร้าง Record DTOs ทดแทน `Map<String, Object>` ใน `com.rizenic.backend.jobs.application.dto`:
- `JobResponse`: ระบุฟิลด์ครบถ้วน (`id`, `report_id`, `job_id`, `branch_name`, `customer_name`, `phone_number`, `customer_type`, `sa_owner`, `car_plate`, `vin_no`, `car_color`, `car_model`, `car_brand`, `job_status`, `department_routing`, `damage_level`, `payment_type`, `notes`, `repair_notes`, `contact_date`, `appointment_date`, `arrived_date`, `target_finish_date`, `actual_finish_date`, `repair_finish_date`, `delivery_date`, `is_parked`, `created_at`, `cost_labor`, `cost_part`, `cost_external`, `billing_date`, `station_kho` ... `station_ready`, `qt_no`, `so_no`, `bl_no`, `epc_no`, `claim_no`, `main_part_name`, `main_part_qty`, `sub_part_name`, `sub_part_qty`)
- `JobCreateRequest`, `JobUpdateRequest`, `JobFastUpdateRequest`, `JobStationUpdateRequest`

### ขั้นตอนที่ 3: Refactor การอัปเดตด่วน (Fast Update) ด้วย Strategy Pattern (OCP)
1. สร้าง Interface:
   ```java
   public interface JobFieldUpdateStrategy {
       boolean supports(String field);
       FastUpdateResult update(Long jobId, Object value);
   }
   ```
2. แยก Implementation ออกเป็น Strategy ย่อย:
   - `JobStatusUpdateStrategy`: อัปเดตสถานะ + Map หาแผนกอัตโนมัติ
   - `FinancialUpdateStrategy`: อัปเดต `cost_labor`, `cost_part`, `cost_external`, `billing_date`, `insurance_pay_date` ลงตาราง `job_financial_summaries`
   - `DocumentUpdateStrategy`: อัปเดต `qt_no`, `so_no`, `bl_no`, `epc_no`, `claim_no`, `ivn_no` ลงตาราง `job_documents`
   - `VehicleUpdateStrategy`: อัปเดต `car_plate`, `car_color`, `vin_no`
   - `CustomerUpdateStrategy`: อัปเดต `customer_name`, `phone_number`
   - `PartTrackingUpdateStrategy`: อัปเดต `order_part_date`, `est_part_date`
   - `ParkedStatusUpdateStrategy`: แปลง `"จอดซ่อม"` / `"ไม่จอดซ่อม"` เป็น Boolean และบันทึกลง `repair_jobs.is_parked`
   - `DateFieldUpdateStrategy`: อัปเดตวันนัดหมายและวันจบงาน (`repair_finished_on`, `actual_finish_on`, `target_finish_on` ฯลฯ)
3. ให้ `JobFastUpdateService` วนลูปเลือก Strategy ที่ `supports(field)` แล้ว execute

### ขั้นตอนที่ 4: แยก Responsibility ย่อยออกจาก `JobsRepository` (SRP & DIP)
1. **`CustomerPersistenceAdapter`**: ดูแลเฉพาะการค้นหาลูกค้า, Deduplicate เบอร์โทร, และจัดการตาราง `customers`, `customer_contacts`, `customer_identity_keys`
2. **`VehiclePersistenceAdapter`**: ดูแลเฉพาะการค้นหารถด้วย VIN / ทะเบียน และการบันทึกลง `vehicles`
3. **`JobDocumentPersistenceAdapter`**: ดูแลเฉพาะการแปลงสตริงคั่นด้วยเครื่องหมายจุลภาค และบันทึกลง `job_documents`
4. **`JobStationPersistenceAdapter`**: ดูแลเฉพาะการบันทึกสถานะลง `job_station_progress`
5. **`RepairJobRepositoryAdapter`**: ดูแลเฉพาะตัวตาราง `repair_jobs` และการ SELECT ข้อมูลใบงาน

### ขั้นตอนที่ 5: ปรับปรุงโมดูล `operations` ให้เป็น Domain Packages
- ย้ายโค้ดใน `com.rizenic.backend.operations` ออกเป็น:
  - `com.rizenic.backend.inspection` (สำหรับ `/api/inspection`)
  - `com.rizenic.backend.quota` (สำหรับ `/api/quotas`)
  - `com.rizenic.backend.preference` (สำหรับ `/api/user-preferences`)

### ขั้นตอนที่ 6: เขียน Automated Tests (Unit & Integration Tests)
1. **Controller Tests (`MockMvc`)**:
   - `GET /api/reports`: ทดสอบว่าได้ JSON อาเรย์และมีฟิลด์ `id`, `station_*` ครบถ้วน
   - `GET /api/report/999999`: ทดสอบว่าได้ HTTP 404
   - `PUT /api/report/{id}/fast-date`: ทดสอบทั้ง `job_status`, `is_parked`, `billing_date`
2. **Service Tests (`Mockito`)**:
   - ทดสอบการเลือก Strategy ของ Fast Update
   - ทดสอบ Branch Fallback Logic
   - ทดสอบการแปลงค่า Boolean ของ `is_parked`

---

## 5. ตารางตรวจสอบความถูกต้องก่อนส่งมอบ (Codex Acceptance Checklist)

| ข้อกำหนด | วิธีการทดสอบ | เกณฑ์การผ่าน |
| :--- | :--- | :--- |
| **1. Code Formatting** | ตรวจสอบไฟล์ `.java` ทั้งหมด | ไม่มีคำสั่งยัดรวมกันหลายคำสั่งใน 1 บรรทัด โค้ดจัดย่อหน้าถูกต้องตามหลัก Google Java Style |
| **2. Compilation & Build** | `mvn clean compile` | BUILD SUCCESS โดยไม่มีคำเตือนหรือ Error |
| **3. Automated Tests** | `mvn test` | รันเทสต์ผ่าน 100% |
| **4. Jobs API Compatibility** | `curl -s http://localhost:8080/api/reports` | คืนค่า `id`, `report_id`, `job_id`, `station_kho`..`station_ready` ครบถ้วน |
| **5. Station Completed Count** | ตรวจนับจำนวนใบงานที่มีสถานะเสร็จ | ตรวจพบอย่างน้อย 1 สถานีเท่ากับ **512 ใบงาน** |
| **6. is_parked Behavior** | ทดสอบ Query และ PUT fast-date | คืนสตริง `"จอดซ่อม"` / `"ไม่จอดซ่อม"` และอัปเดตค่าได้โดยไม่มี HTTP 500 |
| **7. Date Separation** | ทดสอบแก้ `repair_finish_date` | บันทึกลง `repair_finished_on` โดยไม่กระทบ `actual_finish_on` |
| **8. Error 404** | ยิงไอดี 999999 | ได้ `HTTP 404 {"error": "..."}` ทั้ง GET และ DELETE |
| **9. Database Purity** | `git status` & ตรวจสอบ DB | ไม่มี DDL ถูกแก้ไข และไม่มีข้อมูลเทสต์ค้างในฐานข้อมูล |
