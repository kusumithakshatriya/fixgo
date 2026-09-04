import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const technicians = [
  { name: 'Rajesh Kumar', service: 'AC Repair', rating: '4.8', experience: '8 years experience', distance: '1.2 km away', price: '₹450 estimated', arrival: 'Arrives in 25 min' },
  { name: 'Arjun Mehta', service: 'Electrical', rating: '4.7', experience: '6 years experience', distance: '2.4 km away', price: '₹500 estimated', arrival: 'Arrives in 35 min' },
  { name: 'Vikram Shah', service: 'Plumbing', rating: '4.9', experience: '10 years experience', distance: '3.1 km away', price: '₹550 estimated', arrival: 'Arrives in 45 min' },
];

export default function TechnicianComparisonScreen() {
  return <View style={styles.page}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><ThemedText style={styles.backText}>Back</ThemedText></Pressable><ThemedText style={styles.brand}>FixGo</ThemedText></View>
    <ThemedText style={styles.title}>Compare Technicians</ThemedText><ThemedText style={styles.subtitle}>Choose the best option for your repair.</ThemedText><ThemedText style={styles.disclaimer}>Mock options for the FixGo MVP preview.</ThemedText>
    <View style={styles.list}>{technicians.map((technician) => <View key={technician.name} style={styles.card}>
      <View style={styles.cardHeader}><View style={styles.avatar}><ThemedText style={styles.avatarText}>{technician.name.split(' ').map((part) => part[0]).join('')}</ThemedText></View><View style={styles.nameBlock}><ThemedText style={styles.name}>{technician.name}</ThemedText><ThemedText style={styles.service}>{technician.service}</ThemedText></View><View style={styles.rating}><ThemedText style={styles.ratingText}>Rating {technician.rating}</ThemedText></View></View>
      <View style={styles.details}><Detail value={technician.experience} /><Detail value={technician.distance} /><Detail value={technician.arrival} /></View>
      <View style={styles.priceRow}><ThemedText style={styles.priceLabel}>Estimated price</ThemedText><ThemedText style={styles.price}>{technician.price}</ThemedText></View>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => Alert.alert('Mock quote', `Quote details for ${technician.name} will be connected next.`)} style={styles.quoteButton}><ThemedText style={styles.quoteText}>View Quote</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={() => Alert.alert('Mock selection', `${technician.name} is a preview option only.`)} style={styles.chooseButton}><ThemedText style={styles.chooseText}>Choose Technician</ThemedText></Pressable></View>
    </View>)}</View>
  </ScrollView></SafeAreaView></View>;
}

function Detail({ value }: { value: string }) { return <ThemedText style={styles.detail}>• {value}</ThemedText>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#071A2B' }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, content: { padding: Spacing.four, paddingBottom: 40, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backButton: { minHeight: 44, justifyContent: 'center', paddingRight: 12 }, backText: { color: '#72B9F2', fontSize: 16, fontWeight: '800' }, brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: 31, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8, marginTop: 12 }, subtitle: { color: '#B5C9DA', fontSize: 16, lineHeight: 23, fontWeight: '500' }, disclaimer: { color: '#88A0B5', fontSize: 12, lineHeight: 18, fontWeight: '600', marginTop: 2 }, list: { gap: 14, marginTop: 12 },
  card: { backgroundColor: '#102D43', borderRadius: 20, padding: Spacing.three, gap: 14, borderWidth: 1, borderColor: '#23435B' }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { height: 46, width: 46, borderRadius: 15, backgroundColor: '#1C5277', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, nameBlock: { flex: 1, gap: 2 }, name: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '800' }, service: { color: '#AFC4D6', fontSize: 12, lineHeight: 17, fontWeight: '600' }, rating: { borderRadius: 10, backgroundColor: '#193E51', paddingHorizontal: 8, paddingVertical: 6 }, ratingText: { color: '#FFE08A', fontSize: 10, fontWeight: '800' },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, detail: { color: '#C9DAE8', fontSize: 13, lineHeight: 18, fontWeight: '600' }, priceRow: { backgroundColor: '#0C314B', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, priceLabel: { color: '#AFC4D6', fontSize: 13, fontWeight: '700' }, price: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, actions: { flexDirection: 'row', gap: 10 }, quoteButton: { flex: 1, minHeight: 45, borderRadius: 13, borderWidth: 1, borderColor: '#4B82A7', alignItems: 'center', justifyContent: 'center' }, quoteText: { color: '#72B9F2', fontSize: 13, fontWeight: '800' }, chooseButton: { flex: 1.35, minHeight: 45, borderRadius: 13, backgroundColor: '#2188D5', alignItems: 'center', justifyContent: 'center' }, chooseText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
