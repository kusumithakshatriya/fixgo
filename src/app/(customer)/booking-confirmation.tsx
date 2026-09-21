import { router, type Href, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getActiveRequest } from '@/data/customer-flow';
import { useDemo } from '@/context/demo-flow-context';
import { createBooking } from '@/services/supabase';

import { 
  ChevronLeft,
  Check,
  UserRoundCog,
  ShieldCheck,
  Star,
  BriefcaseBusiness,
  Clock,
  Wrench,
  FileText,
  MessageSquareText,
  MapPin,
  Calendar,
  IndianRupee,
  Info,
  ChevronRight
} from 'lucide-react-native';

export default function BookingConfirmationScreen() {
  const { setDemoBooking } = useDemo();
  const { 
    requestId, 
    technicianId,
    technicianName = 'Expert Technician',
    rating = '5.0',
    totalJobs = '0',
    service = 'AC Repair', 
    location = 'Customer address', 
    description, 
    preferredTime 
  } = useLocalSearchParams<{ 
    requestId?: string; 
    technicianId?: string;
    technicianName?: string;
    rating?: string;
    totalJobs?: string;
    service?: string; 
    location?: string; 
    description?: string; 
    preferredTime?: string;
  }>();

  const request = getActiveRequest();
  
  const displayService = request?.service ?? service;
  const displayLocation = request?.location ?? location;
  const displayDescription = request?.description ?? description ?? `Your ${displayService.toLowerCase()} request`;
  const displayPreferredTime = request?.preferredTime ?? preferredTime ?? 'Earliest available';
  
  const displayPrice = 'TBD';
  const displayArrival = 'TBD';
  
  const initials = technicianName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TX';
  
  const [isConfirming, setIsConfirming] = useState(false);

  const trackRepair = async () => {
    if (!requestId || !technicianId) {
      Alert.alert('Error', 'Missing required booking information.');
      return;
    }

    setIsConfirming(true);
    try {
      if (technicianId.startsWith('demo-tech')) {
        await setDemoBooking({
          requestId,
          technicianId,
          technicianName,
          service: displayService,
          price: displayPrice,
          arrival: displayArrival,
          location: displayLocation,
          description: displayDescription,
          preferredTime: displayPreferredTime
        });
      } else {
        await createBooking(requestId, technicianId);
      }
      
      router.push({ 
        pathname: '/repair-tracking', 
        params: { 
          requestId, 
          name: technicianName, 
          service: displayService, 
          price: displayPrice, 
          arrival: displayArrival, 
          location: displayLocation, 
          description: displayDescription, 
          preferredTime: displayPreferredTime 
        } 
      } as unknown as Href);
    } catch (error: any) {
      Alert.alert('Booking Failed', error.message || 'Could not confirm booking.');
    } finally {
      setIsConfirming(false);
    }
  };

  return <View style={styles.page}><SafeAreaView edges={['top']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><ChevronLeft size={16} color={FixGoColors.primary} /><ThemedText style={styles.backText}>Back</ThemedText></Pressable><ThemedText style={styles.headerTitle}>Confirm Booking</ThemedText><View style={styles.headerSpacer} /></View>
      <View style={styles.intro}><View style={styles.introIcon}><Check size={20} color={FixGoColors.card} /></View><View style={styles.introCopy}><ThemedText style={styles.eyebrow}>ONE STEP AWAY</ThemedText><ThemedText style={styles.title}>Your expert is ready</ThemedText><ThemedText style={styles.subtitle}>Review the details below, then confirm your repair visit.</ThemedText></View></View>

      <SectionTitle icon={<UserRoundCog size={18} color={FixGoColors.primary} />} title="Selected technician" />
      <View style={styles.technicianCard}><View style={styles.techTop}><View style={styles.avatar}><ThemedText style={styles.avatarText}>{initials}</ThemedText></View><View style={styles.techCopy}><View style={styles.nameRow}><ThemedText style={styles.name}>{technicianName}</ThemedText><View style={styles.verified}><ShieldCheck size={14} color={FixGoColors.success} /><ThemedText style={styles.verifiedText}>Verified</ThemedText></View></View><ThemedText style={styles.specialty}>{displayService} Specialist</ThemedText></View></View><View style={styles.techMetrics}><Stat icon={<Star size={16} color={FixGoColors.primary} />} value={`${rating}`} label="rating" accent /><Stat icon={<BriefcaseBusiness size={16} color={FixGoColors.textSecondary} />} value={`${totalJobs} jobs`} label="completed" /><Stat icon={<Clock size={16} color={FixGoColors.textSecondary} />} value={`${displayArrival}`} label="ETA" /></View><View style={styles.chargeRow}><View><ThemedText style={styles.chargeLabel}>Expected charge</ThemedText><ThemedText style={styles.chargeHint}>Pay after the service</ThemedText></View><ThemedText style={styles.charge}>{displayPrice}</ThemedText></View></View>

      <SectionTitle icon={<Wrench size={18} color={FixGoColors.primary} />} title="Repair summary" />
      <View style={styles.card}>
        {requestId ? <><Detail icon={<FileText size={16} color={FixGoColors.primary} />} label="Request ID" value={String(requestId)} /><Divider /></> : null}
        <Detail icon={<Wrench size={16} color={FixGoColors.primary} />} label="Selected service" value={displayService} /><Divider /><Detail icon={<MessageSquareText size={16} color={FixGoColors.primary} />} label="Problem description" value={displayDescription} /><Divider /><Detail icon={<Clock size={16} color={FixGoColors.primary} />} label="Preferred time" value={displayPreferredTime} /><Divider /><Detail icon={<MapPin size={16} color={FixGoColors.primary} />} label="Repair location" value={displayLocation} multiLine />
      </View>

      <SectionTitle icon={<Calendar size={18} color={FixGoColors.primary} />} title="Booking details" />
      <View style={styles.card}><Detail icon={<UserRoundCog size={16} color={FixGoColors.primary} />} label="Technician visit" value="Home service visit" /><Divider /><Detail icon={<Clock size={16} color={FixGoColors.primary} />} label="Estimated arrival" value={displayArrival} /><Divider /><Detail icon={<IndianRupee size={16} color={FixGoColors.primary} />} label="Estimated service charge" value={displayPrice} /></View>

      <View style={styles.priceCard}><View style={styles.priceTop}><View><ThemedText style={styles.priceKicker}>ESTIMATED TOTAL</ThemedText><ThemedText style={styles.priceValue}>{displayPrice}</ThemedText></View><View style={styles.priceIcon}><IndianRupee size={21} color={FixGoColors.primary} /></View></View><View style={styles.note}><Info size={15} color={FixGoColors.textSecondary} /><ThemedText style={styles.noteText}>Final price may vary if additional work or parts are required.</ThemedText></View></View>
    </ScrollView>
    <SafeAreaView edges={['bottom']} style={styles.ctaWrap}><View style={styles.ctaContent}><View><ThemedText style={styles.ctaPriceLabel}>Expected charge</ThemedText><ThemedText style={styles.ctaPrice}>{displayPrice}</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel="Confirm booking" onPress={trackRepair} disabled={isConfirming} style={[styles.confirmButton, isConfirming && { opacity: 0.7 }]}><ThemedText style={styles.confirmText}>{isConfirming ? 'Confirming...' : 'Confirm Booking'}</ThemedText>{isConfirming ? <ActivityIndicator color={FixGoColors.card} size="small" /> : <ChevronRight size={16} color={FixGoColors.card} />}</Pressable></View></SafeAreaView>
  </SafeAreaView></View>;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <View style={styles.sectionTitle}>{icon}<ThemedText style={styles.sectionText}>{title}</ThemedText></View>; }
function Stat({ icon, value, label, accent = false }: { icon: React.ReactNode; value: string; label: string; accent?: boolean }) { return <View style={styles.stat}>{icon}<ThemedText style={styles.statValue}>{value}</ThemedText><ThemedText style={styles.statLabel}>{label}</ThemedText></View>; }
function Detail({ icon, label, value, multiLine = false }: { icon: React.ReactNode; label: string; value: string; multiLine?: boolean }) { return <View style={styles.detail}><View style={styles.detailIcon}>{icon}</View><View style={styles.detailCopy}><ThemedText style={styles.detailLabel}>{label}</ThemedText><ThemedText numberOfLines={multiLine ? 2 : 1} style={styles.detailValue}>{value}</ThemedText></View></View>; }
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, content: { padding: Spacing.four, paddingBottom: 128, gap: 14 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 }, backText: { color: FixGoColors.primary, fontSize: 15, fontWeight: '800' }, headerTitle: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' }, headerSpacer: { width: 43 },
  intro: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }, introIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.success }, introCopy: { flex: 1, gap: 2 }, eyebrow: { color: FixGoColors.success, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: FixGoColors.text, fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7 }, subtitle: { color: FixGoColors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }, sectionText: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' },
  technicianCard: { gap: 14, borderRadius: Radius.large, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.accent, padding: Spacing.three, shadowColor: FixGoColors.shadow, shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, techTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 55, height: 55, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, avatarText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' }, techCopy: { flex: 1, gap: 4 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, name: { color: FixGoColors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' }, verified: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECF8F1', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 3 }, verifiedText: { color: FixGoColors.success, fontSize: 9, fontWeight: '900' }, specialty: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '700' }, techMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, stat: { minWidth: '22%', flexGrow: 1, gap: 2, borderRadius: Radius.small, padding: 9, backgroundColor: '#F3F7F7' }, statValue: { color: FixGoColors.text, fontSize: 12, fontWeight: '900' }, statLabel: { color: FixGoColors.textSecondary, fontSize: 9, fontWeight: '700' }, chargeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }, chargeLabel: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '800' }, chargeHint: { color: FixGoColors.textSecondary, fontSize: 10, marginTop: 2 }, charge: { color: FixGoColors.primary, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  card: { borderRadius: Radius.large, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, paddingHorizontal: Spacing.three, shadowColor: FixGoColors.shadow, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, detail: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, detailIcon: { height: 34, width: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accentSurface }, detailCopy: { flex: 1, gap: 2 }, detailLabel: { color: FixGoColors.textSecondary, fontSize: 11, fontWeight: '700' }, detailValue: { color: FixGoColors.text, fontSize: 14, lineHeight: 20, fontWeight: '800' }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: FixGoColors.border },
  priceCard: { borderRadius: Radius.large, gap: 13, padding: Spacing.three, backgroundColor: FixGoColors.accentSurface, borderWidth: 1, borderColor: '#BCEBED' }, priceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, priceKicker: { color: FixGoColors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, priceValue: { color: FixGoColors.primary, fontSize: 30, lineHeight: 35, fontWeight: '900', letterSpacing: -0.8 }, priceIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.card }, note: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#BCEBED', paddingTop: 11 }, noteText: { flex: 1, color: FixGoColors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  ctaWrap: { borderTopWidth: 1, borderColor: FixGoColors.border, backgroundColor: FixGoColors.card, paddingHorizontal: Spacing.four, paddingTop: 12 }, ctaContent: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 }, ctaPriceLabel: { color: FixGoColors.textSecondary, fontSize: 10, fontWeight: '800' }, ctaPrice: { color: FixGoColors.text, fontSize: 19, lineHeight: 23, fontWeight: '900' }, confirmButton: { flex: 1, minHeight: 52, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FixGoColors.primary }, confirmText: { color: FixGoColors.card, fontSize: 14, fontWeight: '900' },
});
