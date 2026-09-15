import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchPartnerDashboardData, fetchUnreadNotificationCount, subscribeToNotifications, togglePartnerOnlineStatus, PartnerDashboardData } from '@/services/supabase';

export default function PartnerHomeScreen() {
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

  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    try {
      await togglePartnerOnlineStatus(value);
    } catch (e) {
      setIsOnline(!value);
      Alert.alert('Error', 'Failed to update online status');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  const hasPendingJobs = (data?.activeJobsCount ?? 0) > 0;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarText}>{data?.name?.charAt(0)?.toUpperCase() || 'T'}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.greeting}>Hi, {data?.name || 'Partner'}</ThemedText>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? FixGoColors.success : FixGoColors.textSecondary }]} />
                  <ThemedText style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</ThemedText>
                </View>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Switch
                value={isOnline}
                onValueChange={handleToggleOnline}
                trackColor={{ false: '#E4ECEC', true: '#B4E5D3' }}
                thumbColor={isOnline ? FixGoColors.success : '#A1B1B3'}
              />
              <Pressable onPress={() => router.push('/(partner)/notifications' as any)} style={styles.notificationBtn}>
                <SymbolView name="bell.fill" size={20} tintColor={FixGoColors.primary} />
                  {unreadCount > 0 && <View style={styles.badge}><ThemedText style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</ThemedText></View>}
                </Pressable>
            </View>
          </View>

          {/* Pending Jobs Area */}
          {hasPendingJobs && data && (
            <Pressable style={styles.pendingCard} onPress={() => router.push('/(partner)/(tabs)/orders' as any)}>
              <View style={styles.pendingHeader}>
                <View style={styles.pendingBadge}>
                  <SymbolView name="circle.fill" size={8} tintColor={FixGoColors.card} />
                  <ThemedText style={styles.pendingBadgeText}>NEW REQUESTS</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.pendingTitle}>You have {data.activeJobsCount} active job{data.activeJobsCount > 1 ? 's' : ''}</ThemedText>
              <View style={styles.pendingAction}>
                <ThemedText style={styles.pendingActionText}>View Details</ThemedText>
                <SymbolView name="arrow.right" size={14} tintColor={FixGoColors.card} />
              </View>
            </Pressable>
          )}

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <SymbolView name="briefcase.fill" size={20} tintColor={FixGoColors.primary} />
              </View>
              <ThemedText style={styles.statValue}>{data?.todaysJobsCount || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Today's Jobs</ThemedText>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <SymbolView name="indianrupeesign.circle.fill" size={20} tintColor={FixGoColors.primary} />
              </View>
              <ThemedText style={styles.statValue}>â‚¹{data?.todaysEarnings || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Today's Earnings</ThemedText>
            </View>
          </View>

          {/* Live Radar Placeholder */}
          <View style={styles.radarSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Live Radar</ThemedText>
              <SymbolView name="location.fill" size={16} tintColor={FixGoColors.primary} />
            </View>
            <View style={styles.radarCard}>
              <View style={styles.radarMap}>
                {/* Visual placeholder for map */}
                <View style={styles.radarCircle1}>
                  <View style={styles.radarCircle2}>
                    <View style={styles.radarCircle3}>
                      <View style={styles.radarPin}>
                        <SymbolView name="mappin.circle.fill" size={24} tintColor={FixGoColors.primary} />
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.radarOverlay}>
                  <ThemedText style={styles.radarOverlayText}>Service Area Active</ThemedText>
                </View>
              </View>
              <View style={styles.radarFooter}>
                <ThemedText style={styles.radarFooterText}>Waiting for nearby requests...</ThemedText>
              </View>
            </View>
          </View>
          
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
});

