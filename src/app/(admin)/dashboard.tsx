import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/Button';
import { FixGoHeader } from '@/components/fixgo/fixgo-header';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllTechnicians } from '@/services/supabase';
import { FixGoColors } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const router = useRouter();
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchAllTechnicians();
      setTechnicians(data);
    } catch (error) {
      console.error('Error fetching technicians', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/otp');
  };

  const pendingCount = technicians.filter(t => t.verification_status === 'pending').length;
  const verifiedCount = technicians.filter(t => t.verification_status === 'verified').length;
  const rejectedCount = technicians.filter(t => t.verification_status === 'rejected').length;
  const incompleteCount = technicians.filter(t => t.verification_status === 'incomplete').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FixGoHeader />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ThemedText type="subtitle" style={styles.sectionTitle}>Verification Overview</ThemedText>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { borderLeftColor: FixGoColors.warning }]}>
            <SymbolView name="clock.fill" tintColor={FixGoColors.warning} size={24} />
            <ThemedText style={styles.metricValue}>{pendingCount}</ThemedText>
            <ThemedText style={styles.metricLabel}>Pending</ThemedText>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: FixGoColors.success }]}>
            <SymbolView name="checkmark.circle.fill" tintColor={FixGoColors.success} size={24} />
            <ThemedText style={styles.metricValue}>{verifiedCount}</ThemedText>
            <ThemedText style={styles.metricLabel}>Verified</ThemedText>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: FixGoColors.error }]}>
            <SymbolView name="xmark.circle.fill" tintColor={FixGoColors.error} size={24} />
            <ThemedText style={styles.metricValue}>{rejectedCount}</ThemedText>
            <ThemedText style={styles.metricLabel}>Rejected</ThemedText>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: FixGoColors.border }]}>
            <SymbolView name="doc.text.fill" tintColor={FixGoColors.textSecondary} size={24} />
            <ThemedText style={styles.metricValue}>{incompleteCount}</ThemedText>
            <ThemedText style={styles.metricLabel}>Incomplete</ThemedText>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Button
            label="View Verification Queue"
            onPress={() => router.push('/(admin)/verification-queue' as any)}
            style={styles.queueBtn}
          />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Sign Out"
          variant="outline"
          onPress={handleLogout}

        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FixGoColors.background,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: FixGoColors.text,
    marginVertical: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: FixGoColors.textSecondary,
  },
  actionsContainer: {
    marginTop: 32,
  },
  queueBtn: {
    paddingVertical: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: FixGoColors.border,
    backgroundColor: '#fff',
  }
});
