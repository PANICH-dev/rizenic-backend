\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- This migration is repair-only: it only fills NULL/unmapped relations and
-- creates missing metadata. It never deletes or overwrites populated facts.
CREATE TABLE IF NOT EXISTS insurer_aliases (
    source_name text PRIMARY KEY,
    insurer_id bigint NOT NULL REFERENCES insurers(id),
    source_code text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Keep every insurer from the old master, including insurers that were absent
-- from the first migration. Existing rows are left untouched.
INSERT INTO insurers(code, name, insurance_type)
SELECT trim(m.insurance_code), trim(m.insurance_name), m.insurance_type
FROM rizenic_old.rizenicinsurancemaster m
WHERE nullif(trim(m.insurance_code), '') IS NOT NULL
  AND nullif(trim(m.insurance_name), '') IS NOT NULL
ON CONFLICT (code) DO NOTHING;

INSERT INTO insurer_aliases(source_name, insurer_id, source_code)
SELECT lower(trim(m.insurance_name)), i.id, trim(m.insurance_code)
FROM rizenic_old.rizenicinsurancemaster m
JOIN insurers i ON i.code = trim(m.insurance_code)
WHERE nullif(trim(m.insurance_name), '') IS NOT NULL
ON CONFLICT (source_name) DO NOTHING;

-- Reconnect only jobs that are currently NULL. Ambiguous names are skipped,
-- preserving the data for an explicit review instead of guessing a company.
WITH candidates AS (
    SELECT j.id, min(i.id) insurer_id
    FROM repair_jobs j
    JOIN rizenic_old.rizenicreport r ON j.job_number = 'LEGACY-' || r.id
    JOIN rizenic_old.rizenicinsurancemaster m
      ON lower(trim(m.insurance_name)) = lower(trim(r.payment_type))
    JOIN insurers i ON i.code = trim(m.insurance_code)
    WHERE j.insurer_id IS NULL
    GROUP BY j.id
    HAVING count(DISTINCT i.id) = 1
)
UPDATE repair_jobs j SET insurer_id = c.insurer_id, updated_at = now()
FROM candidates c WHERE c.id = j.id AND j.insurer_id IS NULL;

-- Reconnect only VINs that identify exactly one vehicle. Plate-only or
-- duplicate-VIN cases remain NULL for manual review.
WITH unique_vins AS (
    SELECT lower(trim(vin)) vin, min(id) vehicle_id
    FROM vehicles
    WHERE nullif(trim(vin), '') IS NOT NULL
    GROUP BY lower(trim(vin))
    HAVING count(*) = 1
), candidates AS (
    SELECT j.id, uv.vehicle_id
    FROM repair_jobs j
    JOIN rizenic_old.rizenicreport r ON j.job_number = 'LEGACY-' || r.id
    JOIN unique_vins uv ON uv.vin = lower(trim(r.vin_no))
    WHERE j.vehicle_id IS NULL AND nullif(trim(r.vin_no), '') IS NOT NULL
)
UPDATE repair_jobs j SET vehicle_id = c.vehicle_id, updated_at = now()
FROM candidates c WHERE c.id = j.id AND j.vehicle_id IS NULL;

-- Apply only documented legacy label aliases. Values with multiple people or
-- unknown labels are deliberately left NULL for review.
UPDATE repair_jobs j
SET status_id = s.id, updated_at = now()
FROM rizenic_old.rizenicreport r
JOIN job_statuses s ON s.name = CASE trim(r.job_status)
    WHEN '12.รอส่งมอบ' THEN '12.ส่งมอบ'
    WHEN '22.งานภายใน' THEN '22.ปิดงาน'
    ELSE trim(r.job_status)
END
WHERE j.job_number = 'LEGACY-' || r.id AND j.status_id IS NULL;

UPDATE repair_jobs j
SET service_advisor_id = e.id, updated_at = now()
FROM rizenic_old.rizenicreport r
JOIN employees e ON lower(e.display_name) = lower(CASE trim(r.sa_owner)
    WHEN 'Fang' THEN 'พี่ฟาง'
    ELSE trim(r.sa_owner)
END)
WHERE j.job_number = 'LEGACY-' || r.id
  AND j.service_advisor_id IS NULL
  AND trim(r.sa_owner) NOT LIKE '%,%'
  AND trim(r.sa_owner) NOT LIKE '%/%';

UPDATE repair_jobs j
SET department_id = d.id, updated_at = now()
FROM rizenic_old.rizenicreport r
JOIN departments d ON lower(d.name) = lower(CASE trim(r.department_routing)
    WHEN 'รอดำเนินการ' THEN 'รอดำเนินการ (ยังไม่ส่งต่อ)'
    ELSE trim(r.department_routing)
END)
WHERE j.job_number = 'LEGACY-' || r.id AND j.department_id IS NULL;

-- Preserve legacy customer rows using their JSON representation so this stays
-- compatible with old customer table column names. Existing names are never
-- overwritten; rows whose name already exists are retained in legacy_records.
INSERT INTO customers(display_name)
SELECT coalesce(nullif(trim(to_jsonb(c)->>'customer_name'), ''),
                nullif(trim(to_jsonb(c)->>'name'), ''),
                'Legacy customer ' || c.id::text)
FROM rizenic_old.customers c
WHERE NOT EXISTS (
    SELECT 1 FROM customers n
    WHERE lower(n.display_name) = lower(coalesce(
        nullif(trim(to_jsonb(c)->>'customer_name'), ''),
        nullif(trim(to_jsonb(c)->>'name'), ''),
        'Legacy customer ' || c.id::text))
);

-- Restore both legacy and repair-page preferences when the user identity can
-- be matched by username, display name, or the legacy _repair suffix.
INSERT INTO user_preferences(user_id, page_key, settings, updated_at)
SELECT ua.id,
       CASE WHEN lower(p.emp_name) LIKE '%_repair' THEN 'repair' ELSE 'legacy' END,
       jsonb_build_object('hidden_columns', p.hidden_columns, 'row_highlights', p.row_highlights),
       p.updated_at
FROM rizenic_old.user_column_preferences p
JOIN user_accounts ua ON lower(ua.username) = lower(regexp_replace(trim(p.emp_name), '_repair$', ''))
   OR EXISTS (SELECT 1 FROM employees e WHERE e.id = ua.employee_id
             AND lower(e.display_name) = lower(regexp_replace(trim(p.emp_name), '_repair$', '')))
ON CONFLICT (user_id, page_key) DO NOTHING;

-- Correct the attachment relationship using the stable LEGACY job number.
INSERT INTO inspection_attachments(inspection_id, attachment_id, purpose)
SELECT ins.id, a.id, 'CAR_DIAGRAM'
FROM rizenic_old.inspection_reports src
JOIN repair_jobs j ON j.job_number = 'LEGACY-' || src.job_id
JOIN inspections ins ON ins.job_id = j.id AND ins.inspection_type = 'LEGACY'
JOIN attachments a ON a.storage_key = 'legacy-inspection-' || src.id || '-diagram'
ON CONFLICT DO NOTHING;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('repair_jobs', 0, 'SAFE_LEGACY_RECONCILIATION', jsonb_build_object(
    'unmapped_insurers', (SELECT count(*) FROM repair_jobs WHERE insurer_id IS NULL),
    'unmapped_vehicles', (SELECT count(*) FROM repair_jobs WHERE vehicle_id IS NULL),
    'inspection_links', (SELECT count(*) FROM inspection_attachments),
    'note', 'NULL-only repair; ambiguous records intentionally preserved for review'
));

COMMIT;
