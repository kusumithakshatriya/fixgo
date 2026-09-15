import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import * as Linking from 'expo-linking';

export default function OtpVerificationScreen() {
  const { login } = useAuth();
  const { email } = useLocalSearchParams<{ email: string }>();
  
  const [error, setError] = useState(''); 
  const [seconds, setSeconds] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  
  const displayEmail = email || 'your email';
  
  useEffect(() => { 
    if (!seconds) return; 
    const interval = setInterval(() => setSeconds((value) => value - 1), 1000); 
    return () => clearInterval(interval); 
  }, [seconds]);
  
  const resend = async () => {
    if (seconds > 0) return;
    setIsLoading(true);
    setError('');
    try {
      await login(displayEmail);
      setSeconds(60);
    } catch (e: any) {
      setError(e.message || 'Failed to resend Magic Link.');
    } finally {
      setIsLoading(false);
    }
  };

  const openMailClient = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('message://');
    } else {
      Linking.openURL('mailto:');
    }
  };
  
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <SymbolView name="chevron.left" size={18} tintColor={FixGoColors.primary} />
          </Pressable>
          <Image source={require('@/assets/images/fixgo.png')} contentFit="contain" style={styles.logo} />
          <SymbolView name="person.circle" size={23} tintColor={FixGoColors.primary} />
        </View>
        <View style={styles.content}>
          <View style={styles.secure}>
            <SymbolView name="lock.shield.fill" size={15} tintColor={FixGoColors.success} />
            <ThemedText style={styles.secureText}>SECURE LOGIN</ThemedText>
          </View>
          <View style={styles.verifyIcon}>
            <SymbolView name="envelope.fill" size={39} tintColor={FixGoColors.primary} />
          </View>
          <ThemedText style={styles.title}>Check your email</ThemedText>
          <ThemedText style={styles.subtitle}>We've sent a magic link to {displayEmail}. Click the link to securely sign in.</ThemedText>
          
          <ActivityIndicator size="large" color={FixGoColors.primary} style={styles.loader} />
          
          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : <ThemedText style={styles.devHint}>Waiting for authentication...</ThemedText>}
          
          <Pressable onPress={openMailClient} style={styles.mailButton}>
            <ThemedText style={styles.mailButtonText}>Open Mail App</ThemedText>
          </Pressable>

          <ThemedText style={styles.timer}>Didn't receive the link? Resend in 00:{`${seconds}`.padStart(2, '0')}</ThemedText>
          <Pressable onPress={resend} disabled={seconds > 0 || isLoading}>
            <ThemedText style={[styles.resend, (seconds > 0 || isLoading) && { opacity: 0.5 }]}>Resend Magic Link</ThemedText>
          </Pressable>
        </View>
        <View style={styles.footer}>
          <SymbolView name="lock.fill" size={13} tintColor={FixGoColors.textSecondary} />
          <ThemedText style={styles.footerText}>Protected by 256-bit secure encryption</ThemedText>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
  page: { flex: 1, backgroundColor: FixGoColors.background }, 
  safe: { flex: 1, paddingHorizontal: Spacing.four }, 
  header: { height: 58, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }, 
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, 
  logo: { width: 82, height: 34 }, 
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }, 
  secure: { flexDirection: 'row', gap: 5, backgroundColor: '#EFF9F5', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 }, 
  secureText: { color: FixGoColors.success, fontSize: 10, fontWeight: '900', letterSpacing: .6 }, 
  verifyIcon: { height: 76, width: 76, borderRadius: 25, backgroundColor: FixGoColors.accent, alignItems: 'center', justifyContent: 'center' }, 
  title: { color: FixGoColors.text, fontSize: 27, lineHeight: 33, fontWeight: '900', textAlign: 'center' }, 
  subtitle: { color: FixGoColors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '600' }, 
  loader: { marginVertical: 20 },
  error: { color: '#B54747', fontSize: 12, fontWeight: '700' }, 
  devHint: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '700' }, 
  timer: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 3 }, 
  resend: { color: FixGoColors.primary, fontSize: 13, fontWeight: '900' }, 
  mailButton: { width: '100%', minHeight: 54, borderRadius: Radius.medium, marginTop: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: FixGoColors.primary }, 
  mailButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, 
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 }, 
  footerText: { color: FixGoColors.textSecondary, fontSize: 11, fontWeight: '700' } 
});
