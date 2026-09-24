\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- Recover contact values from the legacy customer rows without changing any
-- existing customer or contact. JSON extraction keeps this migration tolerant
-- of the old table's historical column names.
WITH source_rows AS (
    SELECT coalesce(nullif(trim(to_jsonb(c)->>'customer_name'), ''),
                    nullif(trim(to_jsonb(c)->>'name'), ''),
                    'Legacy customer ' || c.id::text) display_name,
           coalesce(nullif(trim(to_jsonb(c)->>'phone_number'), ''),
                    nullif(trim(to_jsonb(c)->>'phone'), ''),
                    nullif(trim(to_jsonb(c)->>'mobile'), ''),
                    nullif(trim(to_jsonb(c)->>'customer_phone'), ''),
                    nullif(trim(to_jsonb(c)->>'tel'), '')) raw_phone
    FROM rizenic_old.customers c
), matched AS (
    SELECT DISTINCT n.id customer_id, s.raw_phone
    FROM source_rows s
    JOIN customers n ON lower(n.display_name) = lower(s.display_name)
    WHERE s.raw_phone IS NOT NULL
)
INSERT INTO customer_contacts(customer_id, contact_type, raw_value, is_primary)
SELECT m.customer_id, 'PHONE', m.raw_phone, false
FROM matched m
WHERE NOT EXISTS (
    SELECT 1 FROM customer_contacts cc
    WHERE cc.customer_id = m.customer_id
      AND cc.contact_type = 'PHONE'
      AND cc.raw_value = m.raw_phone
);

WITH source_rows AS (
    SELECT coalesce(nullif(trim(to_jsonb(c)->>'customer_name'), ''),
                    nullif(trim(to_jsonb(c)->>'name'), ''),
                    'Legacy customer ' || c.id::text) display_name,
           lower(regexp_replace(trim(coalesce(nullif(trim(to_jsonb(c)->>'phone_number'), ''),
                                               nullif(trim(to_jsonb(c)->>'phone'), ''),
                                               nullif(trim(to_jsonb(c)->>'mobile'), ''),
                                               nullif(trim(to_jsonb(c)->>'customer_phone'), ''),
                                               nullif(trim(to_jsonb(c)->>'tel'), ''))), '[^0-9+]', '', 'g')) normalized_phone
    FROM rizenic_old.customers c
), matched AS (
    SELECT DISTINCT n.id customer_id, s.normalized_phone
    FROM source_rows s
    JOIN customers n ON lower(n.display_name) = lower(s.display_name)
    WHERE nullif(s.normalized_phone, '') IS NOT NULL
)
INSERT INTO customer_identity_keys(customer_id, key_type, normalized_key)
SELECT customer_id, 'PHONE', normalized_phone FROM matched
ON CONFLICT (key_type, normalized_key) DO NOTHING;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('customers', 0, 'RECOVER_LEGACY_CUSTOMER_CONTACTS', jsonb_build_object(
    'legacy_customer_rows', (SELECT count(*) FROM rizenic_old.customers),
    'legacy_phone_contacts', (SELECT count(*) FROM customer_contacts WHERE contact_type='PHONE')
));

COMMIT;
