import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { FixGoColors, Radius, Spacing } from '@/constants/theme';

export function FixGoHeader() { return <View style={styles.header}><Image source={require('@/assets/images/fixgo.png')} contentFit="contain" style={styles.logo} /><Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={8} onPress={() => router.push('/profile' as Href)} style={styles.profileButton}><SymbolView name="person.fill" size={18} tintColor={FixGoColors.primary} /></Pressable></View>; }
const styles = StyleSheet.create({ header: { backgroundColor: FixGoColors.card, borderBottomWidth: 1, borderBottomColor: FixGoColors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: 14 }, logo: { width: 88, height: 34 }, profileButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accentSurface } });
