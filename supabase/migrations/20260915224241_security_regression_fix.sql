-- Phase 19: Security + Regression Fix

-- 1. SECURITY DEFINER RPC permissions
REVOKE ALL ON FUNCTION public.submit_for_verification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_for_verification() TO authenticated;

REVOKE ALL ON FUNCTION public.get_eligible_technicians_for_service(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_eligible_technicians_for_service(BIGINT) TO authenticated;

-- 2. Strengthen submit_for_verification()
CREATE OR REPLACE FUNCTION public.submit_for_verification()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.partner_profiles;
  v_user public.users;
  v_has_skills BOOLEAN;
  v_has_service_area BOOLEAN;
  v_has_id_proof BOOLEAN;
  v_has_skill_cert BOOLEAN;
BEGIN
  -- Validate authenticated technician
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate role and basic info
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();
  IF v_user.role != 'partner' THEN
    RAISE EXCEPTION 'Only partners can submit for verification';
  END IF;

  IF v_user.name IS NULL OR length(trim(v_user.name)) = 0 THEN
    RAISE EXCEPTION 'Basic profile information (name) is missing';
  END IF;

  -- Profile state check
  SELECT * INTO v_profile FROM public.partner_profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner profile not found';
  END IF;

  IF v_profile.verification_status IN ('verified', 'suspended') THEN
    RAISE EXCEPTION 'Cannot submit from current status (%)', v_profile.verification_status;
  END IF;

  -- At least one valid partner skill/service
  SELECT EXISTS (
    SELECT 1 FROM public.partner_skills WHERE partner_id = auth.uid()
  ) INTO v_has_skills;
  IF NOT v_has_skills THEN
    RAISE EXCEPTION 'At least one service skill is required';
  END IF;

  -- Service area exists
  SELECT EXISTS (
    SELECT 1 FROM public.partner_service_areas WHERE partner_id = auth.uid()
  ) INTO v_has_service_area;
  IF NOT v_has_service_area THEN
    RAISE EXCEPTION 'Service area is required';
  END IF;

  -- Required KYC documents exist (id_proof, skill_certificate)
  SELECT EXISTS (
    SELECT 1 FROM public.technician_documents WHERE technician_id = auth.uid() AND document_type = 'id_proof'
  ) INTO v_has_id_proof;
  IF NOT v_has_id_proof THEN
    RAISE EXCEPTION 'ID Proof document is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.technician_documents WHERE technician_id = auth.uid() AND document_type = 'skill_certificate'
  ) INTO v_has_skill_cert;
  IF NOT v_has_skill_cert THEN
    RAISE EXCEPTION 'Skill Certificate document is required';
  END IF;

  -- All checks passed
  UPDATE public.partner_profiles
  SET verification_status = 'pending',
      rejection_reason = NULL
  WHERE id = auth.uid();
END;
$$;
-- Grant execute back since we redefined
REVOKE ALL ON FUNCTION public.submit_for_verification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_for_verification() TO authenticated;

-- 7. Technician role enforcement
-- Add role check to technician_documents RLS policies
DROP POLICY IF EXISTS "Technicians can insert own documents" ON public.technician_documents;
CREATE POLICY "Technicians can insert own documents" ON public.technician_documents FOR INSERT
TO authenticated
WITH CHECK (
  technician_id = auth.uid() AND
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'partner')
);

-- 8. Backend availability protection
-- Only verified technicians can become available for jobs
-- Use a constraint or trigger on partner_profiles.
CREATE OR REPLACE FUNCTION public.enforce_verified_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If trying to set online or available while NOT verified
  IF (NEW.is_online = true OR NEW.is_available = true) THEN
    IF NEW.verification_status != 'verified' THEN
      -- Automatically reject it by forcing it to false
      NEW.is_online := false;
      NEW.is_available := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_verified_availability ON public.partner_profiles;
CREATE TRIGGER trg_enforce_verified_availability
BEFORE UPDATE ON public.partner_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verified_availability();

-- 6. Storage policies
-- Recreate storage policies safely
DROP POLICY IF EXISTS "Technicians can upload KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Technicians can view own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Technicians can delete own KYC documents" ON storage.objects;

CREATE POLICY "Technicians can upload KYC documents" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'partner')
);

CREATE POLICY "Technicians can view own KYC documents" ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Technicians can delete own KYC documents" ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
