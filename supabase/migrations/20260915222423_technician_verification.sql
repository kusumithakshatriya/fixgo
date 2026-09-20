-- Phase 19: Technician Verification & Onboarding

-- 1. Update partner_profiles with verification_status
ALTER TABLE public.partner_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'incomplete'
  CHECK (verification_status IN ('incomplete', 'pending', 'verified', 'rejected', 'suspended')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Map existing verified users
UPDATE public.partner_profiles
SET verification_status = 'verified'
WHERE is_verified = true AND verification_status = 'incomplete';

-- 2. Create technician_documents table
CREATE TABLE IF NOT EXISTS public.technician_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id_proof', 'address_proof', 'skill_certificate', 'profile_photo', 'other')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for technician_documents updated_at
DROP TRIGGER IF EXISTS set_technician_documents_timestamp ON public.technician_documents;
CREATE TRIGGER set_technician_documents_timestamp
BEFORE UPDATE ON public.technician_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- RLS for technician_documents
ALTER TABLE public.technician_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'technician_documents' AND policyname = 'Technicians can view own documents'
    ) THEN
        CREATE POLICY "Technicians can view own documents" ON public.technician_documents FOR SELECT
        TO authenticated USING (technician_id = auth.uid());

        CREATE POLICY "Technicians can insert own documents" ON public.technician_documents FOR INSERT
        TO authenticated WITH CHECK (technician_id = auth.uid());

        CREATE POLICY "Technicians can update own pending documents" ON public.technician_documents FOR UPDATE
        TO authenticated USING (technician_id = auth.uid() AND verification_status = 'pending');
    END IF;
END
$$;

-- 3. Storage Bucket for KYC Documents
-- (We insert it directly into the storage.buckets table)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Enable RLS on storage.objects if not already


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Technicians can upload KYC documents'
    ) THEN
        CREATE POLICY "Technicians can upload KYC documents" ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

        CREATE POLICY "Technicians can view own KYC documents" ON storage.objects FOR SELECT
        TO authenticated
        USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

        CREATE POLICY "Technicians can delete own KYC documents" ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;
END
$$;

-- 4. Admin Submission RPC
-- A secure way for technician to mark their profile as pending review
CREATE OR REPLACE FUNCTION public.submit_for_verification()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.partner_profiles;
BEGIN
  SELECT * INTO v_profile FROM public.partner_profiles WHERE id = auth.uid() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.verification_status IN ('verified', 'suspended') THEN
    RAISE EXCEPTION 'Cannot submit from current status';
  END IF;

  UPDATE public.partner_profiles
  SET verification_status = 'pending',
      rejection_reason = NULL
  WHERE id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_for_verification() TO authenticated;

-- 5. Safe Technician Fetching for Customer
-- Returns ONLY strictly verified, online, available technicians.
-- The UI/Client can call this RPC to bypass in-memory filtering risks.
CREATE OR REPLACE FUNCTION public.get_eligible_technicians_for_service(p_service_id BIGINT)
RETURNS TABLE (
  partner_id UUID,
  rating NUMERIC,
  total_jobs INTEGER,
  experience_years INTEGER,
  service_radius_km NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.partner_id,
    pp.rating,
    pp.total_jobs,
    ps.experience_years,
    pp.service_radius_km
  FROM public.partner_skills ps
  INNER JOIN public.partner_profiles pp ON ps.partner_id = pp.id
  WHERE ps.service_id = p_service_id
    AND pp.is_verified = true
    AND pp.verification_status = 'verified'
    AND pp.is_online = true
    AND pp.is_available = true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_eligible_technicians_for_service(BIGINT) TO authenticated;
