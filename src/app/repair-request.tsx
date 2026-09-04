import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function RepairRequestScreen() {
  return (
    <ThemedView style={styles.page}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backText}>‹ Back</ThemedText>
        </Pressable>
        <View style={styles.content}>
          <View style={styles.icon}><ThemedText style={styles.iconText}>+</ThemedText></View>
          <ThemedText style={styles.title}>Repair Request</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>This is where customers will describe their problem.</ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth, padding: Spacing.four },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 }, backText: { color: '#1769AA', fontSize: 16, fontWeight: '800' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.six },
  icon: { height: 76, width: 76, borderRadius: 24, backgroundColor: '#E7F2FB', alignItems: 'center', justifyContent: 'center' }, iconText: { color: '#1769AA', fontSize: 40, lineHeight: 44, fontWeight: '400' },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '800' }, description: { fontSize: 17, lineHeight: 26, textAlign: 'center', maxWidth: 300 },
});
