\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO rizenic_new, public;

-- External identifiers are kept separately from the internal master IDs. This
-- lets E-Claim mappings evolve without changing API-facing primary keys.
ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS plate_province_code text;

ALTER TABLE insurers
    ADD COLUMN IF NOT EXISTS comment text;

ALTER TABLE insurer_aliases
    ADD COLUMN IF NOT EXISTS comment text;

CREATE TABLE IF NOT EXISTS insurer_aliases (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_name text NOT NULL UNIQUE,
    insurer_id bigint NOT NULL REFERENCES insurers(id),
    source_code text,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS insurer_aliases_insurer_idx
    ON insurer_aliases(insurer_id);

CREATE TABLE IF NOT EXISTS eclaim_insurer_refs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    insurer_id bigint NOT NULL REFERENCES insurers(id),
    external_system text NOT NULL DEFAULT 'ECLAIM',
    external_code text NOT NULL,
    external_name text,
    is_active boolean NOT NULL DEFAULT true,
    comment text,
    UNIQUE (external_system, external_code)
);
CREATE INDEX IF NOT EXISTS eclaim_insurer_refs_insurer_idx
    ON eclaim_insurer_refs(insurer_id);

CREATE TABLE IF NOT EXISTS eclaim_province_refs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    province_name text NOT NULL,
    eclaim_code text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    comment text,
    UNIQUE (province_name, eclaim_code)
);

-- The legacy page selects vehicle data in an iframe and posts hidden catalog
-- keys. Keep those keys nullable and independent from car_models.id.
CREATE TABLE IF NOT EXISTS eclaim_vehicle_refs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    car_model_id bigint REFERENCES car_models(id),
    eclaim_type_code text,
    eclaim_brand_code text,
    eclaim_model_code text,
    eclaim_year text,
    eclaim_trim_code text,
    eclaim_engine_size text,
    eclaim_project_ref text,
    eclaim_model_name text,
    raw_payload jsonb,
    is_active boolean NOT NULL DEFAULT true,
    comment text,
    UNIQUE (eclaim_type_code, eclaim_brand_code, eclaim_model_code,
            eclaim_year, eclaim_trim_code, eclaim_project_ref)
);
CREATE INDEX IF NOT EXISTS eclaim_vehicle_refs_model_idx
    ON eclaim_vehicle_refs(car_model_id);
CREATE INDEX IF NOT EXISTS eclaim_vehicle_refs_lookup_idx
    ON eclaim_vehicle_refs(eclaim_brand_code, eclaim_model_code, eclaim_year);

-- Fixed values from the E-Claim page. These are reference data, not free text
-- and are safe to use from API validation without changing existing enums.
CREATE TABLE IF NOT EXISTS eclaim_reference_values (
    reference_type text NOT NULL,
    reference_code text NOT NULL,
    reference_name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (reference_type, reference_code)
);

INSERT INTO eclaim_reference_values(reference_type, reference_code, reference_name, sort_order)
VALUES
 ('REPAIR_TYPE','Q1','Q1',1), ('REPAIR_TYPE','Q2','Q2',2),
 ('REPAIR_TYPE','M1','M1',3), ('REPAIR_TYPE','M2','M2',4),
 ('REPAIR_TYPE','H1','H1',5), ('REPAIR_TYPE','H2','H2',6),
 ('REPAIR_TYPE','H3','H3',7),
 ('FUEL_LEVEL','0','E',0), ('FUEL_LEVEL','1','1/4',1),
 ('FUEL_LEVEL','2','1/2',2), ('FUEL_LEVEL','3','3/4',3),
 ('FUEL_LEVEL','4','F',4),
 ('PARK_STATUS','2','จอดซ่อม',1), ('PARK_STATUS','1','ไม่จอดซ่อม',2),
 ('HAS_PARTS','Y','มี',1), ('HAS_PARTS','N','ไม่มี',2),
 ('DELIVERY_RESULT','0','สภาพรถเรียบร้อย',1),
 ('DELIVERY_RESULT','1','รถซ่อมไม่เรียบร้อยพบปัญหา',2),
 ('DELIVERY_ITEMS','0','ครบ',1), ('DELIVERY_ITEMS','1','ไม่ครบ',2),
 ('EQUIPMENT','jack','แม่แรง',1),
 ('EQUIPMENT','floor_mat','แผ่นรองปูพื้น',2),
 ('EQUIPMENT','wheel_cover','ฝาครอบล้อ',3),
 ('EQUIPMENT','spare_tire','ยางอะไหล่',4),
 ('EQUIPMENT','radio','เครื่องเสียง',5),
 ('EQUIPMENT','other','อื่นๆ',6)
