import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function PaymentMethodsScreen() {
  const [upi, setUpi] = useState('');

  const handleVerify = () => {
    if (!upi.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g., name@bank).');
      return;
    }
    Alert.alert('Success', 'UPI ID added successfully.');
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name="chevron.left" size={24} tintColor={FixGoColors.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Payout Setup</ThemedText>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.title}>Payment Methods</ThemedText>
          <ThemedText style={styles.subtitle}>Add a bank account or UPI ID where you want to receive your earnings.</ThemedText>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <SymbolView name="indianrupeesign.square.fill" size={20} tintColor={FixGoColors.primary} />
              <ThemedText style={styles.cardTitle}>UPI ID</ThemedText>
              <View style={styles.recommendedBadge}>
                <ThemedText style={styles.recommendedText}>Recommended</ThemedText>
              </View>
            </View>
            
            <ThemedText style={styles.label}>Enter UPI ID</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g. yourname@okbank"
              placeholderTextColor={FixGoColors.textSecondary}
              value={upi}
              onChangeText={setUpi}
              autoCapitalize="none"
            />
            
            <Pressable style={styles.verifyBtn} onPress={handleVerify}>
              <ThemedText style={styles.verifyBtnText}>Verify & Save</ThemedText>
            </Pressable>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>OR</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.bankBtn} onPress={() => Alert.alert('Coming Soon', 'Bank details entry will be available soon.')}>
            <SymbolView name="building.columns.fill" size={20} tintColor={FixGoColors.text} />
            <View style={styles.bankBtnTextWrap}>
              <ThemedText style={styles.bankBtnTitle}>Add Bank Account</ThemedText>
              <ThemedText style={styles.bankBtnSub}>IFSC & Account Number</ThemedText>
            </View>
            <SymbolView name="chevron.right" size={16} tintColor={FixGoColors.textSecondary} />
          </Pressable>

          <View style={styles.secureBox}>
            <SymbolView name="lock.fill" size={14} tintColor={FixGoColors.success} />
            <ThemedText style={styles.secureText}>Your payment details are 100% secure and encrypted.</ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth, justifyContent: 'space-between' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: FixGoColors.text },
  
  content: { paddingHorizontal: Spacing.four, marginTop: Spacing.four, gap: 16 },
  title: { fontSize: 24, fontWeight: '900', color: FixGoColors.text },
  subtitle: { fontSize: 14, fontWeight: '600', color: FixGoColors.textSecondary, lineHeight: 20 },
  
  card: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.four, borderWidth: 1, borderColor: FixGoColors.border, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: FixGoColors.text },
  recommendedBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 'auto' },
  recommendedText: { color: FixGoColors.success, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  
  label: { fontSize: 13, fontWeight: '700', color: FixGoColors.textSecondary, marginTop: 8 },
  input: { height: 50, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, paddingHorizontal: 16, fontSize: 15, fontWeight: '600', color: FixGoColors.text },
  
  verifyBtn: { backgroundColor: FixGoColors.primary, height: 50, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  verifyBtnText: { color: FixGoColors.card, fontSize: 15, fontWeight: '800' },
  
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: FixGoColors.border },
  dividerText: { marginHorizontal: 16, fontSize: 13, fontWeight: '700', color: FixGoColors.textSecondary },
  
  bankBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: FixGoColors.card, padding: Spacing.four, borderRadius: Radius.large, borderWidth: 1, borderColor: FixGoColors.border },
  bankBtnTextWrap: { flex: 1, marginLeft: 12 },
  bankBtnTitle: { fontSize: 15, fontWeight: '800', color: FixGoColors.text },
  bankBtnSub: { fontSize: 12, fontWeight: '600', color: FixGoColors.textSecondary, marginTop: 2 },
  
  secureBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  secureText: { fontSize: 12, fontWeight: '600', color: FixGoColors.success },
});
