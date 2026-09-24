\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

CREATE INDEX IF NOT EXISTS vehicles_plate_normalized_idx
    ON vehicles(lower(btrim(plate_number)));

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('database', 0, 'ADD_VEHICLE_PLATE_COMPATIBILITY_INDEX', jsonb_build_object(
    'lookup', 'lower(btrim(vehicles.plate_number))'
));

COMMIT;
