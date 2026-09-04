import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const services = [
  { name: 'AC Repair', icon: 'AC' },
  { name: 'Electrical', icon: 'EL' },
  { name: 'Plumbing', icon: 'PL' },
  { name: 'Appliance Repair', icon: 'AR' },
  { name: 'Other', icon: '•••' },
];

const steps = [
  'Describe your problem',
  'Compare technicians',
  'Choose the best option',
];

export default function CustomerHomeScreen() {
  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <ThemedText themeColor="textSecondary" style={styles.smallLabel}>FIXGO CUSTOMER</ThemedText>
              <ThemedText style={styles.brand}>FixGo</ThemedText>
            </View>
            <View style={styles.avatar} accessibilityLabel="Customer profile">
              <ThemedText style={styles.avatarText}>FG</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.greeting}>What needs fixing today?</ThemedText>
          <Pressable accessibilityRole="search" accessibilityLabel="What service do you need?" style={styles.searchBox}>
            <ThemedText style={styles.searchIcon}>⌕</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.searchText}>What service do you need?</ThemedText>
          </Pressable>

          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Choose a service</ThemedText>
            <ThemedText style={styles.sectionHint}>Transparent choices, upfront</ThemedText>
          </View>
          <View style={styles.categoryGrid}>
            {services.map((service) => (
              <Pressable
                key={service.name}
                accessibilityRole="button"
                accessibilityLabel={`Request ${service.name}`}
                onPress={() => router.push('/repair-request' as Href)}
                style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}>
                <View style={styles.categoryIcon}>
                  <ThemedText style={styles.categoryIconText}>{service.icon}</ThemedText>
                </View>
                <ThemedText style={styles.categoryName}>{service.name}</ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.howItWorks}>
            <View style={styles.howHeader}>
              <View style={styles.howIcon}><ThemedText style={styles.howIconText}>✓</ThemedText></View>
              <ThemedText style={styles.howTitle}>How FixGo Works</ThemedText>
            </View>
            {steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepNumber}><ThemedText style={styles.stepNumberText}>{index + 1}</ThemedText></View>
                <ThemedText style={styles.stepText}>{step}</ThemedText>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/repair-request' as Href)}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <ThemedText style={styles.ctaText}>Request a Repair</ThemedText>
            <ThemedText style={styles.ctaArrow}>→</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallLabel: { fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7 },
  brand: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  avatar: { height: 42, width: 42, borderRadius: 21, backgroundColor: '#E7F2FB', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#1769AA', fontSize: 12, fontWeight: '800' },
  greeting: { fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -0.8, marginTop: Spacing.two },
  searchBox: { minHeight: 58, borderRadius: 16, backgroundColor: '#F0F4F7', flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, gap: 12 },
  searchIcon: { color: '#1769AA', fontSize: 27, fontWeight: '700', lineHeight: 28 },
  searchText: { fontSize: 16, fontWeight: '600' },
  sectionHeader: { marginTop: Spacing.two, gap: 3 },
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '800' },
  sectionHint: { color: '#5D6B78', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '31%', minWidth: 95, flexGrow: 1, borderRadius: 16, backgroundColor: '#F7FAFC', padding: 12, minHeight: 110, justifyContent: 'space-between', borderWidth: 1, borderColor: '#E7EDF2' },
  categoryIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E7F2FB', alignItems: 'center', justifyContent: 'center' },
  categoryIconText: { color: '#1769AA', fontSize: 10, fontWeight: '800' },
  categoryName: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  howItWorks: { backgroundColor: '#102A43', borderRadius: 20, padding: Spacing.three, gap: 14, marginTop: Spacing.two },
  howHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  howIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#42C6A5', alignItems: 'center', justifyContent: 'center' },
  howIconText: { color: '#102A43', fontSize: 15, fontWeight: '900' },
  howTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 27, fontWeight: '800' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#254865', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#DDEBF5', fontSize: 12, fontWeight: '800' },
  stepText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  cta: { minHeight: 58, borderRadius: 16, backgroundColor: '#1769AA', paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  ctaArrow: { color: '#FFFFFF', fontSize: 25, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
