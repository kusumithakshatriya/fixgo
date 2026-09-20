-- Phase 20 Step 1: Admin Verification Foundation

-- 1. Create Audit Log Table
CREATE TABLE IF NOT EXISTS public.technician_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin SELECT RLS for Reviews
ALTER TABLE public.technician_verification_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view verification reviews" ON public.technician_verification_reviews;
CREATE POLICY "Admins can view verification reviews"
ON public.technician_verification_reviews FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 2. Admin RLS Policies for existing tables (SELECT only)
-- public.users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- public.partner_profiles
DROP POLICY IF EXISTS "Admins can view all partner_profiles" ON public.partner_profiles;
CREATE POLICY "Admins can view all partner_profiles"
ON public.partner_profiles FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- public.partner_skills
DROP POLICY IF EXISTS "Admins can view all partner_skills" ON public.partner_skills;
CREATE POLICY "Admins can view all partner_skills"
ON public.partner_skills FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- public.partner_service_areas
DROP POLICY IF EXISTS "Admins can view all partner_service_areas" ON public.partner_service_areas;
CREATE POLICY "Admins can view all partner_service_areas"
ON public.partner_service_areas FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- public.technician_documents
DROP POLICY IF EXISTS "Admins can view all technician_documents" ON public.technician_documents;
CREATE POLICY "Admins can view all technician_documents"
ON public.technician_documents FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- storage.objects (KYC bucket)
DROP POLICY IF EXISTS "Admins can read kyc-documents bucket" ON storage.objects;
CREATE POLICY "Admins can read kyc-documents bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- 3. The Approval/Rejection RPC
CREATE OR REPLACE FUNCTION public.process_technician_verification(
  p_technician_id UUID,
  p_decision TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user public.users;
  v_target_user public.users;
  v_target_profile public.partner_profiles;
  v_has_id_proof BOOLEAN;
  v_has_skill_cert BOOLEAN;
BEGIN
  -- A. Require auth.uid() to exist.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- B & C. Load the caller and require 'admin' role.
  SELECT * INTO v_admin_user FROM public.users WHERE id = auth.uid();
  IF v_admin_user IS NULL OR v_admin_user.role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can perform this action';
  END IF;

  -- Check valid decision
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  -- F. Verify target user exists and has partner role
  SELECT * INTO v_target_user FROM public.users WHERE id = p_technician_id;
  IF v_target_user IS NULL OR v_target_user.role != 'partner' THEN
    RAISE EXCEPTION 'Target user is not a valid partner/technician';
  END IF;

  -- E. Lock the target partner_profiles row
  SELECT * INTO v_target_profile FROM public.partner_profiles WHERE id = p_technician_id FOR UPDATE;
  IF v_target_profile IS NULL THEN
    RAISE EXCEPTION 'Partner profile not found';
  END IF;

  -- I. Prevent approval of suspended technicians
  IF v_target_profile.verification_status = 'suspended' THEN
    RAISE EXCEPTION 'Cannot modify verification status of a suspended technician';
  END IF;

  -- H. Handle Rejection
  IF p_decision = 'rejected' THEN
    IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
      RAISE EXCEPTION 'Rejection reason is required when rejecting a technician';
    END IF;

    UPDATE public.partner_profiles
    SET verification_status = 'rejected',
        is_verified = false,
        rejection_reason = p_rejection_reason,
        is_online = false,
        is_available = false
    WHERE id = p_technician_id;

  -- G. Handle Approval
  ELSIF p_decision = 'approved' THEN
    -- Check document requirements
    SELECT EXISTS (
      SELECT 1 FROM public.technician_documents
      WHERE technician_id = p_technician_id AND document_type = 'id_proof'
    ) INTO v_has_id_proof;

    SELECT EXISTS (
      SELECT 1 FROM public.technician_documents
      WHERE technician_id = p_technician_id AND document_type = 'skill_certificate'
    ) INTO v_has_skill_cert;

    IF NOT v_has_id_proof OR NOT v_has_skill_cert THEN
      RAISE EXCEPTION 'Technician must have at least one id_proof and one skill_certificate uploaded';
    END IF;

    UPDATE public.partner_profiles
    SET verification_status = 'verified',
        is_verified = true,
        rejection_reason = NULL
        -- is_online and is_available deliberately NOT set to true
    WHERE id = p_technician_id;
  END IF;

  -- 7. Insert Audit Log (transaction safety inside RPC)
  INSERT INTO public.technician_verification_reviews (
    technician_id, admin_id, decision, rejection_reason
  ) VALUES (
    p_technician_id, auth.uid(), p_decision, p_rejection_reason
  );

END;
$$;

-- L & M. Secure RPC Execution
REVOKE ALL ON FUNCTION public.process_technician_verification(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_technician_verification(UUID, TEXT, TEXT) TO authenticated;
