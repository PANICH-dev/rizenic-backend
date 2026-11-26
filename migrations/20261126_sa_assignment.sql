ALTER TABLE public.rizenicreport
 ADD COLUMN IF NOT EXISTS sa_owner_employee_id TEXT,
 ADD COLUMN IF NOT EXISTS sa_collaborator_employee_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
