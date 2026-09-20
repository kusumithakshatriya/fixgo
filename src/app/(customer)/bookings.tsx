import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';

import { FixGoBottomNav } from '@/components/fixgo/fixgo-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, Radius, Spacing, MaxContentWidth } from '@/constants/theme';
import { fetchCustomerBookings } from '@/services/supabase';

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadBookings = async () => {
    try {
      setError('');
      const data = await fetchCustomerBookings();
      setBookings(data);
    } catch (e: any) {
      setError('Could not load your bookings.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadBookings();
  }, []);

  const renderBooking = ({ item: booking }: { item: any }) => {
    const openTracking = () => router.push({ 
      pathname: '/repair-tracking', 
      params: { 
        bookingId: booking.id,
        technicianId: booking.technician.id,
        initialStatus: booking.status,
        requestId: booking.request.id,
        name: booking.technician.name, 
        service: booking.request.service, 
        price: `${booking.technician.price}`, 
        arrival: `${booking.technician.arrival}`, 
        location: booking.request.location || 'Your location',
        description: booking.request.description
      } 
    } as unknown as Href);

    const isCompleted = booking.status === 'Completed';
    const isAwaiting = booking.status === 'Awaiting Payment';
    const isCancelled = booking.status === 'Cancelled';
    
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Track ${booking.request.service} booking`} onPress={openTracking} style={styles.bookingCard}>
        <View style={styles.status}>
          <ThemedText style={styles.statusText}>{booking.status}</ThemedText>
        </View>
        <ThemedText style={styles.service}>{booking.request.service}</ThemedText>
        <ThemedText style={styles.technician}>{booking.technician.name} · {booking.technician.verified ? 'Verified technician' : 'Technician'}</ThemedText>
        
        <View style={styles.details}>
          {isCompleted && booking.payment ? (
            <>
              <ThemedText style={styles.detail}>₹{booking.payment.final_amount}</ThemedText>
              <ThemedText style={[styles.detail, { textTransform: 'capitalize' }]}>{booking.payment.payment_method}</ThemedText>
            </>
          ) : isAwaiting && booking.payment ? (
            <>
              <ThemedText style={styles.detail}>₹{booking.payment.final_amount}</ThemedText>
              <ThemedText style={styles.detail}>Payment Pending</ThemedText>
            </>
          ) : isCancelled ? (
            <>
              <ThemedText style={styles.detail}>Cancelled</ThemedText>
              <ThemedText style={styles.detail}>-</ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={styles.detail}>₹{booking.technician.price} expected</ThemedText>
              <ThemedText style={styles.detail}>{booking.technician.arrival} min ETA</ThemedText>
            </>
          )}
        </View>
        <ThemedText style={styles.track}>{isCompleted || isCancelled ? 'View details →' : isAwaiting ? 'Complete payment →' : 'View tracking →'}</ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Your Bookings</ThemedText>
        </View>
        
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={FixGoColors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Pressable onPress={loadBookings} style={styles.retryButton}>
              <ThemedText style={styles.retryText}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : bookings.length > 0 ? (
          <FlatList
            data={bookings}
            keyExtractor={item => item.id}
            renderItem={renderBooking}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FixGoColors.primary} />}
          />
        ) : (
          <View style={styles.centerContainer}>
            <ThemedText style={styles.copy}>Your repair bookings will appear here.</ThemedText>
          </View>
        )}
      </SafeAreaView>
      <FixGoBottomNav active="bookings" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background }, 
  content: { flex: 1, alignItems: 'center' }, 
  header: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, paddingBottom: Spacing.two },
  listContent: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, paddingBottom: 100, gap: 12 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  title: { color: FixGoColors.text, fontSize: 24, fontWeight: '800' }, 
  copy: { color: FixGoColors.textSecondary, textAlign: 'center' }, 
  errorText: { color: FixGoColors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  retryButton: { backgroundColor: FixGoColors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.small },
  retryText: { color: FixGoColors.card, fontWeight: '700' },
  bookingCard: { width: '100%', gap: 7, backgroundColor: FixGoColors.card, borderColor: FixGoColors.border, borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three }, 
  status: { alignSelf: 'flex-start', backgroundColor: FixGoColors.accentSurface, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 }, 
  statusText: { color: FixGoColors.primary, fontSize: 10, fontWeight: '900' }, 
  service: { color: FixGoColors.text, fontSize: 18, fontWeight: '800' }, 
  technician: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600' }, 
  details: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, 
  detail: { color: FixGoColors.text, fontSize: 13, fontWeight: '800' }, 
  track: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800', marginTop: 3 },
});
