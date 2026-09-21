import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { DemoProvider } from '@/context/demo-flow-context';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [isDemoChecked, setIsDemoChecked] = useState(false);
  const [customerDemoLoggedIn, setCustomerDemoLoggedIn] = useState(false);
  const [partnerDemoLoggedIn, setPartnerDemoLoggedIn] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('customer_demo_logged_in').then(val => {
      if (val === 'true') setCustomerDemoLoggedIn(true);
      return SecureStore.getItemAsync('partner_demo_logged_in');
    }).then(val => {
      if (val === 'true') setPartnerDemoLoggedIn(true);
    }).catch(console.error).finally(() => {
      setIsDemoChecked(true);
    });
  }, []);

  useEffect(() => {
    if (isLoading || !isDemoChecked) return;

    // Skip redirect if we are on the index (splash screen)
    if ((segments as string[]).length === 0) return;

    const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
    const isPartner = appVariant === 'partner';
    
    // In partner app, (partner) is the main group. If we are in the demo flow, we might not have a Supabase user.
    const inAuthGroup = segments[0] === '(auth)' || (isPartner && segments[0] === '(partner)' && segments[1] === 'auth');
    
    // Allow any partner route if demo logged in (except auth)
    const isPartnerDemoAllowed = isPartner && partnerDemoLoggedIn && !inAuthGroup;
    
    // Allow any customer route if demo logged in (except auth/admin)
    // The previous check strictly compared segments[0] === '(customer)',
    // which caused redirects for normalized routes like /repair-request or /technician-comparison.
    // By checking appVariant === 'customer' and excluding auth, we permit the whole demo flow.
    const isCustomerDemoAllowed = !isPartner && customerDemoLoggedIn && segments[0] !== '(auth)' && segments[0] !== '(admin)';
    
    // If not authenticated, not in auth group, and not viewing allowed demo screens, redirect to login
    if (!user && !inAuthGroup && !isPartnerDemoAllowed && !isCustomerDemoAllowed) {
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
          router.replace('/(auth)/otp');
        }
      }
    }
  }, [user, isLoading, isDemoChecked, segments, customerDemoLoggedIn, partnerDemoLoggedIn]);

  useEffect(() => {
    if (!isLoading && isDemoChecked) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, isDemoChecked]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* <AnimatedSplashOverlay /> - Removed to prevent unwanted logo rendering */}
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DemoProvider>
        <RootLayoutNav />
      </DemoProvider>
    </AuthProvider>
  );
}
