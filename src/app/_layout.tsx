import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Skip redirect if we are on the index (splash screen)
    if ((segments as string[]).length === 0) return;

    const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
    const isPartner = appVariant === 'partner';
    
    // In partner app, (partner) is the main group. If we are in the demo flow, we might not have a Supabase user.
    const inAuthGroup = segments[0] === '(auth)' || (isPartner && segments[0] === '(partner)' && segments[1] === 'auth');
    const isPartnerDemoAllowed = isPartner && segments[0] === '(partner)' && (segments[1] === '(tabs)' || segments[1] === 'onboarding' || segments[1] === 'active-job');
    
    // If not authenticated, not in auth group, and not viewing allowed partner demo screens, redirect to login
    if (!user && !inAuthGroup && !isPartnerDemoAllowed) {
      if (isPartner) {
        router.replace('/(partner)/auth/login' as any);
      } else {
        router.replace('/(auth)/otp');
      }
    } else if (user && inAuthGroup) {
      const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
      
      // If authenticated and in auth group, check if onboarding is complete
      if (!user.name) {
        if (segments[1] !== 'onboarding') {
          router.replace('/(auth)/onboarding');
        }
      } else {
        if (user.role === 'admin') {
          router.replace('/(admin)/dashboard' as any);
        } else if (appVariant === 'partner' && user.role === 'partner') {
          router.replace('/(partner)/(tabs)/home' as any);
        } else if (appVariant === 'customer' && user.role !== 'partner') {
          router.replace('/(customer)/customer-home');
        } else {
          // Mismatch between role and app variant, fallback to login
          // The user needs to switch apps or use correct account
          router.replace('/(auth)/otp');
        }
      }
    }
  }, [user, isLoading, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
