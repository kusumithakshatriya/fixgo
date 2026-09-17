-- ==============================================================================
-- FIXGO PHASE 21.5: SECURE TECHNICIAN JOB LIFECYCLE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_job_status(
    p_booking_id UUID,
    p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking record;
BEGIN
    -- 1. Lock the booking row
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    -- 2. Reject nonexistent bookings
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- 3. Verify auth.uid() is the booking's technician_id
    IF v_booking.technician_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to update this booking';
    END IF;

    -- 4. Reject cancelled or completed bookings
    IF v_booking.status = 'Cancelled' THEN
        RAISE EXCEPTION 'Booking is already cancelled';
    END IF;
    IF v_booking.status = 'Completed' THEN
        RAISE EXCEPTION 'Booking is already completed';
    END IF;

    -- 5. Enforce linear state machine for technician transitions
    IF v_booking.status = 'Accepted' AND p_new_status = 'On The Way' THEN
        -- Allowed
    ELSIF v_booking.status = 'On The Way' AND p_new_status = 'Arrived' THEN
        -- Allowed
    ELSIF v_booking.status = 'Arrived' AND p_new_status = 'Work In Progress' THEN
        -- Allowed
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %', v_booking.status, p_new_status;
    END IF;

    -- 6. Update the booking and service request
    UPDATE public.bookings
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_booking_id;

    UPDATE public.service_requests
    SET status = p_new_status,
        updated_at = now()
    WHERE id = v_booking.service_request_id;

    -- 7. Return success result
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'old_status', v_booking.status,
        'new_status', p_new_status
    );
END;
$$;

-- 8. Revoke EXECUTE from PUBLIC and anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.update_job_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_job_status(UUID, TEXT) TO authenticated;
