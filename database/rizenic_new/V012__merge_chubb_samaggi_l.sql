\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

ALTER TABLE insurers ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE insurer_aliases ADD COLUMN IF NOT EXISTS comment text;

DO $$
DECLARE
    target_id bigint;
    legacy_id bigint;
BEGIN
    SELECT id INTO target_id
    FROM insurers
    WHERE is_active = true
      AND (code = 'LEGACY-f1b8691be1093c4f'
           OR lower(trim(name)) IN (
               lower('ชับบ์สามัคคีประกันภัย'),
               lower('บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)')
           ))
    ORDER BY CASE WHEN code = 'LEGACY-f1b8691be1093c4f' THEN 1 ELSE 2 END, id
    LIMIT 1;

    SELECT id INTO legacy_id
    FROM insurers
    WHERE lower(trim(name)) = lower('บริษัท ชับบ์สามัคคีประกันภัย (L)')
    ORDER BY id
    LIMIT 1;

    IF target_id IS NULL THEN
        RAISE NOTICE 'Canonical Chubb Samaggi insurer master is not present; skipping merge safely';
        RETURN;
    END IF;
    IF legacy_id IS NULL THEN
        RAISE NOTICE 'Chubb Samaggi (L) master is already absent; nothing to merge';
        RETURN;
    END IF;
    IF target_id = legacy_id THEN
        RAISE EXCEPTION 'Canonical and legacy Chubb insurer resolve to the same row';
    END IF;

    UPDATE insurers
    SET name = 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)'
    WHERE id = target_id
      AND lower(trim(name)) = lower('ชับบ์สามัคคีประกันภัย');

    -- Only the FK is consolidated. The original payment_label remains intact
    -- on every job for historical traceability.
    UPDATE repair_jobs
    SET insurer_id = target_id, updated_at = now()
    WHERE insurer_id = legacy_id;

    INSERT INTO insurer_aliases(source_name, insurer_id, source_code, comment)
    SELECT lower('บริษัท ชับบ์สามัคคีประกันภัย (L)'), target_id, i.code,
           'Same company as canonical Chubb Samaggi'
    FROM insurers i
    WHERE i.id = legacy_id
    ON CONFLICT (source_name) DO UPDATE SET insurer_id = EXCLUDED.insurer_id,
        source_code = EXCLUDED.source_code,
        comment = EXCLUDED.comment;

    UPDATE insurers
    SET is_active = false,
        comment = 'Merged into canonical Chubb Samaggi insurer master by business confirmation'
    WHERE id = legacy_id;

    UPDATE insurers
    SET comment = coalesce(comment || '; ', '') || 'Canonical Chubb Samaggi insurer'
    WHERE id = target_id
      AND (comment IS NULL OR comment NOT LIKE '%Canonical Chubb Samaggi insurer%');

    INSERT INTO audit_events(entity_type, entity_id, action, changes)
    VALUES ('insurers', target_id, 'MERGE_CHUBB_SAMAGGI_L', jsonb_build_object(
        'merged_insurer_id', legacy_id,
        'canonical_insurer_id', target_id,
        'original_payment_labels_preserved', true
    ));
END $$;

COMMIT;
