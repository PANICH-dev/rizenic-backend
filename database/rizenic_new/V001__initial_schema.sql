-- Rizenic ERP: proposed normalized schema, version 1.
-- PostgreSQL 17. Run explicitly against rizenic_db with ON_ERROR_STOP=1.
-- This migration creates structures only; it does not migrate legacy rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    IF current_database() <> 'rizenic_db' THEN
        RAISE EXCEPTION 'Run this migration against rizenic_db';
    END IF;
END $$;

-- Deliberately fail if it exists: do not silently accept a different schema.
CREATE SCHEMA rizenic_new;
SET LOCAL search_path TO rizenic_new;

-- Organization and access. Accounts, employees and branch grants are separate.
CREATE TABLE branches (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
    name text NOT NULL CHECK (btrim(name) <> ''),
    timezone text NOT NULL DEFAULT 'Asia/Bangkok',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE employees (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_code text NOT NULL UNIQUE,
    display_name text NOT NULL,
    phone text,
    home_branch_id bigint REFERENCES branches(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_accounts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id bigint NOT NULL UNIQUE REFERENCES employees(id),
    username text NOT NULL CHECK (btrim(username) <> ''),
    password_hash text,
    credential_state text NOT NULL DEFAULT 'RESET_REQUIRED'
        CHECK (credential_state IN ('RESET_REQUIRED', 'ACTIVE', 'DISABLED')),
    CHECK (credential_state <> 'ACTIVE' OR nullif(btrim(password_hash), '') IS NOT NULL),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_accounts_username_ci ON user_accounts (lower(btrim(username)));

CREATE TABLE roles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL
);

CREATE TABLE permissions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    description text
);

CREATE TABLE role_permissions (
    role_id bigint NOT NULL REFERENCES roles(id),
    permission_id bigint NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_branch_roles (
    user_id bigint NOT NULL REFERENCES user_accounts(id),
    branch_id bigint NOT NULL REFERENCES branches(id),
    role_id bigint NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, branch_id, role_id)
);

-- Preserve per-user accessible_pages without widening every user's role.
CREATE TABLE user_branch_permissions (
    user_id bigint NOT NULL REFERENCES user_accounts(id),
    branch_id bigint NOT NULL REFERENCES branches(id),
    permission_id bigint NOT NULL REFERENCES permissions(id),
    effect text NOT NULL CHECK (effect IN ('ALLOW', 'DENY')),
    PRIMARY KEY (user_id, branch_id, permission_id)
);

-- Customer and vehicle masters. No automatic deduplication by name/phone/plate.
CREATE TABLE customer_types (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE customers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_name text NOT NULL,
    customer_type_id bigint REFERENCES customer_types(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- A canonical customer may have several contacts, but one normalized identity
-- key can belong to only one customer. Ambiguous legacy values become issues.
CREATE TABLE customer_identity_keys (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES customers(id),
    key_type text NOT NULL CHECK (key_type IN ('PHONE', 'EMAIL', 'EXTERNAL_ID')),
    normalized_key text NOT NULL CHECK (btrim(normalized_key) <> ''),
    UNIQUE (key_type, normalized_key),
    UNIQUE (id, customer_id)
);
CREATE INDEX customer_identity_customer_idx ON customer_identity_keys(customer_id);

CREATE TABLE customer_contacts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES customers(id),
    contact_type text NOT NULL CHECK (contact_type IN ('PHONE', 'EMAIL', 'OTHER')),
    raw_value text NOT NULL CHECK (btrim(raw_value) <> ''),
    label text,
    is_primary boolean NOT NULL DEFAULT false,
    is_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_contacts_customer_idx ON customer_contacts(customer_id);
CREATE INDEX customer_contacts_lookup_idx ON customer_contacts(contact_type, raw_value);
CREATE UNIQUE INDEX customer_contacts_one_primary_idx
    ON customer_contacts(customer_id, contact_type) WHERE is_primary;

CREATE TABLE car_brands (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE car_models (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    brand_id bigint NOT NULL REFERENCES car_brands(id),
    model_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (brand_id, model_name)
);

CREATE TABLE vehicles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    car_model_id bigint REFERENCES car_models(id),
    vin text,
    plate_number text,
    plate_province text,
    color text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_vin_idx ON vehicles(vin);
CREATE INDEX vehicles_plate_idx ON vehicles(plate_number);
CREATE UNIQUE INDEX vehicles_vin_unique_idx ON vehicles(vin)
    WHERE nullif(btrim(vin), '') IS NOT NULL;
CREATE UNIQUE INDEX vehicles_plate_unique_idx ON vehicles(plate_number, plate_province)
    WHERE nullif(btrim(plate_number), '') IS NOT NULL;

CREATE TABLE insurers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    insurance_type text,
    is_active boolean NOT NULL DEFAULT true
);

-- Jobs and their current state. Snapshots retain the facts on the original job.
CREATE TABLE job_statuses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    department_id bigint REFERENCES departments(id),
    legacy_route_page text,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE repair_jobs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    job_number text,
    customer_id bigint REFERENCES customers(id),
    vehicle_id bigint REFERENCES vehicles(id),
    service_advisor_id bigint REFERENCES employees(id),
    customer_type_id bigint REFERENCES customer_types(id),
    insurer_id bigint REFERENCES insurers(id),
    status_id bigint REFERENCES job_statuses(id),
    department_id bigint REFERENCES departments(id),
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
    archived_at timestamptz,
    version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, branch_id),
    UNIQUE (branch_id, job_number)
);
CREATE INDEX repair_jobs_branch_status_idx ON repair_jobs(branch_id, status_id);
CREATE INDEX repair_jobs_customer_idx ON repair_jobs(customer_id);
CREATE INDEX repair_jobs_vehicle_idx ON repair_jobs(vehicle_id);
CREATE INDEX repair_jobs_advisor_idx ON repair_jobs(service_advisor_id);
CREATE INDEX repair_jobs_intake_idx ON repair_jobs(intake_on);
CREATE INDEX repair_jobs_target_idx ON repair_jobs(target_finish_on);
CREATE INDEX repair_jobs_delivery_idx ON repair_jobs(delivery_on);

-- A job may use one canonical customer contact for its service communication.
-- Contact history remains in customer_contacts; this relation does not copy it.
CREATE TABLE job_contacts (
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    customer_contact_id bigint NOT NULL REFERENCES customer_contacts(id),
    purpose text NOT NULL CHECK (purpose IN ('PRIMARY', 'ALTERNATE')),
    PRIMARY KEY (job_id, customer_contact_id, purpose),
    UNIQUE (job_id, purpose)
);

CREATE TABLE job_documents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    document_type text NOT NULL CHECK (document_type IN ('QT', 'SO', 'BL', 'IVN', 'EPC', 'CLAIM', 'OTHER')),
    document_number text NOT NULL CHECK (btrim(document_number) <> ''),
    document_date date,
    issuer_label text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, document_type, document_number)
);
CREATE INDEX job_documents_lookup_idx ON job_documents(document_type, document_number);

