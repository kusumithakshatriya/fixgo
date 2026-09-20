-- ==============================================================================
-- FIXGO PHASE 21.5: SECURE ADDITIONAL CHARGES
-- ==============================================================================

-- 0. CREATE RECONSTRUCTED TABLE
CREATE TABLE IF NOT EXISTS public.additional_charge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    technician_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL CHECK (trim(reason) <> ''),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'additional_charge_requests'
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.additional_charge_requests;
    END IF;
END $$;

-- Attach Notification Trigger
DROP TRIGGER IF EXISTS trigger_charge_notifications ON public.additional_charge_requests;
CREATE TRIGGER trigger_charge_notifications
    AFTER INSERT OR UPDATE ON public.additional_charge_requests
    FOR EACH ROW
    EXECUTE PROCEDURE public.trg_handle_charge_notifications();

-- FIXGO PHASE 21.5: SECURE ADDITIONAL CHARGES
-- ==============================================================================

-- 1. REQUEST ADDITIONAL CHARGE (TECHNICIAN)
CREATE OR REPLACE FUNCTION public.request_additional_charge(
    p_booking_id UUID,
    p_amount NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking record;
    v_charge record;
BEGIN
    -- Require valid amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;

    -- Require reason
    IF trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Reason is required';
    END IF;

    -- Lock booking
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- Verify technician
    IF v_booking.technician_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to request charges for this booking';
    END IF;

    -- Verify status
    IF v_booking.status != 'Work In Progress' THEN
        RAISE EXCEPTION 'Booking must be in Work In Progress to request additional charges';
    END IF;

    -- Insert charge
    INSERT INTO public.additional_charge_requests (
        booking_id,
        technician_id,
        customer_id,
        amount,
        reason,
        status
    ) VALUES (
        p_booking_id,
        v_booking.technician_id,
        v_booking.customer_id,
        p_amount,
        trim(p_reason),
        'pending'
    ) RETURNING * INTO v_charge;

    RETURN to_jsonb(v_charge);
END;
$$;

REVOKE ALL ON FUNCTION public.request_additional_charge(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_additional_charge(UUID, NUMERIC, TEXT) TO authenticated;


-- 2. RESPOND TO ADDITIONAL CHARGE (CUSTOMER)
CREATE OR REPLACE FUNCTION public.respond_to_additional_charge(
    p_charge_id UUID,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_charge record;
    v_booking record;
BEGIN
    -- Validate action
    IF p_action NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid action. Must be approved or rejected';
    END IF;

    -- Lock charge
    SELECT * INTO v_charge FROM public.additional_charge_requests WHERE id = p_charge_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Charge request not found';
    END IF;

    -- Lock booking to ensure state is valid
    SELECT * INTO v_booking FROM public.bookings WHERE id = v_charge.booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated booking not found';
    END IF;

    -- Verify customer
    IF v_booking.customer_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to respond to this charge';
    END IF;

    -- Check charge status
    IF v_charge.status != 'pending' THEN
        RAISE EXCEPTION 'Charge request has already been %', v_charge.status;
    END IF;

    -- Verify booking status is still active (Work In Progress)
    -- It shouldn't be completed or awaiting payment if there was a pending charge, but verify anyway.
    IF v_booking.status IN ('Cancelled', 'Completed', 'Awaiting Payment') THEN
        RAISE EXCEPTION 'Cannot respond to charges for a % booking', v_booking.status;
    END IF;

    -- Update charge
    UPDATE public.additional_charge_requests
    SET status = p_action::text,
        updated_at = now()
    WHERE id = p_charge_id
    RETURNING * INTO v_charge;

    RETURN to_jsonb(v_charge);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_additional_charge(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_additional_charge(UUID, TEXT) TO authenticated;


-- 3. REVOKE DIRECT MUTATION
-- Drop existing INSERT/UPDATE/ALL policies on additional_charge_requests
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'additional_charge_requests'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.additional_charge_requests', r.policyname);
    END LOOP;
END
$$;

-- Ensure RLS is enabled
ALTER TABLE public.additional_charge_requests ENABLE ROW LEVEL SECURITY;

-- Re-add SELECT policy for involved users
CREATE POLICY "Enable SELECT for involved users" ON public.additional_charge_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = technician_id OR auth.uid() = customer_id);

-- Re-add SELECT policy for admins
CREATE POLICY "Enable SELECT for admins" ON public.additional_charge_requests
    FOR SELECT TO authenticated
    USING (public.is_admin());
