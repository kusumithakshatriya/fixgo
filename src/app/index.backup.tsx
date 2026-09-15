import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixGoColors } from '@/constants/theme';

export default function SplashScreen() {
  useEffect(() => { const timer = setTimeout(() => router.replace('/otp'), 1400); return () => clearTimeout(timer); }, []);
  return <View style={styles.page}><SafeAreaView style={styles.safe}><View style={styles.grid} /><Image source={require('@/assets/images/fixgo.png')} contentFit="contain" style={styles.logo} /></SafeAreaView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: FixGoColors.primary }, safe: { flex: 1, alignItems: 'center', justifyContent: 'center' }, grid: { ...StyleSheet.absoluteFill, opacity: 0.14, borderWidth: 1, borderColor: FixGoColors.accent }, logo: { width: 220, height: 120 } });
