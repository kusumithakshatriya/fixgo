import { router, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixGoBottomNav } from '@/components/fixgo/fixgo-bottom-nav';
import { FixGoHeader } from '@/components/fixgo/fixgo-header';
import { SearchBar } from '@/components/fixgo/search-bar';
import { SectionHeader } from '@/components/fixgo/section-header';
import { ServiceCard } from '@/components/fixgo/service-card';
import { VerifiedPartnerCard } from '@/components/fixgo/verified-partner-card';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

type Service = { label: string; requestService: 'AC Repair' | 'Electrical' | 'Plumbing' | 'Appliance Repair' | 'Other'; icon: SymbolViewProps['name'] };
const services: Service[] = [
  { label: 'Electrician', requestService: 'Electrical', icon: 'bolt.fill' },
  { label: 'Plumber', requestService: 'Plumbing', icon: 'drop.fill' },
  { label: 'AC Repair', requestService: 'AC Repair', icon: 'fan.fill' },
  { label: 'Plumber + AC', requestService: 'Other', icon: 'wrench.and.screwdriver.fill' },
  { label: 'Electrician + AC', requestService: 'Other', icon: 'bolt.circle.fill' },
  { label: 'Electrician + Plumber', requestService: 'Other', icon: 'wrench.and.screwdriver.fill' },
];

export default function CustomerHomeScreen() {
  const requestService = (service: Service) => router.push({ pathname: '/repair-request', params: { service: service.requestService } } as Href);
  return <View style={styles.page}><SafeAreaView edges={['top']} style={styles.safeArea}><FixGoHeader /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.locationRow}><View style={styles.avatar}><ThemedText style={styles.avatarText}>R</ThemedText></View><View style={styles.locationCopy}><ThemedText style={styles.greeting}>Hi, Rahul</ThemedText><View style={styles.locationLine}><SymbolView name="location.fill" size={13} tintColor={FixGoColors.success} /><ThemedText style={styles.location}>Connaught Place, New Delhi</ThemedText></View></View><View style={styles.notification}><SymbolView name="bell" size={21} tintColor={FixGoColors.primary} /></View></View>
    <SearchBar />
    <View style={styles.hero}><View style={styles.heroCopy}><View style={styles.badge}><SymbolView name="bolt.fill" size={13} tintColor={FixGoColors.accent} /><ThemedText style={styles.badgeText}>INSTANT DISPATCH</ThemedText></View><ThemedText style={styles.heroTitle}>Expert help at{'\n'}your doorstep</ThemedText><ThemedText style={styles.heroSubtitle}>Vetted professionals ready in 30 minutes.</ThemedText></View><View style={styles.heroVisual}><SymbolView name="wrench.and.screwdriver.fill" size={47} tintColor={FixGoColors.accent} /></View></View>
    <SectionHeader title="Popular Services" action="Show less" />
    <View style={styles.grid}>{services.map((service) => <ServiceCard key={service.label} label={service.label} icon={service.icon} onPress={() => requestService(service)} />)}</View>
    <VerifiedPartnerCard />
  </ScrollView></SafeAreaView><FixGoBottomNav active="home" /></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, content: { padding: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, avatarText: { color: FixGoColors.card, fontSize: 18, fontWeight: '900' }, locationCopy: { flex: 1, gap: 3 }, greeting: { color: FixGoColors.text, fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.3 }, locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5 }, location: { color: FixGoColors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 }, notification: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, borderColor: FixGoColors.border, borderWidth: 1, backgroundColor: FixGoColors.card },
  hero: { minHeight: 188, overflow: 'hidden', borderRadius: Radius.large, backgroundColor: FixGoColors.primary, padding: Spacing.three, flexDirection: 'row', alignItems: 'center' }, heroCopy: { flex: 1, gap: 10, zIndex: 1 }, badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, backgroundColor: '#1E575E', paddingHorizontal: 9, paddingVertical: 6 }, badgeText: { color: FixGoColors.accent, fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7 }, heroTitle: { color: FixGoColors.card, fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.7 }, heroSubtitle: { maxWidth: 210, color: '#C5DEE0', fontSize: 13, lineHeight: 19, fontWeight: '600' }, heroVisual: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#1B555B', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }] }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
