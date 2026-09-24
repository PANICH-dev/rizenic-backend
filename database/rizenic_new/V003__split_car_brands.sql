\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

CREATE TABLE IF NOT EXISTS car_brands (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true
);

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='rizenic_new' AND table_name='car_models' AND column_name='brand_name') THEN
        EXECUTE $$INSERT INTO car_brands(code, name)
            SELECT lower(regexp_replace(trim(brand_name), '[^a-zA-Z0-9ก-๙]+', '_', 'g')), trim(brand_name)
            FROM car_models GROUP BY trim(brand_name) ON CONFLICT (code) DO NOTHING$$;
        EXECUTE $$ALTER TABLE car_models ADD COLUMN IF NOT EXISTS brand_id bigint$$;
        EXECUTE $$UPDATE car_models m SET brand_id = b.id FROM car_brands b WHERE b.code = lower(regexp_replace(trim(m.brand_name), '[^a-zA-Z0-9ก-๙]+', '_', 'g'))$$;
        IF EXISTS (SELECT 1 FROM car_models WHERE brand_id IS NULL) THEN
            RAISE EXCEPTION 'Cannot split car brands: unmapped car_models remain';
        END IF;
        EXECUTE $$ALTER TABLE car_models ALTER COLUMN brand_id SET NOT NULL$$;
        EXECUTE $$ALTER TABLE car_models ADD CONSTRAINT car_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES car_brands(id)$$;
        EXECUTE $$ALTER TABLE car_models DROP CONSTRAINT IF EXISTS car_models_brand_name_model_name_key$$;
        EXECUTE $$ALTER TABLE car_models ADD CONSTRAINT car_models_brand_id_model_name_key UNIQUE (brand_id, model_name)$$;
        EXECUTE $$ALTER TABLE car_models DROP COLUMN brand_name$$;
    END IF;
END
$migration$;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('car_models', 0, 'SCHEMA_MIGRATION', jsonb_build_object(
    'migration', 'V003__split_car_brands',
    'brands', (SELECT count(*) FROM car_brands),
    'models', (SELECT count(*) FROM car_models)
));

COMMIT;
