-- Phase 20 Step 2: KYC Workflow and Security Fixes

-- 1. Admin Document Review RPC
CREATE OR REPLACE FUNCTION public.process_document_verification(
  p_document_id UUID,
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
  v_target_doc public.technician_documents;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_admin_user FROM public.users WHERE id = auth.uid();
  IF v_admin_user IS NULL OR v_admin_user.role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can perform this action';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  SELECT * INTO v_target_doc FROM public.technician_documents WHERE id = p_document_id FOR UPDATE;
  IF v_target_doc IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT * INTO v_target_user FROM public.users WHERE id = v_target_doc.technician_id;
  IF v_target_user IS NULL OR v_target_user.role != 'partner' THEN
    RAISE EXCEPTION 'Document belongs to an invalid or non-partner user';
  END IF;

  IF p_decision = 'rejected' THEN
    IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
      RAISE EXCEPTION 'Rejection reason is required when rejecting a document';
    END IF;

    UPDATE public.technician_documents
    SET verification_status = 'rejected',
        rejection_reason = trim(p_rejection_reason),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_document_id;
  ELSIF p_decision = 'approved' THEN
    UPDATE public.technician_documents
    SET verification_status = 'approved',
        rejection_reason = NULL,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_document_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.process_document_verification(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_document_verification(UUID, TEXT, TEXT) TO authenticated;

-- 2. Resubmission RLS Policy (DELETE rejected documents)
DROP POLICY IF EXISTS "Technicians can delete own rejected documents" ON public.technician_documents;
CREATE POLICY "Technicians can delete own rejected documents" ON public.technician_documents FOR DELETE
TO authenticated
USING (
  technician_id = auth.uid() AND
  verification_status = 'rejected' AND
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'partner')
);

-- 3. Strengthen Technician Verification RPC
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
  v_has_approved_id BOOLEAN;
  v_has_approved_skill BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_admin_user FROM public.users WHERE id = auth.uid();
  IF v_admin_user IS NULL OR v_admin_user.role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can perform this action';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  SELECT * INTO v_target_user FROM public.users WHERE id = p_technician_id;
  IF v_target_user IS NULL OR v_target_user.role != 'partner' THEN
    RAISE EXCEPTION 'Target user is not a valid partner/technician';
  END IF;

  SELECT * INTO v_target_profile FROM public.partner_profiles WHERE id = p_technician_id FOR UPDATE;
  IF v_target_profile IS NULL THEN
    RAISE EXCEPTION 'Partner profile not found';
  END IF;

  IF v_target_profile.verification_status = 'suspended' THEN
    RAISE EXCEPTION 'Cannot modify verification status of a suspended technician';
  END IF;

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

  ELSIF p_decision = 'approved' THEN
    -- Strict check for APPROVED mandatory documents
    SELECT EXISTS (
      SELECT 1 FROM public.technician_documents
      WHERE technician_id = p_technician_id
        AND document_type = 'id_proof'
        AND verification_status = 'approved'
    ) INTO v_has_approved_id;

    SELECT EXISTS (
      SELECT 1 FROM public.technician_documents
      WHERE technician_id = p_technician_id
        AND document_type = 'skill_certificate'
        AND verification_status = 'approved'
    ) INTO v_has_approved_skill;

    IF NOT v_has_approved_id OR NOT v_has_approved_skill THEN
      RAISE EXCEPTION 'Technician must have at least one APPROVED id_proof and one APPROVED skill_certificate';
    END IF;

    UPDATE public.partner_profiles
    SET verification_status = 'verified',
        is_verified = true,
        rejection_reason = NULL
    WHERE id = p_technician_id;
  END IF;

  INSERT INTO public.technician_verification_reviews (
    technician_id, admin_id, decision, rejection_reason
  ) VALUES (
    p_technician_id, auth.uid(), p_decision, p_rejection_reason
  );

END;
$$;

REVOKE ALL ON FUNCTION public.process_technician_verification(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_technician_verification(UUID, TEXT, TEXT) TO authenticated;
