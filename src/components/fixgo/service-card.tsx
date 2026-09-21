import { Pressable, StyleSheet, View } from 'react-native';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { getServiceIcon } from '@/lib/service-icons';

type ServiceCardProps = { label: string; icon?: any; materialIcon?: any; onPress: () => void };
export function ServiceCard({ label, onPress }: ServiceCardProps) { return <Pressable accessibilityRole="button" accessibilityLabel={`Request ${label}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.icon}>{getServiceIcon(label, { size: 24, color: FixGoColors.primary })}</View><ThemedText style={styles.label}>{label}</ThemedText></Pressable>; }
const styles = StyleSheet.create({ card: { flexGrow: 1, flexBasis: '45%', minHeight: 132, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, padding: Spacing.three, justifyContent: 'space-between', shadowColor: FixGoColors.shadow, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: FixGoColors.accent, alignItems: 'center', justifyContent: 'center' }, label: { color: FixGoColors.text, fontSize: 15, lineHeight: 20, fontWeight: '800' }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] } });
