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
  
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if ((segments as string[]).length === 0) return;

    const checkAndRoute = async () => {
      const customerVal = await SecureStore.getItemAsync('customer_demo_logged_in');
      const partnerVal = await SecureStore.getItemAsync('partner_demo_logged_in');
      const customerDemoLoggedIn = customerVal === 'true';
      const partnerDemoLoggedIn = partnerVal === 'true';

      const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
      const isPartner = appVariant === 'partner';
      
      const inAuthGroup = segments[0] === '(auth)' || (isPartner && segments[0] === '(partner)' && segments[1] === 'auth');
      const isPartnerDemoAllowed = isPartner && partnerDemoLoggedIn && !inAuthGroup;
      const isCustomerDemoAllowed = !isPartner && customerDemoLoggedIn && segments[0] !== '(auth)' && segments[0] !== '(admin)';
      
      if (!user && !inAuthGroup && !isPartnerDemoAllowed && !isCustomerDemoAllowed) {
        if (isPartner) {
          router.replace('/(partner)/auth/login' as any);
        } else {
          router.replace('/(auth)/otp');
        }
      } else if (user && inAuthGroup) {
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
            router.replace('/(auth)/otp');
          }
        }
      }
      
      if (!splashHidden) {
        SplashScreen.hideAsync().catch(() => {});
        setSplashHidden(true);
      }
    };

    checkAndRoute();
  }, [user, isLoading, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