CREATE TABLE body_parts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL CHECK (category IN ('MAIN', 'SUB')),
    is_active boolean NOT NULL DEFAULT true,
    UNIQUE (id, category)
);

CREATE TABLE job_repair_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    body_part_id bigint,
    category text NOT NULL CHECK (category IN ('MAIN', 'SUB')),
    description text NOT NULL,
    quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
    sort_order integer NOT NULL DEFAULT 0,
    FOREIGN KEY (body_part_id, category) REFERENCES body_parts(id, category)
);
CREATE INDEX job_repair_items_job_idx ON job_repair_items(job_id);

-- Capacity units are explicit: never invent item quantities by splitting text.
CREATE TABLE job_capacity_requirements (
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    metric text NOT NULL CHECK (metric IN ('MAIN_PARTS', 'SUB_PARTS')),
    units integer NOT NULL CHECK (units >= 0),
    PRIMARY KEY (job_id, metric)
);

CREATE TABLE repair_stations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE job_station_progress (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    station_id bigint NOT NULL REFERENCES repair_stations(id),
    state text NOT NULL CHECK (state IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'SKIPPED', 'UNKNOWN')),
    legacy_checked boolean,
    assigned_employee_id bigint REFERENCES employees(id),
    started_at timestamptz,
    completed_at timestamptz,
    notes text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, station_id),
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE job_status_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    previous_status_id bigint REFERENCES job_statuses(id),
    new_status_id bigint NOT NULL REFERENCES job_statuses(id),
    changed_by bigint REFERENCES user_accounts(id),
    occurred_at timestamptz,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    source text NOT NULL CHECK (source IN ('APPLICATION', 'MIGRATION')),
    reason text
);
CREATE INDEX job_status_history_job_idx ON job_status_history(job_id, recorded_at);

