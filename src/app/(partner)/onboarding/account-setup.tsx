import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function PartnerAccountSetupScreen() {
  const StepCard = ({ title, desc, icon, isCompleted, href }: { title: string, desc: string, icon: any, isCompleted: boolean, href: any }) => (
    <Pressable style={styles.stepCard} onPress={() => router.push(href)}>
      <View style={[styles.iconWrap, isCompleted && styles.iconWrapCompleted]}>
        <SymbolView name={icon} size={20} tintColor={isCompleted ? FixGoColors.success : FixGoColors.primary} />
      </View>
      <View style={styles.stepContent}>
        <ThemedText style={styles.stepTitle}>{title}</ThemedText>
        <ThemedText style={styles.stepDesc}>{desc}</ThemedText>
      </View>
      <View style={[styles.statusIndicator, isCompleted && styles.statusCompleted]}>
        {isCompleted ? (
          <SymbolView name="checkmark" size={14} tintColor={FixGoColors.card} />
        ) : (
          <SymbolView name="chevron.right" size={16} tintColor={FixGoColors.textSecondary} />
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name="chevron.left" size={24} tintColor={FixGoColors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={styles.title}>Account Setup</ThemedText>
          <ThemedText style={styles.subtitle}>Complete these steps to activate your technician profile.</ThemedText>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '33%' }]} />
            </View>
            <ThemedText style={styles.progressText}>1 of 3 completed</ThemedText>
          </View>

          <View style={styles.stepsList}>
            <StepCard 
              title="Basic Information" 
              desc="Name, contact details, and skills" 
              icon="person.fill" 
              isCompleted={false} 
              href="/(partner)/onboarding/basic-information" 
            />
            <StepCard 
              title="Document Verification" 
              desc="Aadhaar and certificates" 
              icon="doc.text.fill" 
              isCompleted={false} 
              href="/(partner)/onboarding/document-verification" 
            />
            <StepCard 
              title="Payment Methods" 
              desc="Bank account for payouts" 
              icon="indianrupeesign.square.fill" 
              isCompleted={false} 
              href="/(partner)/onboarding/payment-methods" 
            />
          </View>

          <View style={styles.supportCard}>
            <SymbolView name="questionmark.circle.fill" size={24} tintColor={FixGoColors.primary} />
            <View style={styles.supportContent}>
              <ThemedText style={styles.supportTitle}>Need Help?</ThemedText>
              <ThemedText style={styles.supportDesc}>Contact our partner support team for assistance.</ThemedText>
            </View>
            <Pressable style={styles.supportBtn}>
              <ThemedText style={styles.supportBtnText}>Call</ThemedText>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable 
            style={styles.primaryBtn} 
            onPress={() => router.replace('/(partner)/(tabs)/home' as any)}
          >
            <ThemedText style={styles.primaryBtnText}>Go to Dashboard</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth, justifyContent: 'space-between' },
  
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  
  content: { paddingHorizontal: Spacing.four, marginTop: Spacing.four, gap: 16 },
  title: { fontSize: 28, fontWeight: '900', color: FixGoColors.text },
  subtitle: { fontSize: 15, fontWeight: '600', color: FixGoColors.textSecondary, lineHeight: 22 },
  
  progressContainer: { marginVertical: 12 },
  progressBar: { height: 8, backgroundColor: '#E4ECEC', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: FixGoColors.success, borderRadius: 4 },
  progressText: { fontSize: 13, fontWeight: '700', color: FixGoColors.textSecondary },
  
  stepsList: { gap: 12 },
  stepCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: FixGoColors.card, padding: Spacing.three, borderRadius: Radius.large, borderWidth: 1, borderColor: FixGoColors.border },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E2F7F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconWrapCompleted: { backgroundColor: '#E8F5E9' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '800', color: FixGoColors.text },
  stepDesc: { fontSize: 12, fontWeight: '600', color: FixGoColors.textSecondary, marginTop: 4 },
  statusIndicator: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F7F7', justifyContent: 'center', alignItems: 'center' },
  statusCompleted: { backgroundColor: FixGoColors.success },
  
  supportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: Spacing.three, borderRadius: Radius.large, marginTop: 12, borderWidth: 1, borderColor: FixGoColors.border },
  supportContent: { flex: 1, marginLeft: 12, marginRight: 12 },
  supportTitle: { fontSize: 14, fontWeight: '800', color: FixGoColors.text },
  supportDesc: { fontSize: 12, fontWeight: '600', color: FixGoColors.textSecondary, marginTop: 2 },
  supportBtn: { backgroundColor: FixGoColors.card, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: FixGoColors.border },
  supportBtnText: { color: FixGoColors.text, fontSize: 12, fontWeight: '800' },

  footer: { padding: Spacing.four },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});
