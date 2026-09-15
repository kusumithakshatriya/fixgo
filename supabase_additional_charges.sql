CREATE TABLE public.additional_charge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.users(id),
  customer_id UUID NOT NULL REFERENCES public.users(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_additional_charge_requests_booking_id ON public.additional_charge_requests(booking_id);
CREATE INDEX idx_additional_charge_requests_technician_id ON public.additional_charge_requests(technician_id);
CREATE INDEX idx_additional_charge_requests_customer_id ON public.additional_charge_requests(customer_id);
CREATE INDEX idx_additional_charge_requests_status ON public.additional_charge_requests(status);

ALTER TABLE public.additional_charge_requests ENABLE ROW LEVEL SECURITY;

-- Technician SELECT
CREATE POLICY "Technician can view own charge requests"
ON public.additional_charge_requests FOR SELECT
USING (technician_id = auth.uid());

-- Technician INSERT
CREATE POLICY "Technician can insert charge requests"
ON public.additional_charge_requests FOR INSERT
WITH CHECK (
  technician_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = booking_id AND b.technician_id = auth.uid()
  )
);

-- Technician UPDATE (only if pending, e.g., to cancel)
CREATE POLICY "Technician can update own pending charge requests"
ON public.additional_charge_requests FOR UPDATE
USING (technician_id = auth.uid() AND status = 'pending');

-- Customer SELECT
CREATE POLICY "Customer can view own charge requests"
ON public.additional_charge_requests FOR SELECT
USING (customer_id = auth.uid());

-- Customer UPDATE
CREATE POLICY "Customer can update own pending charge requests"
ON public.additional_charge_requests FOR UPDATE
USING (customer_id = auth.uid() AND status = 'pending')
WITH CHECK (
  customer_id = auth.uid() AND 
  status IN ('approved', 'rejected') 
);

-- Handle updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_additional_charge_timestamp ON public.additional_charge_requests;
CREATE TRIGGER set_additional_charge_timestamp
BEFORE UPDATE ON public.additional_charge_requests
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();
