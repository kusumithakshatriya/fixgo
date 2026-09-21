import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, FileText, ChevronRight, Circle, BriefcaseBusiness, IndianRupee, Star, ChartNoAxesColumn, MapPin, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import { getServiceIcon } from '@/lib/service-icons';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchPartnerDashboardData, fetchUnreadNotificationCount, subscribeToNotifications, togglePartnerOnlineStatus, PartnerDashboardData } from '@/services/supabase';
import { useDemo } from '@/context/demo-flow-context';

export default function PartnerHomeScreen() {
  const { hasDemoBooking, demoBookingStatus } = useDemo();
  const [unreadCount, setUnreadCount] = useState(0);
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const dashboardData = await fetchPartnerDashboardData();
      setData(dashboardData);
      setIsOnline(dashboardData?.isOnline || false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [isToggling, setIsToggling] = useState(false);

  const handleToggleOnline = async (value: boolean) => {
    if (isToggling) return;
    if (data?.verification_status !== 'verified' && !hasDemoBooking) {
      Alert.alert('Verification Required', 'You must complete verification before going online.');
      return;
    }

    setIsToggling(true);
    // Optimistic update
    setIsOnline(value);
    try {
      if (data?.verification_status === 'verified') {
        await togglePartnerOnlineStatus(value);
      }
    } catch (e) {
      // Revert on failure
      setIsOnline(!value);
      Alert.alert('Error', 'Failed to update online status. Please check your connection.');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  const isDemo = hasDemoBooking;
  const isVerified = isDemo || data?.verification_status === 'verified';
  const vStatus = isDemo ? 'verified' : (data?.verification_status || 'incomplete');
  
  const displayData = {
    name: isDemo ? 'Ravi Kumar' : data?.name,
    activeJobsCount: isDemo && demoBookingStatus !== 'Completed' ? (data?.activeJobsCount || 0) + 1 : data?.activeJobsCount,
    todaysEarnings: isDemo ? 1250 : data?.todaysEarnings,
    todaysJobsCount: isDemo ? 2 : data?.todaysJobsCount,
    rating: isDemo ? 4.8 : data?.rating,
    totalJobs: isDemo ? 420 : data?.totalJobs,
    rejection_reason: data?.rejection_reason
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarText}>{displayData.name?.charAt(0) || 'T'}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.greeting}>Hi, {displayData.name?.split(' ')[0] || 'Technician'}!</ThemedText>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: isVerified ? (isOnline ? FixGoColors.success : FixGoColors.textSecondary) : FixGoColors.warning }]} />
                  <ThemedText style={styles.statusText}>{isVerified ? (isOnline ? 'Online' : 'Offline') : 'Action Required'}</ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.notificationBtn} onPress={() => router.push('/(partner)/notifications' as any)}>
                <Bell size={20} color={FixGoColors.primary} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</ThemedText>
                  </View>
                )}
              </Pressable>
              {isVerified && (
                <Switch
                  value={isOnline}
                  onValueChange={handleToggleOnline}
                  trackColor={{ false: '#E4ECEC', true: '#E8F5E9' }}
                  thumbColor={isOnline ? FixGoColors.success : '#F3F7F7'}
                disabled={isToggling}
                />
              )}
            </View>
          </View>

          {/* VERIFICATION GATE CARD */}
          {!isVerified && (
            <Pressable
              style={[
                styles.pendingCard,
                { backgroundColor: vStatus === 'rejected' ? FixGoColors.error : vStatus === 'pending' ? FixGoColors.warning : FixGoColors.primary }
              ]}
              onPress={() => router.push('/(partner)/onboarding/account-setup' as any)}
            >
              <View style={styles.pendingHeader}>
                <View style={styles.pendingBadge}>
                  <FileText size={10} color={FixGoColors.card} />
                  <ThemedText style={styles.pendingBadgeText}>
                    {vStatus === 'pending' ? 'UNDER REVIEW' : vStatus === 'rejected' ? 'ACTION NEEDED' : 'SETUP REQUIRED'}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.pendingTitle}>
                {vStatus === 'pending' ? 'Your verification is under review' :
                 vStatus === 'rejected' ? 'Verification needs attention' :
                 'Complete verification to start receiving jobs'}
              </ThemedText>

              {vStatus === 'rejected' && displayData.rejection_reason && (
                 <ThemedText style={{color: FixGoColors.card, opacity: 0.9, fontSize: 13, marginTop: 4}}>
                   Reason: {displayData.rejection_reason}
                 </ThemedText>
              )}

              <View style={styles.pendingAction}>
                <ThemedText style={styles.pendingActionText}>{vStatus === 'pending' ? 'Check Status' : vStatus === 'rejected' ? 'Fix Issues' : 'Complete Setup'}</ThemedText>
                <ChevronRight size={14} color={FixGoColors.card} />
              </View>
            </Pressable>
          )}

          {/* Pending Job Card (Only if verified) */}
          {isVerified && displayData.activeJobsCount !== undefined && displayData.activeJobsCount > 0 && (
            <Pressable style={styles.pendingCard} onPress={() => router.push('/(partner)/(tabs)/orders' as any)}>
              <View style={styles.pendingHeader}>
                <View style={styles.pendingBadge}>
                  <Circle size={8} color={FixGoColors.card} />
                  <ThemedText style={styles.pendingBadgeText}>ACTIVE JOBS</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.pendingTitle}>You have {displayData.activeJobsCount} active job{displayData.activeJobsCount > 1 ? 's' : ''}</ThemedText>
              <View style={styles.pendingAction}>
                <ThemedText style={styles.pendingActionText}>View Details</ThemedText>
                <ChevronRight size={14} color={FixGoColors.card} />
              </View>
            </Pressable>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <BriefcaseBusiness size={20} color={FixGoColors.primary} />
              </View>
              <ThemedText style={styles.statValue}>{displayData.todaysJobsCount || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Today's Jobs</ThemedText>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <IndianRupee size={20} color={FixGoColors.primary} />
              </View>
              <ThemedText style={styles.statValue}>₹{displayData.todaysEarnings || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Today's Earnings</ThemedText>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Star size={20} color={FixGoColors.primary} />
              </View>
              <ThemedText style={styles.statValue}>{displayData.rating?.toFixed(1) || '0.0'}</ThemedText>
              <ThemedText style={styles.statLabel}>Rating</ThemedText>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <ChartNoAxesColumn size={20} color={FixGoColors.primary} />
              </View>
              <ThemedText style={styles.statValue}>{displayData.totalJobs || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Jobs</ThemedText>
            </View>
          </View>

          {isDemo ? (
            <View style={styles.radarSection}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Today's Jobs</ThemedText>
                <BriefcaseBusiness size={16} color={FixGoColors.primary} />
              </View>
              
              <View style={styles.demoJobsContainer}>
                {[
                  { id: 'job-1', name: 'Kavya Reddy', service: 'AC Repair', time: '10:00 AM', status: 'Completed', amount: 450 },
                  { id: 'job-2', name: 'Rahul Kumar', service: 'Washing Machine Repair', time: '01:30 PM', status: 'Completed', amount: 800 },
                  { id: 'job-3', name: 'Priya Sharma', service: 'Plumbing', time: '04:00 PM', status: 'Assigned', amount: 250 }
                ].map((job) => (
                  <Pressable key={job.id} style={styles.demoJobCard} onPress={() => {}}>
                    <View style={styles.demoJobHeader}>
                      <View style={styles.demoJobServiceRow}>
                        {getServiceIcon(job.service, { size: 16, color: FixGoColors.primary })}
                        <ThemedText style={styles.demoJobService}>{job.service}</ThemedText>
                      </View>
                      <View style={[styles.demoStatusBadge, job.status === 'Completed' && { backgroundColor: FixGoColors.card, borderColor: FixGoColors.border, borderWidth: 1 }]}>
                        <ThemedText style={[styles.demoStatusText, job.status === 'Completed' && { color: FixGoColors.textSecondary }]}>{job.status}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.demoJobDetails}>
                      <View style={styles.demoDetailRow}>
                        <MapPin size={12} color={FixGoColors.textSecondary} />
                        <ThemedText style={styles.demoDetailText}>{job.name}</ThemedText>
                      </View>
                      <View style={styles.demoDetailRow}>
                        <Circle size={4} color={FixGoColors.border} style={{ marginHorizontal: 4 }} />
                        <ThemedText style={styles.demoDetailText}>{job.time}</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.radarSection}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Live Radar</ThemedText>
                <MapPin size={16} color={FixGoColors.primary} />
              </View>
              <View style={styles.radarCard}>
                <View style={[styles.radarMap, !isVerified && { opacity: 0.5 }]}>
                  {/* Visual placeholder for map */}
                  <View style={styles.radarCircle1}>
                    <View style={styles.radarCircle2}>
                      <View style={styles.radarCircle3}>
                        <View style={styles.radarPin}>
                          <MapPin size={24} color={FixGoColors.primary} />
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.radarOverlay}>
                    <ThemedText style={[styles.radarOverlayText, !isVerified && { color: FixGoColors.textSecondary }]}>
                      {isVerified ? 'Service Area Active' : 'Radar Offline'}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.radarFooter}>
                  <ThemedText style={styles.radarFooterText}>
                    {isVerified ? (isOnline ? 'Waiting for nearby requests...' : 'You are currently offline') : 'Complete verification to activate radar'}
                  </ThemedText>
                </View>
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, paddingBottom: 100, gap: 24 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: FixGoColors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: FixGoColors.card, fontSize: 18, fontWeight: '900' },
  greeting: { color: FixGoColors.text, fontSize: 20, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#E33A3A', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: FixGoColors.card },
  badgeText: { color: FixGoColors.card, fontSize: 10, fontWeight: 'bold' },
  notificationBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: FixGoColors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: FixGoColors.border },

  pendingCard: { backgroundColor: FixGoColors.primary, borderRadius: Radius.large, padding: Spacing.four, gap: 12, shadowColor: FixGoColors.shadow, shadowOpacity: 0.15, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  pendingBadgeText: { color: FixGoColors.card, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pendingTitle: { color: FixGoColors.card, fontSize: 22, fontWeight: '900' },
  pendingAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  pendingActionText: { color: FixGoColors.card, fontSize: 14, fontWeight: '800' },

  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: FixGoColors.card, borderRadius: Radius.medium, padding: Spacing.three, borderWidth: 1, borderColor: FixGoColors.border, shadowColor: FixGoColors.shadow, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: FixGoColors.accentSurface, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { color: FixGoColors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4 },

  radarSection: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: FixGoColors.text, fontSize: 18, fontWeight: '900' },
  radarCard: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, overflow: 'hidden', borderWidth: 1, borderColor: FixGoColors.border },
  radarMap: { height: 180, backgroundColor: '#E2F7F9', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  radarCircle1: { width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(18,58,64,0.03)', justifyContent: 'center', alignItems: 'center' },
  radarCircle2: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(18,58,64,0.06)', justifyContent: 'center', alignItems: 'center' },
  radarCircle3: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(18,58,64,0.1)', justifyContent: 'center', alignItems: 'center' },
  radarPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: FixGoColors.card, justifyContent: 'center', alignItems: 'center', shadowColor: FixGoColors.shadow, shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  radarOverlay: { position: 'absolute', top: 12, left: 12, backgroundColor: FixGoColors.card, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, shadowColor: FixGoColors.shadow, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  radarOverlayText: { color: FixGoColors.primary, fontSize: 11, fontWeight: '800' },
  radarFooter: { padding: Spacing.three, borderTopWidth: 1, borderColor: FixGoColors.border, backgroundColor: '#FAFAFA' },
  radarFooterText: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  demoJobsContainer: { gap: 12 },
  demoJobCard: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.three, borderWidth: 1, borderColor: FixGoColors.border, shadowColor: FixGoColors.shadow, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, gap: 12 },
  demoJobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  demoJobServiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  demoJobService: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' },
  demoStatusBadge: { backgroundColor: '#E4F4F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  demoStatusText: { color: FixGoColors.primary, fontSize: 11, fontWeight: '800' },
  demoJobDetails: { flexDirection: 'row', alignItems: 'center', backgroundColor: FixGoColors.accentSurface, padding: 10, borderRadius: Radius.medium, gap: 8 },
  demoDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  demoDetailText: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '700' }
});
