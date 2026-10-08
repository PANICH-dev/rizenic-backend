--
-- PostgreSQL database dump
--

\restrict QR1oXaVkznge7GGI0JUnXyAJT12qaj7cmEmzFQu42XQOpm2QIOKKBgVXZSY8G3b

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: rizenic_new; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rizenic_new;


--
-- Name: SCHEMA rizenic_new; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA rizenic_new IS 'Rizenic normalized design v1; structure only, legacy migration pending';


--
-- Name: rizenic_old; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA rizenic_old;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: rizenic_new; Owner: -
--

CREATE FUNCTION rizenic_new.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.attachments (
    id bigint NOT NULL,
    storage_key text NOT NULL,
    original_filename text,
    media_type text NOT NULL,
    byte_size bigint NOT NULL,
    sha256 character(64) NOT NULL,
    uploaded_by bigint,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_byte_size_check CHECK ((byte_size >= 0)),
    CONSTRAINT attachments_sha256_check CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.attachments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_events; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.audit_events (
    id bigint NOT NULL,
    actor_user_id bigint,
    branch_id bigint,
    entity_type text NOT NULL,
    entity_id bigint NOT NULL,
    action text NOT NULL,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id text,
    CONSTRAINT audit_events_changes_check CHECK ((jsonb_typeof(changes) = 'object'::text))
);


--
-- Name: audit_events_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.audit_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.audit_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: body_parts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.body_parts (
    id bigint NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT body_parts_category_check CHECK ((category = ANY (ARRAY['MAIN'::text, 'SUB'::text])))
);


--
-- Name: body_parts_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.body_parts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.body_parts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: branch_capacity_rules; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.branch_capacity_rules (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    metric text NOT NULL,
    rule_date date,
    capacity_limit integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT branch_capacity_rules_capacity_limit_check CHECK ((capacity_limit >= 0)),
    CONSTRAINT branch_capacity_rules_metric_check CHECK ((metric = ANY (ARRAY['INTAKE_CARS'::text, 'TARGET_CARS'::text, 'DELIVERY_CARS'::text, 'COLOR_PARTS'::text, 'MAIN_PARTS'::text, 'SUB_PARTS'::text])))
);


--
-- Name: branch_capacity_rules_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.branch_capacity_rules ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.branch_capacity_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: branch_parts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.branch_parts (
    branch_id bigint NOT NULL,
    part_id bigint NOT NULL,
    storage_location text,
    safety_stock numeric(18,3) DEFAULT 0 NOT NULL,
    CONSTRAINT branch_parts_safety_stock_check CHECK ((safety_stock >= (0)::numeric))
);


--
-- Name: branches; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.branches (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'Asia/Bangkok'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT branches_code_check CHECK ((btrim(code) <> ''::text)),
    CONSTRAINT branches_name_check CHECK ((btrim(name) <> ''::text))
);


--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.branches ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.branches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: car_brands; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.car_brands (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: car_brands_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.car_brands ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.car_brands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: car_models; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.car_models (
    id bigint NOT NULL,
    brand_id bigint NOT NULL,
    model_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: car_models_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.car_models ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.car_models_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customer_contacts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.customer_contacts (
    id bigint NOT NULL,
    customer_id bigint NOT NULL,
    contact_type text NOT NULL,
    raw_value text NOT NULL,
    label text,
    is_primary boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['PHONE'::text, 'EMAIL'::text, 'OTHER'::text]))),
    CONSTRAINT customer_contacts_raw_value_check CHECK ((btrim(raw_value) <> ''::text))
);


--
-- Name: customer_contacts_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.customer_contacts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.customer_contacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customer_identity_keys; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.customer_identity_keys (
    id bigint NOT NULL,
    customer_id bigint NOT NULL,
    key_type text NOT NULL,
    normalized_key text NOT NULL,
    CONSTRAINT customer_identity_keys_key_type_check CHECK ((key_type = ANY (ARRAY['PHONE'::text, 'EMAIL'::text, 'EXTERNAL_ID'::text]))),
    CONSTRAINT customer_identity_keys_normalized_key_check CHECK ((btrim(normalized_key) <> ''::text))
);


