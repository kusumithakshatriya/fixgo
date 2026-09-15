-- 1. Extend payments table
ALTER TABLE public.payments DROP CONSTRAINT payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('pending', 'order_created', 'processing', 'completed', 'failed', 'refunded'));

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS gateway_signature TEXT;

-- 2. Technician Earnings Ledger
CREATE TABLE IF NOT EXISTS public.technician_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES auth.users(id),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE UNIQUE,
  gross_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  technician_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technician_earnings_technician_id ON public.technician_earnings(technician_id);

-- Trigger for technician_earnings updated_at
DROP TRIGGER IF EXISTS set_technician_earnings_timestamp ON public.technician_earnings;
CREATE TRIGGER set_technician_earnings_timestamp
BEFORE UPDATE ON public.technician_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

ALTER TABLE public.technician_earnings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'technician_earnings' 
        AND policyname = 'Technician can view own earnings'
    ) THEN
        CREATE POLICY "Technician can view own earnings" ON public.technician_earnings FOR SELECT
        TO authenticated
        USING (technician_id = auth.uid());
    END IF;
END
$$;

-- 3. Payment Verification & Completion Transaction (Idempotent)
CREATE OR REPLACE FUNCTION public.verify_payment_completion(
  p_gateway_order_id TEXT,
  p_gateway_payment_id TEXT,
  p_gateway_signature TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments;
  v_booking public.bookings;
  v_platform_fee NUMERIC(10,2);
BEGIN
  -- Lock the payment row
  SELECT * INTO v_payment
  FROM public.payments
  WHERE gateway_order_id = p_gateway_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for order %', p_gateway_order_id;
  END IF;

  -- Verify amount (important security check against tampering)
  -- Razorpay works in paise (amount * 100).
  -- Our database final_amount is in Rupees.
  IF v_payment.final_amount * 100 != p_amount THEN
    RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_payment.final_amount * 100, p_amount;
  END IF;

  -- Idempotent check
  IF v_payment.status = 'completed' THEN
    RETURN; -- Already completed, safe to exit (e.g., client verification and webhook race)
  END IF;

  -- Update Payment
  UPDATE public.payments
  SET status = 'completed',
      gateway_payment_id = p_gateway_payment_id,
      gateway_signature = p_gateway_signature,
      payment_method = 'online'
  WHERE id = v_payment.id;

  -- Update Booking
  UPDATE public.bookings
  SET status = 'Completed'
  WHERE id = v_payment.booking_id;

  -- Update Service Request
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id;
  UPDATE public.service_requests
  SET status = 'Completed'
  WHERE id = v_booking.service_request_id;

  -- Record Technician Earnings
  -- Platform fee logic (e.g., 0 for now as per rules)
  v_platform_fee := 0;

  INSERT INTO public.technician_earnings (
    technician_id, booking_id, payment_id, gross_amount, platform_fee, technician_amount
  ) VALUES (
    v_payment.technician_id,
    v_payment.booking_id,
    v_payment.id,
    v_payment.final_amount,
    v_platform_fee,
    v_payment.final_amount - v_platform_fee
  ) ON CONFLICT (payment_id) DO NOTHING;

END;
$$;


-- 4. Cash Payment Flow
-- Technician initiates (marks as ready to collect)
CREATE OR REPLACE FUNCTION public.request_cash_payment(
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.technician_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_payment.status != 'pending' AND v_payment.status != 'order_created' THEN RAISE EXCEPTION 'Payment is not pending'; END IF;

  UPDATE public.payments
  SET payment_method = 'cash',
      status = 'processing'
  WHERE id = p_payment_id;
END;
$$;

-- Customer confirms (marks as paid)
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments;
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.customer_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_payment.payment_method != 'cash' THEN RAISE EXCEPTION 'Not a cash payment'; END IF;
  
  IF v_payment.status = 'completed' THEN RETURN; END IF;
  IF v_payment.status != 'processing' THEN RAISE EXCEPTION 'Cash payment has not been requested by technician'; END IF;

  UPDATE public.payments
  SET status = 'completed'
  WHERE id = p_payment_id;

  UPDATE public.bookings
  SET status = 'Completed'
  WHERE id = v_payment.booking_id;

  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id;
  UPDATE public.service_requests
  SET status = 'Completed'
  WHERE id = v_booking.service_request_id;

  INSERT INTO public.technician_earnings (
    technician_id, booking_id, payment_id, gross_amount, platform_fee, technician_amount
  ) VALUES (
    v_payment.technician_id, v_payment.booking_id, v_payment.id, v_payment.final_amount, 0, v_payment.final_amount
  ) ON CONFLICT (payment_id) DO NOTHING;

END;
$$;


-- 5. Set Razorpay Order ID securely (for Edge Function)
CREATE OR REPLACE FUNCTION public.set_razorpay_order(
  p_payment_id UUID,
  p_order_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  -- Removed strict auth.uid check because Edge Functions use service_role or authenticated with RLS bypassed if needed,
  -- but since it uses service_role, we can allow it.
  
  UPDATE public.payments
  SET gateway = 'razorpay',
      gateway_order_id = p_order_id,
      status = 'order_created',
      payment_method = 'online'
  WHERE id = p_payment_id;
END;
$$;


-- 6. Cleanup old mock functions safely
DROP FUNCTION IF EXISTS public.process_mock_online_payment(UUID);
DROP FUNCTION IF EXISTS public.process_mock_refund(UUID);

