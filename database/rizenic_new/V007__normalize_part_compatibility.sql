\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

ALTER TABLE parts ADD COLUMN IF NOT EXISTS compatible_with_all_models boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS part_compatible_models (
    part_id bigint NOT NULL REFERENCES parts(id),
    car_model_id bigint NOT NULL REFERENCES car_models(id),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (part_id, car_model_id)
);
CREATE INDEX IF NOT EXISTS part_compatible_models_model_idx ON part_compatible_models(car_model_id);

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'rizenic_new' AND table_name = 'parts' AND column_name = 'compatible_models_text'
    ) THEN
        EXECUTE $$UPDATE parts p SET compatible_with_all_models = true WHERE EXISTS (SELECT 1 FROM unnest(string_to_array(coalesce(p.compatible_models_text, ''), ',')) token WHERE upper(trim(token)) = 'ALL')$$;
        EXECUTE $$INSERT INTO part_compatible_models(part_id, car_model_id)
            SELECT DISTINCT p.id, cm.id FROM parts p
            CROSS JOIN LATERAL unnest(string_to_array(coalesce(p.compatible_models_text, ''), ',')) token
            JOIN car_models cm ON lower(trim(cm.model_name)) = lower(trim(token))
            WHERE nullif(trim(token), '') IS NOT NULL AND upper(trim(token)) <> 'ALL'
            ON CONFLICT DO NOTHING$$;
        EXECUTE $$ALTER TABLE parts DROP COLUMN compatible_models_text$$;
    END IF;
END
$migration$;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('parts', 0, 'NORMALIZE_COMPATIBLE_MODELS', jsonb_build_object(
    'compatibility_rows', (SELECT count(*) FROM part_compatible_models),
    'all_model_parts', (SELECT count(*) FROM parts WHERE compatible_with_all_models)
));

ALTER TABLE parts DROP COLUMN IF EXISTS compatible_models_text;

COMMIT;
