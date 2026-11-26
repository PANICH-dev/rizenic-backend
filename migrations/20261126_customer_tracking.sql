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
COMMIT;
