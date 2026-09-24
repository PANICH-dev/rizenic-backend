\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

CREATE TABLE IF NOT EXISTS part_compatibility_unresolved (
    part_id bigint NOT NULL REFERENCES parts(id),
    raw_model_name text NOT NULL,
    reason text NOT NULL DEFAULT 'MODEL_NOT_IN_MASTER',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (part_id, raw_model_name)
);

INSERT INTO part_compatibility_unresolved(part_id, raw_model_name)
SELECT DISTINCT p.id, trim(token)
FROM rizenic_old.rizenicpartsmaster m
JOIN parts p ON p.part_number = m.part_no
CROSS JOIN LATERAL unnest(string_to_array(coalesce(m.car_model, ''), ',')) token
WHERE nullif(trim(token), '') IS NOT NULL
  AND upper(trim(token)) <> 'ALL'
  AND NOT EXISTS (SELECT 1 FROM car_models cm WHERE lower(trim(cm.model_name)) = lower(trim(token)))
ON CONFLICT DO NOTHING;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('parts', 0, 'PRESERVE_UNRESOLVED_COMPATIBILITY', jsonb_build_object(
    'unresolved_rows', (SELECT count(*) FROM part_compatibility_unresolved)
));

COMMIT;
