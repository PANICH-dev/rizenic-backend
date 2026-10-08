\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- INS-01 is the short Rizenic payment label. Link it to the canonical
-- Chubb insurer row; E-Claim code 15 remains a legacy display alias.
INSERT INTO insurer_aliases(source_name, insurer_id, source_code, comment)
SELECT lower('ชับบ์'), er.insurer_id, 'INS-01',
       'Rizenic short label; canonical E-Claim code is 2418'
FROM eclaim_insurer_refs er
WHERE er.external_code = '2418'
ON CONFLICT (source_name) DO UPDATE
SET insurer_id = EXCLUDED.insurer_id,
    source_code = EXCLUDED.source_code,
    comment = EXCLUDED.comment;

COMMIT;
