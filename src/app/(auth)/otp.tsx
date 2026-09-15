import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function OtpScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      await login(trimmedEmail);
      router.push({ pathname: '/(auth)/otp-verification', params: { email: trimmedEmail } });
    } catch (e: any) {
      setError(e.message || 'Failed to send Magic Link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <SymbolView name="chevron.left" size={18} tintColor={FixGoColors.primary} />
          </Pressable>
          <Image source={require('@/assets/images/fixgo.png')} contentFit="contain" style={styles.logo} />
          <View style={styles.iconButton}>
            <SymbolView name="person.circle" size={22} tintColor={FixGoColors.primary} />
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.secureIcon}>
            <SymbolView name="envelope.fill" size={27} tintColor={FixGoColors.primary} />
          </View>
          <ThemedText style={styles.title}>FIXGO</ThemedText>
          <ThemedText style={styles.description}>We'll send a magic link to your email to securely sign you in.</ThemedText>
          
          <View style={styles.card}>
            <ThemedText style={styles.label}>Email Address</ThemedText>
            <View style={[styles.inputRow, error && styles.inputError]}>
              <TextInput 
                value={email} 
                onChangeText={(value) => { setEmail(value); setError(''); }} 
                keyboardType="email-address" 
                autoCapitalize="none"
                placeholder="Enter email address" 
                placeholderTextColor="#8A9A9C" 
                style={styles.input} 
                editable={!isLoading}
              />
            </View>
            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          </View>
          
          <View style={styles.info}>
            <SymbolView name="lock.fill" size={14} tintColor={FixGoColors.success} />
            <ThemedText style={styles.infoText}>Your email is securely stored and used for verification only.</ThemedText>
          </View>
          
          <Pressable onPress={submit} style={[styles.primary, isLoading && styles.primaryDisabled]} disabled={isLoading}>
            <ThemedText style={styles.primaryText}>{isLoading ? 'Sending...' : 'Send Magic Link  →'}</ThemedText>
          </Pressable>
        </View>
        
        <ThemedText style={styles.footer}>
          By continuing, you agree to our <ThemedText style={styles.link}>Terms of Service</ThemedText> & <ThemedText style={styles.link}>Privacy Policy</ThemedText>
        </ThemedText>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
  page: { flex: 1, backgroundColor: FixGoColors.background }, 
  safe: { flex: 1, paddingHorizontal: Spacing.four }, 
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, 
  iconButton: { height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, 
  logo: { width: 82, height: 34 }, 
  content: { flex: 1, justifyContent: 'center', gap: 16 }, 
  secureIcon: { height: 62, width: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accent }, 
  title: { color: FixGoColors.primary, fontSize: 31, fontWeight: '900', letterSpacing: 1 }, 
  description: { color: FixGoColors.textSecondary, fontSize: 15, lineHeight: 22, fontWeight: '600' }, 
  card: { backgroundColor: '#FFFFFF', borderRadius: Radius.medium, padding: Spacing.three, gap: 8, borderWidth: 1, borderColor: FixGoColors.border }, 
  label: { color: FixGoColors.text, fontSize: 13, fontWeight: '800' }, 
  inputRow: { height: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: FixGoColors.border }, 
  inputError: { borderColor: '#C44E4E' }, 
  country: { height: 34, paddingHorizontal: 11, justifyContent: 'center', borderRightWidth: 1, borderColor: FixGoColors.border }, 
  countryText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '900' }, 
  input: { flex: 1, height: '100%', paddingHorizontal: 12, color: FixGoColors.text, fontSize: 16, fontWeight: '600' }, 
  error: { color: '#B54747', fontSize: 12, fontWeight: '700' }, 
  info: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#EFF9F5' }, 
  infoText: { flex: 1, color: FixGoColors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '600' }, 
  primary: { minHeight: 54, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, 
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, 
  footer: { color: FixGoColors.textSecondary, textAlign: 'center', fontSize: 12, lineHeight: 18, marginBottom: 12 }, 
  link: { color: FixGoColors.primary, fontSize: 12, fontWeight: '900', textDecorationLine: 'underline' } 
});
