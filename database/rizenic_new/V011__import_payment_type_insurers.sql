\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- Keep the old payment label as a first-class insurer master value. This is
-- additive and does not alter existing insurer names or codes. The comment
-- makes it explicit that the generated code still needs business/E-Claim
-- confirmation before it is used for an external claim submission.
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS comment text;

INSERT INTO insurers(code, name, insurance_type, comment)
SELECT 'LEGACY-' || substring(md5(lower(trim(r.payment_type))) from 1 for 16),
       trim(r.payment_type),
       'LEGACY',
       'Imported from legacy payment_type; E-Claim code pending confirmation'
FROM rizenic_old.rizenicreport r
WHERE nullif(trim(r.payment_type), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM insurers i
      WHERE lower(trim(i.name)) = lower(trim(r.payment_type))
  )
GROUP BY trim(r.payment_type);

-- Backfill only jobs whose FK is still NULL. The original payment_label is
-- retained unchanged for traceability and reporting.
WITH candidates AS (
    SELECT j.id, min(i.id) insurer_id
    FROM repair_jobs j
    JOIN rizenic_old.rizenicreport r ON j.job_number = 'LEGACY-' || r.id
    JOIN insurers i ON lower(trim(i.name)) = lower(trim(r.payment_type))
    WHERE j.insurer_id IS NULL
      AND nullif(trim(r.payment_type), '') IS NOT NULL
    GROUP BY j.id
    HAVING count(DISTINCT i.id) = 1
)
UPDATE repair_jobs j
SET insurer_id = c.insurer_id, updated_at = now()
FROM candidates c
WHERE j.id = c.id AND j.insurer_id IS NULL;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('insurers', 0, 'IMPORT_LEGACY_PAYMENT_TYPE_MASTERS', jsonb_build_object(
    'legacy_named_masters', (SELECT count(*) FROM insurers WHERE code LIKE 'LEGACY-%'),
    'remaining_without_payment_type', (
        SELECT count(*) FROM repair_jobs j
        JOIN rizenic_old.rizenicreport r ON j.job_number = 'LEGACY-' || r.id
        WHERE j.insurer_id IS NULL AND nullif(trim(r.payment_type), '') IS NULL
    ),
    'note', 'Generated legacy codes require business confirmation before E-Claim submission'
));

COMMIT;
