import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchPartnerJobs, updateBookingStatus, PartnerJob, cancelBooking } from '@/services/supabase';

export default function IncomingJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<PartnerJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        // Fetching all and finding is inefficient for large lists, but works for MVP
        // Ideally we'd have a fetchJobById
        const jobs = await fetchPartnerJobs();
        const found = jobs.find(j => j.id === id);
        if (found) setJob(found);
        else Alert.alert('Error', 'Job not found');
      } catch (e) {
        Alert.alert('Error', 'Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) loadJobDetails();
  }, [id]);

  const handleAction = async (action: 'Accepted' | 'Rejected') => {
    if (!job) return;
    setIsProcessing(true);
    try {
      if (action === 'Accepted') {
        await updateBookingStatus(job.id, job.request.id, 'Accepted');
        router.replace({ pathname: '/(partner)/active-job' as any, params: { id: job.id } });
      } else {
        await updateBookingStatus(job.id, job.request.id, 'Rejected');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Job not found.</ThemedText>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}><ThemedText>Go Back</ThemedText></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <SymbolView name="chevron.left" size={18} tintColor={FixGoColors.primary} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Incoming Job</ThemedText>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.mapPlaceholder}>
            <SymbolView name="map.fill" size={32} tintColor={FixGoColors.primary} style={{ opacity: 0.3 }} />
            <ThemedText style={styles.mapText}>Customer Location (3.2 km away)</ThemedText>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.serviceRow}>
              <View style={styles.serviceIconWrap}>
                <SymbolView name="wrench.and.screwdriver.fill" size={20} tintColor={FixGoColors.primary} />
              </View>
              <View style={styles.serviceTextWrap}>
                <ThemedText style={styles.serviceName}>{job.request.service}</ThemedText>
                <ThemedText style={styles.serviceSub}>Home Service</ThemedText>
              </View>
              <ThemedText style={styles.priceEst}>Est. ₹299</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                <ThemedText style={styles.customerAvatarText}>{job.customer.name?.charAt(0) || 'C'}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.customerName}>{job.customer.name}</ThemedText>
                <ThemedText style={styles.customerDetail}>Customer</ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.problemSection}>
              <ThemedText style={styles.sectionLabel}>Problem Description</ThemedText>
              <ThemedText style={styles.problemText}>{job.request.description || 'No description provided.'}</ThemedText>
            </View>

            <View style={styles.problemSection}>
              <ThemedText style={styles.sectionLabel}>Preferred Timing</ThemedText>
              <ThemedText style={styles.problemText}>{job.request.preferredDate || 'Any Date'} at {job.request.preferredTime || 'Any Time'}</ThemedText>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable 
            style={[styles.rejectBtn, isProcessing && { opacity: 0.5 }]} 
            onPress={() => handleAction('Rejected')}
            disabled={isProcessing}
          >
            <ThemedText style={styles.rejectText}>Decline</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.acceptBtn, isProcessing && { opacity: 0.5 }]} 
            onPress={() => handleAction('Accepted')}
            disabled={isProcessing}
          >
            {isProcessing ? <ActivityIndicator size="small" color={FixGoColors.card} /> : <ThemedText style={styles.acceptText}>Accept Job</ThemedText>}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: FixGoColors.card, borderRadius: 20 },
  headerTitle: { color: FixGoColors.text, fontSize: 18, fontWeight: '900' },
  
  content: { padding: Spacing.four, gap: 16 },
  
  mapPlaceholder: { height: 160, backgroundColor: '#E2F7F9', borderRadius: Radius.large, justifyContent: 'center', alignItems: 'center', gap: 8 },
  mapText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800' },
  
  detailsCard: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.four, shadowColor: FixGoColors.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  serviceRow: { flexDirection: 'row', alignItems: 'center' },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: FixGoColors.accentSurface, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  serviceTextWrap: { flex: 1 },
  serviceName: { color: FixGoColors.text, fontSize: 18, fontWeight: '900' },
  serviceSub: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600' },
  priceEst: { color: FixGoColors.primary, fontSize: 16, fontWeight: '900' },
  
  divider: { height: 1, backgroundColor: FixGoColors.border, marginVertical: 16 },
  
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E4ECEC', justifyContent: 'center', alignItems: 'center' },
  customerAvatarText: { color: FixGoColors.primary, fontSize: 16, fontWeight: '900' },
  customerName: { color: FixGoColors.text, fontSize: 16, fontWeight: '800' },
  customerDetail: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '600' },
  
  problemSection: { marginBottom: 16 },
  sectionLabel: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  problemText: { color: FixGoColors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  
  footer: { flexDirection: 'row', padding: Spacing.four, gap: 12, backgroundColor: FixGoColors.card, borderTopWidth: 1, borderColor: FixGoColors.border },
  rejectBtn: { flex: 1, height: 54, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border, justifyContent: 'center', alignItems: 'center' },
  rejectText: { color: FixGoColors.textSecondary, fontSize: 15, fontWeight: '800' },
  acceptBtn: { flex: 2, height: 54, borderRadius: Radius.medium, backgroundColor: FixGoColors.primary, justifyContent: 'center', alignItems: 'center' },
  acceptText: { color: FixGoColors.card, fontSize: 15, fontWeight: '900' }
});