-- Existing app tracks summaries/dates, not an accounting ledger or payment allocations.
CREATE TABLE job_financial_summaries (
    job_id bigint PRIMARY KEY REFERENCES repair_jobs(id),
    currency char(3) NOT NULL DEFAULT 'THB',
    labor_amount numeric(19,4),
    parts_amount numeric(19,4),
    external_amount numeric(19,4),
    billing_on date,
    insurance_paid_on date,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- NULL limit = unlimited; zero = closed. Convert legacy zero using agreed policy.
CREATE TABLE branch_capacity_rules (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    metric text NOT NULL CHECK (metric IN ('INTAKE_CARS', 'TARGET_CARS', 'DELIVERY_CARS', 'COLOR_PARTS', 'MAIN_PARTS', 'SUB_PARTS')),
    rule_date date,
    capacity_limit integer CHECK (capacity_limit >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (branch_id, metric, rule_date)
);

-- Parts: global master, branch settings, then purchasing/receiving movements.
CREATE TABLE parts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    part_number text NOT NULL UNIQUE CHECK (btrim(part_number) <> ''),
    main_part_number text,
    name text NOT NULL,
    compatible_with_all_models boolean NOT NULL DEFAULT false,
    category text,
    unit text NOT NULL DEFAULT 'piece',
    default_unit_price numeric(19,4),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE part_compatible_models (
    part_id bigint NOT NULL REFERENCES parts(id),
    car_model_id bigint NOT NULL REFERENCES car_models(id),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (part_id, car_model_id)
);
CREATE INDEX part_compatible_models_model_idx ON part_compatible_models(car_model_id);

CREATE TABLE part_compatibility_unresolved (
    part_id bigint NOT NULL REFERENCES parts(id),
    raw_model_name text NOT NULL,
    reason text NOT NULL DEFAULT 'MODEL_NOT_IN_MASTER',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (part_id, raw_model_name)
);

-- Legacy reports also carry a job-level parts workflow summary. Keep it
-- separate from the stock/order ledger; a job can have many requested parts.
CREATE TABLE job_part_tracking (
    job_id bigint PRIMARY KEY REFERENCES repair_jobs(id),
    status text,
    ordered_on date,
    estimated_arrival_on date,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_part_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id bigint NOT NULL REFERENCES repair_jobs(id),
    part_id bigint REFERENCES parts(id),
    description text NOT NULL,
    quantity numeric(18,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    sort_order integer NOT NULL DEFAULT 0,
    UNIQUE (job_id, sort_order)
);
CREATE INDEX job_part_requests_job_idx ON job_part_requests(job_id);

CREATE TABLE branch_parts (
    branch_id bigint NOT NULL REFERENCES branches(id),
    part_id bigint NOT NULL REFERENCES parts(id),
    storage_location text,
    safety_stock numeric(18,3) NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
    PRIMARY KEY (branch_id, part_id)
);

CREATE TABLE part_order_statuses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE part_orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    order_number text,
    epc_reference text,
    ordered_on date,
    ordered_at time,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, branch_id),
    UNIQUE (branch_id, order_number)
);
CREATE INDEX part_orders_epc_idx ON part_orders(branch_id, epc_reference);

CREATE TABLE part_order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    order_id bigint NOT NULL,
    line_number integer NOT NULL CHECK (line_number > 0),
    job_id bigint,
    part_id bigint NOT NULL REFERENCES parts(id),
    status_id bigint REFERENCES part_order_statuses(id),
    description text NOT NULL,
    part_type text,
    quantity_ordered numeric(18,3) NOT NULL CHECK (quantity_ordered > 0),
    estimated_arrival_on date,
    reported_received_on date,
    notes text,
    FOREIGN KEY (order_id, branch_id) REFERENCES part_orders(id, branch_id),
    FOREIGN KEY (job_id, branch_id) REFERENCES repair_jobs(id, branch_id),
    UNIQUE (order_id, line_number),
    UNIQUE (id, part_id, branch_id)
);
CREATE INDEX part_order_items_job_idx ON part_order_items(job_id);
CREATE INDEX part_order_items_part_idx ON part_order_items(part_id, branch_id);

