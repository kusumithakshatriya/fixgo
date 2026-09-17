import { Stack, router } from 'expo-router';
import { FixGoColors } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function PartnerLayout() {
  const { user } = useAuth();
  const hasTriggeredRef = useRef<{ [id: string]: boolean }>({});

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`technician_dispatch_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `technician_id=eq.${user.id}`,
        },
        (payload) => {
          const booking = payload.new as any;
          if (!booking) return;

          // If a new booking is assigned to us, or updated to Assigned
          if (booking.status === 'Technician Assigned' && !hasTriggeredRef.current[booking.id]) {
            hasTriggeredRef.current[booking.id] = true;
            
            // Navigate to the incoming-job modal
            router.push({
              pathname: '/(partner)/incoming-job',
              params: { id: booking.id }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: FixGoColors.background } }}>
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/otp" />
      <Stack.Screen name="onboarding/account-setup" />
      <Stack.Screen name="onboarding/document-verification" />
      <Stack.Screen name="onboarding/payment-methods" />
      <Stack.Screen name="onboarding/basic-information" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="incoming-job" options={{ presentation: 'modal' }} />
      <Stack.Screen name="active-job" />
    </Stack>
  );
}
