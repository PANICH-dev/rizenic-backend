-- Structural checks for the proposed design. No data mutation.
SET search_path TO rizenic_new;

SELECT table_name, count(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'rizenic_new'
GROUP BY table_name
ORDER BY table_name;

SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'rizenic_new'
ORDER BY table_name, constraint_name;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'rizenic_new'
  AND column_name IN ('customer_name_snapshot', 'phone_snapshot', 'vehicle_snapshot',
                      'description_snapshot', 'reference_snapshot', 'normalized_value')
ORDER BY table_name, column_name;
