import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FixGoBottomNav } from '@/components/fixgo/fixgo-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { getConfirmedBooking } from '@/data/customer-flow';

export default function BookingsScreen() {
  const booking = getConfirmedBooking();
  const openTracking = () => booking && router.push({ pathname: '/repair-tracking', params: { name: booking.technician.name, service: booking.request.service, price: `${booking.technician.price}`, arrival: `${booking.technician.arrival}`, location: booking.request.location } } as unknown as Href);
  return <View style={styles.page}><SafeAreaView style={styles.content}>{booking ? <><ThemedText style={styles.title}>Your Bookings</ThemedText><Pressable accessibilityRole="button" accessibilityLabel={`Track ${booking.request.service} booking`} onPress={openTracking} style={styles.bookingCard}><View style={styles.status}><ThemedText style={styles.statusText}>{booking.status}</ThemedText></View><ThemedText style={styles.service}>{booking.request.service}</ThemedText><ThemedText style={styles.technician}>{booking.technician.name} · {booking.technician.verified ? 'Verified technician' : 'Technician'}</ThemedText><View style={styles.details}><ThemedText style={styles.detail}>₹{booking.technician.price} expected</ThemedText><ThemedText style={styles.detail}>{booking.technician.arrival} min ETA</ThemedText></View><ThemedText style={styles.track}>View tracking →</ThemedText></Pressable></> : <><ThemedText style={styles.title}>Your Bookings</ThemedText><ThemedText style={styles.copy}>Your repair bookings will appear here.</ThemedText></>}</SafeAreaView><FixGoBottomNav active="bookings" /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background }, content: { flex: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center', gap: 8 }, title: { color: FixGoColors.text, fontSize: 24, fontWeight: '800' }, copy: { color: FixGoColors.textSecondary, textAlign: 'center' }, bookingCard: { width: '100%', maxWidth: 480, gap: 7, backgroundColor: FixGoColors.card, borderColor: FixGoColors.border, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three }, status: { alignSelf: 'flex-start', backgroundColor: FixGoColors.accentSurface, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 }, statusText: { color: FixGoColors.primary, fontSize: 10, fontWeight: '900' }, service: { color: FixGoColors.text, fontSize: 18, fontWeight: '800' }, technician: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600' }, details: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, detail: { color: FixGoColors.text, fontSize: 13, fontWeight: '800' }, track: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800', marginTop: 3 },
});