CREATE TABLE part_receipts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    receipt_number text,
    epc_reference text,
    received_on date NOT NULL,
    received_by bigint REFERENCES employees(id),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, branch_id),
    UNIQUE (branch_id, receipt_number)
);

CREATE TABLE part_receipt_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    receipt_id bigint NOT NULL,
    line_number integer NOT NULL CHECK (line_number > 0),
    order_item_id bigint,
    part_id bigint NOT NULL REFERENCES parts(id),
    description text,
    quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
    unit_price numeric(19,4),
    FOREIGN KEY (receipt_id, branch_id) REFERENCES part_receipts(id, branch_id),
    FOREIGN KEY (order_item_id, part_id, branch_id) REFERENCES part_order_items(id, part_id, branch_id),
    UNIQUE (receipt_id, line_number),
    UNIQUE (id, part_id, branch_id)
);
CREATE INDEX part_receipt_items_order_idx ON part_receipt_items(order_item_id);

CREATE TABLE part_reservations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    job_id bigint NOT NULL,
    part_id bigint NOT NULL REFERENCES parts(id),
    quantity_reserved numeric(18,3) NOT NULL CHECK (quantity_reserved > 0),
    quantity_released numeric(18,3) NOT NULL DEFAULT 0,
    reserved_at timestamptz,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (job_id, branch_id) REFERENCES repair_jobs(id, branch_id),
    CHECK (quantity_released >= 0 AND quantity_released <= quantity_reserved),
    UNIQUE (id, job_id, part_id, branch_id)
);
CREATE INDEX part_reservations_stock_idx ON part_reservations(branch_id, part_id);
CREATE INDEX part_reservations_job_idx ON part_reservations(job_id);

-- Authoritative stock ledger: reservations never count as a physical issue.
CREATE TABLE stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    part_id bigint NOT NULL REFERENCES parts(id),
    movement_type text NOT NULL CHECK (movement_type IN ('RECEIPT', 'ISSUE', 'RETURN', 'OPENING', 'ADJUSTMENT')),
    quantity_delta numeric(18,3) NOT NULL CHECK (quantity_delta <> 0),
    unit_price numeric(19,4),
    movement_on date,
    occurred_at timestamptz,
    job_id bigint,
    receipt_item_id bigint UNIQUE,
    reservation_id bigint,
    reason text,
    created_by bigint REFERENCES user_accounts(id),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (job_id, branch_id) REFERENCES repair_jobs(id, branch_id),
    FOREIGN KEY (receipt_item_id, part_id, branch_id) REFERENCES part_receipt_items(id, part_id, branch_id),
    FOREIGN KEY (reservation_id, job_id, part_id, branch_id) REFERENCES part_reservations(id, job_id, part_id, branch_id),
    CHECK ((movement_type IN ('RECEIPT', 'RETURN', 'OPENING') AND quantity_delta > 0)
        OR (movement_type = 'ISSUE' AND quantity_delta < 0)
        OR movement_type = 'ADJUSTMENT'),
    CHECK ((movement_type = 'RECEIPT') = (receipt_item_id IS NOT NULL)),
    CHECK (reservation_id IS NULL OR (movement_type = 'ISSUE' AND job_id IS NOT NULL)),
    CHECK (movement_type <> 'ADJUSTMENT' OR nullif(btrim(reason), '') IS NOT NULL)
);
CREATE INDEX stock_movements_stock_idx ON stock_movements(branch_id, part_id, recorded_at);
CREATE INDEX stock_movements_job_idx ON stock_movements(job_id);
CREATE INDEX stock_movements_reservation_idx ON stock_movements(reservation_id);

