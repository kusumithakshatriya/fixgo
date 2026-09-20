CREATE TABLE IF NOT EXISTS public.booking_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  cancelled_by UUID NOT NULL REFERENCES public.users(id),
  cancelled_by_role TEXT NOT NULL CHECK (cancelled_by_role IN ('customer', 'technician')),
  reason TEXT NOT NULL,
  description TEXT,
  refund_status TEXT NOT NULL DEFAULT 'not_applicable' CHECK (refund_status IN ('not_applicable', 'pending', 'processing', 'completed', 'failed')),
  refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  refund_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_cancellations_booking_id ON public.booking_cancellations(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_cancellations_cancelled_by ON public.booking_cancellations(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_booking_cancellations_created_at ON public.booking_cancellations(created_at);
CREATE INDEX IF NOT EXISTS idx_booking_cancellations_refund_status ON public.booking_cancellations(refund_status);

DROP TRIGGER IF EXISTS set_booking_cancellations_timestamp ON public.booking_cancellations;
CREATE TRIGGER set_booking_cancellations_timestamp
BEFORE UPDATE ON public.booking_cancellations
FOR EACH ROW
EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE public.booking_cancellations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_cancellations' 
        AND policyname = 'Customer can view own cancellations'
    ) THEN
        CREATE POLICY "Customer can view own cancellations" ON public.booking_cancellations FOR SELECT
        USING (booking_id IN (SELECT id FROM public.bookings WHERE customer_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_cancellations' 
        AND policyname = 'Technician can view own cancellations'
    ) THEN
        CREATE POLICY "Technician can view own cancellations" ON public.booking_cancellations FOR SELECT
        USING (booking_id IN (SELECT id FROM public.bookings WHERE technician_id = auth.uid()));
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_booking_id UUID,
    p_reason TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS public.booking_cancellations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking record;
    v_payment record;
    v_role TEXT;
    v_refund_status TEXT := 'not_applicable';
    v_refund_amount NUMERIC(10,2) := 0;
    v_cancellation public.booking_cancellations;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    IF v_booking.customer_id = auth.uid() THEN
        v_role := 'customer';
    ELSIF v_booking.technician_id = auth.uid() THEN
        v_role := 'technician';
    ELSE
        RAISE EXCEPTION 'Not authorized to cancel this booking';
    END IF;

    IF v_booking.status = 'Cancelled' THEN
        SELECT * INTO v_cancellation FROM public.booking_cancellations WHERE booking_id = p_booking_id;
        IF FOUND THEN
            RETURN v_cancellation;
        ELSE
            RAISE EXCEPTION 'Booking is already cancelled but cancellation record is missing';
        END IF;
    END IF;

    IF v_booking.status IN ('Work In Progress', 'Awaiting Payment', 'Completed') THEN
        RAISE EXCEPTION 'Booking cannot be cancelled at this stage (status: %)', v_booking.status;
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id FOR UPDATE;
    IF FOUND THEN
        IF v_payment.status = 'completed' AND v_payment.payment_method = 'online' THEN
            v_refund_status := 'pending';
            v_refund_amount := v_payment.final_amount;
        END IF;
    END IF;

    UPDATE public.bookings SET status = 'Cancelled' WHERE id = p_booking_id;
    UPDATE public.service_requests SET status = 'Cancelled' WHERE id = v_booking.service_request_id;

    INSERT INTO public.booking_cancellations (
        booking_id, cancelled_by, cancelled_by_role, reason, description, refund_status, refund_amount
    ) VALUES (
        p_booking_id, auth.uid(), v_role, p_reason, p_description, v_refund_status, v_refund_amount
    ) RETURNING * INTO v_cancellation;

    RETURN v_cancellation;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_mock_refund(p_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cancellation public.booking_cancellations;
    v_payment public.payments;
BEGIN
    SELECT * INTO v_cancellation FROM public.booking_cancellations WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cancellation not found';
    END IF;

    IF v_cancellation.refund_status != 'pending' THEN
        RAISE EXCEPTION 'Refund is not pending';
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    IF v_payment.payment_method != 'online' OR v_payment.status != 'completed' THEN
        RAISE EXCEPTION 'Payment is not an eligible completed online payment';
    END IF;

    UPDATE public.payments SET status = 'refunded' WHERE id = v_payment.id;
    
    UPDATE public.booking_cancellations 
    SET refund_status = 'completed',
        refund_transaction_id = 'MOCK_REFUND_' || v_payment.id::text
    WHERE id = v_cancellation.id;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'booking_cancellations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_cancellations;
  END IF;
END
$$;
