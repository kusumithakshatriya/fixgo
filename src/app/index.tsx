import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixGoColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  
  useEffect(() => { 
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (user) {
        const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
        
        if (user.role === 'admin') {
          router.replace('/(admin)/dashboard' as any);
        } else if (appVariant === 'partner') {
          if (user.role === 'partner') {
            router.replace('/(partner)/(tabs)/home' as any);
          } else {
            router.replace('/(partner)/auth/login' as any);
          }
        } else {
          if (user.role === 'partner') {
            router.replace('/(auth)/otp');
          } else {
            router.replace('/(customer)/customer-home');
          }
        }
      } else {
        const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
        if (appVariant === 'partner') {
          import('expo-secure-store').then(SecureStore => {
            SecureStore.getItemAsync('partner_demo_logged_in').then(val => {
              if (val === 'true') {
                router.replace('/(partner)/(tabs)/home' as any);
              } else {
                router.replace('/(partner)/auth/login' as any);
              }
            }).catch(() => {
              router.replace('/(partner)/auth/login' as any);
            });
          });
        } else {
          import('expo-secure-store').then(SecureStore => {
            SecureStore.getItemAsync('customer_demo_logged_in').then(val => {
              if (val === 'true') {
                router.replace('/(customer)/customer-home');
              } else {
                router.replace('/(auth)/otp');
              }
            }).catch(() => {
              router.replace('/(auth)/otp');
            });
          });
        }
      }
    }, 1400); 
    return () => clearTimeout(timer); 
  }, [isLoading, user]);

  return <View style={styles.page} />;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: FixGoColors.primary } });
