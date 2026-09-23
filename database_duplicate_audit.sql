-- RIZENIC duplicate audit (READ ONLY)
-- This file does not delete/update data. It only lists duplicate master records.

\echo '=== Employee username duplicates ==='
SELECT LOWER(TRIM(username)) AS duplicate_key, COUNT(*) AS duplicate_count, STRING_AGG(employee_id::text, ', ' ORDER BY employee_id) AS ids
FROM rizenicemployeemaster
WHERE NULLIF(TRIM(username), '') IS NOT NULL
GROUP BY LOWER(TRIM(username)) HAVING COUNT(*) > 1;

\echo '=== Employee code duplicates ==='
SELECT LOWER(TRIM(employee_code)) AS duplicate_key, COUNT(*) AS duplicate_count, STRING_AGG(employee_id::text, ', ' ORDER BY employee_id) AS ids
FROM rizenicemployeemaster
WHERE NULLIF(TRIM(employee_code), '') IS NOT NULL
GROUP BY LOWER(TRIM(employee_code)) HAVING COUNT(*) > 1;

\echo '=== Car model duplicates ==='
SELECT LOWER(TRIM(car_brand)) AS brand, LOWER(TRIM(car_model)) AS model, COUNT(*) AS duplicate_count,
       STRING_AGG(model_id::text, ', ' ORDER BY model_id) AS ids
FROM rizeniccarmodelmaster
GROUP BY LOWER(TRIM(car_brand)), LOWER(TRIM(car_model)) HAVING COUNT(*) > 1;

\echo '=== Insurance code duplicates ==='
SELECT LOWER(TRIM(insurance_code)) AS duplicate_key, COUNT(*) AS duplicate_count
FROM rizenicinsurancemaster
GROUP BY LOWER(TRIM(insurance_code)) HAVING COUNT(*) > 1;

\echo '=== Insurance name duplicates ==='
SELECT LOWER(TRIM(insurance_name)) AS duplicate_key, COUNT(*) AS duplicate_count
FROM rizenicinsurancemaster
GROUP BY LOWER(TRIM(insurance_name)) HAVING COUNT(*) > 1;

\echo '=== Customer type duplicates ==='
SELECT LOWER(TRIM(type_name)) AS duplicate_key, COUNT(*) AS duplicate_count,
       STRING_AGG(customer_type_id::text, ', ' ORDER BY customer_type_id) AS ids
FROM rizeniccustomertypemaster
GROUP BY LOWER(TRIM(type_name)) HAVING COUNT(*) > 1;

\echo '=== Parts master Part No. duplicates ==='
SELECT LOWER(TRIM(part_no)) AS duplicate_key, COUNT(*) AS duplicate_count,
       STRING_AGG(part_id::text, ', ' ORDER BY part_id) AS ids
FROM rizenicpartsmaster
GROUP BY LOWER(TRIM(part_no)) HAVING COUNT(*) > 1;

\echo '=== Main status code duplicates ==='
SELECT LOWER(TRIM(status_code)) AS duplicate_key, COUNT(*) AS duplicate_count
FROM rizenicstatusmaster
GROUP BY LOWER(TRIM(status_code)) HAVING COUNT(*) > 1;

\echo '=== Main status name duplicates ==='
SELECT LOWER(TRIM(status_name)) AS duplicate_key, COUNT(*) AS duplicate_count
FROM rizenicstatusmaster
GROUP BY LOWER(TRIM(status_name)) HAVING COUNT(*) > 1;

\echo '=== Body part duplicates ==='
SELECT LOWER(TRIM(category)) AS category, LOWER(TRIM(part_name)) AS part_name, COUNT(*) AS duplicate_count,
       STRING_AGG(id::text, ', ' ORDER BY id) AS ids
FROM rizenic_body_parts
GROUP BY LOWER(TRIM(category)), LOWER(TRIM(part_name)) HAVING COUNT(*) > 1;

\echo '=== Part status duplicates ==='
SELECT LOWER(TRIM(status_name)) AS duplicate_key, COUNT(*) AS duplicate_count,
       STRING_AGG(status_id::text, ', ' ORDER BY status_id) AS ids
FROM rizenic_part_status_master
GROUP BY LOWER(TRIM(status_name)) HAVING COUNT(*) > 1;

\echo '=== Default quota duplicates per branch ==='
SELECT LOWER(TRIM(branch_name)) AS branch, COUNT(*) AS duplicate_count, STRING_AGG(id::text, ', ' ORDER BY id) AS ids
FROM rizenic_quotas
WHERE quota_type='default'
GROUP BY LOWER(TRIM(branch_name)) HAVING COUNT(*) > 1;

\echo '=== Special quota duplicates per branch/date ==='
SELECT LOWER(TRIM(branch_name)) AS branch, quota_date::date AS quota_date, COUNT(*) AS duplicate_count,
       STRING_AGG(id::text, ', ' ORDER BY id) AS ids
FROM rizenic_quotas
WHERE quota_type='special'
GROUP BY LOWER(TRIM(branch_name)), quota_date::date HAVING COUNT(*) > 1;

\echo '=== Duplicate repair reports (same normalized plate + contact date) ==='
SELECT LOWER(REPLACE(TRIM(car_plate), ' ', '')) AS plate_key, contact_date::date AS contact_date,
       COUNT(*) AS duplicate_count, STRING_AGG(id::text, ', ' ORDER BY id) AS ids
FROM rizenicreport
WHERE NULLIF(TRIM(car_plate), '') IS NOT NULL AND contact_date IS NOT NULL
GROUP BY LOWER(REPLACE(TRIM(car_plate), ' ', '')), contact_date::date
HAVING COUNT(*) > 1;
