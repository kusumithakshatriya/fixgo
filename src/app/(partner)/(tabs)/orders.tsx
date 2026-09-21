import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Calendar, IndianRupee, ChevronRight, BriefcaseBusiness } from 'lucide-react-native';
import { getServiceIcon } from '@/lib/service-icons';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchPartnerJobs, PartnerJob } from '@/services/supabase';
import { useDemo } from '@/context/demo-flow-context';

export default function PartnerOrdersScreen() {
  const { hasDemoBooking, demoBookingStatus, demoBookingDetails } = useDemo();
  const [jobs, setJobs] = useState<PartnerJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'Active' | 'Completed'>('Active');

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchPartnerJobs();
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadJobs();
  }, [loadJobs]);

  let displayJobs = [...jobs];
  if (hasDemoBooking && demoBookingDetails) {
    displayJobs = [{
      id: demoBookingDetails.requestId || 'demo-booking-id',
      request_id: demoBookingDetails.requestId || 'demo-req-id',
      status: demoBookingStatus || 'Technician Assigned',
      created_at: new Date().toISOString(),
      request: {
        service: demoBookingDetails.service || 'Demo Service',
        description: demoBookingDetails.description || 'Demo problem description',
        address: demoBookingDetails.location || 'Demo Location',
        latitude: 17.7,
        longitude: 83.3,
        preferred_time: demoBookingDetails.preferredTime || 'ASAP',
        customer: {
          name: 'Demo Customer',
          phone: '+919876543210'
        }
      }
    } as unknown as PartnerJob, ...displayJobs];
  }

  const filteredJobs = displayJobs.filter(job => {
    if (filter === 'Active') {
      return !['Completed', 'Rejected', 'Cancelled'].includes(job.status);
    } else {
      return ['Completed', 'Rejected', 'Cancelled'].includes(job.status);
    }
  });

  const renderJobCard = ({ item }: { item: PartnerJob }) => {
    const isNew = item.status === 'Technician Assigned' || item.status === 'Pending';

    return (
      <Pressable 
        style={styles.jobCard} 
        onPress={() => {
          if (isNew) {
            router.push({ pathname: '/(partner)/incoming-job' as any, params: { id: item.id } });
          } else {
            router.push({ pathname: '/(partner)/active-job' as any, params: { id: item.id } });
          }
        }}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobServiceRow}>
            {getServiceIcon(item.request.service, { size: 16, color: FixGoColors.primary })}
            <ThemedText style={styles.jobService}>{item.request.service}</ThemedText>
          </View>
          <View style={[styles.statusBadge, !isNew && { backgroundColor: FixGoColors.card, borderColor: FixGoColors.border, borderWidth: 1 }]}>
            <ThemedText style={[styles.statusText, !isNew && { color: FixGoColors.textSecondary }]}>{item.status}</ThemedText>
          </View>
        </View>

        <View style={styles.jobDetails}>
          <View style={styles.detailRow}>
            <User size={14} color={FixGoColors.textSecondary} />
            <ThemedText style={styles.detailText}>{item.customer.name}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Calendar size={14} color={FixGoColors.textSecondary} />
            <ThemedText style={styles.detailText}>{item.request.preferredDate || 'Any Date'} at {item.request.preferredTime || 'Any Time'}</ThemedText>
          </View>
          {item.payment && (
            <View style={styles.detailRow}>
              <IndianRupee size={14} color={FixGoColors.success} />
              <ThemedText style={[styles.detailText, { color: FixGoColors.success, fontWeight: '800' }]}>
                ₹{item.payment.final_amount} · {item.payment.status === 'completed' ? `Paid (${item.payment.payment_method})` : 'Awaiting Payment'}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <ThemedText style={styles.footerActionText}>{isNew ? 'Review Request' : 'View Job Details'}</ThemedText>
          <ChevronRight size={14} color={FixGoColors.primary} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Orders</ThemedText>
        </View>

        <View style={styles.filterTabs}>
          <Pressable 
            style={[styles.tab, filter === 'Active' && styles.activeTab]}
            onPress={() => setFilter('Active')}
          >
            <ThemedText style={[styles.tabText, filter === 'Active' && styles.activeTabText]}>Active</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.tab, filter === 'Completed' && styles.activeTab]}
            onPress={() => setFilter('Completed')}
          >
            <ThemedText style={[styles.tabText, filter === 'Completed' && styles.activeTabText]}>Past Jobs</ThemedText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={FixGoColors.primary} />
          </View>
        ) : filteredJobs.length > 0 ? (
          <FlatList
            data={filteredJobs}
            keyExtractor={item => item.id}
            renderItem={renderJobCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FixGoColors.primary} />}
          />
        ) : (
          <View style={styles.centerContainer}>
            <BriefcaseBusiness size={48} color={FixGoColors.border} />
            <ThemedText style={styles.emptyText}>No {filter.toLowerCase()} jobs.</ThemedText>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  header: { padding: Spacing.four, paddingBottom: Spacing.two },
  headerTitle: { color: FixGoColors.text, fontSize: 24, fontWeight: '900' },
  
  filterTabs: { flexDirection: 'row', paddingHorizontal: Spacing.four, marginBottom: Spacing.two, gap: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: '#E4ECEC' },
  activeTab: { backgroundColor: FixGoColors.primary },
  tabText: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '700' },
  activeTabText: { color: FixGoColors.card },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, gap: 12 },
  emptyText: { color: FixGoColors.textSecondary, fontSize: 15, fontWeight: '600', marginTop: 8 },
  
  listContent: { padding: Spacing.four, gap: 16, paddingBottom: 100 },
  
  jobCard: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.three, borderWidth: 1, borderColor: FixGoColors.border, shadowColor: FixGoColors.shadow, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2, gap: 12 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobServiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jobService: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' },
  statusBadge: { backgroundColor: FixGoColors.accentSurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  statusText: { color: FixGoColors.primary, fontSize: 10, fontWeight: '900' },
  
  jobDetails: { gap: 6, backgroundColor: '#F9FAFB', padding: 12, borderRadius: Radius.medium, borderWidth: 1, borderColor: '#F0F2F5' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: FixGoColors.border },
  footerActionText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800' }
});
