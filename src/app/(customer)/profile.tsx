import { StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixGoBottomNav } from '@/components/fixgo/fixgo-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDemo } from '@/context/demo-flow-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export default function ProfileScreen() { 
  const { user, logout } = useAuth();
  const { clearDemo } = useDemo();
  
  const handleLogout = async () => {
    await clearDemo();
    if (user) {
      await logout();
    }
    await SecureStore.deleteItemAsync('customer_demo_logged_in');
    router.replace('/(auth)/otp' as any);
  };
  
  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.content}>
        <ThemedText style={styles.title}>Your Profile</ThemedText>
        <ThemedText style={styles.copy}>Name: {user?.name || 'Not set'}</ThemedText>
        <ThemedText style={styles.copy}>Email: {user?.email || 'Not set'}</ThemedText>
        <ThemedText style={styles.copy}>Phone: {user?.phone || 'Not set'}</ThemedText>
        <ThemedText style={styles.copy}>Location: {user?.location || 'Not set'}</ThemedText>
        
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </SafeAreaView>
      <FixGoBottomNav active="profile" />
    </View>
  ); 
}

const styles = StyleSheet.create({ 
  page: { flex: 1, backgroundColor: FixGoColors.background }, 
  content: { flex: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center', gap: 8 }, 
  title: { color: FixGoColors.text, fontSize: 24, fontWeight: '800', marginBottom: 16 }, 
  copy: { color: FixGoColors.textSecondary, textAlign: 'center' },
  logoutButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#B54747', borderRadius: Radius.medium },
  logoutText: { color: '#FFFFFF', fontWeight: '900' }
});
