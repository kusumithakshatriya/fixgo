import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, CircleHelp, MapPin, UserRoundX, ChevronRight, ShieldCheck, Check, Star, BriefcaseBusiness, GraduationCap, Clock } from 'lucide-react-native';
import { getServiceIcon } from '@/lib/service-icons';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchTechniciansForService, TechnicianForCustomer } from '@/services/supabase';
import { CUSTOMER_DEMO_TECHNICIANS } from '@/data/customer-demo-data';

type SortMode = 'Top rated' | 'Nearest';

export default function TechnicianComparisonScreen() {
  const { requestId, service = 'AC Repair', location = 'Customer repair address', description, preferredTime, customerLat, customerLng } = useLocalSearchParams<{ requestId?: string; service?: string; location?: string; description?: string; preferredTime?: string; customerLat?: string; customerLng?: string }>();
  
  const [sortMode, setSortMode] = useState<SortMode>('Top rated');
  const [technicians, setTechnicians] = useState<TechnicianForCustomer[]>([]);
  const [selected, setSelected] = useState<TechnicianForCustomer | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      setError('');
      let data = await fetchTechniciansForService(service, customerLat, customerLng);
      if (data.length === 0) {
        data = CUSTOMER_DEMO_TECHNICIANS;
      }
      setTechnicians(data);
      if (data.length > 0) {
        setSelected(data[0]);
      } else {
        setSelected(null);
      }
    } catch (e: any) {
      setError('Could not load technicians. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTechnicians();
  }, [service]);

  const sortedTechnicians = useMemo(() => {
    return [...technicians].sort((a, b) => {
      if (sortMode === 'Top rated') {
        return b.rating - a.rating;
      } else if (sortMode === 'Nearest') {
        const distA = a.roadDistanceKm !== null ? a.roadDistanceKm : a.distanceKm;
        const distB = b.roadDistanceKm !== null ? b.roadDistanceKm : b.distanceKm;

        if (distA === null && distB === null) return 0;
        if (distA === null) return 1;
        if (distB === null) return -1;
        return distA - distB;
      }
      return 0;
    });
  }, [technicians, sortMode]);

  const choose = (technician: TechnicianForCustomer) => { setSelected(technician); };
  
  const confirm = () => { 
    if (!selected) return;
    router.push({ 
      pathname: '/booking-confirmation', 
      params: { 
        requestId, 
        technicianId: selected.id,
        technicianName: selected.name,
        rating: String(selected.rating),
        totalJobs: String(selected.totalJobs),
        service, 
        location, 
        description, 
        preferredTime,
        customerLat,
        customerLng
      } 
    } as unknown as Href); 
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}>
              <ChevronLeft size={19} color={FixGoColors.primary} />
            </Pressable>
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveText}>Live Dispatch</ThemedText>
            </View>
            <View style={styles.iconButton}>
              <CircleHelp size={20} color={FixGoColors.primary} />
            </View>
          </View>
          
          <View style={styles.intro}>
            <ThemedText style={styles.title}>Choose your technician</ThemedText>
            <ThemedText style={styles.subtitle}>{loading ? 'Finding' : technicians.length} {service.toLowerCase()} specialists available near you</ThemedText>
          </View>
          
          <View style={styles.serviceRow}>
            <View style={styles.serviceIcon}>
              {getServiceIcon(service, { size: 20, color: FixGoColors.primary })}
            </View>
            <View style={styles.serviceCopy}>
              <ThemedText style={styles.serviceTitle}>{service} Service</ThemedText>
              <View style={styles.location}>
                <MapPin size={12} color={FixGoColors.success} />
                <ThemedText numberOfLines={1} style={styles.locationText}>{location}</ThemedText>
              </View>
            </View>
            <View style={styles.standard}>
              <ThemedText style={styles.standardText}>Standard</ThemedText>
            </View>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: sortMode === 'Top rated' }} onPress={() => setSortMode('Top rated')} style={[styles.filter, sortMode === 'Top rated' && styles.filterActive]}>
              <ThemedText style={[styles.filterText, sortMode === 'Top rated' && styles.filterTextActive]}>Top rated</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: sortMode === 'Nearest' }} onPress={() => setSortMode('Nearest')} style={[styles.filter, sortMode === 'Nearest' && styles.filterActive]}>
              <ThemedText style={[styles.filterText, sortMode === 'Nearest' && styles.filterTextActive]}>Nearest</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled style={[styles.filter, { opacity: 0.5 }]}>
              <ThemedText style={styles.filterText}>Lowest price (Coming soon)</ThemedText>
            </Pressable>
          </ScrollView>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={FixGoColors.primary} />
              <ThemedText style={{ marginTop: 12, color: FixGoColors.textSecondary, fontWeight: '600' }}>Matching you with experts...</ThemedText>
            </View>
          ) : error ? (
            <View style={{ padding: 40, alignItems: 'center', backgroundColor: FixGoColors.card, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border }}>
              <ThemedText style={{ color: FixGoColors.text, fontWeight: '800', marginBottom: 8 }}>{error}</ThemedText>
              <Pressable onPress={loadTechnicians} style={{ backgroundColor: FixGoColors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.small }}>
                <ThemedText style={{ color: FixGoColors.card, fontWeight: '700' }}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : technicians.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center', backgroundColor: FixGoColors.card, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border }}>
              <UserRoundX size={40} color={FixGoColors.textSecondary} />
              <ThemedText style={{ color: FixGoColors.text, fontWeight: '800', marginTop: 12 }}>No technicians available</ThemedText>
              <ThemedText style={{ color: FixGoColors.textSecondary, textAlign: 'center', marginTop: 4 }}>We couldn't find any available {service.toLowerCase()} experts right now. Please try again later.</ThemedText>
            </View>
          ) : (
            <View style={styles.list}>
              {sortedTechnicians.map((technician) => (
                <TechnicianCard 
                  key={technician.id} 
                  technician={technician} 
                  service={service} 
                  selected={selected?.id === technician.id} 
                  onSelect={() => choose(technician)} 
                />
              ))}
            </View>
          )}

        </ScrollView>
        <SafeAreaView edges={['bottom']} style={styles.bottom}>
          <View style={styles.dispatch}>
            <View>
              <ThemedText style={styles.guarantee}>FixGo Guaranteed Dispatch</ThemedText>
              <ThemedText style={styles.guaranteeHint}>Verified professional</ThemedText>
            </View>
            <View style={styles.fee}>
              <ThemedText style={styles.feeLabel}>Visit fee</ThemedText>
              <ThemedText style={styles.feeValue}>
                {selected && 'price' in selected ? `₹${(selected as any).price}` : 'TBD'}
              </ThemedText>
            </View>
          </View>
          <Pressable accessibilityRole="button" disabled={!selected} accessibilityLabel={selected ? `Confirm ${selected.name}` : 'Select a technician'} onPress={confirm} style={[styles.confirm, !selected && { opacity: 0.5 }]}>
            <ThemedText numberOfLines={1} style={styles.confirmText}>
              {selected ? `Confirm ${selected.name}` : 'Select a technician'}
            </ThemedText>
            <ChevronRight size={16} color={FixGoColors.card} />
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

