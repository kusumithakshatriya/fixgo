import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
export function VerifiedPartnerCard() { return <View style={styles.card}><View style={styles.icon}><SymbolView name="checkmark.shield.fill" size={24} tintColor={FixGoColors.success} /></View><View style={styles.copy}><ThemedText style={styles.title}>100% Verified Partners</ThemedText><ThemedText style={styles.subtitle}>Background checked & trained experts</ThemedText></View></View>; }
const styles = StyleSheet.create({ card: { backgroundColor: '#EFF9F5', borderColor: '#CFEADD', borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three, minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { height: 44, width: 44, borderRadius: Radius.small, backgroundColor: '#DDF4E9', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, gap: 2 }, title: { color: FixGoColors.text, fontSize: 15, lineHeight: 20, fontWeight: '800' }, subtitle: { color: FixGoColors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '600' } });
