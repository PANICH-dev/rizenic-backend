\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- Repair migration for environments where V013 already ran before the
-- canonical Chubb master name was normalized. It is intentionally idempotent.
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE insurer_aliases ADD COLUMN IF NOT EXISTS comment text;

DO $$
DECLARE canonical_id bigint;
BEGIN
    SELECT id INTO canonical_id
    FROM insurers
    WHERE is_active = true
      AND (code = 'LEGACY-f1b8691be1093c4f'
           OR lower(trim(name)) IN (
               lower('ชับบ์สามัคคีประกันภัย'),
               lower('บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)')
           ))
    ORDER BY CASE WHEN code = 'LEGACY-f1b8691be1093c4f' THEN 1 ELSE 2 END, id
    LIMIT 1;

    IF canonical_id IS NULL THEN
        RAISE NOTICE 'Chubb Samaggi master not found; no E-Claim refs inserted';
        RETURN;
    END IF;

    UPDATE insurers
    SET name = 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)'
    WHERE id = canonical_id
      AND lower(trim(name)) = lower('ชับบ์สามัคคีประกันภัย');

    INSERT INTO eclaim_insurer_refs(insurer_id, external_code, external_name, comment)
    VALUES
      (canonical_id, '2418', 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด  (มหาชน)', 'Canonical E-Claim option'),
      (canonical_id, '15', 'บริษัท ชับบ์สามัคคีประกันภัย (L)', 'Legacy E-Claim alias; same company')
    ON CONFLICT (external_system, external_code) DO UPDATE
    SET insurer_id = EXCLUDED.insurer_id,
        external_name = EXCLUDED.external_name,
        comment = EXCLUDED.comment,
        is_active = true;

    INSERT INTO insurer_aliases(source_name, insurer_id, source_code, comment)
    VALUES
      (lower('บริษัท ชับบ์สามัคคีประกันภัย (L)'), canonical_id, '15', 'Same company as canonical Chubb Samaggi'),
      (lower('บริษัท ชับบ์สามัคคีประกันภัย จำกัด  (มหาชน)'), canonical_id, '2418', 'Canonical E-Claim name')
    ON CONFLICT (source_name) DO UPDATE
    SET insurer_id = EXCLUDED.insurer_id,
        source_code = EXCLUDED.source_code,
        comment = EXCLUDED.comment;

    INSERT INTO audit_events(entity_type, entity_id, action, changes)
    VALUES ('insurers', canonical_id, 'REPAIR_ECLAIM_CHUBB_REFS', jsonb_build_object(
        'external_codes', jsonb_build_array('2418', '15'),
        'canonical_name', 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)'
    ));
END $$;

COMMIT;
