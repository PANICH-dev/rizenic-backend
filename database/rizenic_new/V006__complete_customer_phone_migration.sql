\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

INSERT INTO customer_contacts(customer_id, contact_type, raw_value, is_primary)
SELECT DISTINCT ce.customer_id, 'PHONE', v.raw_phone, false
FROM rizenic_old.rizenicreport r
JOIN customer_identity_keys ce ON ce.key_type = 'EXTERNAL_ID' AND ce.normalized_key = 'report:' || r.id
CROSS JOIN LATERAL (VALUES (nullif(trim(r.phone_number), '')), (nullif(trim(r.customer_phone), ''))) v(raw_phone)
WHERE v.raw_phone IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM customer_contacts cc
      WHERE cc.customer_id = ce.customer_id AND cc.contact_type = 'PHONE' AND cc.raw_value = v.raw_phone
  );

INSERT INTO customer_identity_keys(customer_id, key_type, normalized_key)
SELECT DISTINCT ON (normalized_key) customer_id, 'PHONE', normalized_key
FROM (
    SELECT ce.customer_id,
           lower(regexp_replace(trim(v.raw_phone), '[^0-9+]', '', 'g')) AS normalized_key
    FROM rizenic_old.rizenicreport r
    JOIN customer_identity_keys ce ON ce.key_type = 'EXTERNAL_ID' AND ce.normalized_key = 'report:' || r.id
    CROSS JOIN LATERAL (VALUES (nullif(trim(r.phone_number), '')), (nullif(trim(r.customer_phone), ''))) v(raw_phone)
    WHERE v.raw_phone IS NOT NULL
) p
WHERE nullif(normalized_key, '') IS NOT NULL
ORDER BY normalized_key, customer_id
ON CONFLICT (key_type, normalized_key) DO NOTHING;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('customers', 0, 'COMPLETE_PHONE_MIGRATION', jsonb_build_object(
    'contacts', (SELECT count(*) FROM customer_contacts WHERE contact_type = 'PHONE'),
    'phone_identity_keys', (SELECT count(*) FROM customer_identity_keys WHERE key_type = 'PHONE')
));

COMMIT;
