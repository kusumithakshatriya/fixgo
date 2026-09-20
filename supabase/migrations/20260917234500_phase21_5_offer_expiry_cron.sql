-- ==============================================================================
-- FIXGO PHASE 21.5: PRIORITY 5 - BACKGROUND OFFER EXPIRY
-- ==============================================================================

-- 1. Index to optimize the cron query finding expired offers
CREATE INDEX IF NOT EXISTS idx_bookings_expiry
ON public.bookings (status, offer_expires_at)
WHERE status = 'Technician Assigned';

-- 2. Modify redispatch_booking to allow execution by cron
-- Explanation: The original redispatch_booking enforced `auth.uid() IS NOT NULL`.
-- However, cron jobs execute natively without an active HTTP context, so auth.uid() is inherently NULL.
-- Since redispatch_booking is strictly internal (revoked from PUBLIC/anon/authenticated), 
-- removing this check is entirely secure and necessary for the cron job to call it.
CREATE OR REPLACE FUNCTION public.redispatch_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_service_id BIGINT;
  v_next_technician_id UUID;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- We rely on the internal caller context (process_technician_offer or cron).
  -- The auth.uid() check was removed to allow background pg_cron execution.
  
  -- Lock the booking row
  SELECT * INTO v_booking 
  FROM public.bookings 
  WHERE id = p_booking_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Redispatch is only valid from a terminal failure state where a technician didn't accept
  IF v_booking.status NOT IN ('Rejected', 'Expired') THEN
    RAISE EXCEPTION 'Booking is not in a redispatchable state (status: %)', v_booking.status;
  END IF;

  -- Determine service_id
  SELECT service_id INTO v_service_id
  FROM public.service_requests
  WHERE id = v_booking.service_request_id;

  -- Find the next eligible technician
  SELECT partner_id INTO v_next_technician_id
  FROM public.get_eligible_technicians_for_service(v_service_id)
  WHERE partner_id NOT IN (
    SELECT technician_id 
    FROM public.booking_offers 
    WHERE booking_id = p_booking_id
  )
  ORDER BY rating DESC, total_jobs DESC
  LIMIT 1;

  IF v_next_technician_id IS NULL THEN
    -- No technician available, set to Cancelled
    UPDATE public.bookings 
    SET status = 'Cancelled'
    WHERE id = p_booking_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'booking_id', p_booking_id,
      'status', 'Cancelled'
    );
  END IF;

  v_new_expires_at := now() + interval '60 seconds';

  -- Assign the new technician
  UPDATE public.bookings
  SET 
    technician_id = v_next_technician_id,
    status = 'Technician Assigned',
    offer_expires_at = v_new_expires_at
  WHERE id = p_booking_id;

  -- Log the new offer
  INSERT INTO public.booking_offers (
    booking_id,
    technician_id,
    status,
    offered_at
  ) VALUES (
    p_booking_id,
    v_next_technician_id,
    'offered',
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'technician_id', v_next_technician_id,
    'offer_expires_at', v_new_expires_at,
    'status', 'Technician Assigned'
  );
END;
$$;

-- Ensure internal-only execution
REVOKE ALL ON FUNCTION public.redispatch_booking(UUID) FROM PUBLIC, anon, authenticated;


-- 3. Create the Expiry Function
CREATE OR REPLACE FUNCTION public.expire_stale_technician_offers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking RECORD;
    v_processed_count INT := 0;
    v_error_count INT := 0;
BEGIN
    -- Loop through all bookings that are currently offered but have expired.
    -- SKIP LOCKED prevents blocking if a technician or customer is currently modifying the booking.
    -- If locked, they'll either be accepted/rejected/cancelled anyway, so we just skip and try next time.
    FOR v_booking IN 
        SELECT id, technician_id
        FROM public.bookings
        WHERE status = 'Technician Assigned'
          AND offer_expires_at <= now()
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- 1. Expire the outstanding offer in booking_offers
            UPDATE public.booking_offers
            SET status = 'expired', responded_at = now()
            WHERE booking_id = v_booking.id 
              AND technician_id = v_booking.technician_id
              AND status = 'offered';

            IF NOT FOUND THEN
                RAISE EXCEPTION 'No active offer found for booking %', v_booking.id;
            END IF;

            -- 2. Transition booking to Expired
            UPDATE public.bookings 
            SET status = 'Expired'
            WHERE id = v_booking.id
              AND status = 'Technician Assigned';

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Booking % was no longer in Technician Assigned state', v_booking.id;
            END IF;

            -- 3. Automatically Redispatch
            PERFORM public.redispatch_booking(v_booking.id);

            v_processed_count := v_processed_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Log error internally, continue to next booking
            RAISE WARNING 'Failed to expire booking %: %', v_booking.id, SQLERRM;
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'processed_count', v_processed_count,
        'error_count', v_error_count
    );
END;
$$;

-- Secure the background expiry function
REVOKE ALL ON FUNCTION public.expire_stale_technician_offers() FROM PUBLIC, anon, authenticated;


-- 4. Enable pg_cron and Schedule the Job
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN

        IF EXISTS (
            SELECT 1
            FROM cron.job
            WHERE jobname = 'fixgo-expire-stale-technician-offers'
        ) THEN
            PERFORM cron.unschedule('fixgo-expire-stale-technician-offers');
        END IF;

        PERFORM cron.schedule(
            'fixgo-expire-stale-technician-offers',
            '* * * * *',
            'SELECT public.expire_stale_technician_offers();'
        );
    END IF;
END $$;
