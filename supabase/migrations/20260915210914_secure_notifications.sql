-- 1. Remove direct UPDATE access for all users
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- We could revoke UPDATE entirely, but dropping the policy is sufficient 
-- since RLS is enabled and defaults to DENY if no policy exists for UPDATE.
-- (Assuming no other policies grant UPDATE)

-- 2. Create RPC for marking a single notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the user owns the notification before updating
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id
      AND user_id = auth.uid();
END;
$$;

-- 3. Create RPC for marking all notifications as read for the current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = auth.uid()
      AND is_read = false;
END;
$$;

-- 4. Grant execute to authenticated users so they can call these via the API
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
