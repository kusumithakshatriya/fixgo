import { router, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { FixGoColors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type Tab = { label: string; route: string; icon: SymbolViewProps['name']; key: string };
const tabs: Tab[] = [
  { key: 'home', label: 'Home', route: '/customer-home', icon: 'house.fill' },
  { key: 'bookings', label: 'Bookings', route: '/bookings', icon: 'calendar' },
  { key: 'offers', label: 'Offers', route: '/offers', icon: 'wallet.pass.fill' },
  { key: 'profile', label: 'Profile', route: '/profile', icon: 'person.fill' },
];
export function FixGoBottomNav({ active }: { active: string }) { return <View style={styles.bar}>{tabs.map((tab) => { const selected = tab.key === active; return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} onPress={() => !selected && router.replace(tab.route as Href)} style={styles.tab}><SymbolView name={tab.icon} size={21} tintColor={selected ? FixGoColors.primary : FixGoColors.textSecondary} /><ThemedText style={[styles.label, selected && styles.selected]}>{tab.label}</ThemedText></Pressable>; })}</View>; }
const styles = StyleSheet.create({ bar: { borderTopWidth: 1, borderColor: FixGoColors.border, backgroundColor: FixGoColors.card, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingBottom: 12, shadowColor: FixGoColors.shadow, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 8 }, tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3 }, label: { color: FixGoColors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: '700' }, selected: { color: FixGoColors.primary, fontWeight: '900' } });