function TechnicianCard({ technician, service, selected, onSelect }: { technician: TechnicianForCustomer; service: string; selected: boolean; onSelect: () => void }) {
  const initials = technician.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TX';
  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{initials}</ThemedText>
        </View>
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name}>{technician.name}</ThemedText>
            {technician.isOnline ? (
              <View style={styles.badge}><ThemedText style={styles.badgeText}>ONLINE</ThemedText></View>
            ) : null}
          </View>
          {technician.isVerified ? (
            <View style={styles.verified}>
              <ShieldCheck size={13} color={FixGoColors.success} />
              <ThemedText style={styles.verifiedText}>Verified {service} expert</ThemedText>
            </View>
          ) : (
             <View style={styles.verified}>
              <ThemedText style={styles.verifiedText}>{service} expert</ThemedText>
            </View>
          )}
          {technician.distanceKm !== null ? (
            <View style={styles.verified}>
              <MapPin size={12} color={FixGoColors.success} />
              <ThemedText style={styles.verifiedText}>Within service area</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.stats}>
        <Stat icon={<Star size={13} color="#D89617" />} value={`${technician.rating.toFixed(1)}`} label="Rating" />
        <Stat icon={<BriefcaseBusiness size={13} color={FixGoColors.primary} />} value={`${technician.totalJobs}`} label="Jobs" />
        <Stat 
          icon={<MapPin size={13} color={FixGoColors.primary} />} 
          value={technician.roadDistanceKm !== null ? `${technician.roadDistanceKm.toFixed(1)} km` : (technician.distanceKm !== null ? `${technician.distanceKm.toFixed(1)} km` : 'N/A')} 
          label={technician.roadDistanceKm !== null ? 'Road Distance' : (technician.distanceKm !== null ? 'Distance' : 'Location unavailable')} 
        />
        <Stat 
          icon={<Clock size={13} color={FixGoColors.primary} />} 
          value={technician.etaMins !== null ? `${technician.etaMins} min` : 'N/A'} 
          label={technician.etaMins !== null ? 'ETA' : 'ETA unavailable'} 
        />
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onSelect} style={[styles.selectButton, selected && styles.selectButtonActive]}>
        {selected ? <Check size={15} color={FixGoColors.card} /> : null}
        <ThemedText style={[styles.selectText, selected && styles.selectTextActive]}>{selected ? 'Selected' : 'Select'}</ThemedText>
      </Pressable>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string; }) { 
  return (
    <View style={styles.stat}>
      {icon}
      <View>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        <ThemedText style={styles.statLabel}>{label}</ThemedText>
      </View>
    </View>
  ); 
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, content: { padding: Spacing.four, paddingBottom: 170, gap: 16 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border }, live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF9F5', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 7 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: FixGoColors.success }, liveText: { color: FixGoColors.success, fontSize: 11, fontWeight: '900' },
  intro: { gap: 5, paddingTop: 3 }, title: { color: FixGoColors.text, fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 }, subtitle: { color: FixGoColors.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  serviceRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, padding: 12 }, serviceIcon: { height: 43, width: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accent }, serviceCopy: { flex: 1, gap: 4 }, serviceTitle: { color: FixGoColors.text, fontSize: 14, fontWeight: '900' }, location: { flexDirection: 'row', alignItems: 'center', gap: 4 }, locationText: { flex: 1, color: FixGoColors.textSecondary, fontSize: 11, fontWeight: '700' }, standard: { borderRadius: Radius.pill, backgroundColor: FixGoColors.accentSurface, paddingHorizontal: 9, paddingVertical: 6 }, standardText: { color: FixGoColors.primary, fontSize: 10, fontWeight: '900' },
  filters: { gap: 8, paddingVertical: 1 }, filter: { minHeight: 35, borderRadius: Radius.pill, borderWidth: 1, borderColor: FixGoColors.border, backgroundColor: FixGoColors.card, justifyContent: 'center', paddingHorizontal: 14 }, filterActive: { borderColor: FixGoColors.primary, backgroundColor: FixGoColors.primary }, filterText: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: FixGoColors.card },
  list: { gap: 12 }, card: { gap: 13, padding: 14, borderRadius: Radius.medium, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, shadowColor: FixGoColors.shadow, shadowOpacity: 0.035, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, cardSelected: { borderColor: FixGoColors.primary, borderWidth: 2, padding: 13 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 51, height: 51, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, avatarText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' }, nameBlock: { flex: 1, gap: 4 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }, name: { color: FixGoColors.text, fontSize: 17, lineHeight: 21, fontWeight: '900' }, badge: { backgroundColor: FixGoColors.accentSurface, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 3 }, badgeText: { color: FixGoColors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }, verified: { flexDirection: 'row', alignItems: 'center', gap: 4 }, verifiedText: { color: FixGoColors.textSecondary, fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: FixGoColors.border, paddingVertical: 10 }, stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }, statValue: { color: FixGoColors.text, fontSize: 12, lineHeight: 15, fontWeight: '900' }, statLabel: { color: FixGoColors.textSecondary, fontSize: 9, lineHeight: 12, fontWeight: '700' },
  selectButton: { minHeight: 42, borderRadius: Radius.small, borderWidth: 1, borderColor: FixGoColors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }, selectButtonActive: { backgroundColor: FixGoColors.primary }, selectText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '900' }, selectTextActive: { color: FixGoColors.card },
  bottom: { borderTopWidth: 1, borderColor: FixGoColors.border, backgroundColor: FixGoColors.card, paddingHorizontal: Spacing.four, paddingTop: 10, gap: 9, shadowColor: FixGoColors.shadow, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -3 }, elevation: 8 }, dispatch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, guarantee: { color: FixGoColors.text, fontSize: 12, fontWeight: '900' }, guaranteeHint: { color: FixGoColors.textSecondary, fontSize: 10, marginTop: 2, fontWeight: '600' }, fee: { alignItems: 'flex-end' }, feeLabel: { color: FixGoColors.textSecondary, fontSize: 10, fontWeight: '700' }, feeValue: { color: FixGoColors.primary, fontSize: 16, fontWeight: '900' }, confirm: { minHeight: 52, borderRadius: Radius.medium, backgroundColor: FixGoColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 3 }, confirmText: { maxWidth: '82%', color: FixGoColors.card, fontSize: 14, fontWeight: '900' },
});