ON CONFLICT (reference_type, reference_code) DO UPDATE
SET reference_name = EXCLUDED.reference_name,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

-- Business-confirmed canonical mapping. Both legacy dropdown options refer
-- to the same company; historical labels remain on repair_jobs.payment_label.
DO $$
DECLARE canonical_id bigint;
BEGIN
    SELECT id INTO canonical_id
    FROM insurers
    WHERE is_active = true
      AND (code = 'LEGACY-f1b8691be1093c4f'
           OR lower(trim(name)) IN (
               lower('ชับบ์สามัคคีประกันภัย'),
               lower('บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)')
           ))
    ORDER BY CASE WHEN code = 'LEGACY-f1b8691be1093c4f' THEN 1 ELSE 2 END, id
    LIMIT 1;

    IF canonical_id IS NOT NULL THEN
        UPDATE insurers
        SET name = 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด (มหาชน)'
        WHERE id = canonical_id
          AND lower(trim(name)) = lower('ชับบ์สามัคคีประกันภัย');

        INSERT INTO eclaim_insurer_refs(insurer_id, external_code, external_name, comment)
        VALUES
          (canonical_id, '2418', 'บริษัท ชับบ์สามัคคีประกันภัย จำกัด  (มหาชน)', 'Canonical E-Claim option'),
          (canonical_id, '15', 'บริษัท ชับบ์สามัคคีประกันภัย (L)', 'Legacy E-Claim alias; same company')
        ON CONFLICT (external_system, external_code) DO UPDATE
        SET insurer_id = EXCLUDED.insurer_id,
            external_name = EXCLUDED.external_name,
            comment = EXCLUDED.comment,
            is_active = true;

        INSERT INTO insurer_aliases(source_name, insurer_id, source_code, comment)
        VALUES
          (lower('บริษัท ชับบ์สามัคคีประกันภัย (L)'), canonical_id, '15', 'Same company as canonical Chubb Samaggi'),
          (lower('บริษัท ชับบ์สามัคคีประกันภัย จำกัด  (มหาชน)'), canonical_id, '2418', 'Canonical E-Claim name')
        ON CONFLICT (source_name) DO UPDATE
        SET insurer_id = EXCLUDED.insurer_id,
            source_code = EXCLUDED.source_code,
            comment = EXCLUDED.comment;
    END IF;
END $$;

