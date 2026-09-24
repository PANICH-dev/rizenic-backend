\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

DO $$ BEGIN
    IF current_database() <> 'rizenic_db' THEN
        RAISE EXCEPTION 'This migration must run against rizenic_db';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'rizenic_old') THEN
        RAISE EXCEPTION 'Source schema rizenic_old is missing';
    END IF;
END $$;

INSERT INTO migration_runs(source_name, source_checksum, mapping_version, state, summary)
VALUES ('Database.zip / rizenic_old', NULL, 'V002', 'RUNNING', '{}'::jsonb)
RETURNING id AS run_id \gset

-- 1. Canonical masters ------------------------------------------------------
INSERT INTO branches(code, name)
SELECT lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '_', 'g')), name
FROM (
    SELECT DISTINCT trim(branch_name) AS name FROM rizenic_old.rizenicemployeemaster WHERE nullif(trim(branch_name), '') IS NOT NULL
    UNION SELECT DISTINCT trim(branch_name) FROM rizenic_old.rizenicreport WHERE nullif(trim(branch_name), '') IS NOT NULL
    UNION SELECT DISTINCT trim(branch_name) FROM rizenic_old.rizenic_part_locations WHERE nullif(trim(branch_name), '') IS NOT NULL
    UNION SELECT DISTINCT trim(branch_name) FROM rizenic_old.rizenic_part_orders WHERE nullif(trim(branch_name), '') IS NOT NULL
    UNION SELECT DISTINCT trim(branch_name) FROM rizenic_old.rizenic_part_inbound WHERE nullif(trim(branch_name), '') IS NOT NULL
    UNION SELECT DISTINCT trim(branch_name) FROM rizenic_old.rizenic_part_outbound WHERE nullif(trim(branch_name), '') IS NOT NULL
    UNION SELECT DISTINCT trim(branch_name) FROM rizenic_old.rizenic_quotas WHERE nullif(trim(branch_name), '') IS NOT NULL
) b
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO departments(code, name)
SELECT DISTINCT lower(regexp_replace(trim(name), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), trim(name)
FROM (
    SELECT department AS name FROM rizenic_old.rizenicstatusmaster
    UNION SELECT routing_name FROM rizenic_old.rizenic_routing_master
) d
WHERE nullif(trim(name), '') IS NOT NULL
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO employees(employee_code, display_name, phone, home_branch_id, is_active)
SELECT e.employee_code, e.employee_name, nullif(trim(e.employee_phone), ''), b.id, coalesce(e.is_active, true)
FROM rizenic_old.rizenicemployeemaster e
LEFT JOIN branches b ON lower(b.name) = lower(trim(e.branch_name))
WHERE nullif(trim(e.employee_code), '') IS NOT NULL
ON CONFLICT (employee_code) DO UPDATE SET display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone, home_branch_id = EXCLUDED.home_branch_id, is_active = EXCLUDED.is_active;

INSERT INTO roles(code, name)
SELECT DISTINCT lower(trim(employee_role)), trim(employee_role)
FROM rizenic_old.rizenicemployeemaster
WHERE nullif(trim(employee_role), '') IS NOT NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO user_accounts(employee_id, username, password_hash, credential_state)
SELECT e.id, m.username, NULL, 'RESET_REQUIRED'
FROM rizenic_old.rizenicemployeemaster m
JOIN employees e ON e.employee_code = m.employee_code
WHERE nullif(trim(m.username), '') IS NOT NULL
ON CONFLICT (employee_id) DO UPDATE SET username = EXCLUDED.username;

INSERT INTO permissions(code, description)
SELECT DISTINCT 'PAGE:' || trim(page_name), 'Legacy accessible page'
FROM rizenic_old.rizenicemployeemaster m
CROSS JOIN LATERAL regexp_split_to_table(coalesce(m.accessible_pages, ''), '\\s*,\\s*') page_name
WHERE nullif(trim(page_name), '') IS NOT NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO user_branch_roles(user_id, branch_id, role_id)
SELECT DISTINCT ua.id, b.id, r.id
FROM rizenic_old.rizenicemployeemaster m
JOIN user_accounts ua ON ua.username = m.username
JOIN branches b ON lower(b.name) = lower(trim(m.branch_name))
JOIN roles r ON r.code = lower(trim(m.employee_role))
ON CONFLICT DO NOTHING;

INSERT INTO user_branch_permissions(user_id, branch_id, permission_id, effect)
SELECT DISTINCT ua.id, b.id, p.id, 'ALLOW'
FROM rizenic_old.rizenicemployeemaster m
JOIN user_accounts ua ON ua.username = m.username
JOIN branches b ON lower(b.name) = lower(trim(m.branch_name))
CROSS JOIN LATERAL regexp_split_to_table(coalesce(m.accessible_pages, ''), '\\s*,\\s*') page_name
JOIN permissions p ON p.code = 'PAGE:' || trim(page_name)
ON CONFLICT DO NOTHING;

INSERT INTO customer_types(code, name)
SELECT DISTINCT ON (type_code) type_code, type_name
FROM rizenic_old.rizeniccustomertypemaster
ORDER BY type_code, customer_type_id DESC
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO car_brands(code, name)
SELECT DISTINCT ON (lower(regexp_replace(trim(car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g')))
       lower(regexp_replace(trim(car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), trim(car_brand)
FROM rizenic_old.rizeniccarmodelmaster
WHERE nullif(trim(car_brand), '') IS NOT NULL
ORDER BY lower(regexp_replace(trim(car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), model_id DESC
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO car_models(brand_id, model_name)
SELECT DISTINCT b.id, trim(m.car_model)
FROM rizenic_old.rizeniccarmodelmaster m
JOIN car_brands b ON b.code = lower(regexp_replace(trim(m.car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g'))
WHERE nullif(trim(m.car_brand), '') IS NOT NULL AND nullif(trim(m.car_model), '') IS NOT NULL
ON CONFLICT (brand_id, model_name) DO NOTHING;

-- Preserve vehicles whose source model is blank without leaving a nullable
-- model relation. The brand remains known whenever the source contains it.
INSERT INTO car_brands(code, name)
VALUES ('unknown_brand', 'ไม่ระบุยี่ห้อ')
ON CONFLICT (code) DO NOTHING;

INSERT INTO car_models(brand_id, model_name)
SELECT b.id, 'ไม่ระบุรุ่น'
FROM car_brands b
WHERE b.code = 'unknown_brand'
   OR EXISTS (
       SELECT 1 FROM rizenic_old.rizenicreport r
       WHERE nullif(trim(r.car_brand), '') IS NOT NULL
         AND nullif(trim(r.car_model), '') IS NULL
         AND b.code = lower(regexp_replace(trim(r.car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g'))
   )
ON CONFLICT (brand_id, model_name) DO NOTHING;

INSERT INTO insurers(code, name, insurance_type)
SELECT insurance_code, insurance_name, insurance_type FROM rizenic_old.rizenicinsurancemaster
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, insurance_type = EXCLUDED.insurance_type;

INSERT INTO departments(code, name)
SELECT DISTINCT lower(regexp_replace(trim(department), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), trim(department)
FROM rizenic_old.rizenicstatusmaster WHERE nullif(trim(department), '') IS NOT NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO job_statuses(code, name, department_id, legacy_route_page)
SELECT s.status_code, s.status_name,
       d.id, s.route_page
FROM rizenic_old.rizenicstatusmaster s
LEFT JOIN departments d ON lower(d.name) = lower(trim(s.department))
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
    department_id = EXCLUDED.department_id, legacy_route_page = EXCLUDED.legacy_route_page;

INSERT INTO body_parts(name, category)
SELECT part_name, CASE WHEN category = 'ชิ้นส่วนหลัก' THEN 'MAIN' ELSE 'SUB' END
FROM rizenic_old.rizenic_body_parts
ON CONFLICT DO NOTHING;

INSERT INTO parts(part_number, main_part_number, name, category, default_unit_price)
SELECT part_no, part_main_no, part_name, part_category, unit_price
FROM rizenic_old.rizenicpartsmaster
ON CONFLICT (part_number) DO UPDATE SET main_part_number = EXCLUDED.main_part_number,
    name = EXCLUDED.name, category = EXCLUDED.category, default_unit_price = EXCLUDED.default_unit_price;

UPDATE parts p
SET compatible_with_all_models = true
FROM rizenic_old.rizenicpartsmaster m
WHERE p.part_number = m.part_no
  AND EXISTS (
      SELECT 1 FROM unnest(string_to_array(coalesce(m.car_model, ''), ',')) token
      WHERE upper(trim(token)) = 'ALL'
  );

INSERT INTO part_compatible_models(part_id, car_model_id)
SELECT DISTINCT p.id, cm.id
FROM rizenic_old.rizenicpartsmaster m
JOIN parts p ON p.part_number = m.part_no
CROSS JOIN LATERAL unnest(string_to_array(coalesce(m.car_model, ''), ',')) token
JOIN car_models cm ON lower(trim(cm.model_name)) = lower(trim(token))
WHERE nullif(trim(token), '') IS NOT NULL AND upper(trim(token)) <> 'ALL'
ON CONFLICT DO NOTHING;

INSERT INTO part_compatibility_unresolved(part_id, raw_model_name)
SELECT DISTINCT p.id, trim(token)
FROM rizenic_old.rizenicpartsmaster m
JOIN parts p ON p.part_number = m.part_no
CROSS JOIN LATERAL unnest(string_to_array(coalesce(m.car_model, ''), ',')) token
WHERE nullif(trim(token), '') IS NOT NULL
  AND upper(trim(token)) <> 'ALL'
  AND NOT EXISTS (SELECT 1 FROM car_models cm WHERE lower(trim(cm.model_name)) = lower(trim(token)))
ON CONFLICT DO NOTHING;

-- Keep transaction rows whose part master is missing without inventing a
-- duplicate real part. These are explicitly marked as legacy unresolved.
INSERT INTO parts(part_number, name, category)
SELECT DISTINCT x.part_no, '[LEGACY UNRESOLVED] ' || x.part_no, 'LEGACY_UNRESOLVED'
FROM (
    SELECT part_no FROM rizenic_old.rizenic_part_orders
    UNION SELECT part_no FROM rizenic_old.rizenic_part_inbound
    UNION SELECT part_no FROM rizenic_old.rizenic_part_outbound
    UNION SELECT part_no FROM rizenic_old.rizenic_part_locations
) x
WHERE nullif(trim(x.part_no), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM parts p WHERE p.part_number = x.part_no)
ON CONFLICT (part_number) DO NOTHING;

INSERT INTO branch_parts(branch_id, part_id, storage_location, safety_stock)
SELECT b.id, p.id, l.location, coalesce(l.safety_stock, 0)
FROM rizenic_old.rizenic_part_locations l
JOIN branches b ON lower(b.name) = lower(trim(l.branch_name))
JOIN parts p ON p.part_number = l.part_no
ON CONFLICT (branch_id, part_id) DO UPDATE SET storage_location = EXCLUDED.storage_location,
    safety_stock = EXCLUDED.safety_stock;

INSERT INTO part_order_statuses(code, name)
SELECT DISTINCT lower(regexp_replace(trim(status_name), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), status_name
FROM rizenic_old.rizenic_part_status_master
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO repair_stations(code, name, sort_order)
VALUES ('KHO', '01.เคาะ', 1), ('POU', '02.โป๊ว', 2), ('PUAN', '03.เตรียมพื้น', 3),
       ('PON', '04.พ่นสี', 4), ('PRAK', '05.ประกอบ', 5), ('KAT', '06.ขัดสี', 6),
       ('QC', '07.QC', 7), ('MAG', '08.แม็ก', 8), ('KRAJ', '09.กระจก', 9),
       ('FILM', '10.ฟิล์ม', 10), ('PAK', '11.พักซ่อม', 11), ('READY', '12.รอส่งมอบ', 12)
ON CONFLICT (code) DO NOTHING;

-- 2. Customer and vehicle canonicalization ---------------------------------
-- Canonical customer identity: normalized phone first, normalized name only
-- for reports without a phone. Every report still receives a source-scoped
-- external key so its historical job remains traceable.
INSERT INTO customers(display_name)
SELECT coalesce(nullif(trim(customer_name), ''), 'Legacy customer ' || source_id)
FROM (
    SELECT min(id) source_id,
           lower(regexp_replace(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '[^0-9+]', '', 'g')) normalized_phone,
           min(nullif(trim(customer_name), '')) customer_name
    FROM rizenic_old.rizenicreport
    WHERE nullif(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '') IS NOT NULL
    GROUP BY lower(regexp_replace(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '[^0-9+]', '', 'g'))
) x
ON CONFLICT DO NOTHING;

INSERT INTO customers(display_name)
SELECT min(nullif(trim(customer_name), ''))
FROM rizenic_old.rizenicreport
WHERE nullif(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '') IS NULL
  AND nullif(trim(customer_name), '') IS NOT NULL
GROUP BY lower(trim(customer_name));

INSERT INTO customers(display_name)
SELECT 'Legacy report customer ' || r.id
FROM rizenic_old.rizenicreport r
WHERE nullif(trim(coalesce(nullif(r.phone_number, ''), nullif(r.customer_phone, ''))), '') IS NULL
  AND nullif(trim(r.customer_name), '') IS NULL;

INSERT INTO customer_identity_keys(customer_id, key_type, normalized_key)
SELECT DISTINCT ON (normalized_phone) c.id, 'PHONE', normalized_phone
FROM (
    SELECT lower(regexp_replace(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '[^0-9+]', '', 'g')) normalized_phone,
           min(nullif(trim(customer_name), '')) customer_name
    FROM rizenic_old.rizenicreport
    WHERE nullif(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '') IS NOT NULL
    GROUP BY lower(regexp_replace(trim(coalesce(nullif(phone_number, ''), nullif(customer_phone, ''))), '[^0-9+]', '', 'g'))
) x
JOIN customers c ON lower(c.display_name) = lower(coalesce(x.customer_name, 'Legacy customer ' || x.normalized_phone))
ORDER BY normalized_phone, c.id
ON CONFLICT DO NOTHING;

INSERT INTO customer_identity_keys(customer_id, key_type, normalized_key)
SELECT c.id, 'EXTERNAL_ID', 'report:' || r.id
FROM rizenic_old.rizenicreport r
JOIN customers c ON c.id = COALESCE(
    (SELECT k.customer_id FROM customer_identity_keys k
     WHERE k.key_type='PHONE' AND k.normalized_key = lower(regexp_replace(trim(coalesce(nullif(r.phone_number, ''), nullif(r.customer_phone, ''))), '[^0-9+]', '', 'g'))),
    (SELECT c2.id FROM customers c2
     WHERE lower(c2.display_name) = lower(nullif(trim(r.customer_name), ''))
     ORDER BY c2.id LIMIT 1),
    (SELECT c3.id FROM customers c3 WHERE c3.display_name = 'Legacy report customer ' || r.id)
)
ON CONFLICT DO NOTHING;

INSERT INTO customer_contacts(customer_id, contact_type, raw_value, is_primary)
SELECT DISTINCT k.customer_id, 'PHONE', v.raw_phone, false
FROM rizenic_old.rizenicreport r
JOIN customer_identity_keys k ON k.key_type='EXTERNAL_ID' AND k.normalized_key='report:' || r.id
CROSS JOIN LATERAL (VALUES (nullif(trim(r.phone_number), '')), (nullif(trim(r.customer_phone), ''))) v(raw_phone)
WHERE v.raw_phone IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO vehicles(car_model_id, vin, plate_number, color)
SELECT DISTINCT ON (coalesce(nullif(trim(v.vin_no), ''), nullif(trim(v.car_plate), ''), 'report:' || v.id))
       COALESCE(cm.id, unknown_cm.id), nullif(trim(v.vin_no), ''), nullif(trim(v.car_plate), ''), nullif(trim(v.car_color), '')
FROM rizenic_old.rizenicreport v
LEFT JOIN car_brands cb ON cb.code = lower(regexp_replace(trim(v.car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g'))
LEFT JOIN car_models cm ON cm.brand_id = cb.id AND cm.model_name = trim(v.car_model)
LEFT JOIN car_models unknown_cm ON unknown_cm.brand_id = COALESCE(cb.id, (SELECT id FROM car_brands WHERE code = 'unknown_brand'))
    AND unknown_cm.model_name = 'ไม่ระบุรุ่น'
ORDER BY coalesce(nullif(trim(v.vin_no), ''), nullif(trim(v.car_plate), ''), 'report:' || v.id), v.id;

-- 3. Jobs, schedules, documents and repair progress -----------------------
INSERT INTO repair_jobs(branch_id, job_number, customer_id, vehicle_id, service_advisor_id,
                        customer_type_id, insurer_id, status_id, department_id, damage_level,
                        payment_label, is_parked, notes, repair_notes, complaint_note,
                        contact_on, appointment_on, intake_on, estimated_finish_on, target_finish_on,
                        actual_finish_on, repair_finished_on, delivery_on, created_at)
SELECT b.id, 'LEGACY-' || r.id, coalesce(c.id, ce.customer_id), v.id, e.id, ct.id, i.id, js.id, d.id,
       nullif(trim(r.damage_level), ''), nullif(trim(r.payment_type), ''),
       CASE lower(trim(r.is_parked)) WHEN 'จอดซ่อม' THEN true WHEN 'ไม่จอดซ่อม' THEN false ELSE NULL END,
       r.notes, r.repair_notes, r.complain_note, r.contact_date, r.appointment_date, r.arrived_date,
       r.expected_finish_date, r.target_finish_date, r.actual_finish_date, r.repair_finish_date,
       r.delivery_date, coalesce(r.created_at, now())
FROM rizenic_old.rizenicreport r
JOIN branches b ON lower(b.name) = lower(trim(r.branch_name))
LEFT JOIN customer_identity_keys ck ON ck.key_type = 'PHONE'
    AND ck.normalized_key = lower(regexp_replace(trim(coalesce(nullif(r.phone_number, ''), nullif(r.customer_phone, ''))), '[^0-9+]', '', 'g'))
LEFT JOIN customers c ON c.id = ck.customer_id
LEFT JOIN customer_identity_keys ce ON ce.key_type = 'EXTERNAL_ID' AND ce.normalized_key = 'report:' || r.id
LEFT JOIN vehicles v ON coalesce(nullif(trim(v.plate_number), ''), nullif(trim(v.vin), '')) = coalesce(nullif(trim(r.car_plate), ''), nullif(trim(r.vin_no), ''))
LEFT JOIN employees e ON lower(trim(e.display_name)) = lower(trim(r.sa_owner))
LEFT JOIN customer_types ct ON ct.name = trim(r.customer_type)
LEFT JOIN insurers i ON lower(i.name) = lower(trim(r.payment_type))
LEFT JOIN job_statuses js ON js.name = trim(r.job_status)
LEFT JOIN departments d ON lower(d.name) = lower(trim(r.department_routing))
ON CONFLICT (branch_id, job_number) DO NOTHING;

-- Fill the customer relation from the external key for name-only reports.
UPDATE repair_jobs j SET customer_id = k.customer_id
FROM rizenic_old.rizenicreport r
JOIN customer_identity_keys k ON k.key_type = 'EXTERNAL_ID' AND k.normalized_key = 'report:' || r.id
WHERE j.job_number = 'LEGACY-' || r.id AND j.customer_id IS NULL;

INSERT INTO job_documents(job_id, document_type, document_number)
SELECT j.id, x.document_type, trim(x.document_number)
FROM rizenic_old.rizenicreport r
JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
CROSS JOIN LATERAL (
    SELECT 'QT' document_type, unnest(string_to_array(concat_ws(',', nullif(trim(r.qt_no), ''), nullif(trim(r.quotation_no), '')), ',')) document_number
    UNION ALL SELECT 'SO', unnest(string_to_array(concat_ws(',', nullif(trim(r.so_no), ''), nullif(trim(r.job_order_no), '')), ','))
    UNION ALL SELECT 'BL', unnest(string_to_array(coalesce(r.bl_no, ''), ','))
    UNION ALL SELECT 'IVN', unnest(string_to_array(coalesce(r.ivn_no, ''), ','))
    UNION ALL SELECT 'EPC', unnest(string_to_array(coalesce(r.epc_no, ''), ','))
    UNION ALL SELECT 'CLAIM', unnest(string_to_array(coalesce(r.claim_no, ''), ','))
) x
WHERE nullif(trim(x.document_number), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO job_repair_items(job_id, body_part_id, category, description, quantity, sort_order)
SELECT j.id, bp.id, x.category, trim(x.description), 1,
       row_number() OVER (PARTITION BY j.id, x.category ORDER BY x.ord)
FROM rizenic_old.rizenicreport r
JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
CROSS JOIN LATERAL (
    SELECT 'MAIN' category, unnest(string_to_array(coalesce(r.main_part_name, ''), ',')) description, 1 ord
    UNION ALL SELECT 'SUB', unnest(string_to_array(coalesce(r.sub_part_name, ''), ',')), 2
) x
LEFT JOIN body_parts bp ON bp.category = x.category AND lower(bp.name) = lower(trim(x.description))
WHERE nullif(trim(x.description), '') IS NOT NULL;

INSERT INTO job_capacity_requirements(job_id, metric, units)
SELECT j.id, x.metric, greatest(coalesce(x.units, 0), 0)
FROM rizenic_old.rizenicreport r
JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
CROSS JOIN LATERAL (VALUES ('MAIN_PARTS', r.main_part_qty), ('SUB_PARTS', r.sub_part_qty)) x(metric, units)
ON CONFLICT (job_id, metric) DO UPDATE SET units = EXCLUDED.units;

INSERT INTO job_part_tracking(job_id, status, ordered_on, estimated_arrival_on)
SELECT j.id, r.part_status, r.order_part_date, r.est_part_date
FROM rizenic_old.rizenicreport r JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
WHERE r.part_status IS NOT NULL OR r.order_part_date IS NOT NULL OR r.est_part_date IS NOT NULL
ON CONFLICT (job_id) DO UPDATE SET status = EXCLUDED.status,
    ordered_on = EXCLUDED.ordered_on, estimated_arrival_on = EXCLUDED.estimated_arrival_on;

INSERT INTO job_part_requests(job_id, description, quantity, sort_order)
SELECT j.id, trim(x.description), 1, row_number() OVER (PARTITION BY j.id ORDER BY x.ord)
FROM rizenic_old.rizenicreport r JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
CROSS JOIN LATERAL unnest(string_to_array(coalesce(r.ordered_part_names, ''), ',')) WITH ORDINALITY x(description, ord)
WHERE nullif(trim(x.description), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO job_station_progress(job_id, station_id, state, legacy_checked)
SELECT j.id, s.id,
       CASE WHEN x.checked THEN 'COMPLETED' ELSE 'NOT_STARTED' END, x.checked
FROM rizenic_old.rizenicreport r
JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
CROSS JOIN LATERAL (VALUES
    ('KHO', r.station_kho), ('POU', r.station_pou), ('PUAN', r.station_puan), ('PON', r.station_pon),
    ('PRAK', r.station_prak), ('KAT', r.station_kat), ('QC', r.station_qc), ('MAG', r.station_mag),
    ('KRAJ', r.station_kraj), ('FILM', r.station_film), ('PAK', r.station_pak), ('READY', r.station_ready)
) x(code, checked)
JOIN repair_stations s ON s.code = x.code
ON CONFLICT (job_id, station_id) DO UPDATE SET state = EXCLUDED.state, legacy_checked = EXCLUDED.legacy_checked;

INSERT INTO job_status_history(job_id, new_status_id, occurred_at, source, reason)
SELECT j.id, j.status_id, coalesce(j.created_at, now()), 'MIGRATION', 'Initial status from rizenicreport'
FROM repair_jobs j WHERE j.status_id IS NOT NULL;

INSERT INTO job_financial_summaries(job_id, currency, labor_amount, parts_amount, external_amount, billing_on, insurance_paid_on)
SELECT j.id, 'THB', r.cost_labor, r.cost_part, r.cost_external, r.billing_date, r.insurance_pay_date
FROM rizenic_old.rizenicreport r JOIN repair_jobs j ON j.job_number = 'LEGACY-' || r.id
ON CONFLICT (job_id) DO UPDATE SET labor_amount = EXCLUDED.labor_amount,
    parts_amount = EXCLUDED.parts_amount, external_amount = EXCLUDED.external_amount,
    billing_on = EXCLUDED.billing_on, insurance_paid_on = EXCLUDED.insurance_paid_on;

-- 4. Quotas -----------------------------------------------------------------
INSERT INTO branch_capacity_rules(branch_id, metric, rule_date, capacity_limit)
SELECT b.id, x.metric, CASE WHEN q.quota_type = 'special' THEN q.quota_date ELSE NULL END, x.limit_value
FROM rizenic_old.rizenic_quotas q
JOIN branches b ON lower(b.name) = lower(trim(q.branch_name))
CROSS JOIN LATERAL (VALUES
    ('INTAKE_CARS', q.quota_arrived), ('TARGET_CARS', q.quota_target), ('DELIVERY_CARS', q.quota_delivery),
    ('COLOR_PARTS', q.quota_color_parts), ('MAIN_PARTS', q.quota_main_parts), ('SUB_PARTS', q.quota_sub_parts)
) x(metric, limit_value)
ON CONFLICT (branch_id, metric, rule_date) DO UPDATE SET capacity_limit = EXCLUDED.capacity_limit;

-- 5. Orders, receipts and stock --------------------------------------------
INSERT INTO part_orders(branch_id, order_number, epc_reference, ordered_on, ordered_at, notes)
SELECT b.id, 'LEGACY-PO-' || o.order_id, o.epc_no, o.order_date,
       CASE WHEN o.order_time ~ '^\\d{2}:\\d{2}' THEN o.order_time::time ELSE NULL END, o.notes
FROM rizenic_old.rizenic_part_orders o
JOIN branches b ON lower(b.name) = lower(trim(o.branch_name))
ON CONFLICT (branch_id, order_number) DO NOTHING;

INSERT INTO part_order_items(branch_id, order_id, line_number, job_id, part_id, status_id,
                             description, part_type, quantity_ordered, estimated_arrival_on, reported_received_on)
SELECT b.id, po.id, 1, j.id, p.id, ps.id, o.part_name, o.part_type, greatest(o.qty_ordered, 1),
       o.est_arrival_date, o.received_date
FROM rizenic_old.rizenic_part_orders o
JOIN branches b ON lower(b.name) = lower(trim(o.branch_name))
JOIN part_orders po ON po.order_number = 'LEGACY-PO-' || o.order_id AND po.branch_id = b.id
JOIN parts p ON p.part_number = o.part_no
LEFT JOIN part_order_statuses ps ON ps.name = o.order_status
LEFT JOIN repair_jobs j ON j.job_number = 'LEGACY-' || coalesce(o.job_id, o.report_id)
    AND j.branch_id = b.id
ON CONFLICT (order_id, line_number) DO NOTHING;

INSERT INTO part_receipts(branch_id, receipt_number, epc_reference, received_on)
SELECT b.id, 'LEGACY-IN-' || i.inbound_id, i.epc_no, i.received_date
FROM rizenic_old.rizenic_part_inbound i
JOIN branches b ON lower(b.name) = lower(trim(i.branch_name))
ON CONFLICT (branch_id, receipt_number) DO NOTHING;

INSERT INTO part_receipt_items(branch_id, receipt_id, line_number, order_item_id, part_id,
                               description, quantity, unit_price)
SELECT b.id, pr.id, 1, oi.id, p.id, i.part_name, greatest(i.qty, 1), i.unit_price
FROM rizenic_old.rizenic_part_inbound i
JOIN branches b ON lower(b.name) = lower(trim(i.branch_name))
JOIN part_receipts pr ON pr.receipt_number = 'LEGACY-IN-' || i.inbound_id AND pr.branch_id = b.id
JOIN parts p ON p.part_number = i.part_no
LEFT JOIN part_order_items oi ON oi.part_id = p.id
    AND oi.branch_id = b.id
    AND oi.order_id = (SELECT po.id FROM part_orders po WHERE po.order_number = 'LEGACY-PO-' ||
        (SELECT o.order_id FROM rizenic_old.rizenic_part_orders o WHERE o.epc_no = i.epc_no AND o.part_no = i.part_no AND o.branch_name = i.branch_name LIMIT 1) AND po.branch_id = b.id)
ON CONFLICT (receipt_id, line_number) DO NOTHING;

INSERT INTO stock_movements(branch_id, part_id, movement_type, quantity_delta, unit_price, movement_on,
                            occurred_at, receipt_item_id, reason)
SELECT ri.branch_id, ri.part_id, 'RECEIPT', ri.quantity, ri.unit_price, pr.received_on,
       pr.created_at, ri.id, 'Migrated inbound receipt'
FROM part_receipt_items ri JOIN part_receipts pr ON pr.id = ri.receipt_id
ON CONFLICT (receipt_item_id) DO NOTHING;

INSERT INTO stock_movements(branch_id, part_id, movement_type, quantity_delta, unit_price, movement_on,
                            occurred_at, job_id, reason)
SELECT b.id, p.id, 'ISSUE', -greatest(o.qty, 1), o.unit_price, o.issue_date,
       o.created_at, j.id, 'Migrated outbound issue'
FROM rizenic_old.rizenic_part_outbound o
JOIN branches b ON lower(b.name) = lower(trim(o.branch_name))
JOIN parts p ON p.part_number = o.part_no
LEFT JOIN repair_jobs j ON j.job_number = 'LEGACY-' || o.job_id
WHERE NOT EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.reason = 'Migrated outbound issue'
                  AND sm.branch_id = b.id AND sm.part_id = p.id AND sm.movement_on = o.issue_date);

-- 6. Inspections, files and preferences -----------------------------------
INSERT INTO inspections(branch_id, job_id, vehicle_id, inspection_type, fuel_percent, mileage, job_type,
                        job_category, repair_checklist, inventory_checklist, electrical_checklist,
                        inspected_at, notes)
SELECT b.id, j.id, j.vehicle_id, 'LEGACY', i.fuel_level, i.current_mileage, i.job_type, i.job_category,
       coalesce(i.repair_checklist, '{}'::jsonb), coalesce(i.inventory_checklist, '{}'::jsonb),
       coalesce(i.electrical_checklist, '{}'::jsonb), i.created_at, i.notes
FROM rizenic_old.inspection_reports i
JOIN repair_jobs j ON j.job_number = 'LEGACY-' || i.job_id
JOIN branches b ON b.id = j.branch_id;

INSERT INTO attachments(storage_key, original_filename, media_type, byte_size, sha256)
SELECT 'legacy-inspection-' || i.id || '-diagram', 'legacy-' || i.id || '-diagram.png', 'image/png',
       greatest((length(i.car_diagram_image) * 3 / 4)::bigint, 0), encode(rizenic_old.digest(i.car_diagram_image::bytea, 'sha256'), 'hex')
FROM rizenic_old.inspection_reports i
WHERE nullif(trim(i.car_diagram_image), '') IS NOT NULL
ON CONFLICT (storage_key) DO NOTHING;

INSERT INTO inspection_attachments(inspection_id, attachment_id, purpose)
SELECT ins.id, a.id, 'CAR_DIAGRAM'
FROM rizenic_old.inspection_reports src
JOIN inspections ins ON ins.job_id::text = src.job_id AND ins.inspection_type = 'LEGACY'
JOIN attachments a ON a.storage_key = 'legacy-inspection-' || src.id || '-diagram'
ON CONFLICT DO NOTHING;

INSERT INTO user_preferences(user_id, page_key, settings, updated_at)
SELECT ua.id, 'legacy', jsonb_build_object('hidden_columns', p.hidden_columns, 'row_highlights', p.row_highlights), p.updated_at
FROM rizenic_old.user_column_preferences p
JOIN user_accounts ua ON lower(ua.username) = lower(p.emp_name)
ON CONFLICT (user_id, page_key) DO UPDATE SET settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at;

-- 7. Source lineage for every populated legacy table -----------------------
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'customers', c.id::text, to_jsonb(c), md5(to_jsonb(c)::text), '[]'::jsonb FROM rizenic_old.customers c;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'inspection_reports', i.id::text, to_jsonb(i), md5(to_jsonb(i)::text), '[]'::jsonb FROM rizenic_old.inspection_reports i;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizeniccarmodelmaster', m.model_id::text, to_jsonb(m), md5(to_jsonb(m)::text), '[]'::jsonb FROM rizenic_old.rizeniccarmodelmaster m;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizeniccustomertypemaster', c.customer_type_id::text, to_jsonb(c), md5(to_jsonb(c)::text), '[]'::jsonb FROM rizenic_old.rizeniccustomertypemaster c;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenicemployeemaster', e.employee_id::text, to_jsonb(e) - 'password', md5((to_jsonb(e) - 'password')::text), '["password"]'::jsonb FROM rizenic_old.rizenicemployeemaster e;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenicinsurancemaster', i.insurance_code, to_jsonb(i), md5(to_jsonb(i)::text), '[]'::jsonb FROM rizenic_old.rizenicinsurancemaster i;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenicpartsmaster', p.part_id::text, to_jsonb(p), md5(to_jsonb(p)::text), '[]'::jsonb FROM rizenic_old.rizenicpartsmaster p;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenicreport', r.id::text, to_jsonb(r), md5(to_jsonb(r)::text), '[]'::jsonb FROM rizenic_old.rizenicreport r;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenicstatusmaster', s.status_code, to_jsonb(s), md5(to_jsonb(s)::text), '[]'::jsonb FROM rizenic_old.rizenicstatusmaster s;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_body_parts', b.id::text, to_jsonb(b), md5(to_jsonb(b)::text), '[]'::jsonb FROM rizenic_old.rizenic_body_parts b;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_part_inbound', i.inbound_id::text, to_jsonb(i), md5(to_jsonb(i)::text), '[]'::jsonb FROM rizenic_old.rizenic_part_inbound i;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_part_locations', l.id::text, to_jsonb(l), md5(to_jsonb(l)::text), '[]'::jsonb FROM rizenic_old.rizenic_part_locations l;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_part_orders', o.order_id::text, to_jsonb(o), md5(to_jsonb(o)::text), '[]'::jsonb FROM rizenic_old.rizenic_part_orders o;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_part_outbound', o.outbound_id::text, to_jsonb(o), md5(to_jsonb(o)::text), '[]'::jsonb FROM rizenic_old.rizenic_part_outbound o;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_part_status_master', s.status_id::text, to_jsonb(s), md5(to_jsonb(s)::text), '[]'::jsonb FROM rizenic_old.rizenic_part_status_master s;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_quotas', q.id::text, to_jsonb(q), md5(to_jsonb(q)::text), '[]'::jsonb FROM rizenic_old.rizenic_quotas q;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'rizenic_routing_master', r.routing_id::text, to_jsonb(r), md5(to_jsonb(r)::text), '[]'::jsonb FROM rizenic_old.rizenic_routing_master r;
INSERT INTO legacy_records(run_id, source_schema, source_table, source_key, payload, payload_checksum, redacted_fields)
SELECT :run_id, 'rizenic_old', 'user_column_preferences', p.user_id::text, to_jsonb(p), md5(to_jsonb(p)::text), '[]'::jsonb FROM rizenic_old.user_column_preferences p;

-- Explicit issue records for values that cannot be interpreted without a
-- business decision. They do not block storage; they block cutover only when
-- marked ERROR by the validation phase.
INSERT INTO migration_issues(run_id, issue_code, severity, details)
SELECT :run_id, 'VIN_HAS_MULTIPLE_PLATES', 'WARNING', jsonb_build_object('vin', trim(vin_no), 'source_count', count(*))
FROM rizenic_old.rizenicreport
WHERE nullif(trim(vin_no), '') IS NOT NULL
GROUP BY trim(vin_no)
HAVING count(DISTINCT nullif(trim(car_plate), '')) > 1;

INSERT INTO migration_issues(run_id, issue_code, severity, details)
SELECT :run_id, 'PART_REFERENCE_NOT_IN_MASTER', 'WARNING', jsonb_build_object('part_no', x.part_no)
FROM (
    SELECT DISTINCT part_no FROM rizenic_old.rizenic_part_orders
    UNION SELECT DISTINCT part_no FROM rizenic_old.rizenic_part_inbound
    UNION SELECT DISTINCT part_no FROM rizenic_old.rizenic_part_outbound
    UNION SELECT DISTINCT part_no FROM rizenic_old.rizenic_part_locations
) x
WHERE nullif(trim(x.part_no), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM rizenic_old.rizenicpartsmaster p WHERE p.part_no = x.part_no);

INSERT INTO migration_issues(run_id, issue_code, severity, details)
SELECT :run_id, 'PART_COMPATIBILITY_MODEL_NOT_FOUND', 'WARNING',
       jsonb_build_object('part_no', m.part_no, 'raw_model_name', trim(token))
FROM rizenic_old.rizenicpartsmaster m
CROSS JOIN LATERAL unnest(string_to_array(coalesce(m.car_model, ''), ',')) token
WHERE nullif(trim(token), '') IS NOT NULL
  AND upper(trim(token)) <> 'ALL'
  AND NOT EXISTS (SELECT 1 FROM car_models cm WHERE lower(trim(cm.model_name)) = lower(trim(token)));

-- Source → target mappings for the central and transactional entities.
INSERT INTO legacy_entity_mappings(legacy_record_id, target_table, target_id)
SELECT lr.id, 'repair_jobs', j.id
FROM legacy_records lr JOIN repair_jobs j ON j.job_number = 'LEGACY-' || lr.source_key
WHERE lr.run_id = :run_id AND lr.source_table = 'rizenicreport'
ON CONFLICT DO NOTHING;

INSERT INTO legacy_entity_mappings(legacy_record_id, target_table, target_id)
SELECT lr.id, 'part_orders', po.id
FROM legacy_records lr JOIN part_orders po ON po.order_number = 'LEGACY-PO-' || lr.source_key
WHERE lr.run_id = :run_id AND lr.source_table = 'rizenic_part_orders'
ON CONFLICT DO NOTHING;

INSERT INTO legacy_entity_mappings(legacy_record_id, target_table, target_id)
SELECT lr.id, 'part_receipts', pr.id
FROM legacy_records lr JOIN part_receipts pr ON pr.receipt_number = 'LEGACY-IN-' || lr.source_key
WHERE lr.run_id = :run_id AND lr.source_table = 'rizenic_part_inbound'
ON CONFLICT DO NOTHING;

UPDATE migration_runs
SET state = 'VALIDATING', summary = jsonb_build_object(
    'legacy_records', (SELECT count(*) FROM legacy_records WHERE run_id = :run_id),
    'migration_issues', (SELECT count(*) FROM migration_issues WHERE run_id = :run_id),
    'repair_jobs', (SELECT count(*) FROM repair_jobs),
    'part_orders', (SELECT count(*) FROM part_orders),
    'part_receipts', (SELECT count(*) FROM part_receipts)
)
WHERE id = :run_id;

COMMIT;
