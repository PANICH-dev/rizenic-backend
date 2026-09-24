\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- /jobs: the list query reads the latest phone, station flags, documents and
-- repair items through correlated subqueries for every repair job.
CREATE INDEX IF NOT EXISTS customer_contacts_job_phone_idx
    ON customer_contacts(customer_id, contact_type, is_primary DESC, id);
CREATE INDEX IF NOT EXISTS job_station_progress_job_state_station_idx
    ON job_station_progress(job_id, state, station_id);
CREATE INDEX IF NOT EXISTS job_repair_items_job_category_sort_idx
    ON job_repair_items(job_id, category, sort_order, id);
CREATE INDEX IF NOT EXISTS repair_jobs_active_latest_idx
    ON repair_jobs(id DESC) WHERE archived_at IS NULL;

-- /parts/inventory: aggregate stock movements by branch, part and movement
-- type, and resolve receipt items by part/order.
CREATE INDEX IF NOT EXISTS stock_movements_stock_type_idx
    ON stock_movements(branch_id, part_id, movement_type, recorded_at);
CREATE INDEX IF NOT EXISTS part_order_items_part_order_idx
    ON part_order_items(part_id, order_id);
CREATE INDEX IF NOT EXISTS stock_movements_issue_latest_idx
    ON stock_movements(id DESC) WHERE movement_type = 'ISSUE';

-- /inspection: job_id is already indexed, while this index makes the latest
-- inspection and attachment aggregation cheaper for a single job.
CREATE INDEX IF NOT EXISTS inspections_job_latest_idx
    ON inspections(job_id, id DESC);
CREATE INDEX IF NOT EXISTS inspection_attachments_inspection_purpose_idx
    ON inspection_attachments(inspection_id, purpose, attachment_id);

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('database', 0, 'ADD_HEAVY_API_QUERY_INDEXES', jsonb_build_object(
    'api_groups', jsonb_build_array('jobs', 'parts', 'inventory', 'inspection'),
    'correlated_subquery_paths', jsonb_build_array('contacts', 'stations', 'documents', 'repair_items')
));

COMMIT;
