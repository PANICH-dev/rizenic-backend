BEGIN;
CREATE TABLE IF NOT EXISTS public.tracking_employee_sessions (
 token_hash TEXT PRIMARY KEY,
 employee_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS tracking_employee_sessions_expiry_idx ON public.tracking_employee_sessions(expires_at);
CREATE TABLE IF NOT EXISTS public.customer_tracking_links (
 id BIGSERIAL PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 anchor_job_id BIGINT NOT NULL REFERENCES public.rizenicreport(id) ON DELETE CASCADE,
 job_ids BIGINT[] NOT NULL CHECK(cardinality(job_ids)>0),
 created_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
 revoked_at TIMESTAMPTZ,
 CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS customer_tracking_links_anchor_idx ON public.customer_tracking_links(anchor_job_id);
CREATE INDEX IF NOT EXISTS customer_tracking_links_expiry_idx ON public.customer_tracking_links(expires_at);
CREATE INDEX IF NOT EXISTS rizenicreport_tracking_plate_idx ON public.rizenicreport (upper(regexp_replace(coalesce(car_plate,''),'[^a-zA-Z0-9ก-ฮ]','','g')));

CREATE TABLE IF NOT EXISTS public.line_branch_settings (
 branch TEXT PRIMARY KEY CHECK(branch IN ('navamin','rangsit')),
 access_token_enc TEXT, channel_secret_enc TEXT,
 enabled BOOLEAN NOT NULL DEFAULT FALSE, send_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 bot_user_id TEXT, bot_display_name TEXT, bot_basic_id TEXT,
 updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO public.line_branch_settings(branch) VALUES('navamin'),('rangsit') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.line_customers (
 id BIGSERIAL PRIMARY KEY, branch TEXT NOT NULL CHECK(branch IN ('navamin','rangsit')),
 line_user_id TEXT NOT NULL, display_name TEXT NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE, last_event_ms BIGINT NOT NULL DEFAULT 0,
 followed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(branch,line_user_id), UNIQUE(id,branch)
);
CREATE TABLE IF NOT EXISTS public.line_customer_events (
 branch TEXT NOT NULL, event_id TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(branch,event_id)
);
CREATE TABLE IF NOT EXISTS public.line_customer_bindings (
 report_id BIGINT PRIMARY KEY REFERENCES public.rizenicreport(id) ON DELETE CASCADE,
 branch TEXT NOT NULL, contact_id BIGINT NOT NULL,
 bound_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(contact_id,branch) REFERENCES public.line_customers(id,branch)
);
CREATE INDEX IF NOT EXISTS line_customer_bindings_contact_idx ON public.line_customer_bindings(contact_id);
CREATE TABLE IF NOT EXISTS public.line_tracking_deliveries (
 request_id UUID PRIMARY KEY, report_id BIGINT NOT NULL REFERENCES public.rizenicreport(id) ON DELETE CASCADE,
 branch TEXT NOT NULL, contact_id BIGINT NOT NULL,
 tracking_link_id BIGINT NOT NULL REFERENCES public.customer_tracking_links(id),
 created_by TEXT NOT NULL, payload_enc TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed','unknown')),
 attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ,
 line_request_id TEXT, error_code TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMPTZ,
 FOREIGN KEY(contact_id,branch) REFERENCES public.line_customers(id,branch)
);
CREATE INDEX IF NOT EXISTS line_tracking_deliveries_report_idx ON public.line_tracking_deliveries(report_id,created_at DESC);
CREATE INDEX IF NOT EXISTS rizenicreport_tracking_branch_vin_idx ON public.rizenicreport(branch_name,upper(btrim(vin_no)));
COMMIT;
