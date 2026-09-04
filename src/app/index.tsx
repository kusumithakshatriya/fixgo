import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} accessibilityElementsHidden>
            <View style={styles.brandRoof} />
            <View style={styles.brandDoor} />
          </View>
          <ThemedText style={styles.brandText}>FixGo</ThemedText>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.eyebrow}>
            <ThemedText style={styles.eyebrowText}>HOME REPAIRS, ON YOUR TERMS</ThemedText>
          </View>
          <ThemedText style={styles.title}>Home Repairs,{"\n"}Made Simple</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.supportingText}>
            Find trusted technicians, compare prices, and stay in control of your repair.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue as a customer"
            onPress={() => router.replace('/customer-home' as Href)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>I'm a Customer</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue as a technician"
            onPress={() => router.push('/technician' as Href)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryButtonText}>I'm a Technician</ThemedText>
          </Pressable>
        </View>

        <ThemedText themeColor="textSecondary" style={styles.footer}>
          Compare. Choose. Track. Repair.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1769AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRoof: { width: 18, height: 12, backgroundColor: '#FFFFFF', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  brandDoor: { width: 7, height: 9, backgroundColor: '#1769AA', marginTop: -9, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  brandText: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  heroSection: {
    justifyContent: 'center',
    flex: 1,
    gap: Spacing.three,
  },
  eyebrow: { alignSelf: 'flex-start', backgroundColor: '#E7F2FB', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  eyebrowText: { color: '#1769AA', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  title: { fontSize: 42, lineHeight: 48, fontWeight: '800', letterSpacing: -1.4 },
  supportingText: { fontSize: 18, lineHeight: 27, maxWidth: 440 },
  actions: { gap: Spacing.two },
  primaryButton: { backgroundColor: '#1769AA', minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#B8C8D6', minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  secondaryButtonText: { color: '#1769AA', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  footer: { textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: Spacing.four },
});
