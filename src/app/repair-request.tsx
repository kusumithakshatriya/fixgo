import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const services = ['AC Repair', 'Electrical', 'Plumbing', 'Appliance Repair', 'Other'] as const;
type Service = (typeof services)[number];
const isService = (value: string | undefined): value is Service => services.some((item) => item === value);

export default function RepairRequestScreen() {
  const { service: selectedService } = useLocalSearchParams<{ service?: string }>();
  const [service, setService] = useState<Service | ''>(isService(selectedService) ? selectedService : '');
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState('');
  const [timing, setTiming] = useState<'asap' | 'later'>('asap');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => { if (isService(selectedService)) setService(selectedService); }, [selectedService]);

  const preferredTimeLabel = timing === 'asap'
    ? 'As soon as possible'
    : [preferredDate, preferredTime].filter(Boolean).join(' at ') || 'Schedule for later';

  function handleSubmit() {
    if (!service || !problem.trim() || !address.trim()) {
      setValidationMessage('Please select a service and add a problem description and repair address.');
      return;
    }
    setValidationMessage('');
    const mockRepairRequest = { id: `fixgo-${Date.now()}`, service, problem: problem.trim(), address: address.trim(), preferredTime: preferredTimeLabel, createdAt: new Date().toISOString() };
    void mockRepairRequest;
    Alert.alert('Repair request created!', "Next, we'll show technicians who can help.", [
      { text: 'Continue', onPress: () => router.push('/technician-comparison' as Href) },
    ]);
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><ThemedText style={styles.backText}>Back</ThemedText></Pressable>
              <View style={styles.brandRow}><View style={styles.brandMark}><ThemedText style={styles.brandMarkText}>FG</ThemedText></View><ThemedText style={styles.brand}>FixGo</ThemedText></View>
            </View>
            <View style={styles.titleBlock}><ThemedText style={styles.title}>Request a Repair</ThemedText><ThemedText style={styles.subtitle}>Tell us what needs fixing.</ThemedText></View>

            <SectionLabel label="Service" />
            <View style={styles.chipRow}>{services.map((item) => {
              const active = service === item;
              return <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setService(item)} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}><ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{item}</ThemedText></Pressable>;
            })}</View>

            <SectionLabel label="Describe the problem" />
            <View style={styles.inputCard}><TextInput accessibilityLabel="Problem description" value={problem} onChangeText={setProblem} placeholder="Describe the problem... What happened?" placeholderTextColor="#88A0B5" multiline maxLength={500} textAlignVertical="top" style={styles.problemInput} /><ThemedText style={styles.counter}>{problem.length}/500</ThemedText></View>

            <Pressable accessibilityRole="button" onPress={() => Alert.alert('Photo upload will be connected next.')} style={({ pressed }) => [styles.photoCard, pressed && styles.pressed]}>
              <View style={styles.photoIcon}><ThemedText style={styles.photoIconText}>+</ThemedText></View><View style={styles.photoCopy}><ThemedText style={styles.photoTitle}>Add a photo</ThemedText><ThemedText style={styles.photoDescription}>Help technicians understand the problem faster.</ThemedText></View>
            </Pressable>

            <SectionLabel label="Repair Location" />
            <View style={styles.locationCard}>
              <Pressable accessibilityRole="button" onPress={() => Alert.alert('Location services will be connected next.')} style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}><View style={styles.locationIcon}><ThemedText style={styles.locationIconText}>LOC</ThemedText></View><ThemedText style={styles.locationActionText}>Use my current location</ThemedText></Pressable>
              <TextInput accessibilityLabel="Repair address" value={address} onChangeText={setAddress} placeholder="Enter your address" placeholderTextColor="#88A0B5" style={styles.addressInput} />
            </View>

            <SectionLabel label="Preferred time" />
            <View style={styles.timingRow}><TimingOption label="As soon as possible" active={timing === 'asap'} onPress={() => setTiming('asap')} /><TimingOption label="Schedule for later" active={timing === 'later'} onPress={() => setTiming('later')} /></View>
            {timing === 'later' ? <View style={styles.scheduleRow}><TextInput value={preferredDate} onChangeText={setPreferredDate} placeholder="Preferred date" placeholderTextColor="#88A0B5" style={styles.scheduleInput} /><TextInput value={preferredTime} onChangeText={setPreferredTime} placeholder="Preferred time" placeholderTextColor="#88A0B5" style={styles.scheduleInput} /></View> : null}

            <View style={styles.summaryCard}><ThemedText style={styles.summaryTitle}>Request Summary</ThemedText><SummaryRow label="Service" value={service || 'Select a service'} /><SummaryRow label="Problem" value={problem.trim() || 'Add a description'} /><SummaryRow label="Location" value={address.trim() || 'Add your address'} /><SummaryRow label="Preferred time" value={preferredTimeLabel} /></View>
            {validationMessage ? <ThemedText accessibilityLiveRegion="polite" style={styles.validation}>{validationMessage}</ThemedText> : null}
            <Pressable accessibilityRole="button" onPress={handleSubmit} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}><ThemedText style={styles.submitText}>Find Technicians</ThemedText></Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) { return <ThemedText style={styles.sectionLabel}>{label}</ThemedText>; }
function TimingOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.timingOption, active && styles.timingOptionActive]}><View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View><ThemedText style={styles.timingText}>{label}</ThemedText></Pressable>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <View style={styles.summaryRow}><ThemedText style={styles.summaryLabel}>{label}</ThemedText><ThemedText numberOfLines={2} style={styles.summaryValue}>{value}</ThemedText></View>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#071A2B' }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, keyboardView: { flex: 1 }, content: { padding: Spacing.four, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, backButton: { minHeight: 44, justifyContent: 'center', paddingRight: 12 }, backText: { color: '#72B9F2', fontSize: 16, fontWeight: '800' }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brandMark: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#2188D5', alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  titleBlock: { gap: 5, marginTop: 8, marginBottom: 8 }, title: { color: '#FFFFFF', fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 }, subtitle: { color: '#B5C9DA', fontSize: 16, lineHeight: 23, fontWeight: '500' }, sectionLabel: { color: '#EAF4FC', fontSize: 16, lineHeight: 22, fontWeight: '800', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 21, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B' }, chipActive: { backgroundColor: '#2188D5', borderColor: '#72B9F2' }, chipText: { color: '#C9DAE8', fontSize: 14, fontWeight: '700' }, chipTextActive: { color: '#FFFFFF' },
  inputCard: { minHeight: 138, borderRadius: 18, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', padding: 14 }, problemInput: { flex: 1, minHeight: 92, color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '500', padding: 0 }, counter: { alignSelf: 'flex-end', color: '#88A0B5', fontSize: 12, fontWeight: '600' },
  photoCard: { minHeight: 90, borderRadius: 18, backgroundColor: '#0D263A', borderWidth: 1, borderColor: '#2A5270', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 13 }, photoIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#173D59', alignItems: 'center', justifyContent: 'center' }, photoIconText: { color: '#72B9F2', fontSize: 26, lineHeight: 30, fontWeight: '400' }, photoCopy: { flex: 1, gap: 2 }, photoTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, photoDescription: { color: '#AFC4D6', fontSize: 13, lineHeight: 19, fontWeight: '500' },
  locationCard: { borderRadius: 18, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', overflow: 'hidden' }, locationAction: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#23435B' }, locationIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#173D59', alignItems: 'center', justifyContent: 'center' }, locationIconText: { color: '#72B9F2', fontSize: 9, fontWeight: '900' }, locationActionText: { color: '#72B9F2', fontSize: 15, fontWeight: '800' }, addressInput: { minHeight: 54, color: '#FFFFFF', fontSize: 16, fontWeight: '500', paddingHorizontal: 14 },
  timingRow: { gap: 9 }, timingOption: { minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B' }, timingOptionActive: { borderColor: '#2188D5', backgroundColor: '#123752' }, radio: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: '#88A0B5', alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: '#5FB3F1' }, radioDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#5FB3F1' }, timingText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, scheduleRow: { flexDirection: 'row', gap: 10 }, scheduleInput: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', color: '#FFFFFF', fontSize: 14, fontWeight: '600', paddingHorizontal: 12 },
  summaryCard: { marginTop: 8, borderRadius: 20, backgroundColor: '#0C314B', padding: Spacing.three, gap: 12, borderWidth: 1, borderColor: '#24567A' }, summaryTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 25, fontWeight: '800', marginBottom: 2 }, summaryRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, summaryLabel: { width: 104, color: '#93B4CC', fontSize: 13, lineHeight: 19, fontWeight: '700' }, summaryValue: { flex: 1, color: '#EAF4FC', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'right' }, validation: { color: '#FFD0CC', backgroundColor: '#4A2428', borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontWeight: '600' }, submitButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#2188D5', alignItems: 'center', justifyContent: 'center', marginTop: 2 }, submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.8 },
});
