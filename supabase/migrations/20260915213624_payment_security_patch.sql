-- 1. Webhook Events Table
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies needed; only accessed via service_role in Edge Functions

-- 2. Clean up old function
DROP FUNCTION IF EXISTS public.verify_payment_completion(TEXT, TEXT, TEXT, NUMERIC);

-- 3. Core Completion Logic (Internal)
-- This function handles the actual state changes and checks.
CREATE OR REPLACE FUNCTION public.internal_complete_payment(
  p_payment_id UUID,
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
  v_service_req public.service_requests;
  v_platform_fee NUMERIC(10,2) := 0;
BEGIN
  -- Lock payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  -- Idempotency check
  IF v_payment.status = 'completed' THEN RETURN; END IF;

  -- Lock and verify booking
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  
  -- Relationship checks
  IF v_payment.customer_id != v_booking.customer_id THEN RAISE EXCEPTION 'Customer mismatch'; END IF;
  IF v_payment.technician_id != v_booking.technician_id THEN RAISE EXCEPTION 'Technician mismatch'; END IF;

  -- Lock and verify service request
  SELECT * INTO v_service_req FROM public.service_requests WHERE id = v_booking.service_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service request not found'; END IF;

  -- Amount check (p_amount is in paise)
  IF v_payment.final_amount * 100 != p_amount THEN
    RAISE EXCEPTION 'Amount mismatch: expected %, got %', v_payment.final_amount * 100, p_amount;
  END IF;

  -- Apply updates
  UPDATE public.payments
  SET status = 'completed',
      gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
      gateway_signature = COALESCE(p_gateway_signature, gateway_signature),
      payment_method = 'online'
  WHERE id = v_payment.id;

  UPDATE public.bookings SET status = 'Completed' WHERE id = v_booking.id;
  UPDATE public.service_requests SET status = 'Completed' WHERE id = v_service_req.id;

  -- Earnings
  INSERT INTO public.technician_earnings (
    technician_id, booking_id, payment_id, gross_amount, platform_fee, technician_amount
  ) VALUES (
    v_payment.technician_id, v_payment.booking_id, v_payment.id, 
    v_payment.final_amount, v_platform_fee, v_payment.final_amount - v_platform_fee
  ) ON CONFLICT (payment_id) DO NOTHING;
END;
$$;
-- Revoke direct access
REVOKE ALL ON FUNCTION public.internal_complete_payment(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;

-- 4. Client Verification RPC
CREATE OR REPLACE FUNCTION public.client_payment_completion(
  p_payment_id UUID,
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
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  
  IF v_payment.gateway_order_id != p_gateway_order_id THEN
    RAISE EXCEPTION 'Order ID mismatch';
  END IF;

  PERFORM public.internal_complete_payment(p_payment_id, p_gateway_payment_id, p_gateway_signature, p_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.client_payment_completion(UUID, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;


-- 5. Webhook Verification RPC
CREATE OR REPLACE FUNCTION public.webhook_payment_completion(
  p_event_id TEXT,
  p_event_type TEXT,
  p_gateway_order_id TEXT,
  p_gateway_payment_id TEXT,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments;
  v_webhook public.razorpay_webhook_events;
BEGIN
  -- Webhook idempotency
  INSERT INTO public.razorpay_webhook_events (event_id, event_type)
  VALUES (p_event_id, p_event_type)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING * INTO v_webhook;

  IF v_webhook IS NULL THEN
    -- Event already exists, check if processed
    SELECT * INTO v_webhook FROM public.razorpay_webhook_events WHERE event_id = p_event_id FOR UPDATE;
    IF v_webhook.processed_at IS NOT NULL THEN
      RETURN; -- Already processed
    END IF;
  END IF;

  -- Find payment by order id
  SELECT * INTO v_payment FROM public.payments WHERE gateway_order_id = p_gateway_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found for order %', p_gateway_order_id; END IF;

  PERFORM public.internal_complete_payment(v_payment.id, p_gateway_payment_id, NULL, p_amount);

  -- Mark processed
  UPDATE public.razorpay_webhook_events SET processed_at = now() WHERE event_id = p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.webhook_payment_completion(TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;


-- 6. Revoke access on set_razorpay_order
REVOKE ALL ON FUNCTION public.set_razorpay_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- 7. Secure Cash Flow
-- Revoke direct execution of old ones if we want to be strict, but they check auth.uid()
-- ensure they exist and have correct checks
-- (Already created in previous migration with correct auth.uid() checks, but let's re-affirm grants)
GRANT EXECUTE ON FUNCTION public.request_cash_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(UUID) TO authenticated;

