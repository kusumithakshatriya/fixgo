-- =================================================================================
-- PHASE 21.4: AUTOMATIC TECHNICIAN REDISPATCH
-- =================================================================================

-- 1. Create booking_offers table to store history
CREATE TABLE IF NOT EXISTS public.booking_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('offered', 'accepted', 'rejected', 'expired')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ NULL,
  UNIQUE(booking_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_offers_booking_id ON public.booking_offers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_offers_technician_id ON public.booking_offers(technician_id);

ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'booking_offers' AND policyname = 'Technicians can read own offers'
  ) THEN
    CREATE POLICY "Technicians can read own offers" ON public.booking_offers
    FOR SELECT USING (auth.uid() = technician_id);
  END IF;
END $$;

-- 2. Atomic RPC for creating a booking and the initial offer
CREATE OR REPLACE FUNCTION public.create_booking_with_offer(
  p_service_request_id UUID,
  p_technician_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_booking_id UUID;
  v_offer_expires_at TIMESTAMPTZ;
BEGIN
  v_customer_id := auth.uid();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify customer owns the service request
  IF NOT EXISTS (
    SELECT 1 FROM public.service_requests 
    WHERE id = p_service_request_id AND customer_id = v_customer_id
  ) THEN
    RAISE EXCEPTION 'Service request not found or not owned by customer';
  END IF;

  -- Verify no existing booking for this service request
  IF EXISTS (SELECT 1 FROM public.bookings WHERE service_request_id = p_service_request_id) THEN
    RAISE EXCEPTION 'A booking already exists for this repair request.';
  END IF;

  -- Create booking
  INSERT INTO public.bookings (
    service_request_id,
    customer_id,
    technician_id,
    status,
    offer_expires_at
  ) VALUES (
    p_service_request_id,
    v_customer_id,
    p_technician_id,
    'Technician Assigned',
    now() + interval '60 seconds'
  ) RETURNING id, offer_expires_at INTO v_booking_id, v_offer_expires_at;

  -- Create initial offer record
  INSERT INTO public.booking_offers (
    booking_id,
    technician_id,
    status,
    offered_at
  ) VALUES (
    v_booking_id,
    p_technician_id,
    'offered',
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'technician_id', p_technician_id,
    'offer_expires_at', v_offer_expires_at,
    'status', 'Technician Assigned'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_with_offer(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_with_offer(UUID, UUID) TO authenticated;

-- 3. Redispatch RPC
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
  -- We rely on the caller context (either process_technician_offer or cron) 
  -- but we enforce auth.uid for safety just in case.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
    RAISE EXCEPTION 'Booking is not in a redispatchable state';
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
      'status', 'Cancelled',
      'message', 'No eligible technicians remaining.'
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

-- Security Fix: Do NOT grant execute to authenticated.
-- It should only be called internally by process_technician_offer.
REVOKE ALL ON FUNCTION public.redispatch_booking(UUID) FROM PUBLIC, anon, authenticated;

-- 4. Update process_technician_offer to use redispatch automatically
CREATE OR REPLACE FUNCTION public.process_technician_offer(
  p_booking_id UUID,
  p_action TEXT -- 'accept', 'reject', or 'expire'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tech_id UUID;
  v_booking RECORD;
  v_new_status TEXT;
  v_redispatch_result JSONB;
BEGIN
  v_tech_id := auth.uid();
  IF v_tech_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the booking row
  SELECT * INTO v_booking 
  FROM public.bookings 
  WHERE id = p_booking_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Verify ownership
  IF v_booking.technician_id != v_tech_id THEN
    RAISE EXCEPTION 'Not authorized to process this offer';
  END IF;

  -- Verify current status
  IF v_booking.status != 'Technician Assigned' THEN
    RAISE EXCEPTION 'Booking is no longer in an offer state (Current status: %)', v_booking.status;
  END IF;

  -- Determine action
  IF p_action = 'accept' THEN
    IF v_booking.offer_expires_at IS NOT NULL AND now() > v_booking.offer_expires_at THEN
      -- Automatically expire it in DB as well
      UPDATE public.bookings 
      SET status = 'Expired' 
      WHERE id = p_booking_id;
      
      -- Update history
      UPDATE public.booking_offers 
      SET status = 'expired', responded_at = now()
      WHERE booking_id = p_booking_id AND technician_id = v_tech_id AND status = 'offered';

      -- Trigger redispatch
      v_redispatch_result := public.redispatch_booking(p_booking_id);
      
      -- Transaction Correction: Return result without raising exception
      RETURN jsonb_build_object(
        'success', false,
        'expired', true,
        'redispatched', COALESCE((v_redispatch_result->>'success')::boolean, false),
        'booking_id', p_booking_id,
        'new_status', v_redispatch_result->>'status',
        'technician_id', v_redispatch_result->>'technician_id',
        'offer_expires_at', v_redispatch_result->>'offer_expires_at',
        'redispatch_result', v_redispatch_result
      );
    END IF;

    v_new_status := 'Accepted';

    -- Update history
    UPDATE public.booking_offers 
    SET status = 'accepted', responded_at = now()
    WHERE booking_id = p_booking_id AND technician_id = v_tech_id AND status = 'offered';

    -- Update status
    UPDATE public.bookings 
    SET status = v_new_status
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'booking_id', p_booking_id,
      'new_status', v_new_status
    );

  ELSIF p_action = 'reject' THEN
    v_new_status := 'Rejected';
    
    -- Update history
    UPDATE public.booking_offers 
    SET status = 'rejected', responded_at = now()
    WHERE booking_id = p_booking_id AND technician_id = v_tech_id AND status = 'offered';

    -- Update status to rejected temporarily
    UPDATE public.bookings 
    SET status = v_new_status
    WHERE id = p_booking_id;

    -- Trigger redispatch atomically
    v_redispatch_result := public.redispatch_booking(p_booking_id);

    RETURN v_redispatch_result;
    
  ELSIF p_action = 'expire' THEN
    v_new_status := 'Expired';

    -- Update history
    UPDATE public.booking_offers 
    SET status = 'expired', responded_at = now()
    WHERE booking_id = p_booking_id AND technician_id = v_tech_id AND status = 'offered';

    -- Update status
    UPDATE public.bookings 
    SET status = v_new_status
    WHERE id = p_booking_id;

    -- Trigger redispatch atomically
    v_redispatch_result := public.redispatch_booking(p_booking_id);

    RETURN v_redispatch_result;
    
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
END;
$$;
