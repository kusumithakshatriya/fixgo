-- Phase 20 Step 1 Correction: Fix RLS Recursion and Harden Security

-- 1. Create secure SECURITY DEFINER helper to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN v_role = 'admin';
END;
$$;

-- Secure the helper function
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Replace RLS Policies using the helper
-- public.users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
TO authenticated
USING (public.is_admin());

-- public.partner_profiles
DROP POLICY IF EXISTS "Admins can view all partner_profiles" ON public.partner_profiles;
CREATE POLICY "Admins can view all partner_profiles"
ON public.partner_profiles FOR SELECT
TO authenticated
USING (public.is_admin());

-- public.partner_skills
DROP POLICY IF EXISTS "Admins can view all partner_skills" ON public.partner_skills;
CREATE POLICY "Admins can view all partner_skills"
ON public.partner_skills FOR SELECT
TO authenticated
USING (public.is_admin());

-- public.partner_service_areas
DROP POLICY IF EXISTS "Admins can view all partner_service_areas" ON public.partner_service_areas;
CREATE POLICY "Admins can view all partner_service_areas"
ON public.partner_service_areas FOR SELECT
TO authenticated
USING (public.is_admin());

-- public.technician_documents
DROP POLICY IF EXISTS "Admins can view all technician_documents" ON public.technician_documents;
CREATE POLICY "Admins can view all technician_documents"
ON public.technician_documents FOR SELECT
TO authenticated
USING (public.is_admin());

-- storage.objects (KYC bucket)
DROP POLICY IF EXISTS "Admins can read kyc-documents bucket" ON storage.objects;
CREATE POLICY "Admins can read kyc-documents bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  public.is_admin()
);

-- public.technician_verification_reviews
DROP POLICY IF EXISTS "Admins can view verification reviews" ON public.technician_verification_reviews;
CREATE POLICY "Admins can view verification reviews"
ON public.technician_verification_reviews FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3. Harden the Audit Log
-- Explicitly revoke direct mutation privileges from client APIs
REVOKE INSERT, UPDATE, DELETE
ON public.technician_verification_reviews
FROM anon, authenticated;
