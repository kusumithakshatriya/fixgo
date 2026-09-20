import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'expo-router';
import { FixGoColors } from '@/constants/theme';

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading spinner
  }

  // Double check authorization on the layout level
  if (!user || user.role !== 'admin') {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: FixGoColors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="dashboard"
        options={{ title: 'Admin Dashboard', headerShown: false }}
      />
      <Stack.Screen
        name="verification-queue"
        options={{ title: 'Verification Queue' }}
      />
      <Stack.Screen
        name="technician-review"
        options={{ title: 'Review Technician' }}
      />
    </Stack>
  );
}
