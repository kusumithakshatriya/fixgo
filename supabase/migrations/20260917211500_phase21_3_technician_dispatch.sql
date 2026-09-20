-- =================================================================================
-- PHASE 21.3: TECHNICIAN LOCATIONS & SECURE JOB DISPATCH
-- =================================================================================

-- 1. Create technician_locations table if it does not exist
CREATE TABLE IF NOT EXISTS public.technician_locations (
  technician_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on technician_locations
ALTER TABLE public.technician_locations ENABLE ROW LEVEL SECURITY;

-- Technician can manage their own location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'technician_locations' AND policyname = 'Technician can manage own location'
  ) THEN
    CREATE POLICY "Technician can manage own location"
    ON public.technician_locations
    FOR ALL
    USING (auth.uid() = technician_id)
    WITH CHECK (auth.uid() = technician_id);
  END IF;
END
$$;

-- Customer can read location if technician is assigned to an active booking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'technician_locations' AND policyname = 'Customer can read assigned technician location'
  ) THEN
    CREATE POLICY "Customer can read assigned technician location"
    ON public.technician_locations
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.technician_id = technician_locations.technician_id
        AND b.customer_id = auth.uid()
        AND b.status IN ('Technician Assigned', 'Assigned', 'Accepted', 'On The Way', 'Arrived', 'Work In Progress')
      )
    );
  END IF;
END
$$;

-- Ensure table is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'technician_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
  END IF;
END
$$;

-- 2. Add offer_expires_at to bookings
DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'offer_expires_at'
    ) THEN
      ALTER TABLE public.bookings ADD COLUMN offer_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '60 seconds');
    END IF;
  END
$$;

-- Ensure bookings is in realtime publication (already true for most setups, but just in case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END
$$;

-- 3. Secure Atomic RPC for Accept/Reject Job Offer
CREATE OR REPLACE FUNCTION public.process_technician_offer(
  p_booking_id UUID,
  p_action TEXT -- 'accept' or 'reject'
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
BEGIN
  v_tech_id := auth.uid();
  IF v_tech_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the booking row to prevent concurrent race conditions
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
    -- Check expiration
    IF v_booking.offer_expires_at IS NOT NULL AND now() > v_booking.offer_expires_at THEN
      -- Automatically expire it in DB as well
      UPDATE public.bookings 
      SET status = 'Expired' 
      WHERE id = p_booking_id;
      
      RAISE EXCEPTION 'Offer has expired';
    END IF;

    v_new_status := 'Accepted';

  ELSIF p_action = 'reject' THEN
    v_new_status := 'Rejected';
    
  ELSIF p_action = 'expire' THEN
    -- Used by the frontend or cron to formally expire it
    v_new_status := 'Expired';
    
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  -- Update status
  UPDATE public.bookings 
  SET status = v_new_status
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'new_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_technician_offer(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_technician_offer(UUID, TEXT) TO authenticated;

