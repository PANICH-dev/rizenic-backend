# Rizenic ERP — API specification

## 1. Contract

- Canonical base path: `/api/v1`
- Backward-compatible alias: `/api` (controller รองรับทั้งสอง path)
- Content type: `application/json`
- Authentication: `Authorization: Bearer <session-token>` สำหรับ endpoint ที่ต้อง login
- `repair_jobs.id` เป็น ID ใหม่ แต่ endpoint งานและ inspection รองรับ legacy reference ตามกติกาด้านล่าง

### Response ที่ใช้ร่วมกัน

สำเร็จแบบ mutation มักคืน `{"success":true}` หรือ `{"success":true,"insertedId":...}`; GET master คืน array โดยตรง ส่วน inspection/quota บางรายการห่อด้วย `data` ตาม controller ปัจจุบัน

ข้อผิดพลาดหลัก: `400` payload/parameter ไม่ถูกต้อง, `401` login ไม่ผ่าน, `403` integration ถูกปิดหรือไม่มีสิทธิ์, `404` ไม่พบข้อมูล, `409` ทำรายการที่ขัดกับ stock/integrity

## 2. Authentication

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/login` | `{username,password}` | employee/session token, `expires_in=28800` |

รหัสผ่านผิดคืน `401` และไม่คืน password/hash ใน response

## 3. Master data

| Method | Path | Request/Path | Result |
|---|---|---|---|
| GET | `/statuses` | — | status list |
| POST | `/statuses` | `StatusRequest` | saved status |
| DELETE | `/statuses/{code}` | status code | `{success:true}` |
| GET | `/car-models` | — | brand/model list |
| POST | `/car-models` | `BrandModelRequest` | saved model |
| PUT | `/car-models/{id}` | `BrandModelRequest` | updated model |
| DELETE | `/car-models/{id}` | — | `{success:true}` |
| GET | `/customer-types` | — | customer type list |
| POST | `/customer-types` | `SimpleRequest` | saved type |
| PUT | `/customer-types/{id}` | `SimpleRequest` | updated type |
| DELETE | `/customer-types/{id}` | — | `{success:true}` |
| GET | `/insurances` | — | insurer list |
| POST | `/insurances` | `InsurerRequest` | saved insurer |
| PUT | `/insurances/{code}` | `InsurerRequest` | updated insurer |
| DELETE | `/insurances/{code}` | — | `{success:true}` |
| GET | `/body-parts` | — | body-part list |
| POST | `/body-parts` | `BodyPartRequest` | saved body part |
| PUT | `/body-parts/{id}` | `BodyPartRequest` | updated body part |
| DELETE | `/body-parts/{id}` | — | `{success:true}` |
| GET | `/employees` | — | employee list without password |
| POST | `/employees` | `EmployeeRequest` | saved employee |
| PUT | `/employees/{id}` | `EmployeeRequest` | updated employee |
| DELETE | `/employees/{id}` | — | `{success:true}` |

## 4. Repair jobs

| Method | Path | Request | Result |
|---|---|---|---|
| GET | `/reports`, `/report`, `/jobs` | — | report list |
| GET | `/report/{id}` | numeric ID/reference | report detail or `404` |
| POST | `/report` | `JobCreateRequest` | `201`, `insertedId` |
| PUT | `/report/{id}` | `JobUpdateRequest` | `{success:true}` |
| DELETE | `/report/{id}` | — | archive job, preserve history |
| PUT | `/report/{id}/station` | station payload | `{success:true}` |
| PUT | `/report/{id}/fast-date` | `{field,value}` | `{success:true}` |

`{id}` lookup first tries `job_number='LEGACY-'+id`, then current `repair_jobs.id`. This prevents a legacy ID from accidentally opening a different identity-sequence row. Updates, archive, station and fast updates use the same resolver.

## 5. Parts and inventory

| Method | Path | Request | Result |
|---|---|---|---|
| GET | `/parts` | — | parts master |
| GET | `/parts/check/{partNo}` | part number | part availability or `404` |
| POST/PUT/DELETE | `/parts`, `/parts/{id}` | `PartRequest` | CRUD result |
| GET | `/part-statuses` | — | order status list |
| POST/DELETE | `/part-statuses`, `/part-statuses/{id}` | status payload | CRUD result |
| GET | `/part-orders` | — | purchase orders |
| POST/PUT/DELETE | `/part-orders`, `/part-orders/{id}` | order payload | CRUD result |
| PUT | `/part-orders/{id}/fast` | `{field,value}` | `{success:true}` |
| GET | `/part-inbound` | — | receipts |
| POST | `/part-inbound` | receipt payload | `insertedId` |
| PUT | `/part-inbound/{id}/fast` | `{field,value}` | `{success:true}` |
| DELETE | `/part-inbound/{id}` | — | `409`; reverse movement first |
| GET | `/part-outbound` | — | outbound movements |
| POST/PUT | `/part-outbound`, `/part-outbound/{id}` | outbound payload | mutation result |
| PUT | `/part-outbound/{id}/fast` | `{field,value}` | `{success:true}` |
| DELETE | `/part-outbound/{id}` | — | creates reversal |
| GET | `/parts-inventory?branch={name}` | required `branch` | inventory balances |

`/parts-inventory` without `branch` returns `400` with `{"error":"กรุณาระบุสาขา"}`. Inventory is calculated from stock movements/reservations views; do not update balances directly.

## 6. Inspection, quota and preferences

| Method | Path | Request | Result |
|---|---|---|---|
| POST | `/inspection` | inspection/checklist payload | `{success:true,data:...}` |
| GET | `/inspection/{reference}` | current ID, legacy ID, or plate | `{success:true,data:...}` |
| GET | `/quotas` | — | quota list |
| POST | `/quotas` | quota payload | `201`, `{success:true,data:...}` |
| PUT | `/quotas/{id}` | quota payload | saved quota |
| DELETE | `/quotas/{id}` | — | `{success:true}` |
| GET | `/user-preferences/{empName}` | employee name | preference object |
| POST | `/user-preferences` | preference object | `{success:true,message:...}` |

Inspection reference resolution order: numeric legacy job reference, current `repair_jobs.id`, then normalized current vehicle plate. Attachment fields may contain a storage key; clients should load `/api/v1/attachments/{storageKey}`.

## 7. Integration and migration validation

| Method | Path | Request | Result |
|---|---|---|---|
| POST | `/sync-dynamic` | controlled sync payload | integration result; arbitrary SQL is not accepted |
| POST | `/send-line-notify` | notification payload | provider result or `403` when disabled |
| POST | `/robot/outbox` | robot job JSON | `201`, persisted outbox file |
| GET | `/migration/validation` | — | migration health/counts |
| GET | `/attachments/{storageKey}` | storage key | binary file with detected media type |

The attachment endpoint is also available at `/api/attachments/{storageKey}` for old clients.

## 8. Compatibility and data rules

1. Do not use plate, VIN, employee name or customer name as a foreign key; resolve to canonical IDs.
2. Legacy job IDs are compatibility references only; store new relations with `repair_jobs.id`.
3. Stock ledger is append-only. Reversal/adjustment is required instead of deleting a posted movement.
4. E-Claim codes are external references (`eclaim_*_refs`) and must not replace master primary keys.
5. All multi-table mutations run in one transaction and write audit/history where applicable.

## 9. Source of truth

The endpoint list above is derived from Spring controllers in `rizenic-backend-service/src/main/java/com/rizenic/backend/{auth,master,jobs,parts,operations,integration,infrastructure}`. Schema names and relations are derived from migrations V001–V018. When implementation changes, update this file and `database/rizenic_new/er-diagram.md` in the same pull request.
