\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

INSERT INTO car_brands(code, name)
VALUES ('unknown_brand', 'ไม่ระบุยี่ห้อ')
ON CONFLICT (code) DO NOTHING;

INSERT INTO car_models(brand_id, model_name)
SELECT b.id, 'ไม่ระบุรุ่น'
FROM car_brands b
WHERE b.code = 'unknown_brand'
   OR EXISTS (
       SELECT 1
       FROM rizenic_old.rizenicreport r
       WHERE nullif(trim(r.car_brand), '') IS NOT NULL
         AND nullif(trim(r.car_model), '') IS NULL
         AND b.code = lower(regexp_replace(trim(r.car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g'))
   )
ON CONFLICT (brand_id, model_name) DO NOTHING;

-- Resolve each vehicle from its legacy VIN/plate; retain the source brand
-- where available, otherwise use the explicit unknown brand/model.
UPDATE vehicles v
SET car_model_id = COALESCE(
    (
        SELECT cm.id
        FROM rizenic_old.rizenicreport r
        JOIN car_brands cb ON cb.code = COALESCE(
            NULLIF(lower(regexp_replace(trim(r.car_brand), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), ''),
            'unknown_brand'
        )
        JOIN car_models cm ON cm.brand_id = cb.id AND cm.model_name = CASE
            WHEN nullif(trim(r.car_model), '') IS NULL THEN 'ไม่ระบุรุ่น'
            ELSE trim(r.car_model)
        END
        WHERE (NULLIF(trim(r.vin_no), '') = v.vin AND v.vin IS NOT NULL)
           OR (NULLIF(trim(r.car_plate), '') = v.plate_number AND v.plate_number IS NOT NULL)
        ORDER BY r.id
        LIMIT 1
    ),
    (SELECT cm.id FROM car_models cm JOIN car_brands cb ON cb.id = cm.brand_id
     WHERE cb.code = 'unknown_brand' AND cm.model_name = 'ไม่ระบุรุ่น')
)
WHERE v.car_model_id IS NULL;

-- Any vehicle without a source identity gets the explicit generic model.
UPDATE vehicles v
SET car_model_id = cm.id
FROM car_models cm
JOIN car_brands cb ON cb.id = cm.brand_id AND cb.code = 'unknown_brand'
WHERE v.car_model_id IS NULL AND cm.model_name = 'ไม่ระบุรุ่น';

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('vehicles', 0, 'ASSIGN_UNKNOWN_MODEL', jsonb_build_object(
    'model_name', 'ไม่ระบุรุ่น',
    'vehicles_without_model', (SELECT count(*) FROM vehicles WHERE car_model_id IS NULL)
));

COMMIT;