--
-- Name: customer_identity_keys_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.customer_identity_keys ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.customer_identity_keys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customer_types; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.customer_types (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: customer_types_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.customer_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.customer_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customers; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.customers (
    id bigint NOT NULL,
    display_name text NOT NULL,
    customer_type_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.customers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: departments; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.departments (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.departments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: eclaim_insurer_refs; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.eclaim_insurer_refs (
    id bigint NOT NULL,
    insurer_id bigint NOT NULL,
    external_system text DEFAULT 'ECLAIM'::text NOT NULL,
    external_code text NOT NULL,
    external_name text,
    is_active boolean DEFAULT true NOT NULL,
    comment text
);


--
-- Name: eclaim_insurer_refs_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.eclaim_insurer_refs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.eclaim_insurer_refs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: eclaim_province_refs; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.eclaim_province_refs (
    id bigint NOT NULL,
    province_name text NOT NULL,
    eclaim_code text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    comment text
);


--
-- Name: eclaim_province_refs_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.eclaim_province_refs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.eclaim_province_refs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: eclaim_reference_values; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.eclaim_reference_values (
    reference_type text NOT NULL,
    reference_code text NOT NULL,
    reference_name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: eclaim_vehicle_refs; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.eclaim_vehicle_refs (
    id bigint NOT NULL,
    car_model_id bigint,
    eclaim_type_code text,
    eclaim_brand_code text,
    eclaim_model_code text,
    eclaim_year text,
    eclaim_trim_code text,
    eclaim_engine_size text,
    eclaim_project_ref text,
    eclaim_model_name text,
    raw_payload jsonb,
    is_active boolean DEFAULT true NOT NULL,
    comment text
);


--
-- Name: eclaim_vehicle_refs_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.eclaim_vehicle_refs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.eclaim_vehicle_refs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employees; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.employees (
    id bigint NOT NULL,
    employee_code text NOT NULL,
    display_name text NOT NULL,
    phone text,
    home_branch_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.employees ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inspection_attachments; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.inspection_attachments (
    inspection_id bigint NOT NULL,
    attachment_id bigint NOT NULL,
    purpose text NOT NULL,
    CONSTRAINT inspection_attachments_purpose_check CHECK ((purpose = ANY (ARRAY['CAR_DIAGRAM'::text, 'FUEL_GAUGE'::text, 'CUSTOMER_INTAKE_SIGNATURE'::text, 'INSPECTOR_INTAKE_SIGNATURE'::text, 'CUSTOMER_DELIVERY_SIGNATURE'::text, 'INSPECTOR_DELIVERY_SIGNATURE'::text, 'OTHER'::text])))
);


--
-- Name: inspections; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.inspections (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    job_id bigint,
    vehicle_id bigint,
    inspection_type text NOT NULL,
    fuel_percent numeric(5,2),
    mileage numeric(18,3),
    job_type text,
    job_category text,
    repair_checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    inventory_checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    electrical_checklist jsonb DEFAULT '{}'::jsonb NOT NULL,
    inspector_id bigint,
    inspected_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inspections_electrical_checklist_check CHECK ((jsonb_typeof(electrical_checklist) = 'object'::text)),
    CONSTRAINT inspections_fuel_percent_check CHECK (((fuel_percent >= (0)::numeric) AND (fuel_percent <= (100)::numeric))),
    CONSTRAINT inspections_inspection_type_check CHECK ((inspection_type = ANY (ARRAY['INTAKE'::text, 'DELIVERY'::text, 'OTHER'::text, 'LEGACY'::text]))),
    CONSTRAINT inspections_inventory_checklist_check CHECK ((jsonb_typeof(inventory_checklist) = 'object'::text)),
    CONSTRAINT inspections_mileage_check CHECK ((mileage >= (0)::numeric)),
    CONSTRAINT inspections_repair_checklist_check CHECK ((jsonb_typeof(repair_checklist) = 'object'::text))
);


--
-- Name: inspections_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.inspections ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.inspections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: insurer_aliases; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.insurer_aliases (
    source_name text NOT NULL,
    insurer_id bigint NOT NULL,
    source_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comment text
);


--
-- Name: insurers; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.insurers (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    insurance_type text,
    is_active boolean DEFAULT true NOT NULL,
    comment text
);


--
-- Name: insurers_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.insurers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.insurers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_reservations; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_reservations (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    job_id bigint NOT NULL,
    part_id bigint NOT NULL,
    quantity_reserved numeric(18,3) NOT NULL,
    quantity_released numeric(18,3) DEFAULT 0 NOT NULL,
    reserved_at timestamp with time zone,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT part_reservations_check CHECK (((quantity_released >= (0)::numeric) AND (quantity_released <= quantity_reserved))),
    CONSTRAINT part_reservations_quantity_reserved_check CHECK ((quantity_reserved > (0)::numeric))
);


--
-- Name: reservation_balances; Type: VIEW; Schema: rizenic_new; Owner: -
--

CREATE VIEW rizenic_new.reservation_balances AS
SELECT
    NULL::bigint AS id,
    NULL::bigint AS branch_id,
    NULL::bigint AS part_id,
    NULL::bigint AS job_id,
    NULL::numeric(18,3) AS quantity_reserved,
    NULL::numeric(18,3) AS quantity_released,
    NULL::numeric AS quantity_issued,
    NULL::numeric AS quantity_remaining;


--
-- Name: stock_movements; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.stock_movements (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    part_id bigint NOT NULL,
    movement_type text NOT NULL,
    quantity_delta numeric(18,3) NOT NULL,
    unit_price numeric(19,4),
    movement_on date,
    occurred_at timestamp with time zone,
    job_id bigint,
    receipt_item_id bigint,
    reservation_id bigint,
    reason text,
    created_by bigint,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_check CHECK ((((movement_type = ANY (ARRAY['RECEIPT'::text, 'RETURN'::text, 'OPENING'::text])) AND (quantity_delta > (0)::numeric)) OR ((movement_type = 'ISSUE'::text) AND (quantity_delta < (0)::numeric)) OR (movement_type = 'ADJUSTMENT'::text))),
    CONSTRAINT stock_movements_check1 CHECK (((movement_type = 'RECEIPT'::text) = (receipt_item_id IS NOT NULL))),
    CONSTRAINT stock_movements_check2 CHECK (((reservation_id IS NULL) OR ((movement_type = 'ISSUE'::text) AND (job_id IS NOT NULL)))),
    CONSTRAINT stock_movements_check3 CHECK (((movement_type <> 'ADJUSTMENT'::text) OR (NULLIF(btrim(reason), ''::text) IS NOT NULL))),
    CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['RECEIPT'::text, 'ISSUE'::text, 'RETURN'::text, 'OPENING'::text, 'ADJUSTMENT'::text]))),
    CONSTRAINT stock_movements_quantity_delta_check CHECK ((quantity_delta <> (0)::numeric))
);


--
-- Name: TABLE stock_movements; Type: COMMENT; Schema: rizenic_new; Owner: -
--

COMMENT ON TABLE rizenic_new.stock_movements IS 'Post receipt and movement atomically; enforce quantity equality, available stock and reservation limits under a branch/part lock';


--
-- Name: inventory_balances; Type: VIEW; Schema: rizenic_new; Owner: -
--

CREATE VIEW rizenic_new.inventory_balances AS
 WITH keys AS (
         SELECT branch_parts.branch_id,
            branch_parts.part_id
           FROM rizenic_new.branch_parts
        UNION
         SELECT stock_movements.branch_id,
            stock_movements.part_id
           FROM rizenic_new.stock_movements
        UNION
         SELECT part_reservations.branch_id,
            part_reservations.part_id
           FROM rizenic_new.part_reservations
        ), stock AS (
         SELECT stock_movements.branch_id,
            stock_movements.part_id,
            sum(stock_movements.quantity_delta) AS quantity_on_hand
           FROM rizenic_new.stock_movements
          GROUP BY stock_movements.branch_id, stock_movements.part_id
        ), reserved AS (
         SELECT reservation_balances.branch_id,
            reservation_balances.part_id,
            sum(reservation_balances.quantity_remaining) AS quantity_reserved
           FROM rizenic_new.reservation_balances
          GROUP BY reservation_balances.branch_id, reservation_balances.part_id
        )
 SELECT k.branch_id,
    k.part_id,
    COALESCE(s.quantity_on_hand, (0)::numeric) AS quantity_on_hand,
    COALESCE(r.quantity_reserved, (0)::numeric) AS quantity_reserved,
    (COALESCE(s.quantity_on_hand, (0)::numeric) - COALESCE(r.quantity_reserved, (0)::numeric)) AS quantity_available
   FROM ((keys k
     LEFT JOIN stock s USING (branch_id, part_id))
     LEFT JOIN reserved r USING (branch_id, part_id));


--
-- Name: VIEW inventory_balances; Type: COMMENT; Schema: rizenic_new; Owner: -
--

COMMENT ON VIEW rizenic_new.inventory_balances IS 'Negative values are exposed for reconciliation, never silently clamped to zero';


--
-- Name: job_capacity_requirements; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_capacity_requirements (
    job_id bigint NOT NULL,
    metric text NOT NULL,
    units integer NOT NULL,
    CONSTRAINT job_capacity_requirements_metric_check CHECK ((metric = ANY (ARRAY['MAIN_PARTS'::text, 'SUB_PARTS'::text]))),
    CONSTRAINT job_capacity_requirements_units_check CHECK ((units >= 0))
);


--
-- Name: TABLE job_capacity_requirements; Type: COMMENT; Schema: rizenic_new; Owner: -
--

COMMENT ON TABLE rizenic_new.job_capacity_requirements IS 'Declared workload used for quotas; may differ from repair-item list counts in legacy data';


--
-- Name: job_contacts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_contacts (
    job_id bigint NOT NULL,
    customer_contact_id bigint NOT NULL,
    purpose text NOT NULL,
    CONSTRAINT job_contacts_purpose_check CHECK ((purpose = ANY (ARRAY['PRIMARY'::text, 'ALTERNATE'::text])))
);


--
-- Name: job_documents; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_documents (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    document_type text NOT NULL,
    document_number text NOT NULL,
    document_date date,
    issuer_label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_documents_document_number_check CHECK ((btrim(document_number) <> ''::text)),
    CONSTRAINT job_documents_document_type_check CHECK ((document_type = ANY (ARRAY['QT'::text, 'SO'::text, 'BL'::text, 'IVN'::text, 'EPC'::text, 'CLAIM'::text, 'OTHER'::text])))
);


--
-- Name: job_documents_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.job_documents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.job_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_financial_summaries; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_financial_summaries (
    job_id bigint NOT NULL,
    currency character(3) DEFAULT 'THB'::bpchar NOT NULL,
    labor_amount numeric(19,4),
    parts_amount numeric(19,4),
    external_amount numeric(19,4),
    billing_on date,
    insurance_paid_on date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE job_financial_summaries; Type: COMMENT; Schema: rizenic_new; Owner: -
--

COMMENT ON TABLE rizenic_new.job_financial_summaries IS 'Legacy monetary summaries; not a double-entry ledger and not proof of actual payment';


--
-- Name: job_part_requests; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_part_requests (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    part_id bigint,
    description text NOT NULL,
    quantity numeric(18,3) DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT job_part_requests_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: job_part_requests_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.job_part_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.job_part_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_part_tracking; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_part_tracking (
    job_id bigint NOT NULL,
    status text,
    ordered_on date,
    estimated_arrival_on date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_repair_items; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_repair_items (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    body_part_id bigint,
    category text NOT NULL,
    description text NOT NULL,
    quantity numeric(18,3) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT job_repair_items_category_check CHECK ((category = ANY (ARRAY['MAIN'::text, 'SUB'::text]))),
    CONSTRAINT job_repair_items_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: job_repair_items_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.job_repair_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.job_repair_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_station_progress; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_station_progress (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    station_id bigint NOT NULL,
    state text NOT NULL,
    legacy_checked boolean,
    assigned_employee_id bigint,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_station_progress_check CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT job_station_progress_state_check CHECK ((state = ANY (ARRAY['NOT_STARTED'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'ON_HOLD'::text, 'SKIPPED'::text, 'UNKNOWN'::text])))
);


--
-- Name: COLUMN job_station_progress.legacy_checked; Type: COMMENT; Schema: rizenic_new; Owner: -
--

COMMENT ON COLUMN rizenic_new.job_station_progress.legacy_checked IS 'Original checkbox value; does not prove completion or its time';


--
-- Name: job_station_progress_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.job_station_progress ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.job_station_progress_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_status_history; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_status_history (
    id bigint NOT NULL,
    job_id bigint NOT NULL,
    previous_status_id bigint,
    new_status_id bigint NOT NULL,
    changed_by bigint,
    occurred_at timestamp with time zone,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    source text NOT NULL,
    reason text,
    CONSTRAINT job_status_history_source_check CHECK ((source = ANY (ARRAY['APPLICATION'::text, 'MIGRATION'::text])))
);


--
-- Name: job_status_history_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.job_status_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.job_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: job_statuses; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.job_statuses (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    department_id bigint,
    legacy_route_page text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: job_statuses_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.job_statuses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.job_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: legacy_entity_mappings; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.legacy_entity_mappings (
    id bigint NOT NULL,
    legacy_record_id bigint NOT NULL,
    target_table text NOT NULL,
    mapping_key text DEFAULT 'primary'::text NOT NULL,
    target_id bigint,
    target_key jsonb DEFAULT '{}'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legacy_entity_mappings_check CHECK (((target_id IS NOT NULL) OR (target_key <> '{}'::jsonb))),
    CONSTRAINT legacy_entity_mappings_target_id_check CHECK ((target_id > 0)),
    CONSTRAINT legacy_entity_mappings_target_key_check CHECK ((jsonb_typeof(target_key) = 'object'::text)),
    CONSTRAINT legacy_entity_mappings_target_table_check CHECK ((target_table ~ '^[a-z][a-z_]*$'::text))
);


--
-- Name: TABLE legacy_entity_mappings; Type: COMMENT; Schema: rizenic_new; Owner: -
--

COMMENT ON TABLE rizenic_new.legacy_entity_mappings IS 'Polymorphic target IDs require migration validation; database FK only validates source record';


--
-- Name: legacy_entity_mappings_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.legacy_entity_mappings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.legacy_entity_mappings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: legacy_records; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.legacy_records (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    source_schema text NOT NULL,
    source_table text NOT NULL,
    source_key text NOT NULL,
    payload jsonb NOT NULL,
    payload_checksum text NOT NULL,
    redacted_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legacy_records_payload_check CHECK (((jsonb_typeof(payload) = 'object'::text) AND (NOT (payload ? 'password'::text)))),
    CONSTRAINT legacy_records_redacted_fields_check CHECK ((jsonb_typeof(redacted_fields) = 'array'::text))
);


--
-- Name: legacy_records_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.legacy_records ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.legacy_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: migration_issues; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.migration_issues (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    legacy_record_id bigint,
    field_name text,
    issue_code text NOT NULL,
    severity text NOT NULL,
    state text DEFAULT 'OPEN'::text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolution_note text,
    resolved_by bigint,
    resolved_at timestamp with time zone,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT migration_issues_check CHECK (((state = 'OPEN'::text) OR ((resolved_at IS NOT NULL) AND (NULLIF(btrim(resolution_note), ''::text) IS NOT NULL)))),
    CONSTRAINT migration_issues_details_check CHECK ((jsonb_typeof(details) = 'object'::text)),
    CONSTRAINT migration_issues_severity_check CHECK ((severity = ANY (ARRAY['INFO'::text, 'WARNING'::text, 'ERROR'::text]))),
    CONSTRAINT migration_issues_state_check CHECK ((state = ANY (ARRAY['OPEN'::text, 'RESOLVED'::text, 'ACCEPTED'::text])))
);


--
-- Name: migration_issues_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.migration_issues ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.migration_issues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: migration_runs; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.migration_runs (
    id bigint NOT NULL,
    source_name text NOT NULL,
    source_checksum text,
    mapping_version text NOT NULL,
    state text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT migration_runs_state_check CHECK ((state = ANY (ARRAY['PREPARING'::text, 'RUNNING'::text, 'VALIDATING'::text, 'COMPLETED'::text, 'FAILED'::text]))),
    CONSTRAINT migration_runs_summary_check CHECK ((jsonb_typeof(summary) = 'object'::text))
);


--
-- Name: migration_runs_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.migration_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.migration_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_compatibility_unresolved; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_compatibility_unresolved (
    part_id bigint NOT NULL,
    raw_model_name text NOT NULL,
    reason text DEFAULT 'MODEL_NOT_IN_MASTER'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: part_compatible_models; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_compatible_models (
    part_id bigint NOT NULL,
    car_model_id bigint NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: part_order_items; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_order_items (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    order_id bigint NOT NULL,
    line_number integer NOT NULL,
    job_id bigint,
    part_id bigint NOT NULL,
    status_id bigint,
    description text NOT NULL,
    part_type text,
    quantity_ordered numeric(18,3) NOT NULL,
    estimated_arrival_on date,
    reported_received_on date,
    notes text,
    CONSTRAINT part_order_items_line_number_check CHECK ((line_number > 0)),
    CONSTRAINT part_order_items_quantity_ordered_check CHECK ((quantity_ordered > (0)::numeric))
);


--
-- Name: part_order_items_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.part_order_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.part_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_order_receipt_totals; Type: VIEW; Schema: rizenic_new; Owner: -
--

CREATE VIEW rizenic_new.part_order_receipt_totals AS
SELECT
    NULL::bigint AS order_item_id,
    NULL::numeric(18,3) AS quantity_ordered,
    NULL::numeric AS quantity_received;


--
-- Name: part_order_statuses; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_order_statuses (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: part_order_statuses_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.part_order_statuses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.part_order_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_orders; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_orders (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    order_number text,
    epc_reference text,
    ordered_on date,
    ordered_at time without time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: part_orders_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.part_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.part_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_receipt_items; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_receipt_items (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    receipt_id bigint NOT NULL,
    line_number integer NOT NULL,
    order_item_id bigint,
    part_id bigint NOT NULL,
    description text,
    quantity numeric(18,3) NOT NULL,
    unit_price numeric(19,4),
    CONSTRAINT part_receipt_items_line_number_check CHECK ((line_number > 0)),
    CONSTRAINT part_receipt_items_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: part_receipt_items_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.part_receipt_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.part_receipt_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_receipts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.part_receipts (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    receipt_number text,
    epc_reference text,
    received_on date NOT NULL,
    received_by bigint,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: part_receipts_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.part_receipts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.part_receipts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: part_reservations_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.part_reservations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.part_reservations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: parts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.parts (
    id bigint NOT NULL,
    part_number text NOT NULL,
    main_part_number text,
    name text NOT NULL,
    compatible_with_all_models boolean DEFAULT false NOT NULL,
    category text,
    unit text DEFAULT 'piece'::text NOT NULL,
    default_unit_price numeric(19,4),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parts_part_number_check CHECK ((btrim(part_number) <> ''::text))
);


--
-- Name: parts_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.parts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.parts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: permissions; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.permissions (
    id bigint NOT NULL,
    code text NOT NULL,
    description text
);


--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: repair_jobs; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.repair_jobs (
    id bigint NOT NULL,
    branch_id bigint NOT NULL,
    job_number text,
    customer_id bigint,
    vehicle_id bigint,
    service_advisor_id bigint,
    customer_type_id bigint,
    insurer_id bigint,
    status_id bigint,
    department_id bigint,
    damage_level text,
    payment_label text,
    is_parked boolean,
    notes text,
    repair_notes text,
    complaint_note text,
    contact_on date,
    appointment_on date,
    intake_on date,
    estimated_finish_on date,
    target_finish_on date,
    actual_finish_on date,
    repair_finished_on date,
    delivery_on date,
    archived_at timestamp with time zone,
    version bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: repair_jobs_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.repair_jobs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.repair_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: repair_stations; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.repair_stations (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: repair_stations_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.repair_stations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.repair_stations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: role_permissions; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.role_permissions (
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.roles (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_accounts; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.user_accounts (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    username text NOT NULL,
    password_hash text,
    credential_state text DEFAULT 'RESET_REQUIRED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_accounts_check CHECK (((credential_state <> 'ACTIVE'::text) OR (NULLIF(btrim(password_hash), ''::text) IS NOT NULL))),
    CONSTRAINT user_accounts_credential_state_check CHECK ((credential_state = ANY (ARRAY['RESET_REQUIRED'::text, 'ACTIVE'::text, 'DISABLED'::text]))),
    CONSTRAINT user_accounts_username_check CHECK ((btrim(username) <> ''::text))
);


--
-- Name: user_accounts_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.user_accounts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.user_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_branch_permissions; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.user_branch_permissions (
    user_id bigint NOT NULL,
    branch_id bigint NOT NULL,
    permission_id bigint NOT NULL,
    effect text NOT NULL,
    CONSTRAINT user_branch_permissions_effect_check CHECK ((effect = ANY (ARRAY['ALLOW'::text, 'DENY'::text])))
);


--
-- Name: user_branch_roles; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.user_branch_roles (
    user_id bigint NOT NULL,
    branch_id bigint NOT NULL,
    role_id bigint NOT NULL
);


--
-- Name: user_preferences; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.user_preferences (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    page_key text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_preferences_settings_check CHECK ((jsonb_typeof(settings) = 'object'::text))
);


--
-- Name: user_preferences_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.user_preferences ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.user_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vehicle_registration_history; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.vehicle_registration_history (
    id bigint NOT NULL,
    vehicle_id bigint NOT NULL,
    plate_number text NOT NULL,
    plate_province text,
    plate_province_code text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_to timestamp with time zone,
    is_current boolean DEFAULT true NOT NULL,
    source text DEFAULT 'SYSTEM'::text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicle_registration_history_check CHECK (((valid_to IS NULL) OR (valid_to >= valid_from)))
);


--
-- Name: vehicle_registration_history_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.vehicle_registration_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.vehicle_registration_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: vehicles; Type: TABLE; Schema: rizenic_new; Owner: -
--

CREATE TABLE rizenic_new.vehicles (
    id bigint NOT NULL,
    car_model_id bigint,
    vin text,
    plate_number text,
    plate_province text,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    plate_province_code text
);


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: rizenic_new; Owner: -
--

ALTER TABLE rizenic_new.vehicles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME rizenic_new.vehicles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: customers; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.customers (
    id integer NOT NULL,
    customer_name text,
    phone_number text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.customers ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inspection_reports; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.inspection_reports (
    id integer NOT NULL,
    job_id text,
    car_plate text,
    branch_name text,
    fuel_level integer DEFAULT 0,
    current_mileage numeric DEFAULT 0,
    job_type text,
    job_category text,
    repair_checklist jsonb DEFAULT '{}'::jsonb,
    inventory_checklist jsonb DEFAULT '{}'::jsonb,
    electrical_checklist jsonb DEFAULT '{}'::jsonb,
    car_diagram_image text,
    fuel_gauge_image text,
    customer_signature text,
    inspector_signature text,
    customer_signature_delivery text,
    inspector_signature_delivery text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    claim_no text
);


--
-- Name: inspection_reports_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.inspection_reports ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.inspection_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_body_parts; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_body_parts (
    id integer NOT NULL,
    part_name text,
    category text
);


--
-- Name: rizenic_body_parts_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_body_parts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_body_parts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_part_inbound; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_part_inbound (
    inbound_id integer NOT NULL,
    received_date date,
    epc_no text,
    part_no text,
    part_main_no text,
    part_name text,
    car_model text,
    qty integer DEFAULT 0,
    unit_price numeric DEFAULT 0,
    branch_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rizenic_part_inbound_inbound_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_part_inbound ALTER COLUMN inbound_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_part_inbound_inbound_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_part_locations; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_part_locations (
    id integer NOT NULL,
    part_no text,
    branch_name text,
    location text,
    safety_stock integer DEFAULT 0
);


--
-- Name: rizenic_part_locations_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_part_locations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_part_locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_part_orders; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_part_orders (
    order_id integer NOT NULL,
    qt_no text,
    so_no text,
    epc_no text,
    order_date date,
    est_arrival_date date,
    received_date date,
    order_time text,
    car_plate text,
    vin_no text,
    car_model text,
    part_no text,
    part_main_no text,
    qty_ordered integer DEFAULT 0,
    qty_received integer DEFAULT 0,
    order_status text,
    part_name text,
    part_type text,
    branch_name text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    report_id integer,
    job_id integer
);


--
-- Name: rizenic_part_orders_order_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_part_orders ALTER COLUMN order_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_part_orders_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_part_outbound; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_part_outbound (
    outbound_id integer NOT NULL,
    issue_date date,
    part_no text,
    part_main_no text,
    part_name text,
    qty integer DEFAULT 0,
    car_plate text,
    qt_no text,
    so_no text,
    unit_price numeric DEFAULT 0,
    part_type text,
    car_model text,
    job_status text,
    branch_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    job_id integer
);


--
-- Name: rizenic_part_outbound_outbound_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_part_outbound ALTER COLUMN outbound_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_part_outbound_outbound_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_part_status_master; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_part_status_master (
    status_id integer NOT NULL,
    status_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rizenic_part_status_master_status_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_part_status_master ALTER COLUMN status_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_part_status_master_status_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_quotas; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_quotas (
    id integer NOT NULL,
    quota_type text,
    quota_date date,
    branch_name text,
    quota_arrived integer DEFAULT 0,
    quota_target integer DEFAULT 0,
    quota_delivery integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    quota_color_parts integer DEFAULT 0,
    quota_main_parts integer DEFAULT 0,
    quota_sub_parts integer DEFAULT 0
);


--
-- Name: rizenic_quotas_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_quotas ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_quotas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenic_routing_master; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenic_routing_master (
    routing_id integer NOT NULL,
    routing_name text
);


--
-- Name: rizenic_routing_master_routing_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenic_routing_master ALTER COLUMN routing_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenic_routing_master_routing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizeniccarmodelmaster; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizeniccarmodelmaster (
    model_id integer NOT NULL,
    car_brand text,
    car_model text
);


--
-- Name: rizeniccarmodelmaster_model_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizeniccarmodelmaster ALTER COLUMN model_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizeniccarmodelmaster_model_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizeniccustomertypemaster; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizeniccustomertypemaster (
    customer_type_id integer NOT NULL,
    type_code text,
    type_name text
);


--
-- Name: rizeniccustomertypemaster_customer_type_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizeniccustomertypemaster ALTER COLUMN customer_type_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizeniccustomertypemaster_customer_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenicemployeemaster; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenicemployeemaster (
    employee_id integer NOT NULL,
    employee_code text,
    employee_name text,
    employee_role text,
    employee_phone text,
    is_active boolean DEFAULT true,
    branch_name text,
    username text,
    password text,
    accessible_pages text
);


--
-- Name: rizenicemployeemaster_employee_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenicemployeemaster ALTER COLUMN employee_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenicemployeemaster_employee_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenicinsurancemaster; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenicinsurancemaster (
    insurance_code text NOT NULL,
    insurance_name text,
    insurance_type text
);


--
-- Name: rizenicpartsmaster; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenicpartsmaster (
    part_id integer NOT NULL,
    part_main_no text,
    part_no text,
    part_name text,
    car_model text,
    part_category text,
    unit_price numeric DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rizenicpartsmaster_part_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenicpartsmaster ALTER COLUMN part_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenicpartsmaster_part_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenicreport; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenicreport (
    id integer NOT NULL,
    contact_date date,
    appointment_date date,
    customer_type text,
    customer_name text,
    phone_number text,
    car_plate text,
    car_brand text,
    car_model text,
    vin_no text,
    payment_type text,
    sa_owner text,
    damage_level text,
    main_part_name text,
    main_part_qty integer DEFAULT 0,
    sub_part_name text,
    sub_part_qty integer DEFAULT 0,
    cost_labor numeric DEFAULT 0,
    cost_part numeric DEFAULT 0,
    cost_external numeric DEFAULT 0,
    job_status text,
    expected_finish_date date,
    actual_finish_date date,
    delivery_date date,
    quotation_no text,
    job_order_no text,
    ivn_no text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    target_finish_date date,
    customer_phone text,
    branch_name text,
    arrived_date date,
    station_kho boolean DEFAULT false,
    station_pou boolean DEFAULT false,
    station_puan boolean DEFAULT false,
    station_pon boolean DEFAULT false,
    station_prak boolean DEFAULT false,
    station_kat boolean DEFAULT false,
    station_qc boolean DEFAULT false,
    station_mag boolean DEFAULT false,
    station_kraj boolean DEFAULT false,
    station_film boolean DEFAULT false,
    station_pak boolean DEFAULT false,
    station_ready boolean DEFAULT false,
    repair_notes text,
    repair_finish_date date,
    qt_no text,
    so_no text,
    bl_no text,
    epc_no text,
    part_status text,
    order_part_date date,
    est_part_date date,
    ordered_part_names text,
    department_routing text,
    insurance_pay_date date,
    is_parked text,
    billing_date date,
    car_color text,
    claim_no text,
    complain_note text
);


--
-- Name: rizenicreport_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.rizenicreport ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.rizenicreport_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rizenicstatusmaster; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.rizenicstatusmaster (
    status_code text NOT NULL,
    status_name text,
    department text,
    route_page text
);


--
-- Name: user_column_preferences; Type: TABLE; Schema: rizenic_old; Owner: -
--

CREATE TABLE rizenic_old.user_column_preferences (
    user_id integer NOT NULL,
    emp_name text,
    hidden_columns jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    row_highlights jsonb DEFAULT '{}'::jsonb
);


--
-- Name: user_column_preferences_user_id_seq; Type: SEQUENCE; Schema: rizenic_old; Owner: -
--

ALTER TABLE rizenic_old.user_column_preferences ALTER COLUMN user_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME rizenic_old.user_column_preferences_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_storage_key_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.attachments
    ADD CONSTRAINT attachments_storage_key_key UNIQUE (storage_key);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: body_parts body_parts_id_category_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.body_parts
    ADD CONSTRAINT body_parts_id_category_key UNIQUE (id, category);


--
-- Name: body_parts body_parts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.body_parts
    ADD CONSTRAINT body_parts_pkey PRIMARY KEY (id);


--
-- Name: branch_capacity_rules branch_capacity_rules_branch_id_metric_rule_date_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branch_capacity_rules
    ADD CONSTRAINT branch_capacity_rules_branch_id_metric_rule_date_key UNIQUE NULLS NOT DISTINCT (branch_id, metric, rule_date);


--
-- Name: branch_capacity_rules branch_capacity_rules_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branch_capacity_rules
    ADD CONSTRAINT branch_capacity_rules_pkey PRIMARY KEY (id);


--
-- Name: branch_parts branch_parts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branch_parts
    ADD CONSTRAINT branch_parts_pkey PRIMARY KEY (branch_id, part_id);


--
-- Name: branches branches_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branches
    ADD CONSTRAINT branches_code_key UNIQUE (code);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: car_brands car_brands_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.car_brands
    ADD CONSTRAINT car_brands_code_key UNIQUE (code);


--
-- Name: car_brands car_brands_name_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.car_brands
    ADD CONSTRAINT car_brands_name_key UNIQUE (name);


--
-- Name: car_brands car_brands_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.car_brands
    ADD CONSTRAINT car_brands_pkey PRIMARY KEY (id);


--
-- Name: car_models car_models_brand_id_model_name_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.car_models
    ADD CONSTRAINT car_models_brand_id_model_name_key UNIQUE (brand_id, model_name);


--
-- Name: car_models car_models_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.car_models
    ADD CONSTRAINT car_models_pkey PRIMARY KEY (id);


--
-- Name: customer_contacts customer_contacts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_contacts
    ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: customer_identity_keys customer_identity_keys_id_customer_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_identity_keys
    ADD CONSTRAINT customer_identity_keys_id_customer_id_key UNIQUE (id, customer_id);


--
-- Name: customer_identity_keys customer_identity_keys_key_type_normalized_key_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_identity_keys
    ADD CONSTRAINT customer_identity_keys_key_type_normalized_key_key UNIQUE (key_type, normalized_key);


--
-- Name: customer_identity_keys customer_identity_keys_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_identity_keys
    ADD CONSTRAINT customer_identity_keys_pkey PRIMARY KEY (id);


--
-- Name: customer_types customer_types_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_types
    ADD CONSTRAINT customer_types_code_key UNIQUE (code);


--
-- Name: customer_types customer_types_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_types
    ADD CONSTRAINT customer_types_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: eclaim_insurer_refs eclaim_insurer_refs_external_system_external_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_insurer_refs
    ADD CONSTRAINT eclaim_insurer_refs_external_system_external_code_key UNIQUE (external_system, external_code);


--
-- Name: eclaim_insurer_refs eclaim_insurer_refs_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_insurer_refs
    ADD CONSTRAINT eclaim_insurer_refs_pkey PRIMARY KEY (id);


--
-- Name: eclaim_province_refs eclaim_province_refs_eclaim_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_province_refs
    ADD CONSTRAINT eclaim_province_refs_eclaim_code_key UNIQUE (eclaim_code);


--
-- Name: eclaim_province_refs eclaim_province_refs_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_province_refs
    ADD CONSTRAINT eclaim_province_refs_pkey PRIMARY KEY (id);


--
-- Name: eclaim_province_refs eclaim_province_refs_province_name_eclaim_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_province_refs
    ADD CONSTRAINT eclaim_province_refs_province_name_eclaim_code_key UNIQUE (province_name, eclaim_code);


--
-- Name: eclaim_reference_values eclaim_reference_values_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_reference_values
    ADD CONSTRAINT eclaim_reference_values_pkey PRIMARY KEY (reference_type, reference_code);


--
-- Name: eclaim_vehicle_refs eclaim_vehicle_refs_eclaim_type_code_eclaim_brand_code_ecla_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_vehicle_refs
    ADD CONSTRAINT eclaim_vehicle_refs_eclaim_type_code_eclaim_brand_code_ecla_key UNIQUE (eclaim_type_code, eclaim_brand_code, eclaim_model_code, eclaim_year, eclaim_trim_code, eclaim_project_ref);


--
-- Name: eclaim_vehicle_refs eclaim_vehicle_refs_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_vehicle_refs
    ADD CONSTRAINT eclaim_vehicle_refs_pkey PRIMARY KEY (id);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: inspection_attachments inspection_attachments_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspection_attachments
    ADD CONSTRAINT inspection_attachments_pkey PRIMARY KEY (inspection_id, attachment_id, purpose);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: insurer_aliases insurer_aliases_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.insurer_aliases
    ADD CONSTRAINT insurer_aliases_pkey PRIMARY KEY (source_name);


--
-- Name: insurers insurers_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.insurers
    ADD CONSTRAINT insurers_code_key UNIQUE (code);


--
-- Name: insurers insurers_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.insurers
    ADD CONSTRAINT insurers_pkey PRIMARY KEY (id);


--
-- Name: job_capacity_requirements job_capacity_requirements_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_capacity_requirements
    ADD CONSTRAINT job_capacity_requirements_pkey PRIMARY KEY (job_id, metric);


--
-- Name: job_contacts job_contacts_job_id_purpose_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_contacts
    ADD CONSTRAINT job_contacts_job_id_purpose_key UNIQUE (job_id, purpose);


--
-- Name: job_contacts job_contacts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_contacts
    ADD CONSTRAINT job_contacts_pkey PRIMARY KEY (job_id, customer_contact_id, purpose);


--
-- Name: job_documents job_documents_job_id_document_type_document_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_documents
    ADD CONSTRAINT job_documents_job_id_document_type_document_number_key UNIQUE (job_id, document_type, document_number);


--
-- Name: job_documents job_documents_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_documents
    ADD CONSTRAINT job_documents_pkey PRIMARY KEY (id);


--
-- Name: job_financial_summaries job_financial_summaries_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_financial_summaries
    ADD CONSTRAINT job_financial_summaries_pkey PRIMARY KEY (job_id);


--
-- Name: job_part_requests job_part_requests_job_id_sort_order_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_part_requests
    ADD CONSTRAINT job_part_requests_job_id_sort_order_key UNIQUE (job_id, sort_order);


--
-- Name: job_part_requests job_part_requests_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_part_requests
    ADD CONSTRAINT job_part_requests_pkey PRIMARY KEY (id);


--
-- Name: job_part_tracking job_part_tracking_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_part_tracking
    ADD CONSTRAINT job_part_tracking_pkey PRIMARY KEY (job_id);


--
-- Name: job_repair_items job_repair_items_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_repair_items
    ADD CONSTRAINT job_repair_items_pkey PRIMARY KEY (id);


--
-- Name: job_station_progress job_station_progress_job_id_station_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_station_progress
    ADD CONSTRAINT job_station_progress_job_id_station_id_key UNIQUE (job_id, station_id);


--
-- Name: job_station_progress job_station_progress_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_station_progress
    ADD CONSTRAINT job_station_progress_pkey PRIMARY KEY (id);


--
-- Name: job_status_history job_status_history_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_status_history
    ADD CONSTRAINT job_status_history_pkey PRIMARY KEY (id);


--
-- Name: job_statuses job_statuses_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_statuses
    ADD CONSTRAINT job_statuses_code_key UNIQUE (code);


--
-- Name: job_statuses job_statuses_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_statuses
    ADD CONSTRAINT job_statuses_pkey PRIMARY KEY (id);


--
-- Name: legacy_entity_mappings legacy_entity_mappings_legacy_record_id_target_table_mappin_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_entity_mappings
    ADD CONSTRAINT legacy_entity_mappings_legacy_record_id_target_table_mappin_key UNIQUE (legacy_record_id, target_table, mapping_key);


--
-- Name: legacy_entity_mappings legacy_entity_mappings_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_entity_mappings
    ADD CONSTRAINT legacy_entity_mappings_pkey PRIMARY KEY (id);


--
-- Name: legacy_records legacy_records_id_run_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_records
    ADD CONSTRAINT legacy_records_id_run_id_key UNIQUE (id, run_id);


--
-- Name: legacy_records legacy_records_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_records
    ADD CONSTRAINT legacy_records_pkey PRIMARY KEY (id);


--
-- Name: legacy_records legacy_records_run_id_source_schema_source_table_source_key_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_records
    ADD CONSTRAINT legacy_records_run_id_source_schema_source_table_source_key_key UNIQUE (run_id, source_schema, source_table, source_key);


--
-- Name: migration_issues migration_issues_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.migration_issues
    ADD CONSTRAINT migration_issues_pkey PRIMARY KEY (id);


--
-- Name: migration_runs migration_runs_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.migration_runs
    ADD CONSTRAINT migration_runs_pkey PRIMARY KEY (id);


--
-- Name: part_compatibility_unresolved part_compatibility_unresolved_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_compatibility_unresolved
    ADD CONSTRAINT part_compatibility_unresolved_pkey PRIMARY KEY (part_id, raw_model_name);


--
-- Name: part_compatible_models part_compatible_models_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_compatible_models
    ADD CONSTRAINT part_compatible_models_pkey PRIMARY KEY (part_id, car_model_id);


--
-- Name: part_order_items part_order_items_id_part_id_branch_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_id_part_id_branch_id_key UNIQUE (id, part_id, branch_id);


--
-- Name: part_order_items part_order_items_order_id_line_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_order_id_line_number_key UNIQUE (order_id, line_number);


--
-- Name: part_order_items part_order_items_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_pkey PRIMARY KEY (id);


--
-- Name: part_order_statuses part_order_statuses_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_statuses
    ADD CONSTRAINT part_order_statuses_code_key UNIQUE (code);


--
-- Name: part_order_statuses part_order_statuses_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_statuses
    ADD CONSTRAINT part_order_statuses_pkey PRIMARY KEY (id);


--
-- Name: part_orders part_orders_branch_id_order_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_orders
    ADD CONSTRAINT part_orders_branch_id_order_number_key UNIQUE (branch_id, order_number);


--
-- Name: part_orders part_orders_id_branch_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_orders
    ADD CONSTRAINT part_orders_id_branch_id_key UNIQUE (id, branch_id);


--
-- Name: part_orders part_orders_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_orders
    ADD CONSTRAINT part_orders_pkey PRIMARY KEY (id);


--
-- Name: part_receipt_items part_receipt_items_id_part_id_branch_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_id_part_id_branch_id_key UNIQUE (id, part_id, branch_id);


--
-- Name: part_receipt_items part_receipt_items_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: part_receipt_items part_receipt_items_receipt_id_line_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_receipt_id_line_number_key UNIQUE (receipt_id, line_number);


--
-- Name: part_receipts part_receipts_branch_id_receipt_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipts
    ADD CONSTRAINT part_receipts_branch_id_receipt_number_key UNIQUE (branch_id, receipt_number);


--
-- Name: part_receipts part_receipts_id_branch_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipts
    ADD CONSTRAINT part_receipts_id_branch_id_key UNIQUE (id, branch_id);


--
-- Name: part_receipts part_receipts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipts
    ADD CONSTRAINT part_receipts_pkey PRIMARY KEY (id);


--
-- Name: part_reservations part_reservations_id_job_id_part_id_branch_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_reservations
    ADD CONSTRAINT part_reservations_id_job_id_part_id_branch_id_key UNIQUE (id, job_id, part_id, branch_id);


--
-- Name: part_reservations part_reservations_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_reservations
    ADD CONSTRAINT part_reservations_pkey PRIMARY KEY (id);


--
-- Name: parts parts_part_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.parts
    ADD CONSTRAINT parts_part_number_key UNIQUE (part_number);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: repair_jobs repair_jobs_branch_id_job_number_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_branch_id_job_number_key UNIQUE (branch_id, job_number);


--
-- Name: repair_jobs repair_jobs_id_branch_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_id_branch_id_key UNIQUE (id, branch_id);


--
-- Name: repair_jobs repair_jobs_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_pkey PRIMARY KEY (id);


--
-- Name: repair_stations repair_stations_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_stations
    ADD CONSTRAINT repair_stations_code_key UNIQUE (code);


--
-- Name: repair_stations repair_stations_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_stations
    ADD CONSTRAINT repair_stations_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_receipt_item_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_receipt_item_id_key UNIQUE (receipt_item_id);


--
-- Name: user_accounts user_accounts_employee_id_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_accounts
    ADD CONSTRAINT user_accounts_employee_id_key UNIQUE (employee_id);


--
-- Name: user_accounts user_accounts_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_accounts
    ADD CONSTRAINT user_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_branch_permissions user_branch_permissions_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_permissions
    ADD CONSTRAINT user_branch_permissions_pkey PRIMARY KEY (user_id, branch_id, permission_id);


--
-- Name: user_branch_roles user_branch_roles_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_roles
    ADD CONSTRAINT user_branch_roles_pkey PRIMARY KEY (user_id, branch_id, role_id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_page_key_key; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_preferences
    ADD CONSTRAINT user_preferences_user_id_page_key_key UNIQUE (user_id, page_key);


--
-- Name: vehicle_registration_history vehicle_registration_history_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.vehicle_registration_history
    ADD CONSTRAINT vehicle_registration_history_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: inspection_reports inspection_reports_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.inspection_reports
    ADD CONSTRAINT inspection_reports_pkey PRIMARY KEY (id);


--
-- Name: rizenic_body_parts rizenic_body_parts_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_body_parts
    ADD CONSTRAINT rizenic_body_parts_pkey PRIMARY KEY (id);


--
-- Name: rizenic_part_inbound rizenic_part_inbound_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_part_inbound
    ADD CONSTRAINT rizenic_part_inbound_pkey PRIMARY KEY (inbound_id);


--
-- Name: rizenic_part_locations rizenic_part_locations_part_no_branch_name_key; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_part_locations
    ADD CONSTRAINT rizenic_part_locations_part_no_branch_name_key UNIQUE (part_no, branch_name);


--
-- Name: rizenic_part_locations rizenic_part_locations_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_part_locations
    ADD CONSTRAINT rizenic_part_locations_pkey PRIMARY KEY (id);


--
-- Name: rizenic_part_orders rizenic_part_orders_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_part_orders
    ADD CONSTRAINT rizenic_part_orders_pkey PRIMARY KEY (order_id);


--
-- Name: rizenic_part_outbound rizenic_part_outbound_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_part_outbound
    ADD CONSTRAINT rizenic_part_outbound_pkey PRIMARY KEY (outbound_id);


--
-- Name: rizenic_part_status_master rizenic_part_status_master_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_part_status_master
    ADD CONSTRAINT rizenic_part_status_master_pkey PRIMARY KEY (status_id);


--
-- Name: rizenic_quotas rizenic_quotas_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_quotas
    ADD CONSTRAINT rizenic_quotas_pkey PRIMARY KEY (id);


--
-- Name: rizenic_routing_master rizenic_routing_master_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenic_routing_master
    ADD CONSTRAINT rizenic_routing_master_pkey PRIMARY KEY (routing_id);


--
-- Name: rizeniccarmodelmaster rizeniccarmodelmaster_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizeniccarmodelmaster
    ADD CONSTRAINT rizeniccarmodelmaster_pkey PRIMARY KEY (model_id);


--
-- Name: rizeniccustomertypemaster rizeniccustomertypemaster_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizeniccustomertypemaster
    ADD CONSTRAINT rizeniccustomertypemaster_pkey PRIMARY KEY (customer_type_id);


--
-- Name: rizenicemployeemaster rizenicemployeemaster_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenicemployeemaster
    ADD CONSTRAINT rizenicemployeemaster_pkey PRIMARY KEY (employee_id);


--
-- Name: rizenicinsurancemaster rizenicinsurancemaster_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenicinsurancemaster
    ADD CONSTRAINT rizenicinsurancemaster_pkey PRIMARY KEY (insurance_code);


--
-- Name: rizenicpartsmaster rizenicpartsmaster_part_no_key; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenicpartsmaster
    ADD CONSTRAINT rizenicpartsmaster_part_no_key UNIQUE (part_no);


--
-- Name: rizenicpartsmaster rizenicpartsmaster_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenicpartsmaster
    ADD CONSTRAINT rizenicpartsmaster_pkey PRIMARY KEY (part_id);


--
-- Name: rizenicreport rizenicreport_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenicreport
    ADD CONSTRAINT rizenicreport_pkey PRIMARY KEY (id);


--
-- Name: rizenicstatusmaster rizenicstatusmaster_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.rizenicstatusmaster
    ADD CONSTRAINT rizenicstatusmaster_pkey PRIMARY KEY (status_code);


--
-- Name: user_column_preferences user_column_preferences_emp_name_key; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.user_column_preferences
    ADD CONSTRAINT user_column_preferences_emp_name_key UNIQUE (emp_name);


--
-- Name: user_column_preferences user_column_preferences_pkey; Type: CONSTRAINT; Schema: rizenic_old; Owner: -
--

ALTER TABLE ONLY rizenic_old.user_column_preferences
    ADD CONSTRAINT user_column_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: attachments_sha256_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX attachments_sha256_idx ON rizenic_new.attachments USING btree (sha256);


--
-- Name: audit_events_entity_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX audit_events_entity_idx ON rizenic_new.audit_events USING btree (entity_type, entity_id, occurred_at);


--
-- Name: customer_contacts_customer_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX customer_contacts_customer_idx ON rizenic_new.customer_contacts USING btree (customer_id);


--
-- Name: customer_contacts_job_phone_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX customer_contacts_job_phone_idx ON rizenic_new.customer_contacts USING btree (customer_id, contact_type, is_primary DESC, id);


--
-- Name: customer_contacts_lookup_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX customer_contacts_lookup_idx ON rizenic_new.customer_contacts USING btree (contact_type, raw_value);


--
-- Name: customer_contacts_one_primary_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE UNIQUE INDEX customer_contacts_one_primary_idx ON rizenic_new.customer_contacts USING btree (customer_id, contact_type) WHERE is_primary;


--
-- Name: customer_identity_customer_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX customer_identity_customer_idx ON rizenic_new.customer_identity_keys USING btree (customer_id);


--
-- Name: eclaim_insurer_refs_insurer_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX eclaim_insurer_refs_insurer_idx ON rizenic_new.eclaim_insurer_refs USING btree (insurer_id);


--
-- Name: eclaim_vehicle_refs_lookup_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX eclaim_vehicle_refs_lookup_idx ON rizenic_new.eclaim_vehicle_refs USING btree (eclaim_brand_code, eclaim_model_code, eclaim_year);


--
-- Name: eclaim_vehicle_refs_model_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX eclaim_vehicle_refs_model_idx ON rizenic_new.eclaim_vehicle_refs USING btree (car_model_id);


--
-- Name: employees_display_name_ci_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX employees_display_name_ci_idx ON rizenic_new.employees USING btree (lower(btrim(display_name)));


--
-- Name: inspection_attachments_attachment_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX inspection_attachments_attachment_idx ON rizenic_new.inspection_attachments USING btree (attachment_id);


--
-- Name: inspection_attachments_inspection_purpose_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX inspection_attachments_inspection_purpose_idx ON rizenic_new.inspection_attachments USING btree (inspection_id, purpose, attachment_id);


--
-- Name: inspections_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX inspections_job_idx ON rizenic_new.inspections USING btree (job_id, created_at);


--
-- Name: inspections_job_latest_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX inspections_job_latest_idx ON rizenic_new.inspections USING btree (job_id, id DESC);


--
-- Name: inspections_vehicle_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX inspections_vehicle_idx ON rizenic_new.inspections USING btree (vehicle_id, created_at);


--
-- Name: insurer_aliases_insurer_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX insurer_aliases_insurer_idx ON rizenic_new.insurer_aliases USING btree (insurer_id);


--
-- Name: insurers_name_ci_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX insurers_name_ci_idx ON rizenic_new.insurers USING btree (lower(btrim(name)));


--
-- Name: job_contacts_contact_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_contacts_contact_idx ON rizenic_new.job_contacts USING btree (customer_contact_id);


--
-- Name: job_documents_lookup_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_documents_lookup_idx ON rizenic_new.job_documents USING btree (document_type, document_number);


--
-- Name: job_part_requests_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_part_requests_job_idx ON rizenic_new.job_part_requests USING btree (job_id);


--
-- Name: job_repair_items_job_category_sort_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_repair_items_job_category_sort_idx ON rizenic_new.job_repair_items USING btree (job_id, category, sort_order, id);


--
-- Name: job_repair_items_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_repair_items_job_idx ON rizenic_new.job_repair_items USING btree (job_id);


--
-- Name: job_station_progress_assignee_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_station_progress_assignee_idx ON rizenic_new.job_station_progress USING btree (assigned_employee_id, updated_at);


--
-- Name: job_station_progress_job_state_station_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_station_progress_job_state_station_idx ON rizenic_new.job_station_progress USING btree (job_id, state, station_id);


--
-- Name: job_station_progress_station_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_station_progress_station_idx ON rizenic_new.job_station_progress USING btree (station_id, updated_at);


--
-- Name: job_status_history_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_status_history_job_idx ON rizenic_new.job_status_history USING btree (job_id, recorded_at);


--
-- Name: job_status_history_status_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX job_status_history_status_idx ON rizenic_new.job_status_history USING btree (new_status_id, recorded_at);


--
-- Name: legacy_entity_mappings_target_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX legacy_entity_mappings_target_idx ON rizenic_new.legacy_entity_mappings USING btree (target_table, target_id);


--
-- Name: migration_issues_run_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX migration_issues_run_idx ON rizenic_new.migration_issues USING btree (run_id, state, severity);


--
-- Name: part_compatible_models_model_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_compatible_models_model_idx ON rizenic_new.part_compatible_models USING btree (car_model_id);


--
-- Name: part_order_items_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_order_items_job_idx ON rizenic_new.part_order_items USING btree (job_id);


--
-- Name: part_order_items_part_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_order_items_part_idx ON rizenic_new.part_order_items USING btree (part_id, branch_id);


--
-- Name: part_order_items_part_order_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_order_items_part_order_idx ON rizenic_new.part_order_items USING btree (part_id, order_id);


--
-- Name: part_orders_epc_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_orders_epc_idx ON rizenic_new.part_orders USING btree (branch_id, epc_reference);


--
-- Name: part_receipt_items_order_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_receipt_items_order_idx ON rizenic_new.part_receipt_items USING btree (order_item_id);


--
-- Name: part_reservations_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_reservations_job_idx ON rizenic_new.part_reservations USING btree (job_id);


--
-- Name: part_reservations_stock_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX part_reservations_stock_idx ON rizenic_new.part_reservations USING btree (branch_id, part_id);


--
-- Name: repair_jobs_active_latest_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_active_latest_idx ON rizenic_new.repair_jobs USING btree (id DESC) WHERE (archived_at IS NULL);


--
-- Name: repair_jobs_advisor_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_advisor_idx ON rizenic_new.repair_jobs USING btree (service_advisor_id);


--
-- Name: repair_jobs_branch_status_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_branch_status_idx ON rizenic_new.repair_jobs USING btree (branch_id, status_id);


--
-- Name: repair_jobs_customer_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_customer_idx ON rizenic_new.repair_jobs USING btree (customer_id);


--
-- Name: repair_jobs_delivery_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_delivery_idx ON rizenic_new.repair_jobs USING btree (delivery_on);


--
-- Name: repair_jobs_department_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_department_idx ON rizenic_new.repair_jobs USING btree (department_id);


--
-- Name: repair_jobs_insurer_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_insurer_idx ON rizenic_new.repair_jobs USING btree (insurer_id);


--
-- Name: repair_jobs_intake_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_intake_idx ON rizenic_new.repair_jobs USING btree (intake_on);


--
-- Name: repair_jobs_job_number_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_job_number_idx ON rizenic_new.repair_jobs USING btree (job_number);


--
-- Name: repair_jobs_status_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_status_idx ON rizenic_new.repair_jobs USING btree (status_id);


--
-- Name: repair_jobs_target_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_target_idx ON rizenic_new.repair_jobs USING btree (target_finish_on);


--
-- Name: repair_jobs_vehicle_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX repair_jobs_vehicle_idx ON rizenic_new.repair_jobs USING btree (vehicle_id);


--
-- Name: stock_movements_issue_latest_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX stock_movements_issue_latest_idx ON rizenic_new.stock_movements USING btree (id DESC) WHERE (movement_type = 'ISSUE'::text);


--
-- Name: stock_movements_job_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX stock_movements_job_idx ON rizenic_new.stock_movements USING btree (job_id);


--
-- Name: stock_movements_reservation_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX stock_movements_reservation_idx ON rizenic_new.stock_movements USING btree (reservation_id);


--
-- Name: stock_movements_stock_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX stock_movements_stock_idx ON rizenic_new.stock_movements USING btree (branch_id, part_id, recorded_at);


--
-- Name: stock_movements_stock_type_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX stock_movements_stock_type_idx ON rizenic_new.stock_movements USING btree (branch_id, part_id, movement_type, recorded_at);


--
-- Name: user_accounts_username_ci; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE UNIQUE INDEX user_accounts_username_ci ON rizenic_new.user_accounts USING btree (lower(btrim(username)));


--
-- Name: vehicle_registration_history_current_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE UNIQUE INDEX vehicle_registration_history_current_idx ON rizenic_new.vehicle_registration_history USING btree (vehicle_id) WHERE is_current;


--
-- Name: vehicle_registration_history_vehicle_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX vehicle_registration_history_vehicle_idx ON rizenic_new.vehicle_registration_history USING btree (vehicle_id, valid_from DESC);


--
-- Name: vehicles_plate_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX vehicles_plate_idx ON rizenic_new.vehicles USING btree (plate_number);


--
-- Name: vehicles_plate_normalized_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX vehicles_plate_normalized_idx ON rizenic_new.vehicles USING btree (lower(btrim(plate_number)));


--
-- Name: vehicles_plate_unique_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE UNIQUE INDEX vehicles_plate_unique_idx ON rizenic_new.vehicles USING btree (plate_number, plate_province) WHERE (NULLIF(btrim(plate_number), ''::text) IS NOT NULL);


--
-- Name: vehicles_vin_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE INDEX vehicles_vin_idx ON rizenic_new.vehicles USING btree (vin);


--
-- Name: vehicles_vin_unique_idx; Type: INDEX; Schema: rizenic_new; Owner: -
--

CREATE UNIQUE INDEX vehicles_vin_unique_idx ON rizenic_new.vehicles USING btree (vin) WHERE (NULLIF(btrim(vin), ''::text) IS NOT NULL);


--
-- Name: inspection_reports_job_id_id_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX inspection_reports_job_id_id_idx ON rizenic_old.inspection_reports USING btree (job_id, id DESC);


--
-- Name: rizenic_part_inbound_branch_name_part_no_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenic_part_inbound_branch_name_part_no_idx ON rizenic_old.rizenic_part_inbound USING btree (branch_name, part_no);


--
-- Name: rizenic_part_orders_epc_no_part_no_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenic_part_orders_epc_no_part_no_idx ON rizenic_old.rizenic_part_orders USING btree (epc_no, part_no);


--
-- Name: rizenic_part_orders_job_id_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenic_part_orders_job_id_idx ON rizenic_old.rizenic_part_orders USING btree (job_id);


--
-- Name: rizenic_part_orders_report_id_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenic_part_orders_report_id_idx ON rizenic_old.rizenic_part_orders USING btree (report_id);


--
-- Name: rizenic_part_outbound_branch_name_part_no_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenic_part_outbound_branch_name_part_no_idx ON rizenic_old.rizenic_part_outbound USING btree (branch_name, part_no);


--
-- Name: rizenic_quotas_branch_name_quota_type_quota_date_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenic_quotas_branch_name_quota_type_quota_date_idx ON rizenic_old.rizenic_quotas USING btree (branch_name, quota_type, quota_date);


--
-- Name: rizenicemployeemaster_username_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenicemployeemaster_username_idx ON rizenic_old.rizenicemployeemaster USING btree (username);


--
-- Name: rizenicreport_branch_name_arrived_date_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenicreport_branch_name_arrived_date_idx ON rizenic_old.rizenicreport USING btree (branch_name, arrived_date);


--
-- Name: rizenicreport_car_plate_contact_date_idx; Type: INDEX; Schema: rizenic_old; Owner: -
--

CREATE INDEX rizenicreport_car_plate_contact_date_idx ON rizenic_old.rizenicreport USING btree (car_plate, contact_date);


--
-- Name: part_order_receipt_totals _RETURN; Type: RULE; Schema: rizenic_new; Owner: -
--

CREATE OR REPLACE VIEW rizenic_new.part_order_receipt_totals AS
 SELECT oi.id AS order_item_id,
    oi.quantity_ordered,
    COALESCE(sum(ri.quantity), (0)::numeric) AS quantity_received
   FROM (rizenic_new.part_order_items oi
     LEFT JOIN rizenic_new.part_receipt_items ri ON ((ri.order_item_id = oi.id)))
  GROUP BY oi.id;


--
-- Name: reservation_balances _RETURN; Type: RULE; Schema: rizenic_new; Owner: -
--

CREATE OR REPLACE VIEW rizenic_new.reservation_balances AS
 SELECT r.id,
    r.branch_id,
    r.part_id,
    r.job_id,
    r.quantity_reserved,
    r.quantity_released,
    COALESCE((- sum(m.quantity_delta)), (0)::numeric) AS quantity_issued,
    ((r.quantity_reserved - r.quantity_released) + COALESCE(sum(m.quantity_delta), (0)::numeric)) AS quantity_remaining
   FROM (rizenic_new.part_reservations r
     LEFT JOIN rizenic_new.stock_movements m ON ((m.reservation_id = r.id)))
  GROUP BY r.id;


--
-- Name: branch_capacity_rules touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.branch_capacity_rules FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: branches touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.branches FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: customers touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.customers FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: employees touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.employees FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: inspections touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.inspections FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: job_financial_summaries touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.job_financial_summaries FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: job_part_tracking touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.job_part_tracking FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: job_station_progress touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.job_station_progress FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: part_orders touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.part_orders FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: part_reservations touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.part_reservations FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: parts touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.parts FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: repair_jobs touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.repair_jobs FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: user_accounts touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.user_accounts FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: user_preferences touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.user_preferences FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: vehicles touch_updated_at; Type: TRIGGER; Schema: rizenic_new; Owner: -
--

CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.vehicles FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at();


--
-- Name: attachments attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: audit_events audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.audit_events
    ADD CONSTRAINT audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: audit_events audit_events_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.audit_events
    ADD CONSTRAINT audit_events_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: branch_capacity_rules branch_capacity_rules_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branch_capacity_rules
    ADD CONSTRAINT branch_capacity_rules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: branch_parts branch_parts_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branch_parts
    ADD CONSTRAINT branch_parts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: branch_parts branch_parts_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.branch_parts
    ADD CONSTRAINT branch_parts_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: car_models car_models_brand_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.car_models
    ADD CONSTRAINT car_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES rizenic_new.car_brands(id);


--
-- Name: customer_contacts customer_contacts_customer_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_contacts
    ADD CONSTRAINT customer_contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES rizenic_new.customers(id);


--
-- Name: customer_identity_keys customer_identity_keys_customer_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customer_identity_keys
    ADD CONSTRAINT customer_identity_keys_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES rizenic_new.customers(id);


--
-- Name: customers customers_customer_type_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.customers
    ADD CONSTRAINT customers_customer_type_id_fkey FOREIGN KEY (customer_type_id) REFERENCES rizenic_new.customer_types(id);


--
-- Name: eclaim_insurer_refs eclaim_insurer_refs_insurer_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_insurer_refs
    ADD CONSTRAINT eclaim_insurer_refs_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES rizenic_new.insurers(id);


--
-- Name: eclaim_vehicle_refs eclaim_vehicle_refs_car_model_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.eclaim_vehicle_refs
    ADD CONSTRAINT eclaim_vehicle_refs_car_model_id_fkey FOREIGN KEY (car_model_id) REFERENCES rizenic_new.car_models(id);


--
-- Name: employees employees_home_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.employees
    ADD CONSTRAINT employees_home_branch_id_fkey FOREIGN KEY (home_branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: inspection_attachments inspection_attachments_attachment_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspection_attachments
    ADD CONSTRAINT inspection_attachments_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES rizenic_new.attachments(id);


--
-- Name: inspection_attachments inspection_attachments_inspection_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspection_attachments
    ADD CONSTRAINT inspection_attachments_inspection_id_fkey FOREIGN KEY (inspection_id) REFERENCES rizenic_new.inspections(id);


--
-- Name: inspections inspections_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspections
    ADD CONSTRAINT inspections_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: inspections inspections_inspector_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspections
    ADD CONSTRAINT inspections_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES rizenic_new.employees(id);


--
-- Name: inspections inspections_job_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspections
    ADD CONSTRAINT inspections_job_id_branch_id_fkey FOREIGN KEY (job_id, branch_id) REFERENCES rizenic_new.repair_jobs(id, branch_id);


--
-- Name: inspections inspections_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.inspections
    ADD CONSTRAINT inspections_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES rizenic_new.vehicles(id);


--
-- Name: insurer_aliases insurer_aliases_insurer_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.insurer_aliases
    ADD CONSTRAINT insurer_aliases_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES rizenic_new.insurers(id);


--
-- Name: job_capacity_requirements job_capacity_requirements_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_capacity_requirements
    ADD CONSTRAINT job_capacity_requirements_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_contacts job_contacts_customer_contact_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_contacts
    ADD CONSTRAINT job_contacts_customer_contact_id_fkey FOREIGN KEY (customer_contact_id) REFERENCES rizenic_new.customer_contacts(id);


--
-- Name: job_contacts job_contacts_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_contacts
    ADD CONSTRAINT job_contacts_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_documents job_documents_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_documents
    ADD CONSTRAINT job_documents_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_financial_summaries job_financial_summaries_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_financial_summaries
    ADD CONSTRAINT job_financial_summaries_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_part_requests job_part_requests_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_part_requests
    ADD CONSTRAINT job_part_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_part_requests job_part_requests_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_part_requests
    ADD CONSTRAINT job_part_requests_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: job_part_tracking job_part_tracking_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_part_tracking
    ADD CONSTRAINT job_part_tracking_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_repair_items job_repair_items_body_part_id_category_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_repair_items
    ADD CONSTRAINT job_repair_items_body_part_id_category_fkey FOREIGN KEY (body_part_id, category) REFERENCES rizenic_new.body_parts(id, category);


--
-- Name: job_repair_items job_repair_items_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_repair_items
    ADD CONSTRAINT job_repair_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_station_progress job_station_progress_assigned_employee_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_station_progress
    ADD CONSTRAINT job_station_progress_assigned_employee_id_fkey FOREIGN KEY (assigned_employee_id) REFERENCES rizenic_new.employees(id);


--
-- Name: job_station_progress job_station_progress_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_station_progress
    ADD CONSTRAINT job_station_progress_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_station_progress job_station_progress_station_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_station_progress
    ADD CONSTRAINT job_station_progress_station_id_fkey FOREIGN KEY (station_id) REFERENCES rizenic_new.repair_stations(id);


--
-- Name: job_status_history job_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_status_history
    ADD CONSTRAINT job_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: job_status_history job_status_history_job_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_status_history
    ADD CONSTRAINT job_status_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES rizenic_new.repair_jobs(id);


--
-- Name: job_status_history job_status_history_new_status_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_status_history
    ADD CONSTRAINT job_status_history_new_status_id_fkey FOREIGN KEY (new_status_id) REFERENCES rizenic_new.job_statuses(id);


--
-- Name: job_status_history job_status_history_previous_status_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_status_history
    ADD CONSTRAINT job_status_history_previous_status_id_fkey FOREIGN KEY (previous_status_id) REFERENCES rizenic_new.job_statuses(id);


--
-- Name: job_statuses job_statuses_department_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.job_statuses
    ADD CONSTRAINT job_statuses_department_id_fkey FOREIGN KEY (department_id) REFERENCES rizenic_new.departments(id);


--
-- Name: legacy_entity_mappings legacy_entity_mappings_legacy_record_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_entity_mappings
    ADD CONSTRAINT legacy_entity_mappings_legacy_record_id_fkey FOREIGN KEY (legacy_record_id) REFERENCES rizenic_new.legacy_records(id);


--
-- Name: legacy_records legacy_records_run_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.legacy_records
    ADD CONSTRAINT legacy_records_run_id_fkey FOREIGN KEY (run_id) REFERENCES rizenic_new.migration_runs(id);


--
-- Name: migration_issues migration_issues_legacy_record_id_run_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.migration_issues
    ADD CONSTRAINT migration_issues_legacy_record_id_run_id_fkey FOREIGN KEY (legacy_record_id, run_id) REFERENCES rizenic_new.legacy_records(id, run_id);


--
-- Name: migration_issues migration_issues_resolved_by_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.migration_issues
    ADD CONSTRAINT migration_issues_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: migration_issues migration_issues_run_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.migration_issues
    ADD CONSTRAINT migration_issues_run_id_fkey FOREIGN KEY (run_id) REFERENCES rizenic_new.migration_runs(id);


--
-- Name: part_compatibility_unresolved part_compatibility_unresolved_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_compatibility_unresolved
    ADD CONSTRAINT part_compatibility_unresolved_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: part_compatible_models part_compatible_models_car_model_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_compatible_models
    ADD CONSTRAINT part_compatible_models_car_model_id_fkey FOREIGN KEY (car_model_id) REFERENCES rizenic_new.car_models(id);


--
-- Name: part_compatible_models part_compatible_models_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_compatible_models
    ADD CONSTRAINT part_compatible_models_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: part_order_items part_order_items_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: part_order_items part_order_items_job_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_job_id_branch_id_fkey FOREIGN KEY (job_id, branch_id) REFERENCES rizenic_new.repair_jobs(id, branch_id);


--
-- Name: part_order_items part_order_items_order_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_order_id_branch_id_fkey FOREIGN KEY (order_id, branch_id) REFERENCES rizenic_new.part_orders(id, branch_id);


--
-- Name: part_order_items part_order_items_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: part_order_items part_order_items_status_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_order_items
    ADD CONSTRAINT part_order_items_status_id_fkey FOREIGN KEY (status_id) REFERENCES rizenic_new.part_order_statuses(id);


--
-- Name: part_orders part_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_orders
    ADD CONSTRAINT part_orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: part_receipt_items part_receipt_items_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: part_receipt_items part_receipt_items_order_item_id_part_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_order_item_id_part_id_branch_id_fkey FOREIGN KEY (order_item_id, part_id, branch_id) REFERENCES rizenic_new.part_order_items(id, part_id, branch_id);


--
-- Name: part_receipt_items part_receipt_items_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: part_receipt_items part_receipt_items_receipt_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipt_items
    ADD CONSTRAINT part_receipt_items_receipt_id_branch_id_fkey FOREIGN KEY (receipt_id, branch_id) REFERENCES rizenic_new.part_receipts(id, branch_id);


--
-- Name: part_receipts part_receipts_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipts
    ADD CONSTRAINT part_receipts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: part_receipts part_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_receipts
    ADD CONSTRAINT part_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES rizenic_new.employees(id);


--
-- Name: part_reservations part_reservations_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_reservations
    ADD CONSTRAINT part_reservations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: part_reservations part_reservations_job_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_reservations
    ADD CONSTRAINT part_reservations_job_id_branch_id_fkey FOREIGN KEY (job_id, branch_id) REFERENCES rizenic_new.repair_jobs(id, branch_id);


--
-- Name: part_reservations part_reservations_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.part_reservations
    ADD CONSTRAINT part_reservations_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: repair_jobs repair_jobs_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: repair_jobs repair_jobs_customer_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES rizenic_new.customers(id);


--
-- Name: repair_jobs repair_jobs_customer_type_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_customer_type_id_fkey FOREIGN KEY (customer_type_id) REFERENCES rizenic_new.customer_types(id);


--
-- Name: repair_jobs repair_jobs_department_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_department_id_fkey FOREIGN KEY (department_id) REFERENCES rizenic_new.departments(id);


--
-- Name: repair_jobs repair_jobs_insurer_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_insurer_id_fkey FOREIGN KEY (insurer_id) REFERENCES rizenic_new.insurers(id);


--
-- Name: repair_jobs repair_jobs_service_advisor_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_service_advisor_id_fkey FOREIGN KEY (service_advisor_id) REFERENCES rizenic_new.employees(id);


--
-- Name: repair_jobs repair_jobs_status_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_status_id_fkey FOREIGN KEY (status_id) REFERENCES rizenic_new.job_statuses(id);


--
-- Name: repair_jobs repair_jobs_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.repair_jobs
    ADD CONSTRAINT repair_jobs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES rizenic_new.vehicles(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES rizenic_new.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES rizenic_new.roles(id);


--
-- Name: stock_movements stock_movements_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: stock_movements stock_movements_job_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_job_id_branch_id_fkey FOREIGN KEY (job_id, branch_id) REFERENCES rizenic_new.repair_jobs(id, branch_id);


--
-- Name: stock_movements stock_movements_part_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_part_id_fkey FOREIGN KEY (part_id) REFERENCES rizenic_new.parts(id);


--
-- Name: stock_movements stock_movements_receipt_item_id_part_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_receipt_item_id_part_id_branch_id_fkey FOREIGN KEY (receipt_item_id, part_id, branch_id) REFERENCES rizenic_new.part_receipt_items(id, part_id, branch_id);


--
-- Name: stock_movements stock_movements_reservation_id_job_id_part_id_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.stock_movements
    ADD CONSTRAINT stock_movements_reservation_id_job_id_part_id_branch_id_fkey FOREIGN KEY (reservation_id, job_id, part_id, branch_id) REFERENCES rizenic_new.part_reservations(id, job_id, part_id, branch_id);


--
-- Name: user_accounts user_accounts_employee_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_accounts
    ADD CONSTRAINT user_accounts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES rizenic_new.employees(id);


--
-- Name: user_branch_permissions user_branch_permissions_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_permissions
    ADD CONSTRAINT user_branch_permissions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: user_branch_permissions user_branch_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_permissions
    ADD CONSTRAINT user_branch_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES rizenic_new.permissions(id);


--
-- Name: user_branch_permissions user_branch_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_permissions
    ADD CONSTRAINT user_branch_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: user_branch_roles user_branch_roles_branch_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_roles
    ADD CONSTRAINT user_branch_roles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES rizenic_new.branches(id);


--
-- Name: user_branch_roles user_branch_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_roles
    ADD CONSTRAINT user_branch_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES rizenic_new.roles(id);


--
-- Name: user_branch_roles user_branch_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_branch_roles
    ADD CONSTRAINT user_branch_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES rizenic_new.user_accounts(id);


--
-- Name: vehicle_registration_history vehicle_registration_history_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.vehicle_registration_history
    ADD CONSTRAINT vehicle_registration_history_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES rizenic_new.vehicles(id);


--
-- Name: vehicles vehicles_car_model_id_fkey; Type: FK CONSTRAINT; Schema: rizenic_new; Owner: -
--

ALTER TABLE ONLY rizenic_new.vehicles
    ADD CONSTRAINT vehicles_car_model_id_fkey FOREIGN KEY (car_model_id) REFERENCES rizenic_new.car_models(id);


--
-- PostgreSQL database dump complete
--

\unrestrict QR1oXaVkznge7GGI0JUnXyAJT12qaj7cmEmzFQu42XQOpm2QIOKKBgVXZSY8G3b

