CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'booking_assigned', 'booking_accepted', 'technician_on_the_way',
        'technician_arrived', 'service_started', 'additional_charge_requested',
        'additional_charge_approved', 'additional_charge_rejected',
        'booking_cancelled', 'payment_completed', 'refund_completed', 'system'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_booking_id ON public.notifications(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications(user_id, is_read);

DO 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        DROP TRIGGER IF EXISTS set_notifications_timestamp ON public.notifications;
        EXECUTE 'CREATE TRIGGER set_notifications_timestamp BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column()';
    END IF;
END
;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications" ON public.notifications 
        FOR SELECT USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications" ON public.notifications 
        FOR UPDATE USING (user_id = auth.uid());
    END IF;
END
;

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_booking_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
BEGIN
    INSERT INTO public.notifications (user_id, booking_id, type, title, message)
    VALUES (p_user_id, p_booking_id, p_type, p_title, p_message);
END;
;

CREATE OR REPLACE FUNCTION public.trg_handle_booking_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS 
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.technician_id IS NOT NULL THEN
            PERFORM public.create_notification(NEW.customer_id, NEW.id, 'booking_assigned', 'Technician assigned', 'A technician has been assigned to your service request.');
            PERFORM public.create_notification(NEW.technician_id, NEW.id, 'booking_assigned', 'New service request', 'You have been assigned a new service request.');
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.technician_id IS NULL AND NEW.technician_id IS NOT NULL THEN
            PERFORM public.create_notification(NEW.customer_id, NEW.id, 'booking_assigned', 'Technician assigned', 'A technician has been assigned to your service request.');
            PERFORM public.create_notification(NEW.technician_id, NEW.id, 'booking_assigned', 'New service request', 'You have been assigned a new service request.');
        END IF;

        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF NEW.status = 'Accepted' THEN
                PERFORM public.create_notification(NEW.customer_id, NEW.id, 'booking_accepted', 'Technician accepted', 'The technician has accepted your request.');
            ELSIF NEW.status = 'On The Way' THEN
                PERFORM public.create_notification(NEW.customer_id, NEW.id, 'technician_on_the_way', 'Technician is on the way', 'Your technician is en route.');
            ELSIF NEW.status = 'Arrived' THEN
                PERFORM public.create_notification(NEW.customer_id, NEW.id, 'technician_arrived', 'Technician has arrived', 'Your technician is at the location.');
            ELSIF NEW.status = 'Work In Progress' THEN
                PERFORM public.create_notification(NEW.customer_id, NEW.id, 'service_started', 'Service started', 'The technician has started the work.');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
;

DO 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookings') THEN
        DROP TRIGGER IF EXISTS trigger_booking_notifications ON public.bookings;
        EXECUTE 'CREATE TRIGGER trigger_booking_notifications AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE PROCEDURE public.trg_handle_booking_notifications()';
    END IF;
END
;

CREATE OR REPLACE FUNCTION public.trg_handle_charge_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
    v_cust_id UUID;
    v_tech_id UUID;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        SELECT customer_id INTO v_cust_id FROM public.bookings WHERE id = NEW.booking_id;
        IF v_cust_id IS NOT NULL THEN
            PERFORM public.create_notification(v_cust_id, NEW.booking_id, 'additional_charge_requested', 'Additional charge requested', 'The technician has requested an additional charge of ' || NEW.amount::text || '.');
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF NEW.status = 'approved' THEN
                SELECT technician_id INTO v_tech_id FROM public.bookings WHERE id = NEW.booking_id;
                IF v_tech_id IS NOT NULL THEN
                    PERFORM public.create_notification(v_tech_id, NEW.booking_id, 'additional_charge_approved', 'Additional charge approved', 'The customer has approved the additional charge.');
                END IF;
            ELSIF NEW.status = 'rejected' THEN
                SELECT technician_id INTO v_tech_id FROM public.bookings WHERE id = NEW.booking_id;
                IF v_tech_id IS NOT NULL THEN
                    PERFORM public.create_notification(v_tech_id, NEW.booking_id, 'additional_charge_rejected', 'Additional charge rejected', 'The customer has rejected the additional charge.');
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
;

DO 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'additional_charge_requests') THEN
        DROP TRIGGER IF EXISTS trigger_charge_notifications ON public.additional_charge_requests;
        EXECUTE 'CREATE TRIGGER trigger_charge_notifications AFTER INSERT OR UPDATE ON public.additional_charge_requests FOR EACH ROW EXECUTE PROCEDURE public.trg_handle_charge_notifications()';
    END IF;
END
;

CREATE OR REPLACE FUNCTION public.trg_handle_cancellation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
    v_cust_id UUID;
    v_tech_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.cancelled_by_role = 'customer' THEN
            SELECT technician_id INTO v_tech_id FROM public.bookings WHERE id = NEW.booking_id;
            IF v_tech_id IS NOT NULL THEN
                PERFORM public.create_notification(v_tech_id, NEW.booking_id, 'booking_cancelled', 'Booking cancelled', 'The customer has cancelled the booking.');
            END IF;
        ELSIF NEW.cancelled_by_role = 'technician' THEN
            SELECT customer_id INTO v_cust_id FROM public.bookings WHERE id = NEW.booking_id;
            IF v_cust_id IS NOT NULL THEN
                PERFORM public.create_notification(v_cust_id, NEW.booking_id, 'booking_cancelled', 'Booking cancelled', 'The technician has cancelled the booking.');
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.refund_status IS DISTINCT FROM NEW.refund_status AND NEW.refund_status = 'completed' THEN
            SELECT customer_id INTO v_cust_id FROM public.bookings WHERE id = NEW.booking_id;
            IF v_cust_id IS NOT NULL THEN
                PERFORM public.create_notification(v_cust_id, NEW.booking_id, 'refund_completed', 'Refund completed', 'Your refund has been successfully processed.');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
;

DO 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'booking_cancellations') THEN
        DROP TRIGGER IF EXISTS trigger_cancellation_notifications ON public.booking_cancellations;
        EXECUTE 'CREATE TRIGGER trigger_cancellation_notifications AFTER INSERT OR UPDATE ON public.booking_cancellations FOR EACH ROW EXECUTE PROCEDURE public.trg_handle_cancellation_notifications()';
    END IF;
END
;

CREATE OR REPLACE FUNCTION public.trg_handle_payment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
    v_cust_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
            SELECT customer_id INTO v_cust_id FROM public.bookings WHERE id = NEW.booking_id;
            IF v_cust_id IS NOT NULL THEN
                PERFORM public.create_notification(v_cust_id, NEW.booking_id, 'payment_completed', 'Payment completed', 'Your payment has been successfully processed.');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
;

DO 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        DROP TRIGGER IF EXISTS trigger_payment_notifications ON public.payments;
        EXECUTE 'CREATE TRIGGER trigger_payment_notifications AFTER UPDATE ON public.payments FOR EACH ROW EXECUTE PROCEDURE public.trg_handle_payment_notifications()';
    END IF;
END
;

REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;

DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
;
