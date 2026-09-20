import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchPartnerDashboardData, PartnerDashboardData, fetchTechnicianDocuments } from '@/services/supabase';

export default function PartnerAccountSetupScreen() {
  const [data, setData] = useState<PartnerDashboardData | null>(null);

  const [isLoading, setIsLoading] = useState(true);

    const [hasIdProof, setHasIdProof] = useState(false);
  const [hasSkillCert, setHasSkillCert] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const dashboardData = await fetchPartnerDashboardData();
      setData(dashboardData);
      const docs = await fetchTechnicianDocuments();
      setHasIdProof(docs.some(d => d.document_type === 'id_proof'));
      setHasSkillCert(docs.some(d => d.document_type === 'skill_certificate'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  const hasName = !!data?.name && data.name !== 'Technician';
  const hasSkills = data?.totalJobs !== undefined; // If profile is fully initialized
  const hasBasicInfo = hasName;
  const hasDocuments = hasIdProof && hasSkillCert;
  const isVerified = data?.verification_status === 'verified';
  const isPending = data?.verification_status === 'pending';
  const isRejected = data?.verification_status === 'rejected';

  let completedSteps = 0;
  if (hasBasicInfo) completedSteps++;
  if (hasDocuments) completedSteps++;
  if (isVerified || isPending) completedSteps++;

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
          <Pressable onPress={() => router.replace('/(partner)/(tabs)/home' as any)} style={styles.backBtn}>
            <SymbolView name="chevron.left" size={24} tintColor={FixGoColors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={styles.title}>Account Setup</ThemedText>

          {isRejected ? (
            <ThemedText style={[styles.subtitle, { color: FixGoColors.error }]}>Your verification was rejected. Please review and update your documents.</ThemedText>
          ) : isPending ? (
            <ThemedText style={styles.subtitle}>Your profile is under review by our team. Please check back later.</ThemedText>
          ) : (
            <ThemedText style={styles.subtitle}>Complete these steps to activate your technician profile.</ThemedText>
          )}

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(completedSteps / 3) * 100}%` }]} />
            </View>
            <ThemedText style={styles.progressText}>{completedSteps} of 3 completed</ThemedText>
          </View>

          <View style={styles.stepsList}>
            <StepCard
              title="Basic Information"
              desc="Name, contact details, and skills"
              icon="person.fill"
              isCompleted={hasBasicInfo}
              href="/(partner)/onboarding/basic-information"
            />
            <StepCard
              title="Document Verification"
              desc="ID proof and certificates"
              icon="doc.text.fill"
              isCompleted={hasDocuments && !isRejected}
              href="/(partner)/onboarding/document-verification"
            />
            <StepCard
              title="Payment Methods"
              desc="Bank account for payouts (Optional for now)"
              icon="indianrupeesign.square.fill"
              isCompleted={false}
              href="/(partner)/onboarding/payment-methods"
            />
          </View>

          {isRejected && data?.rejection_reason && (
            <View style={[styles.supportCard, { borderColor: FixGoColors.error, backgroundColor: '#FFF5F5' }]}>
              <SymbolView name="exclamationmark.triangle.fill" size={24} tintColor={FixGoColors.error} />
              <View style={styles.supportContent}>
                <ThemedText style={[styles.supportTitle, { color: FixGoColors.error }]}>Rejection Reason</ThemedText>
                <ThemedText style={[styles.supportDesc, { color: FixGoColors.error }]}>{data.rejection_reason}</ThemedText>
              </View>
            </View>
          )}

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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
