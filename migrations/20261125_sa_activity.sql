BEGIN;
ALTER TABLE public.rizenicreport
 ADD COLUMN IF NOT EXISTS service_visit_no TEXT,
 ADD COLUMN IF NOT EXISTS customer_source TEXT,
 ADD COLUMN IF NOT EXISTS insurance_checkin_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS insurance_checkin_sa TEXT,
 ADD COLUMN IF NOT EXISTS insurance_checkin_by TEXT,
 ADD COLUMN IF NOT EXISTS insurance_checkin_recorded_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS arrival_checkin_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS arrival_checkin_sa TEXT,
 ADD COLUMN IF NOT EXISTS arrival_checkin_by TEXT,
 ADD COLUMN IF NOT EXISTS delivery_checkin_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS delivery_checkin_sa TEXT,
 ADD COLUMN IF NOT EXISTS delivery_checkin_by TEXT;
CREATE TABLE IF NOT EXISTS public.customer_sources (
 id BIGSERIAL PRIMARY KEY,
 name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_sources_unique_name ON public.customer_sources (lower(btrim(name)));
INSERT INTO public.customer_sources(name) VALUES ('ออนไลน์'),('หน้าร้าน'),('ลูกค้าแนะนำ') ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS report_insurance_checkin_idx ON public.rizenicreport(insurance_checkin_at) WHERE insurance_checkin_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS report_arrival_checkin_idx ON public.rizenicreport(arrival_checkin_at) WHERE arrival_checkin_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS report_delivery_checkin_idx ON public.rizenicreport(delivery_checkin_at) WHERE delivery_checkin_at IS NOT NULL;
COMMIT;
