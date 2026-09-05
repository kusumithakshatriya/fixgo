import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixGoBottomNav } from '@/components/fixgo/fixgo-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Spacing } from '@/constants/theme';
export default function BookingsScreen() { return <View style={styles.page}><SafeAreaView style={styles.content}><ThemedText style={styles.title}>Your Bookings</ThemedText><ThemedText style={styles.copy}>Your repair bookings will appear here.</ThemedText></SafeAreaView><FixGoBottomNav active="bookings" /></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: FixGoColors.background }, content: { flex: 1, padding: Spacing.four, justifyContent: 'center', alignItems: 'center', gap: 8 }, title: { color: FixGoColors.text, fontSize: 24, fontWeight: '800' }, copy: { color: FixGoColors.textSecondary, textAlign: 'center' } });
