CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.users(id),
  technician_id UUID NOT NULL REFERENCES public.users(id),
  base_amount NUMERIC(10,2) NOT NULL CHECK (base_amount >= 0),
  additional_charges_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (additional_charges_amount >= 0),
  final_amount NUMERIC(10,2) NOT NULL CHECK (final_amount >= 0),
  payment_method TEXT CHECK (payment_method IN ('cash', 'online')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id
ON public.payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_customer_id
ON public.payments(customer_id);

CREATE INDEX IF NOT EXISTS idx_payments_technician_id
ON public.payments(technician_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON public.payments(status);


-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- Payments timestamp trigger
DROP TRIGGER IF EXISTS set_payments_timestamp
ON public.payments;

CREATE TRIGGER set_payments_timestamp
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();


-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- Customer can view their own payments
DROP POLICY IF EXISTS "Customer can view own payments"
ON public.payments;

CREATE POLICY "Customer can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());


-- Technician can view assigned payments
DROP POLICY IF EXISTS "Technician can view own assigned payments"
ON public.payments;

CREATE POLICY "Technician can view own assigned payments"
ON public.payments
FOR SELECT
TO authenticated
USING (technician_id = auth.uid());


-- ============================================================
-- 1. CREATE OR GET PAYMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_or_get_payment(
  p_booking_id UUID
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
  v_base_price NUMERIC(10,2);
  v_additional_amount NUMERIC(10,2);
  v_payment public.payments;
BEGIN

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;


  IF v_booking.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;


  IF EXISTS (
    SELECT 1
    FROM public.additional_charge_requests
    WHERE booking_id = p_booking_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION
      'Cannot generate payment while additional charges are pending';
  END IF;


  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_payment;
  END IF;


  SELECT s.base_price
  INTO v_base_price
  FROM public.service_requests sr
  JOIN public.services s
    ON sr.service_id = s.id
  WHERE sr.id = v_booking.service_request_id;


  IF v_base_price IS NULL THEN
    RAISE EXCEPTION 'Service base price not found';
  END IF;


  SELECT COALESCE(SUM(amount), 0)
  INTO v_additional_amount
  FROM public.additional_charge_requests
  WHERE booking_id = p_booking_id
    AND status = 'approved';


  INSERT INTO public.payments (
    booking_id,
    customer_id,
    technician_id,
    base_amount,
    additional_charges_amount,
    final_amount
  )
  VALUES (
    p_booking_id,
    v_booking.customer_id,
    v_booking.technician_id,
    v_base_price,
    v_additional_amount,
    v_base_price + v_additional_amount
  )
  RETURNING *
  INTO v_payment;


  UPDATE public.bookings
  SET status = 'Awaiting Payment'
  WHERE id = p_booking_id;


  UPDATE public.service_requests
  SET status = 'Awaiting Payment'
  WHERE id = v_booking.service_request_id;


  RETURN v_payment;

END;
$$;


-- ============================================================
-- 2. SELECT PAYMENT METHOD
-- ============================================================

CREATE OR REPLACE FUNCTION public.select_payment_method(
  p_payment_id UUID,
  p_method TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments;
BEGIN

  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;


  IF v_payment.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;


  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION
      'Cannot change method after payment has progressed';
  END IF;


  IF p_method NOT IN ('cash', 'online') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;


  UPDATE public.payments
  SET payment_method = p_method
  WHERE id = p_payment_id;

END;
$$;


-- ============================================================
-- 3. MOCK ONLINE PAYMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_mock_online_payment(
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

  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;


  IF v_payment.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;


  IF v_payment.payment_method != 'online' THEN
    RAISE EXCEPTION 'Payment method is not online';
  END IF;


  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;


  UPDATE public.payments
  SET
    status = 'completed',
    transaction_id = 'MOCK_' || p_payment_id::TEXT
  WHERE id = p_payment_id;


  UPDATE public.bookings
  SET status = 'Completed'
  WHERE id = v_payment.booking_id;


  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = v_payment.booking_id;


  UPDATE public.service_requests
  SET status = 'Completed'
  WHERE id = v_booking.service_request_id;

END;
$$;


-- ============================================================
-- 4. CONFIRM CASH PAYMENT
-- ============================================================

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

  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;


  IF v_payment.technician_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;


  IF v_payment.payment_method != 'cash' THEN
    RAISE EXCEPTION 'Payment method is not cash';
  END IF;


  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Payment is not pending';
  END IF;


  UPDATE public.payments
  SET status = 'completed'
  WHERE id = p_payment_id;


  UPDATE public.bookings
  SET status = 'Completed'
  WHERE id = v_payment.booking_id;


  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = v_payment.booking_id;


  UPDATE public.service_requests
  SET status = 'Completed'
  WHERE id = v_booking.service_request_id;

END;
$$;


-- ============================================================
-- REALTIME
-- ============================================================

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN

    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.payments;

  END IF;

END;
$$;