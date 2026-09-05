import { Pressable, StyleSheet, View } from 'react-native';
import { FixGoColors } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
export function SectionHeader({ title, action }: { title: string; action?: string }) { return <View style={styles.container}><ThemedText style={styles.title}>{title}</ThemedText>{action ? <Pressable accessibilityRole="button" accessibilityLabel={action}><ThemedText style={styles.action}>{action}</ThemedText></Pressable> : null}</View>; }
const styles = StyleSheet.create({ container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: FixGoColors.text, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.3 }, action: { color: FixGoColors.primary, fontSize: 14, lineHeight: 20, fontWeight: '800' } });