-- Variable inspection checklists stay JSON; files/signatures have explicit links.
CREATE TABLE inspections (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id bigint NOT NULL REFERENCES branches(id),
    job_id bigint,
    vehicle_id bigint REFERENCES vehicles(id),
    inspection_type text NOT NULL CHECK (inspection_type IN ('INTAKE', 'DELIVERY', 'OTHER', 'LEGACY')),
    fuel_percent numeric(5,2) CHECK (fuel_percent BETWEEN 0 AND 100),
    mileage numeric(18,3) CHECK (mileage >= 0),
    job_type text,
    job_category text,
    repair_checklist jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(repair_checklist) = 'object'),
    inventory_checklist jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(inventory_checklist) = 'object'),
    electrical_checklist jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(electrical_checklist) = 'object'),
    inspector_id bigint REFERENCES employees(id),
    inspected_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (job_id, branch_id) REFERENCES repair_jobs(id, branch_id)
);
CREATE INDEX inspections_job_idx ON inspections(job_id, created_at);
CREATE INDEX inspections_vehicle_idx ON inspections(vehicle_id, created_at);

CREATE TABLE attachments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    storage_key text NOT NULL UNIQUE,
    original_filename text,
    media_type text NOT NULL,
    byte_size bigint NOT NULL CHECK (byte_size >= 0),
    sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    uploaded_by bigint REFERENCES user_accounts(id),
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inspection_attachments (
    inspection_id bigint NOT NULL REFERENCES inspections(id),
    attachment_id bigint NOT NULL REFERENCES attachments(id),
    purpose text NOT NULL CHECK (purpose IN ('CAR_DIAGRAM', 'FUEL_GAUGE', 'CUSTOMER_INTAKE_SIGNATURE',
        'INSPECTOR_INTAKE_SIGNATURE', 'CUSTOMER_DELIVERY_SIGNATURE', 'INSPECTOR_DELIVERY_SIGNATURE', 'OTHER')),
    PRIMARY KEY (inspection_id, attachment_id, purpose)
);

CREATE TABLE user_preferences (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES user_accounts(id),
    page_key text NOT NULL,
    settings jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, page_key)
);

-- Migration provenance. Source snapshots must be redacted before writing here.
CREATE TABLE migration_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_name text NOT NULL,
    source_checksum text,
    mapping_version text NOT NULL,
    state text NOT NULL CHECK (state IN ('PREPARING', 'RUNNING', 'VALIDATING', 'COMPLETED', 'FAILED')),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    summary jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(summary) = 'object')
);

CREATE TABLE legacy_records (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id bigint NOT NULL REFERENCES migration_runs(id),
    source_schema text NOT NULL,
    source_table text NOT NULL,
    source_key text NOT NULL,
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND NOT (payload ? 'password')),
    payload_checksum text NOT NULL,
    redacted_fields jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(redacted_fields) = 'array'),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, source_schema, source_table, source_key),
    UNIQUE (id, run_id)
);

CREATE TABLE legacy_entity_mappings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    legacy_record_id bigint NOT NULL REFERENCES legacy_records(id),
    target_table text NOT NULL CHECK (target_table ~ '^[a-z][a-z_]*$'),
    mapping_key text NOT NULL DEFAULT 'primary',
    target_id bigint CHECK (target_id > 0),
    target_key jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(target_key) = 'object'),
    recorded_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (legacy_record_id, target_table, mapping_key),
    CHECK (target_id IS NOT NULL OR target_key <> '{}'::jsonb)
);
CREATE INDEX legacy_entity_mappings_target_idx ON legacy_entity_mappings(target_table, target_id);