INSERT INTO eclaim_province_refs(province_name, eclaim_code, comment)
VALUES
 ('กระบี่','1','E-Claim ddlCarRegProvince'), ('กรุงเทพ ฯ','2','E-Claim ddlCarRegProvince'),
 ('กาญจนบุรี','3','E-Claim ddlCarRegProvince'), ('กาฬสินธุ์','4','E-Claim ddlCarRegProvince'),
 ('กำแพงเพชร','5','E-Claim ddlCarRegProvince'), ('ขอนแก่น','6','E-Claim ddlCarRegProvince'),
 ('จันทบุรี','7','E-Claim ddlCarRegProvince'), ('ฉะเชิงเทรา','8','E-Claim ddlCarRegProvince'),
 ('ชลบุรี','9','E-Claim ddlCarRegProvince'), ('ชัยนาท','10','E-Claim ddlCarRegProvince'),
 ('ชัยภูมิ','11','E-Claim ddlCarRegProvince'), ('ชุมพร','12','E-Claim ddlCarRegProvince'),
 ('เชียงราย','13','E-Claim ddlCarRegProvince'), ('เชียงใหม่','14','E-Claim ddlCarRegProvince'),
 ('ตรัง','15','E-Claim ddlCarRegProvince'), ('ตราด','16','E-Claim ddlCarRegProvince'),
 ('ตาก','17','E-Claim ddlCarRegProvince'), ('นครนายก','18','E-Claim ddlCarRegProvince'),
 ('นครปฐม','19','E-Claim ddlCarRegProvince'), ('นครพนม','20','E-Claim ddlCarRegProvince'),
 ('นครราชสีมา','21','E-Claim ddlCarRegProvince'), ('นครศรีธรรมราช','22','E-Claim ddlCarRegProvince'),
 ('นครสวรรค์','23','E-Claim ddlCarRegProvince'), ('นนทบุรี','24','E-Claim ddlCarRegProvince'),
 ('นราธิวาส','25','E-Claim ddlCarRegProvince'), ('น่าน','26','E-Claim ddlCarRegProvince'),
 ('บุรีรัมย์','27','E-Claim ddlCarRegProvince'), ('ปทุมธานี','28','E-Claim ddlCarRegProvince'),
 ('ประจวบคีรีขันธ์','29','E-Claim ddlCarRegProvince'), ('ปราจีนบุรี','30','E-Claim ddlCarRegProvince'),
 ('ปัตตานี','31','E-Claim ddlCarRegProvince'), ('พะเยา','32','E-Claim ddlCarRegProvince'),
 ('พังงา','33','E-Claim ddlCarRegProvince'), ('พัทลุง','34','E-Claim ddlCarRegProvince'),
 ('พิจิตร','35','E-Claim ddlCarRegProvince'), ('พิษณุโลก','36','E-Claim ddlCarRegProvince'),
 ('เพชรบุรี','37','E-Claim ddlCarRegProvince'), ('เพชรบูรณ์','38','E-Claim ddlCarRegProvince'),
 ('แพร่','39','E-Claim ddlCarRegProvince'), ('ภูเก็ต','40','E-Claim ddlCarRegProvince'),
 ('มหาสารคาม','41','E-Claim ddlCarRegProvince'), ('มุกดาหาร','42','E-Claim ddlCarRegProvince'),
 ('แม่ฮ่องสอน','43','E-Claim ddlCarRegProvince'), ('ยโสธร','44','E-Claim ddlCarRegProvince'),
 ('ยะลา','45','E-Claim ddlCarRegProvince'), ('ร้อยเอ็ด','46','E-Claim ddlCarRegProvince'),
 ('ระนอง','47','E-Claim ddlCarRegProvince'), ('ระยอง','48','E-Claim ddlCarRegProvince'),
 ('ราชบุรี','49','E-Claim ddlCarRegProvince'), ('ลพบุรี','50','E-Claim ddlCarRegProvince'),
 ('ลำปาง','51','E-Claim ddlCarRegProvince'), ('ลำพูน','52','E-Claim ddlCarRegProvince'),
 ('เลย','53','E-Claim ddlCarRegProvince'), ('ศรีสะเกษ','54','E-Claim ddlCarRegProvince'),
 ('สกลนคร','55','E-Claim ddlCarRegProvince'), ('สงขลา','56','E-Claim ddlCarRegProvince'),
 ('สตูล','57','E-Claim ddlCarRegProvince'), ('สมุทรปราการ','58','E-Claim ddlCarRegProvince'),
 ('สมุทรสงคราม','59','E-Claim ddlCarRegProvince'), ('สมุทรสาคร','60','E-Claim ddlCarRegProvince'),
 ('สระแก้ว','61','E-Claim ddlCarRegProvince'), ('สระบุรี','62','E-Claim ddlCarRegProvince'),
 ('สิงห์บุรี','63','E-Claim ddlCarRegProvince'), ('สุโขทัย','64','E-Claim ddlCarRegProvince'),
 ('สุพรรณบุรี','65','E-Claim ddlCarRegProvince'), ('สุราษฎร์ธานี','66','E-Claim ddlCarRegProvince'),
 ('สุรินทร์','67','E-Claim ddlCarRegProvince'), ('หนองคาย','68','E-Claim ddlCarRegProvince'),
 ('หนองบัวลำภู','69','E-Claim ddlCarRegProvince'), ('พระนครศรีอยุธยา','70','E-Claim ddlCarRegProvince'),
 ('อ่างทอง','71','E-Claim ddlCarRegProvince'), ('อำนาจเจริญ','72','E-Claim ddlCarRegProvince'),
 ('อุดรธานี','73','E-Claim ddlCarRegProvince'), ('อุตรดิตถ์','74','E-Claim ddlCarRegProvince'),
 ('อุทัยธานี','75','E-Claim ddlCarRegProvince'), ('อุบลราชธานี','76','E-Claim ddlCarRegProvince'),
 ('เบตง','77','E-Claim ddlCarRegProvince'), ('บึงกาฬ','78','E-Claim ddlCarRegProvince'),
 ('อื่นๆ','79','E-Claim ddlCarRegProvince')
ON CONFLICT (eclaim_code) DO UPDATE
SET province_name = EXCLUDED.province_name,
    comment = EXCLUDED.comment,
    is_active = true;

INSERT INTO audit_events(entity_type, entity_id, action, changes)
VALUES ('database', 0, 'ADD_ECLAIM_EXTERNAL_REFERENCE_KEYS', jsonb_build_object(
    'preserves_existing_ids', true,
    'canonical_chubb_eclaim_codes', jsonb_build_array('2418','15'),
    'reference_types', jsonb_build_array('REPAIR_TYPE','FUEL_LEVEL','PARK_STATUS','HAS_PARTS','DELIVERY_RESULT','DELIVERY_ITEMS','EQUIPMENT')
));

COMMIT;
