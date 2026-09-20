import { router, type Href } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixGoBottomNav } from '@/components/fixgo/fixgo-bottom-nav';

import { SearchBar } from '@/components/fixgo/search-bar';
import { SectionHeader } from '@/components/fixgo/section-header';
import { ServiceCard } from '@/components/fixgo/service-card';
import { CategoryCard } from '@/components/fixgo/category-card';
import { VerifiedPartnerCard } from '@/components/fixgo/verified-partner-card';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchActiveServices, fetchCustomerBookings, subscribeToBookingUpdates, fetchUnreadNotificationCount, subscribeToNotifications, type ServiceEntity } from '@/services/supabase';

type Service = { label: string; requestService: string; icon: SymbolViewProps['name']; materialIcon?: any; isMVP?: boolean };

const categoryMap: Record<string, { icon: SymbolViewProps['name']; materialIcon: any; isMVP: boolean; label?: string }> = {
  'AC Repair': { icon: 'snow', materialIcon: 'air-conditioner', isMVP: true },
  'Electrical': { icon: 'bolt.fill', materialIcon: 'lightning-bolt', isMVP: true },
  'Plumbing': { icon: 'drop.fill', materialIcon: 'water', isMVP: true },
  'Washing Machine': { icon: 'washer.fill', materialIcon: 'washing-machine', isMVP: false },
  'Refrigerator': { icon: 'refrigerator.fill', materialIcon: 'fridge', isMVP: false },
  'RO / Water Purifier': { label: 'RO / Purifier', icon: 'drop.circle.fill', materialIcon: 'water-pump', isMVP: false },
  'Geyser': { icon: 'flame.fill', materialIcon: 'fire', isMVP: false },
  'Fan': { icon: 'wind', materialIcon: 'fan', isMVP: false },
  'Inverter': { icon: 'battery.100', materialIcon: 'battery-charging-100', isMVP: false },
  'Microwave': { icon: 'microwave.fill', materialIcon: 'microwave', isMVP: false },
};

const popularServices: Service[] = [
  { label: 'Electrician', requestService: 'Electrical', icon: 'bolt.fill', materialIcon: 'lightning-bolt' },
  { label: 'Plumber', requestService: 'Plumbing', icon: 'drop.fill', materialIcon: 'water' },
  { label: 'Plumber + AC', requestService: 'Other', icon: 'wrench.and.screwdriver.fill', materialIcon: 'tools' },
  { label: 'Electrician + AC', requestService: 'Other', icon: 'bolt.circle.fill', materialIcon: 'lightning-bolt-circle' },
];

