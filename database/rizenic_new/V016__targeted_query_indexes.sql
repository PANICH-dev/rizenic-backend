\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- High-frequency repair-job lookups. The existing branch/status index remains
-- useful for branch boards; these cover direct search and other filters.
CREATE INDEX IF NOT EXISTS repair_jobs_job_number_idx
    ON repair_jobs(job_number);
CREATE INDEX IF NOT EXISTS repair_jobs_insurer_idx
    ON repair_jobs(insurer_id);
CREATE INDEX IF NOT EXISTS repair_jobs_status_idx
    ON repair_jobs(status_id);
CREATE INDEX IF NOT EXISTS repair_jobs_department_idx
    ON repair_jobs(department_id);

-- Legacy reconciliation and exact-name master lookups normalize whitespace
-- and case before comparing.
CREATE INDEX IF NOT EXISTS insurers_name_ci_idx
    ON insurers(lower(btrim(name)));
CREATE INDEX IF NOT EXISTS employees_display_name_ci_idx
    ON employees(lower(btrim(display_name)));

-- Reverse joins used when opening an attachment or rendering station history.
CREATE INDEX IF NOT EXISTS inspection_attachments_attachment_idx
    ON inspection_attachments(attachment_id);
CREATE INDEX IF NOT EXISTS job_contacts_contact_idx
    ON job_contacts(customer_contact_id);
CREATE INDEX IF NOT EXISTS job_station_progress_station_idx
    ON job_station_progress(station_id, updated_at);
CREATE INDEX IF NOT EXISTS job_station_progress_assignee_idx
    ON job_station_progress(assigned_employee_id, updated_at);
CREATE INDEX IF NOT EXISTS job_status_history_status_idx
    ON job_status_history(new_status_id, recorded_at);

-- Hash lookup supports attachment deduplication and integrity checks.
CREATE INDEX IF NOT EXISTS attachments_sha256_idx
    ON attachments(sha256);

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('database', 0, 'ADD_TARGETED_QUERY_INDEXES', jsonb_build_object(
    'index_groups', jsonb_build_array(
        'repair_job_filters', 'normalized_master_lookup',
        'reverse_attachment_and_station_lookup', 'attachment_hash_lookup'
    )
));

COMMIT;
