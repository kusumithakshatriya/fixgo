-- Phase 7: AI Diagnosis Schema Setup

-- 1. Create a generic trigger function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the ai_diagnoses table
CREATE TABLE public.ai_diagnoses (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null unique references public.service_requests(id) on delete cascade,
    
    diagnosis text,
    severity text check (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    confidence numeric(5,2),
    
    estimated_min numeric(10,2),
    estimated_max numeric(10,2),
    parts_estimate numeric(10,2),
    labor_estimate numeric(10,2),
    
    recommendation text,
    raw_response jsonb,
    
    status text not null default 'PENDING' check (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Indexes
-- The UNIQUE constraint on request_id automatically creates a unique b-tree index.
-- Adding an index on status for faster queue processing by Edge Functions.
CREATE INDEX idx_ai_diagnoses_status ON public.ai_diagnoses(status);

-- 4. Apply the updated_at trigger
CREATE TRIGGER set_public_ai_diagnoses_updated_at
BEFORE UPDATE ON public.ai_diagnoses
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.ai_diagnoses ENABLE ROW LEVEL SECURITY;

-- 6. Create Policies
-- Authenticated customers can SELECT their own AI diagnosis via join to service_requests
CREATE POLICY "Customers can view their own AI diagnosis"
ON public.ai_diagnoses
FOR SELECT
TO authenticated
USING (
    request_id IN (
        SELECT id FROM public.service_requests WHERE customer_id = auth.uid()
    )
);

-- NOTE: No INSERT, UPDATE, or DELETE policies are granted to the 'authenticated' role.
-- AI results should only be manipulated by a secure backend (e.g., Supabase Edge Functions)
-- utilizing the service_role key, which bypasses RLS entirely.
