import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { fetchAllTechnicians } from '@/services/supabase';
import { FixGoColors } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';

export default function VerificationQueue() {
  const router = useRouter();
  const [pendingTechnicians, setPendingTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchAllTechnicians();
      // Filter strictly by the database verification_status
      const pending = data.filter(t => t.verification_status === 'pending');
      setPendingTechnicians(pending);
    } catch (error) {
      console.error('Error fetching queue', error);
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

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(admin)/technician-review', params: { id: item.id } } as any)}
    >
      <View style={styles.cardHeader}>
        <ThemedText style={styles.name}>{item.users?.name || 'Unknown Name'}</ThemedText>
        <SymbolView name="chevron.right" size={20} tintColor={FixGoColors.textSecondary} />
      </View>
      <View style={styles.cardDetails}>
        <ThemedText style={styles.detailText}>Experience: {item.years_of_experience || 0} years</ThemedText>
        <ThemedText style={styles.detailText}>Rating: {item.rating ? item.rating.toFixed(1) : 'New'}</ThemedText>
      </View>
      <View style={styles.statusBadge}>
        <SymbolView name="clock.fill" size={14} tintColor={FixGoColors.warning} style={{ marginRight: 4 }} />
        <ThemedText style={styles.statusText}>Pending Review</ThemedText>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingTechnicians}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No technicians pending verification.</ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FixGoColors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: FixGoColors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: FixGoColors.textSecondary,
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: FixGoColors.textSecondary,
  }
});
