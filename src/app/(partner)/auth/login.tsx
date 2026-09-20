import { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function PartnerLoginScreen() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);

    try {
      // Demo Partner authentication:
      // Do not call Supabase email OTP.
      // The Partner app uses the simulated 6-digit OTP flow.
      router.push({
        pathname: '/(partner)/auth/otp' as any,
        params: { phone },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name="chevron.left" size={24} tintColor={FixGoColors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <ThemedText style={styles.logoText}>FIXGO</ThemedText>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>PARTNER APP</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.title}>Welcome back</ThemedText>
          <ThemedText style={styles.subtitle}>Enter your mobile number to securely log in or sign up.</ThemedText>

          <View style={styles.inputContainer}>
            <View style={styles.countryCode}>
              <ThemedText style={styles.countryCodeText}>+91</ThemedText>
              <SymbolView name="chevron.down" size={14} tintColor={FixGoColors.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Mobile Number"
              placeholderTextColor={FixGoColors.textSecondary}
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.termsText}>
            By continuing, you agree to our{' '}
            <ThemedText style={styles.linkText}>Terms of Service</ThemedText> and{' '}
            <ThemedText style={styles.linkText}>Privacy Policy</ThemedText>.
          </ThemedText>

          <Pressable 
            style={[styles.primaryBtn, (phone.length < 10 || isLoading) && styles.disabledBtn]} 
            onPress={handleSendOtp}
            disabled={phone.length < 10 || isLoading}
          >
            <ThemedText style={styles.primaryBtnText}>
              {isLoading ? 'Continuing...' : 'Continue'}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth, justifyContent: 'space-between' },
  
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  
  content: { flex: 1, paddingHorizontal: Spacing.four, marginTop: Spacing.four },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.six },
  logoText: { fontSize: 24, fontWeight: '900', color: FixGoColors.primary, letterSpacing: 1 },
  badge: { backgroundColor: FixGoColors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: FixGoColors.card, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  
  title: { fontSize: 28, fontWeight: '900', color: FixGoColors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '600', color: FixGoColors.textSecondary, marginBottom: 32, lineHeight: 22 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 56, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, backgroundColor: FixGoColors.card, overflow: 'hidden' },
  countryCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, borderRightWidth: 1, borderColor: FixGoColors.border, height: '100%' },
  countryCodeText: { fontSize: 16, fontWeight: '700', color: FixGoColors.text },
  input: { flex: 1, height: '100%', paddingHorizontal: 16, fontSize: 16, fontWeight: '600', color: FixGoColors.text },
  
  footer: { padding: Spacing.four, gap: 16 },
  termsText: { fontSize: 12, fontWeight: '600', color: FixGoColors.textSecondary, textAlign: 'center', lineHeight: 18 },
  linkText: { color: FixGoColors.primary, textDecorationLine: 'underline' },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { opacity: 0.5 },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});