export default function CustomerHomeScreen() {
  const { user } = useAuth();
  const customerName = user?.name || 'there';
  const locationText = user?.location || 'Your saved location';

  const requestService = (service: Service) => 
    router.push({ pathname: '/repair-request', params: { service: service.requestService } } as Href);

  const [categories, setCategories] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState(false);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBooking, setActiveBooking] = useState<any>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await fetchUnreadNotificationCount();
      setUnreadCount(count);
    } catch(e) {}
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoadingServices(true);
      setServicesError(false);
      
      const [servicesData, bookingsData] = await Promise.all([
        fetchActiveServices(),
        fetchCustomerBookings() // From supabase.ts
      ]);
      
      const mapped: Service[] = servicesData.map(item => {
        const config = categoryMap[item.name];
        if (config) {
          return {
            label: config.label || item.name,
            requestService: item.name,
            icon: config.icon,
            isMVP: config.isMVP,
          };
        }
        return {
          label: item.name,
          requestService: item.name,
          icon: 'wrench.and.screwdriver.fill' as SymbolViewProps['name'],
          isMVP: false,
        };
      });
      setCategories(mapped);
      
      // Find the first active booking
      const active = bookingsData.find(b => 
        !['Completed', 'Rejected', 'Cancelled'].includes(b.status)
      );
      setActiveBooking(active || null);
      
    } catch (e) {
      setServicesError(true);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    loadData();
      loadUnreadCount();
  }, [loadData]);

  useEffect(() => {
    if (!activeBooking) return;
    const unsubscribe = subscribeToBookingUpdates(activeBooking.id, (payload) => {
      if (payload.new && payload.new.status) {
        setActiveBooking((prev: any) => ({
          ...prev,
          status: payload.new.status,
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeBooking?.id]);

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.locationRow}>
            <Pressable onPress={() => router.push('/(customer)/profile')} style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{customerName.charAt(0).toUpperCase()}</ThemedText>
            </Pressable>
              <View style={styles.locationCopy}>
                <ThemedText style={styles.greeting}>Hi, {customerName}</ThemedText>
                <View style={styles.locationLine}>
                  <SymbolView name="location.fill" size={13} tintColor={FixGoColors.success} fallback={<MaterialCommunityIcons name="map-marker" size={13} color={FixGoColors.success} />} />
                  <ThemedText style={styles.location} numberOfLines={1}>{locationText}</ThemedText>
                </View>
              </View>
              <Pressable onPress={() => router.push('/(customer)/notifications' as any)} style={styles.notification}>
                <SymbolView name="bell" size={21} tintColor={FixGoColors.primary} fallback={<MaterialCommunityIcons name="bell" size={21} color={FixGoColors.primary} />} />
                {unreadCount > 0 && <View style={styles.badge}><ThemedText style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</ThemedText></View>}
              </Pressable>
            </View>

          {/* Search */}
          <SearchBar />

          {/* Active Booking */}
          <SectionHeader title="Active Booking" />
          {activeBooking ? (
            <Pressable style={styles.activeBookingCard} onPress={() => router.push({
              pathname: '/repair-tracking',
              params: {
                bookingId: activeBooking.id,
                technicianId: activeBooking.technician.id,
                initialStatus: activeBooking.status,
                requestId: activeBooking.request.id,
                name: activeBooking.technician.name,
                service: activeBooking.request.service,
                price: activeBooking.technician.price,
                arrival: activeBooking.technician.arrival,
                description: activeBooking.request.description,
              }
            } as any)}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingBadge}>
                  <SymbolView name="circle.fill" size={8} tintColor={FixGoColors.accent} />
                  <ThemedText style={styles.bookingBadgeText}>{activeBooking.status.toUpperCase()}</ThemedText>
                </View>
                <ThemedText style={styles.bookingTime}>{activeBooking.technician.arrival} min ETA</ThemedText>
              </View>
              <ThemedText style={styles.bookingTitle}>{activeBooking.request.service} Service</ThemedText>
              <ThemedText style={styles.bookingSubtitle}>Technician: {activeBooking.technician.name}</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.emptyBooking}>
              <SymbolView name="calendar.badge.plus" size={32} tintColor={FixGoColors.textSecondary} />
              <ThemedText style={styles.emptyBookingText}>No active bookings right now.</ThemedText>
            </View>
          )}

          {/* Categories */}
          <SectionHeader title="Categories" />
          {loadingServices ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color={FixGoColors.primary} />
            </View>
          ) : servicesError ? (
            <View style={styles.stateContainer}>
              <ThemedText style={styles.errorText}>Unable to load services.</ThemedText>
              <Pressable onPress={loadData} style={styles.retryButton}>
                <ThemedText style={styles.retryText}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.stateContainer}>
              <ThemedText style={styles.emptyText}>No services available right now.</ThemedText>
            </View>
          ) : (
            <View style={styles.categoryGrid}>
              {categories.map((service) => (
                <CategoryCard 
                  key={service.label} 
                  label={service.label} 
                  icon={service.icon} 
                  materialIcon={service.materialIcon}
                  isMVP={service.isMVP}
                  onPress={() => requestService(service)} 
                />
              ))}
            </View>
          )}

          {/* Popular Services */}
          <SectionHeader title="Popular Services" />
          <View style={styles.grid}>
            {popularServices.map((service) => (
              <ServiceCard 
                key={service.label} 
                label={service.label} 
                icon={service.icon} 
                materialIcon={service.materialIcon}
                onPress={() => requestService(service)} 
              />
            ))}
          </View>

          {/* Recent Bookings */}
          <SectionHeader title="Recent Bookings" action="View all" onActionPress={() => router.push('/(customer)/bookings')} />
          <View style={styles.recentBookingCard}>
              <View style={styles.recentBookingIcon}>
                <SymbolView name="bolt.fill" size={20} tintColor={FixGoColors.textSecondary} fallback={<MaterialCommunityIcons name="lightning-bolt" size={22} color={FixGoColors.textSecondary} />} />
              </View>
            <View style={styles.recentBookingDetails}>
              <ThemedText style={styles.recentBookingTitle}>Electrical Repair</ThemedText>
              <ThemedText style={styles.recentBookingDate}>12 Aug 2026 â€¢ Completed</ThemedText>
            </View>
            <ThemedText style={styles.recentBookingPrice}>â‚¹450</ThemedText>
          </View>

          <VerifiedPartnerCard />
        </ScrollView>
      </SafeAreaView>
      <FixGoBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background }, 
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, 
  content: { padding: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, 
  avatar: { height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, 
  avatarText: { color: FixGoColors.card, fontSize: 18, fontWeight: '900' }, 
  locationCopy: { flex: 1, gap: 3 }, 
  greeting: { color: FixGoColors.text, fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.3 }, 
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5 }, 
  location: { color: FixGoColors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 }, 
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#E33A3A', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: FixGoColors.card },
  badgeText: { color: FixGoColors.card, fontSize: 10, fontWeight: 'bold' },
  notification: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium, borderColor: FixGoColors.border, borderWidth: 1, backgroundColor: FixGoColors.card },
  
  activeBookingCard: { backgroundColor: FixGoColors.primary, borderRadius: Radius.large, padding: Spacing.three, gap: 8 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bookingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1E575E', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  bookingBadgeText: { color: FixGoColors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  bookingTime: { color: FixGoColors.accent, fontSize: 12, fontWeight: '700' },
  bookingTitle: { color: FixGoColors.card, fontSize: 18, fontWeight: '800' },
  bookingSubtitle: { color: '#C5DEE0', fontSize: 13, fontWeight: '600' },

  emptyBooking: { height: 100, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyBookingText: { color: FixGoColors.textSecondary, fontSize: 14, fontWeight: '600' },
  
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  recentBookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: FixGoColors.card, padding: 16, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border },
  recentBookingIcon: { height: 40, width: 40, borderRadius: 20, backgroundColor: FixGoColors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  recentBookingDetails: { flex: 1, gap: 2 },
  recentBookingTitle: { color: FixGoColors.text, fontSize: 15, fontWeight: '700' },
  recentBookingDate: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '600' },
  recentBookingPrice: { color: FixGoColors.text, fontSize: 15, fontWeight: '800' },
  
  stateContainer: { padding: Spacing.four, alignItems: 'center', justifyContent: 'center', minHeight: 100 },
  errorText: { color: FixGoColors.textSecondary, fontSize: 14, marginBottom: Spacing.two },
  emptyText: { color: FixGoColors.textSecondary, fontSize: 14 },
  retryButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, backgroundColor: FixGoColors.primary, borderRadius: Radius.small },
  retryText: { color: FixGoColors.card, fontSize: 14, fontWeight: '700' }
});

