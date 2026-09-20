-- Phase 4G: Service Request Media Table

CREATE TABLE public.service_request_media (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.service_requests(id) on delete cascade,
    storage_path text not null,
    media_type text not null check (media_type in ('image','video')),
    file_name text,
    created_at timestamptz not null default now()
);

-- Enable Row Level Security
ALTER TABLE public.service_request_media ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view their own media
CREATE POLICY "Users can view their own service request media"
ON public.service_request_media
FOR SELECT
TO authenticated
USING (
    request_id IN (
        SELECT id FROM public.service_requests WHERE customer_id = auth.uid()
    )
);

-- Policy: Authenticated users can insert their own media
CREATE POLICY "Users can insert their own service request media"
ON public.service_request_media
FOR INSERT
TO authenticated
WITH CHECK (
    request_id IN (
        SELECT id FROM public.service_requests WHERE customer_id = auth.uid()
    )
);

-- Policy: Authenticated users can delete their own media
CREATE POLICY "Users can delete their own service request media"
ON public.service_request_media
FOR DELETE
TO authenticated
USING (
    request_id IN (
        SELECT id FROM public.service_requests WHERE customer_id = auth.uid()
    )
);

-- Add 'Other' service if it does not exist
INSERT INTO public.services (name, description, category, base_price, is_active)
SELECT 'Other', 'Other home repair or maintenance service', 'Other', 299, true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Other');

