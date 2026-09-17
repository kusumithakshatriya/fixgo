import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchPartnerBookingById, processTechnicianOffer, PartnerJob } from '@/services/supabase';

export default function IncomingJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<PartnerJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        if (!id) return;
        const found = await fetchPartnerBookingById(id);
        if (found) {
          setJob(found);
          
          if (found.offerExpiresAt) {
            const expiry = new Date(found.offerExpiresAt).getTime();
            const now = new Date().getTime();
            const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
            setTimeLeft(remaining);
            
            if (remaining === 0 && found.status === 'Technician Assigned') {
              handleAction('expire');
            }
          } else {
            // Fallback 60s if no DB expiry
            setTimeLeft(60);
          }
        } else {
          Alert.alert('Error', 'Job not found');
          router.back();
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    };
    loadJobDetails();
  }, [id]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isProcessing) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleAction('expire');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isProcessing]);

  const handleAction = async (action: 'accept' | 'reject' | 'expire') => {
    if (!job) return;
    setIsProcessing(true);
    try {
      await processTechnicianOffer(job.id, action);
      if (action === 'accept') {
        router.replace({ pathname: '/(partner)/active-job' as any, params: { id: job.id } });
      } else {
        router.back();
      }
    } catch (e: any) {
      if (action !== 'expire') {
        Alert.alert('Error', e.message || 'Could not update status');
      } else {
        router.back(); // quietly close on expire
      }
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
          <View style={styles.timerContainer}>
            <SymbolView name="clock.fill" size={14} tintColor={FixGoColors.warning} />
            <ThemedText style={styles.timerText}>{timeLeft !== null ? `00:${timeLeft.toString().padStart(2, '0')}` : '00:00'}</ThemedText>
          </View>
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
              <ThemedText style={styles.priceEst}>Est. Rs.1299</ThemedText>
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
            onPress={() => handleAction('reject')}
            disabled={isProcessing}
          >
            <ThemedText style={styles.rejectText}>Decline</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.acceptBtn, isProcessing && { opacity: 0.5 }]} 
            onPress={() => handleAction('accept')}
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
  timerContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF5E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  timerText: { color: FixGoColors.warning, fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  
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
