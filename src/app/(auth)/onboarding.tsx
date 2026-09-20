import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingScreen() {
  const { updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const continueToHome = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    try {
      await updateProfile({
        name: trimmedName,
        phone: phone.trim(),
        location: location.trim(),
      });
      const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || 'customer';
      if (appVariant === 'partner') {
        router.replace('/(partner)/(tabs)/home' as any);
      } else {
        router.replace('/(customer)/customer-home');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <ThemedText style={styles.title}>Complete your profile</ThemedText>
          <ThemedText style={styles.subtitle}>This helps our technicians know who they're helping</ThemedText>
          
          <View style={styles.avatar}>
            <SymbolView name="person.fill" size={54} tintColor={FixGoColors.primary} />
            <View style={styles.camera}>
              <SymbolView name="camera.fill" size={13} tintColor="#FFFFFF" />
            </View>
          </View>
          
          <View style={styles.inputArea}>
            <ThemedText style={styles.label}>Full Name *</ThemedText>
            <TextInput 
              value={name} 
              onChangeText={(value) => { setName(value); setError(''); }} 
              placeholder="Enter your full name" 
              placeholderTextColor="#8A9A9C" 
              autoCapitalize="words" 
              style={[styles.input, error && styles.inputError]} 
            />
            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            
            <ThemedText style={styles.label}>Mobile Number (Optional)</ThemedText>
            <TextInput 
              value={phone} 
              onChangeText={setPhone} 
              placeholder="10-digit number" 
              placeholderTextColor="#8A9A9C" 
              keyboardType="phone-pad"
              style={styles.input} 
            />
            
            <ThemedText style={styles.label}>Location (Optional)</ThemedText>
            <TextInput 
              value={location} 
              onChangeText={setLocation} 
              placeholder="City or Neighborhood" 
              placeholderTextColor="#8A9A9C" 
              style={styles.input} 
            />
          </View>
          
          <Pressable onPress={continueToHome} style={[styles.primary, isSubmitting && styles.primaryDisabled]} disabled={isSubmitting}>
            <ThemedText style={styles.primaryText}>{isSubmitting ? 'Saving...' : 'Continue'}</ThemedText>
          </Pressable>
        </ScrollView>
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
  content: { flexGrow: 1, paddingTop: 30, gap: 16, paddingBottom: 40 }, 
  title: { color: FixGoColors.text, fontSize: 29, lineHeight: 35, fontWeight: '900' }, 
  subtitle: { color: FixGoColors.textSecondary, fontSize: 15, lineHeight: 22, fontWeight: '600' }, 
  avatar: { alignSelf: 'center', height: 128, width: 128, borderRadius: 64, marginVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accent }, 
  camera: { position: 'absolute', bottom: 2, right: 2, height: 36, width: 36, borderRadius: 18, borderWidth: 3, borderColor: FixGoColors.background, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, 
  inputArea: { gap: 8, marginBottom: 12 }, 
  label: { color: FixGoColors.text, fontSize: 13, fontWeight: '800', marginTop: 8 }, 
  input: { height: 56, paddingHorizontal: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, color: FixGoColors.text, fontSize: 16, fontWeight: '600' }, 
  inputError: { borderColor: '#C44E4E' }, 
  error: { color: '#B54747', fontSize: 12, fontWeight: '700' }, 
  primary: { minHeight: 54, borderRadius: Radius.medium, marginTop: 8, backgroundColor: FixGoColors.primary, justifyContent: 'center', alignItems: 'center' }, 
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' } 
});
