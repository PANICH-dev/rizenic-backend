ALTER TABLE public.rizenicreport
 ADD COLUMN IF NOT EXISTS checkin_cancel_history JSONB NOT NULL DEFAULT '[]'::jsonb;
