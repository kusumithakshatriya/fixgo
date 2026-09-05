import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export function FixGoHeader() { return <View style={styles.header}><View style={styles.brand}><View style={styles.logoMark}><SymbolView name="wrench.and.screwdriver.fill" size={19} tintColor={FixGoColors.primary} /></View><ThemedText style={styles.brandText}>FixGo</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={8} onPress={() => router.push('/profile' as Href)} style={styles.profileButton}><SymbolView name="person.fill" size={18} tintColor={FixGoColors.primary} /></Pressable></View>; }
const styles = StyleSheet.create({ header: { backgroundColor: FixGoColors.card, borderBottomWidth: 1, borderBottomColor: FixGoColors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: 14 }, brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }, logoMark: { width: 36, height: 36, borderRadius: Radius.small, backgroundColor: FixGoColors.accent, alignItems: 'center', justifyContent: 'center' }, brandText: { color: FixGoColors.primary, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5 }, profileButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accentSurface } });
