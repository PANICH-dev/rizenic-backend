\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

CREATE TABLE IF NOT EXISTS vehicle_registration_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id bigint NOT NULL REFERENCES vehicles(id),
    plate_number text NOT NULL,
    plate_province text,
    plate_province_code text,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_to timestamptz,
    is_current boolean NOT NULL DEFAULT true,
    source text NOT NULL DEFAULT 'SYSTEM',
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS vehicle_registration_history_vehicle_idx
    ON vehicle_registration_history(vehicle_id, valid_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_registration_history_current_idx
    ON vehicle_registration_history(vehicle_id) WHERE is_current;

-- Seed the current registration only when a vehicle has a plate and no history.
-- Existing vehicle rows and their IDs remain unchanged.
INSERT INTO vehicle_registration_history(
    vehicle_id, plate_number, plate_province, plate_province_code,
    valid_from, source, comment
)
SELECT v.id, trim(v.plate_number), v.plate_province, v.plate_province_code,
       v.created_at, 'LEGACY_MIGRATION', 'Seeded from vehicles current registration'
FROM vehicles v
WHERE nullif(trim(v.plate_number), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM vehicle_registration_history h
      WHERE h.vehicle_id = v.id
  );

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('vehicles', 0, 'ADD_VEHICLE_REGISTRATION_HISTORY', jsonb_build_object(
    'seeded_current_registrations', (
        SELECT count(*) FROM vehicle_registration_history WHERE source = 'LEGACY_MIGRATION'
    ),
    'preserves_vehicle_ids', true
));

COMMIT;
