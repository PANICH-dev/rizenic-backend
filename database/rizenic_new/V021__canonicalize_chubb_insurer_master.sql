\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- INS-01 is the existing internal insurer key used by legacy repair jobs.
-- Make that row the canonical master and retain the imported LEGACY row only
-- as an inactive historical record. E-Claim codes remain in the external refs
-- table and are not exposed as internal insurer identifiers.
DO $$
DECLARE
    canonical_id bigint;
    duplicate_id bigint;
BEGIN
    SELECT id INTO canonical_id FROM insurers WHERE code = 'INS-01' LIMIT 1;
    SELECT id INTO duplicate_id FROM insurers WHERE code = 'LEGACY-f1b8691be1093c4f' LIMIT 1;

    IF canonical_id IS NULL OR duplicate_id IS NULL OR canonical_id = duplicate_id THEN
        RAISE NOTICE 'Chubb canonicalization skipped: expected master rows are not both present';
        RETURN;
    END IF;

    UPDATE repair_jobs SET insurer_id = canonical_id
    WHERE insurer_id = duplicate_id;

    UPDATE eclaim_insurer_refs SET insurer_id = canonical_id
    WHERE insurer_id = duplicate_id;

    UPDATE insurer_aliases SET insurer_id = canonical_id
    WHERE insurer_id = duplicate_id;

    UPDATE insurers
    SET name = 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)',
        insurance_type = 'ประกันภัย',
        comment = 'Canonical internal Chubb master; E-Claim refs 2418 and 15'
    WHERE id = canonical_id;

    UPDATE insurers
    SET is_active = false,
        comment = 'Merged into INS-01 canonical master; retained for history'
    WHERE id = duplicate_id;

    INSERT INTO audit_events(entity_type, entity_id, action, changes)
    VALUES ('insurers', canonical_id, 'CANONICALIZE_CHUBB_MASTER', jsonb_build_object(
        'canonical_code', 'INS-01',
        'merged_insurer_id', duplicate_id,
        'eclaim_codes', jsonb_build_array('2418', '15')
    ));
END $$;

COMMIT;
