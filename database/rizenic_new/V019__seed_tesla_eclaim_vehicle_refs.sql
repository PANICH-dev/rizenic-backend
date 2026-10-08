\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- E-Claim's Tesla selector currently exposes these seven model options.  The
-- option value is the model code itself.  Only the 2024 Model 3 project and
-- engine values have been confirmed from the captured WebForms response; the
-- remaining fields stay NULL until E-Claim returns their hidden values.
WITH tesla_models(model_code, engine_size, project_ref) AS (
    VALUES
      ('MODEL 3 EV 4DR 2017 TO 2023', NULL::text, NULL::text),
      ('MODEL 3 EV 4DR 2024', '0', '4711'),
      ('MODEL S EV', NULL::text, NULL::text),
      ('MODEL X 90D EV', NULL::text, NULL::text),
      ('MODEL X EV', NULL::text, NULL::text),
      ('MODEL Y EV 2020 TO 2024', NULL::text, NULL::text),
      ('MODEL Y EV 2025', NULL::text, NULL::text)
)
INSERT INTO eclaim_vehicle_refs(
    car_model_id, eclaim_type_code, eclaim_brand_code, eclaim_model_code,
    eclaim_engine_size, eclaim_project_ref, eclaim_model_name, comment
)
SELECT cm.id, 'E', 'ETESLA', tm.model_code, tm.engine_size, tm.project_ref,
       tm.model_code, 'Captured from E-Claim Tesla vehicle selector'
FROM tesla_models tm
LEFT JOIN car_brands cb ON lower(trim(cb.name)) = 'tesla'
LEFT JOIN car_models cm
  ON cm.brand_id = cb.id AND lower(trim(cm.model_name)) = lower(tm.model_code)
WHERE NOT EXISTS (
    SELECT 1
    FROM eclaim_vehicle_refs existing
    WHERE existing.eclaim_type_code = 'E'
      AND existing.eclaim_brand_code = 'ETESLA'
      AND existing.eclaim_model_code = tm.model_code
      AND existing.eclaim_engine_size IS NOT DISTINCT FROM tm.engine_size
      AND existing.eclaim_project_ref IS NOT DISTINCT FROM tm.project_ref
);

COMMIT;
