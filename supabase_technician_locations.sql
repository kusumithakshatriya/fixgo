CREATE TABLE IF NOT EXISTS public.technician_locations (
  technician_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS
ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

-- Technician can manage their own location
CREATE POLICY "Technician can manage own location"
ON public.technician_locations
FOR ALL
USING (auth.uid() = technician_id)
WITH CHECK (auth.uid() = technician_id);

-- Customer can read location if technician is assigned to an active booking
CREATE POLICY "Customer can read assigned technician location"
ON public.technician_locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.technician_id = technician_locations.technician_id
    AND b.customer_id = auth.uid()
    AND b.status IN ('Assigned', 'Accepted', 'On The Way', 'Arrived', 'Work In Progress')
  )
);
