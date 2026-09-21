-- Create table for cross-app demo synchronization
CREATE TABLE public.demo_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'Awaiting Assignment',
    service TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    price TEXT,
    technician_id TEXT NOT NULL,
    customer_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for demo mode (isolated to this specific table)
CREATE POLICY "Allow anonymous read on demo_bookings"
    ON public.demo_bookings
    FOR SELECT
    USING (true);

CREATE POLICY "Allow anonymous insert on demo_bookings"
    ON public.demo_bookings
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow anonymous update on demo_bookings"
    ON public.demo_bookings
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on demo_bookings"
    ON public.demo_bookings
    FOR DELETE
    USING (true);
