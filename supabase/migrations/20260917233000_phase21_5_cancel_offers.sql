-- ==============================================================================
-- FIXGO PHASE 21.5: BOOKING-OFFER CLEANUP ON CANCELLATION
-- ==============================================================================

-- Replace cancel_booking to include booking_offers cleanup
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
    -- 1. Obtain row-level lock on the booking to prevent concurrent offer acceptance or status changes
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- 2. Authorize caller
    IF v_booking.customer_id = auth.uid() THEN
        v_role := 'customer';
    ELSIF v_booking.technician_id = auth.uid() THEN
        v_role := 'technician';
    ELSE
        RAISE EXCEPTION 'Not authorized to cancel this booking';
    END IF;

    -- 3. Idempotency check
    IF v_booking.status = 'Cancelled' THEN
        SELECT * INTO v_cancellation FROM public.booking_cancellations WHERE booking_id = p_booking_id;
        IF FOUND THEN
            RETURN v_cancellation;
        ELSE
            RAISE EXCEPTION 'Booking is already cancelled but cancellation record is missing';
        END IF;
    END IF;

    -- 4. State validation
    IF v_booking.status IN ('Work In Progress', 'Awaiting Payment', 'Completed') THEN
        RAISE EXCEPTION 'Booking cannot be cancelled at this stage (status: %)', v_booking.status;
    END IF;

    -- 5. Handle payment refunds if online payment was completed
    SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id FOR UPDATE;
    IF FOUND THEN
        IF v_payment.status = 'completed' AND v_payment.payment_method = 'online' THEN
            v_refund_status := 'pending';
            v_refund_amount := v_payment.final_amount;
        END IF;
    END IF;

    -- 6. Cancel Booking and Service Request
    UPDATE public.bookings SET status = 'Cancelled' WHERE id = p_booking_id;
    UPDATE public.service_requests SET status = 'Cancelled' WHERE id = v_booking.service_request_id;

    -- 7. Phase 21.5 Priority 4: Atomically expire any outstanding offers for this booking.
    -- Since we hold the FOR UPDATE lock on bookings, process_technician_offer() cannot race this.
    UPDATE public.booking_offers
    SET status = 'expired', responded_at = now()
    WHERE booking_id = p_booking_id AND status = 'offered';

    -- 8. Record the cancellation
    INSERT INTO public.booking_cancellations (
        booking_id, cancelled_by, cancelled_by_role, reason, description, refund_status, refund_amount
    ) VALUES (
        p_booking_id, auth.uid(), v_role, p_reason, p_description, v_refund_status, v_refund_amount
    ) RETURNING * INTO v_cancellation;

    RETURN v_cancellation;
END;
$$;
