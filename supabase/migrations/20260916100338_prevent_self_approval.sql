-- Phase 19: Security Fix - Prevent Technician Self-Approval

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the update originates directly from the client API,
  -- current_user will be 'authenticated' or 'anon' (or 'authenticator').
  -- SECURITY DEFINER RPCs (like submit_for_verification) execute as 'postgres'.
  -- Admin API keys execute as 'service_role'.
  IF current_user IN ('authenticator', 'authenticated', 'anon') THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
       NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
       NEW.rating IS DISTINCT FROM OLD.rating OR
       NEW.total_jobs IS DISTINCT FROM OLD.total_jobs OR
       NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Unauthorized modification of administrative fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_profile_changes ON public.partner_profiles;
CREATE TRIGGER trg_prevent_unauthorized_profile_changes
BEFORE UPDATE ON public.partner_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_profile_changes();
