# Legacy reconciliation before production

`V009__safe_legacy_reconciliation.sql`, `V010__recover_legacy_customer_contacts.sql`, and `V011__import_payment_type_insurers.sql` are additive and repair-only. They fill
only currently NULL insurer, vehicle, status, service-advisor, department and
inspection relationships, recover legacy phone contacts, and preserve every
non-empty legacy `payment_type` as an insurer master row. Ambiguous insurer
names, duplicate VINs, and multi-person SA values remain unchanged for review.

After applying the migration, materialize the legacy inspection images with:

```bash
python3 -m pip install "psycopg[binary]"

ATTACHMENT_STORAGE_PATH=/path/to/data/attachments \
DATABASE_URL='postgresql://...' \
python3 scripts/export_legacy_inspection_images.py
```

Install the dependency once in the migration environment; do not add it to
the running application image unless that is already part of the deployment.

The exporter verifies SHA-256 before writing, writes atomically, and skips an
existing file with matching bytes. It never deletes or overwrites a different
file; a mismatch stops the run for manual review.

Before go-live, compare these counts and keep the output with the release
evidence:

```sql
select count(*) from rizenic_new.repair_jobs where insurer_id is null;
select count(*) from rizenic_new.repair_jobs where vehicle_id is null;
select count(*) from rizenic_new.inspection_attachments;
select metric, count(*) from rizenic_new.branch_capacity_rules group by metric;
```

Expected results after the supplied production audit dataset is reconciled:

- `vehicle_id IS NULL`: **0**
- `inspection_attachments`: **7**
- `insurer_id IS NULL` after V009: **163**; after V011: **19** (the 19 rows had no legacy payment value)
- quota metrics: **6 metrics × 16 rows**, including `COLOR_PARTS`

## Post-Go-Live Insurer Confirmation & Merging SOP

### 1. Confirming Official E-Claim Codes (LMG, Falcon, etc.)
When the claims/accounting department provides the official, verified E-Claim insurer code:
1. Always verify that the new code does not collide with existing insurer masters.
2. Note: `rizenic_new.insurers` contains `(id, code, name, insurance_type, is_active, comment)`. Do not reference `updated_at` unless the column is added.
3. Execute within an explicit transaction:

```sql
BEGIN;

-- Step 1: Pre-check for collision
SELECT id, code, name, is_active
FROM rizenic_new.insurers
WHERE code = '<OFFICIAL_ECLAIM_CODE>';

-- Step 2: Safe guarded update
UPDATE rizenic_new.insurers
SET code = '<OFFICIAL_ECLAIM_CODE>',
    comment = 'Confirmed official E-Claim code'
WHERE code = 'LEGACY-<hash>'
  AND NOT EXISTS (
      SELECT 1 FROM rizenic_new.insurers WHERE code = '<OFFICIAL_ECLAIM_CODE>'
  );

COMMIT;
```

### 2. Handling Chubb Samaggi (Chubb Samaggi vs Chubb INS-01)
Do **NOT** automatically merge Chubb Samaggi with `INS-01` (`ชับบ์`). In Thai E-Claim / EMCS, distinct legal entities exist (e.g. *บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)* vs *บริษัท ชับบ์สามัคคีประกันภัย (L)*).

Only merge if the claims department officially signs off that historical claims under this label belong to `INS-01`:

```sql
BEGIN;

-- Step 1: Assert expected record count before merge (expected: 28)
SELECT count(*) AS legacy_job_count
FROM rizenic_new.repair_jobs
WHERE insurer_id = (
    SELECT id FROM rizenic_new.insurers WHERE code = 'LEGACY-f1b8691be1093c4f'
);

-- Step 2: Reassign jobs to canonical Chubb (INS-01)
UPDATE rizenic_new.repair_jobs
SET insurer_id = (
    SELECT id FROM rizenic_new.insurers WHERE code = 'INS-01'
), updated_at = now()
WHERE insurer_id = (
    SELECT id FROM rizenic_new.insurers WHERE code = 'LEGACY-f1b8691be1093c4f'
);

-- Step 3: Deactivate the legacy temporary master with audit comment
UPDATE rizenic_new.insurers
SET is_active = false,
    comment = 'Merged into INS-01 after claims department confirmation'
WHERE code = 'LEGACY-f1b8691be1093c4f';

-- Step 4: Verify payment_label remains intact for historical traceability
SELECT job_number, payment_label, insurer_id
FROM rizenic_new.repair_jobs
WHERE insurer_id = (SELECT id FROM rizenic_new.insurers WHERE code = 'INS-01')
  AND payment_label = 'ชับบ์สามัคคีประกันภัย'
LIMIT 5;

COMMIT;
```
