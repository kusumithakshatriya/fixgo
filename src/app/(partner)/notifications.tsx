import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchNotifications, markNotificationAsRead, subscribeToNotifications, type Notification } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function PartnerNotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToNotifications(user.id, (payload) => {
      loadNotifications();
    });
    return () => {
      unsubscribe.unsubscribe();
    };
  }, [user, loadNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      } catch (err) {
        console.error(err);
      }
    }

    if (notification.booking_id) {
      router.push('/(partner)/(tabs)/orders' as any);
    }
  };

  const getIconForType = (type: string) => {
    switch(type) {
      case 'booking_assigned': return 'briefcase.fill';
      case 'additional_charge_approved': return 'checkmark.circle.fill';
      case 'additional_charge_rejected': return 'xmark.circle.fill';
      case 'booking_cancelled': return 'xmark.circle.fill';
      default: return 'bell.fill';
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Notifications",
          headerStyle: { backgroundColor: FixGoColors.background },
          headerShadowVisible: false,
          headerTintColor: FixGoColors.text,
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={FixGoColors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor={FixGoColors.primary} />}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <SymbolView name="bell.slash.fill" size={48} tintColor={FixGoColors.textSecondary} />
                <ThemedText style={styles.emptyText}>No notifications yet</ThemedText>
              </View>
            ) : (
              notifications.map((notif) => (
                <Pressable
                  key={notif.id}
                  style={[styles.notificationCard, notif.is_read ? styles.notificationRead : styles.notificationUnread]}
                  onPress={() => handleNotificationPress(notif)}
                >
                  <View style={styles.iconContainer}>
                    <SymbolView name={getIconForType(notif.type) as any} size={24} tintColor={FixGoColors.primary} />
                  </View>
                  <View style={styles.textContent}>
                    <ThemedText style={styles.title}>{notif.title}</ThemedText>
                    <ThemedText style={styles.message}>{notif.message}</ThemedText>
                    <ThemedText style={styles.time}>{new Date(notif.created_at).toLocaleString()}</ThemedText>
                  </View>
                  {!notif.is_read && <View style={styles.unreadDot} />}
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FixGoColors.background, alignItems: 'center' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.four, gap: Spacing.three },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 12 },
  emptyText: { color: FixGoColors.textSecondary, fontSize: 16, fontWeight: '600' },
  notificationCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Radius.medium, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, gap: 12, alignItems: 'center' },
  notificationUnread: { backgroundColor: '#F0F8F9', borderColor: '#C5DEE0' },
  notificationRead: { opacity: 0.8 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: FixGoColors.accentSurface, justifyContent: 'center', alignItems: 'center' },
  textContent: { flex: 1, gap: 4 },
  title: { color: FixGoColors.text, fontSize: 16, fontWeight: '800' },
  message: { color: FixGoColors.textSecondary, fontSize: 14, fontWeight: '500' },
  time: { color: FixGoColors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: FixGoColors.primary },
});
