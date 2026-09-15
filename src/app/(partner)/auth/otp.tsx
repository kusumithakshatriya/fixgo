import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function PartnerOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const otp = code.join('');
    if (otp.length < 6) {
      Alert.alert('Incomplete', 'Please enter the 6-digit OTP.');
      return;
    }
    
    // As instructed, we route to Account Setup to continue onboarding
    // In a real flow, this would exchange the code for a session
    router.replace('/(partner)/onboarding/account-setup' as any);
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
          <ThemedText style={styles.title}>Verify it's you</ThemedText>
          <ThemedText style={styles.subtitle}>
            We've sent a 6-digit code to <ThemedText style={styles.phoneText}>+91 {phone}</ThemedText>.
          </ThemedText>

          <View style={styles.otpContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputs.current[index] = ref; }}
                style={[styles.otpInput, digit && styles.otpInputFilled]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={t => handleChange(t, index)}
                onKeyPress={e => handleKeyPress(e, index)}
              />
            ))}
          </View>

          <View style={styles.resendContainer}>
            <ThemedText style={styles.resendText}>Didn't receive the code?</ThemedText>
            {timer > 0 ? (
              <ThemedText style={styles.timerText}>Resend in 00:{timer.toString().padStart(2, '0')}</ThemedText>
            ) : (
              <Pressable onPress={() => setTimer(30)}>
                <ThemedText style={styles.resendAction}>Resend OTP</ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable 
            style={[styles.primaryBtn, code.join('').length < 6 && styles.disabledBtn]} 
            onPress={handleVerify}
            disabled={code.join('').length < 6}
          >
            <ThemedText style={styles.primaryBtnText}>Verify & Continue</ThemedText>
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
  title: { fontSize: 28, fontWeight: '900', color: FixGoColors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: '600', color: FixGoColors.textSecondary, marginBottom: 32, lineHeight: 22 },
  phoneText: { color: FixGoColors.text, fontWeight: '800' },
  
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  otpInput: { width: 48, height: 56, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border, backgroundColor: FixGoColors.card, textAlign: 'center', fontSize: 24, fontWeight: '800', color: FixGoColors.text },
  otpInputFilled: { borderColor: FixGoColors.primary, backgroundColor: '#FAFAFA' },
  
  resendContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resendText: { fontSize: 14, fontWeight: '600', color: FixGoColors.textSecondary },
  timerText: { fontSize: 14, fontWeight: '700', color: FixGoColors.textSecondary },
  resendAction: { fontSize: 14, fontWeight: '800', color: FixGoColors.primary },
  
  footer: { padding: Spacing.four, gap: 16 },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { opacity: 0.5 },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});
