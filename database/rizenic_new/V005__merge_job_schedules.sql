\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

ALTER TABLE repair_jobs
    ADD COLUMN IF NOT EXISTS contact_on date,
    ADD COLUMN IF NOT EXISTS appointment_on date,
    ADD COLUMN IF NOT EXISTS intake_on date,
    ADD COLUMN IF NOT EXISTS estimated_finish_on date,
    ADD COLUMN IF NOT EXISTS target_finish_on date,
    ADD COLUMN IF NOT EXISTS actual_finish_on date,
    ADD COLUMN IF NOT EXISTS repair_finished_on date,
    ADD COLUMN IF NOT EXISTS delivery_on date;

DO $migration$
BEGIN
IF to_regclass('rizenic_new.job_schedules') IS NOT NULL THEN
EXECUTE $$UPDATE repair_jobs j
SET contact_on = s.contact_on,
    appointment_on = s.appointment_on,
    intake_on = s.intake_on,
    estimated_finish_on = s.estimated_finish_on,
    target_finish_on = s.target_finish_on,
    actual_finish_on = s.actual_finish_on,
    repair_finished_on = s.repair_finished_on,
    delivery_on = s.delivery_on,
    updated_at = greatest(j.updated_at, s.updated_at)
FROM job_schedules s
WHERE s.job_id = j.id$$;
END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS repair_jobs_intake_idx ON repair_jobs(intake_on);
CREATE INDEX IF NOT EXISTS repair_jobs_target_idx ON repair_jobs(target_finish_on);
CREATE INDEX IF NOT EXISTS repair_jobs_delivery_idx ON repair_jobs(delivery_on);

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('repair_jobs', 0, 'MERGE_JOB_SCHEDULES', jsonb_build_object(
    'source_table', 'job_schedules',
    'rows_merged', 0
));

DROP TABLE IF EXISTS job_schedules;

COMMIT;