CREATE TABLE migration_issues (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id bigint NOT NULL REFERENCES migration_runs(id),
    legacy_record_id bigint,
    field_name text,
    issue_code text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
    state text NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'RESOLVED', 'ACCEPTED')),
    details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
    resolution_note text,
    resolved_by bigint REFERENCES user_accounts(id),
    resolved_at timestamptz,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (legacy_record_id, run_id) REFERENCES legacy_records(id, run_id),
    CHECK (state = 'OPEN' OR (resolved_at IS NOT NULL AND nullif(btrim(resolution_note), '') IS NOT NULL))
);
CREATE INDEX migration_issues_run_idx ON migration_issues(run_id, state, severity);

-- Application must write the audit event in the same transaction as its change.
CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id bigint REFERENCES user_accounts(id),
    branch_id bigint REFERENCES branches(id),
    entity_type text NOT NULL,
    entity_id bigint NOT NULL,
    action text NOT NULL,
    changes jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(changes) = 'object'),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    correlation_id text
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, occurred_at);

-- Computed values have one source of truth; no stock counters on the master.
CREATE VIEW part_order_receipt_totals AS
SELECT oi.id AS order_item_id, oi.quantity_ordered,
       COALESCE(SUM(ri.quantity), 0) AS quantity_received
FROM part_order_items oi
LEFT JOIN part_receipt_items ri ON ri.order_item_id = oi.id
GROUP BY oi.id;

CREATE VIEW reservation_balances AS
SELECT r.id, r.branch_id, r.part_id, r.job_id,
       r.quantity_reserved, r.quantity_released,
       COALESCE(-SUM(m.quantity_delta), 0) AS quantity_issued,
       r.quantity_reserved - r.quantity_released + COALESCE(SUM(m.quantity_delta), 0) AS quantity_remaining
FROM part_reservations r
LEFT JOIN stock_movements m ON m.reservation_id = r.id
GROUP BY r.id;

CREATE VIEW inventory_balances AS
WITH keys AS (
    SELECT branch_id, part_id FROM branch_parts
    UNION SELECT branch_id, part_id FROM stock_movements
    UNION SELECT branch_id, part_id FROM part_reservations
), stock AS (
    SELECT branch_id, part_id, SUM(quantity_delta) AS quantity_on_hand
    FROM stock_movements GROUP BY branch_id, part_id
), reserved AS (
    SELECT branch_id, part_id, SUM(quantity_remaining) AS quantity_reserved
    FROM reservation_balances GROUP BY branch_id, part_id
)
SELECT k.branch_id, k.part_id,
       COALESCE(s.quantity_on_hand, 0) AS quantity_on_hand,
       COALESCE(r.quantity_reserved, 0) AS quantity_reserved,
       COALESCE(s.quantity_on_hand, 0) - COALESCE(r.quantity_reserved, 0) AS quantity_available
FROM keys k
LEFT JOIN stock s USING (branch_id, part_id)
LEFT JOIN reserved r USING (branch_id, part_id);

-- Maintain updated_at only on the new schema's mutable tables.
CREATE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END $$;

DO $$ DECLARE t record;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'rizenic_new' AND column_name = 'updated_at'
    LOOP
        EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON rizenic_new.%I '
            'FOR EACH ROW EXECUTE FUNCTION rizenic_new.touch_updated_at()', t.table_name);
    END LOOP;
END $$;

COMMENT ON SCHEMA rizenic_new IS 'Rizenic normalized design v1; structure only, legacy migration pending';
COMMENT ON TABLE job_capacity_requirements IS 'Declared workload used for quotas; may differ from repair-item list counts in legacy data';
COMMENT ON TABLE job_financial_summaries IS 'Legacy monetary summaries; not a double-entry ledger and not proof of actual payment';
COMMENT ON COLUMN job_station_progress.legacy_checked IS 'Original checkbox value; does not prove completion or its time';
COMMENT ON TABLE legacy_entity_mappings IS 'Polymorphic target IDs require migration validation; database FK only validates source record';
COMMENT ON TABLE stock_movements IS 'Post receipt and movement atomically; enforce quantity equality, available stock and reservation limits under a branch/part lock';
COMMENT ON VIEW inventory_balances IS 'Negative values are exposed for reconciliation, never silently clamped to zero';
COMMIT;
