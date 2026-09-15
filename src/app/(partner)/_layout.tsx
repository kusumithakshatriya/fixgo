import { Stack } from 'expo-router';
import { FixGoColors } from '@/constants/theme';

export default function PartnerLayout() {
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
