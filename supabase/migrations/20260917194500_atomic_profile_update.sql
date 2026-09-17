-- Phase 21.2: Atomic Technician Profile Update

CREATE OR REPLACE FUNCTION public.update_technician_profile(
    p_name text,
    p_phone text,
    p_bio text,
    p_experience_years integer,
    p_service_radius_km numeric,
    p_area_name text,
    p_latitude numeric,
    p_longitude numeric,
    p_service_ids bigint[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_valid_service_ids bigint[];
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Basic input validation
    IF p_experience_years < 0 THEN
        RAISE EXCEPTION 'Experience years cannot be negative';
    END IF;
    IF p_service_radius_km <= 0 THEN
        RAISE EXCEPTION 'Service radius must be greater than 0';
    END IF;

    -- 1. Update public.users
    UPDATE public.users 
    SET 
        name = COALESCE(p_name, name), 
        phone = COALESCE(p_phone, phone)
    WHERE id = v_user_id;

    -- 2. Upsert public.partner_profiles
    -- We do NOT touch administrative fields (verification_status, is_verified, rating)
    -- We do NOT touch is_online (preserves current state)
    INSERT INTO public.partner_profiles (id, bio, experience_years, service_radius_km)
    VALUES (v_user_id, p_bio, p_experience_years, p_service_radius_km)
    ON CONFLICT (id) DO UPDATE
    SET 
        bio = EXCLUDED.bio,
        experience_years = EXCLUDED.experience_years,
        service_radius_km = EXCLUDED.service_radius_km,
        updated_at = now();

    -- 3. Upsert public.partner_service_areas
    IF p_area_name IS NOT NULL AND trim(p_area_name) != '' THEN
        IF EXISTS (SELECT 1 FROM public.partner_service_areas WHERE partner_id = v_user_id) THEN
            UPDATE public.partner_service_areas
            SET 
                area_name = p_area_name,
                latitude = p_latitude,
                longitude = p_longitude
            WHERE partner_id = v_user_id;
        ELSE
            INSERT INTO public.partner_service_areas (partner_id, area_name, latitude, longitude)
            VALUES (v_user_id, p_area_name, p_latitude, p_longitude);
        END IF;
    END IF;

    -- 4. Replace partner_skills atomically
    DELETE FROM public.partner_skills WHERE partner_id = v_user_id;
    
    IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
        -- Verify that all provided service IDs exist in public.services
        SELECT array_agg(id) INTO v_valid_service_ids
        FROM public.services
        WHERE id = ANY(p_service_ids);

        IF array_length(v_valid_service_ids, 1) IS NULL OR array_length(v_valid_service_ids, 1) != array_length(p_service_ids, 1) THEN
            RAISE EXCEPTION 'One or more invalid service IDs provided';
        END IF;

        INSERT INTO public.partner_skills (partner_id, service_id, experience_years)
        SELECT v_user_id, unnest(p_service_ids), p_experience_years;
    END IF;
END;
$$;

-- Secure the RPC
REVOKE ALL ON FUNCTION public.update_technician_profile FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_technician_profile TO authenticated;
