-- Phase 10: Partner Bookings RLS

-- Partner can select their own bookings
DROP POLICY IF EXISTS "Partners can view their own bookings" ON public.bookings;
CREATE POLICY "Partners can view their own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (technician_id = auth.uid());

-- Partner can update their own bookings
DROP POLICY IF EXISTS "Partners can update their own bookings" ON public.bookings;
CREATE POLICY "Partners can update their own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (technician_id = auth.uid())
WITH CHECK (technician_id = auth.uid());

-- Partner can view service_requests assigned to them
DROP POLICY IF EXISTS "Partners can view assigned service_requests" ON public.service_requests;
CREATE POLICY "Partners can view assigned service_requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
    id IN (
        SELECT service_request_id FROM public.bookings WHERE technician_id = auth.uid()
    )
);

-- Partner can update service_requests assigned to them
DROP POLICY IF EXISTS "Partners can update assigned service_requests" ON public.service_requests;
CREATE POLICY "Partners can update assigned service_requests"
ON public.service_requests
FOR UPDATE
TO authenticated
USING (
    id IN (
        SELECT service_request_id FROM public.bookings WHERE technician_id = auth.uid()
    )
)
WITH CHECK (
    id IN (
        SELECT service_request_id FROM public.bookings WHERE technician_id = auth.uid()
    )
);
