import { router, type Href, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { setActiveRequest } from '@/data/customer-flow';

import { fetchActiveServices } from '@/services/supabase';
import { invokeDiagnoseRepair } from '@/services/ai-diagnosis';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '@/hooks/useAuth';

type SelectedPhoto = { uri: string; name: string; mimeType?: string };

export default function RepairRequestScreen() {
  const { user } = useAuth();
  const { service: selectedService } = useLocalSearchParams<{ service?: string }>();
  const [service, setService] = useState<string>(selectedService || '');
  const [services, setServices] = useState<string[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState(false);
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState('');
  const [timing, setTiming] = useState<'asap' | 'later'>('asap');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  
  const [customerLat, setCustomerLat] = useState<string>('');
  const [customerLng, setCustomerLng] = useState<string>('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (selectedService) setService(selectedService);
  }, [selectedService]);

  useEffect(() => {
    async function load() {
      try {
        setLoadingServices(true);
        setServicesError(false);
        const data = await fetchActiveServices();
        setServices(data.map(s => s.name));
      } catch (e) {
        setServicesError(true);
        setServices(['AC Repair', 'Electrical', 'Plumbing']); // fallback without fake Other
      } finally {
        setLoadingServices(false);
      }
    }
    load();
  }, []);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setPreferredDate(`${year}-${month}-${day}`);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const hours = String(selectedDate.getHours()).padStart(2, '0');
      const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
      setPreferredTime(`${hours}:${minutes}`);
    }
  };

  const preferredTimeLabel = timing === 'asap'
    ? 'As soon as possible'
    : [preferredDate, preferredTime].filter(Boolean).join(' at ') || 'Schedule for later';

  async function pickPhoto() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const media = result.assets[0];
      setSelectedPhoto({ uri: media.uri, name: media.name || 'Selected media', mimeType: media.mimeType });
    } catch {
      Alert.alert('Unable to select media', 'Please try choosing the file again.');
    }
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState('');
  const [existingRequestId, setExistingRequestId] = useState<string | null>(null);

  async function handleSubmit() {
    if (!service || !problem.trim() || !address.trim()) {
      setValidationMessage('Please select a service and add a problem description and repair address.');
      return;
    }
    
    if (timing === 'later') {
      if (!preferredDate || !preferredTime) {
        setValidationMessage('Please select both a preferred date and time.');
        return;
      }
    }
    setValidationMessage('');
    setIsSubmitting(true);
    setUploadState('Saving request...');

    let lat = customerLat;
    let lng = customerLng;

    // Request silently if not already captured
    if (!lat || !lng) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Timeout to avoid blocking submit indefinitely
          const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
          const location = await Promise.race([locPromise, timeoutPromise]) as Location.LocationObject | null;
          
          if (location) {
            lat = location.coords.latitude.toString();
            lng = location.coords.longitude.toString();
            setCustomerLat(lat);
            setCustomerLng(lng);
          }
        }
      } catch (e) {
        // gracefully ignore if unavailable
        console.log('Could not silently fetch location on submit', e);
      }
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!user) {
        const demoLogged = await SecureStore.getItemAsync('customer_demo_logged_in');
        if (demoLogged === 'true') {
          setIsSubmitting(false);
          setUploadState('');
          router.push({ 
            pathname: '/technician-comparison', 
            params: { 
              requestId: 'demo-request', 
              service, 
              location: address.trim(), 
              description: problem.trim(), 
              preferredTime: preferredTimeLabel,
              customerLat: lat,
              customerLng: lng
            } 
          } as unknown as Href);
          return;
        } else {
          throw new Error('You must be logged in to submit a request.');
        }
      }

      let finalRequestId = existingRequestId;

      if (!finalRequestId) {
        const { data: serviceData, error: serviceError } = await supabase
          .from('services')
          .select('id')
          .eq('name', service)
          .single();
        
        if (serviceError || !serviceData) throw new Error('Service not found.');

        const { data: requestData, error: insertError } = await supabase
          .from('service_requests')
          .insert({
            customer_id: user.id,
            service_id: serviceData.id,
            description: problem.trim(),
            status: 'REQUESTED',
            preferred_date: timing === 'later' ? preferredDate : null,
            preferred_time: timing === 'later' ? preferredTime : 'ASAP'
          })
          .select('id')
          .single();

        finalRequestId = requestData?.id || '';

        if (insertError) {
          throw insertError;
        }

        if (finalRequestId) {
          setExistingRequestId(finalRequestId);
        }
      }

      let mediaAlreadyUploaded = false;
      if (existingRequestId) {
        const { count, error: countError } = await supabase
          .from('service_request_media')
          .select('*', { count: 'exact', head: true })
          .eq('request_id', finalRequestId);
        if (!countError && count && count > 0) {
          mediaAlreadyUploaded = true;
        }
      }

      // Upload media if selected
      if (selectedPhoto && finalRequestId && !mediaAlreadyUploaded) {
        setUploadState('Uploading media...');
        const extension = selectedPhoto.name.split('.').pop()?.toLowerCase() || 'jpg';
        const isVideo = ['mp4', 'mov', 'quicktime'].includes(extension) || selectedPhoto.mimeType?.startsWith('video/');
        const safeName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
        const filePath = `${finalRequestId}/${safeName}`;
        const contentType = selectedPhoto.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

        try {
          let fileUri = selectedPhoto.uri;
          if (Platform.OS === 'android' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
            fileUri = 'file://' + fileUri;
          }

          const response = await fetch(fileUri);
          const arrayBuffer = await response.arrayBuffer();

          const { error: uploadError } = await supabase.storage
            .from('repair-media')
            .upload(filePath, arrayBuffer, {
              contentType,
              upsert: false
            });

          if (uploadError) {
            console.error('Upload failed:', uploadError);
            throw new Error(`Failed to upload media: ${uploadError.message}`);
          } else {
            const { error: mediaDbError } = await supabase
              .from('service_request_media')
              .insert({
                request_id: finalRequestId,
                storage_path: filePath,
                media_type: isVideo ? 'video' : 'image',
                file_name: selectedPhoto.name || safeName,
              });

            if (mediaDbError) {
              console.error('Failed to link media in database:', mediaDbError);
              throw new Error(`Failed to save media metadata: ${mediaDbError.message}`);
            }
          }
        } catch (e: any) {
          console.error('File read/upload error:', e);
          throw new Error(`Failed to process media: ${e.message}`);
        }
      }

      try {
        setUploadState('Analyzing your repair...');
        await invokeDiagnoseRepair(finalRequestId || '');
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        Alert.alert(
          'Analysis Delayed',
          'We could not complete the AI assessment right now, but your repair request was saved.',
          [
            { text: 'Continue anyway', onPress: () => router.push({ pathname: '/technician-comparison', params: { requestId: finalRequestId, service, location: address.trim(), description: problem.trim(), preferredTime: preferredTimeLabel, customerLat: lat, customerLng: lng } } as unknown as Href) },
            { text: 'Retry', onPress: () => setIsSubmitting(false) }
          ]
        );
        return;
      }

      setUploadState('Success!');

      router.push({ 
        pathname: '/ai-result', 
        params: { 
          requestId: finalRequestId, 
          service, 
          location: address.trim(), 
          description: problem.trim(), 
          preferredTime: preferredTimeLabel,
          customerLat: lat,
          customerLng: lng
        } 
      } as unknown as Href);
    } catch (error: any) {
      setUploadState('');
      setValidationMessage(error.message || 'An error occurred while submitting your request.');
    } finally {
      setIsSubmitting(false);
      setUploadState('');
    }
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
            <View style={styles.chipRow}>
              {loadingServices ? (
                <ThemedText style={styles.loadingText}>Loading services...</ThemedText>
              ) : services.map((item) => {
                const active = service === item;
                return (
                  <Pressable 
                    key={item} 
                    accessibilityRole="button" 
                    accessibilityState={{ selected: active }} 
                    onPress={() => setService(item)} 
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                  >
                    <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>{item}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <SectionLabel label="Describe the problem" />
            <View style={styles.inputCard}><TextInput accessibilityLabel="Problem description" value={problem} onChangeText={setProblem} placeholder="Describe the problem... What happened?" placeholderTextColor="#88A0B5" multiline maxLength={500} textAlignVertical="top" style={styles.problemInput} /><ThemedText style={styles.counter}>{problem.length}/500</ThemedText></View>

            {selectedPhoto ? (
              <View style={styles.photoCard}>
                <Image source={{ uri: selectedPhoto.uri }} contentFit="cover" style={styles.photoPreview} accessibilityLabel="Selected repair photo" />
                <View style={styles.photoCopy}><ThemedText style={styles.photoTitle}>Selected photo</ThemedText><ThemedText numberOfLines={1} style={styles.photoDescription}>{selectedPhoto.name}</ThemedText><View style={styles.photoActions}><Pressable accessibilityRole="button" onPress={pickPhoto} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}><ThemedText style={styles.changePhotoText}>Change photo</ThemedText></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Remove selected photo" onPress={() => setSelectedPhoto(null)} style={({ pressed }) => [styles.removePhotoAction, pressed && styles.pressed]}><ThemedText style={styles.removePhotoText}>Remove</ThemedText></Pressable></View></View>
              </View>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Add a repair photo" onPress={pickPhoto} style={({ pressed }) => [styles.photoCard, pressed && styles.pressed]}>
                <View style={styles.photoIcon}><ThemedText style={styles.photoIconText}>+</ThemedText></View><View style={styles.photoCopy}><ThemedText style={styles.photoTitle}>Add a photo</ThemedText><ThemedText style={styles.photoDescription}>Help technicians understand the problem faster.</ThemedText></View>
              </Pressable>
            )}

            <SectionLabel label="Repair Location" />
            <View style={styles.locationCard}>
              <Pressable 
                accessibilityRole="button" 
                onPress={async () => {
                  try {
                    setValidationMessage('');
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                      setValidationMessage('Location permission denied.');
                      return;
                    }
                    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setCustomerLat(location.coords.latitude.toString());
                    setCustomerLng(location.coords.longitude.toString());
                    
                    const geocode = await Location.reverseGeocodeAsync(location.coords);
                    if (geocode.length > 0) {
                      const place = geocode[0];
                      const addr = [place.street, place.city, place.region].filter(Boolean).join(', ');
                      if (addr) setAddress(addr);
                      else setAddress('Location Captured');
                    } else {
                      setAddress('Location Captured');
                    }
                  } catch (e: any) {
                    setValidationMessage('Could not retrieve location: ' + e.message);
                  }
                }} 
                style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}
              >
                <View style={styles.locationIcon}><ThemedText style={styles.locationIconText}>LOC</ThemedText></View>
                <ThemedText style={styles.locationActionText}>Use my current location</ThemedText>
              </Pressable>
              <TextInput accessibilityLabel="Repair address" value={address} onChangeText={setAddress} placeholder="Enter your address" placeholderTextColor="#88A0B5" style={styles.addressInput} />
            </View>

            <SectionLabel label="Preferred time" />
            <View style={styles.timingRow}><TimingOption label="As soon as possible" active={timing === 'asap'} onPress={() => setTiming('asap')} /><TimingOption label="Schedule for later" active={timing === 'later'} onPress={() => setTiming('later')} /></View>
            {timing === 'later' ? (
              <View style={styles.scheduleRow}>
                <Pressable onPress={() => setShowDatePicker(true)} style={styles.scheduleInputPicker}>
                  <ThemedText style={[styles.scheduleInputText, !preferredDate && { color: '#88A0B5' }]}>{preferredDate || "Select Date"}</ThemedText>
                </Pressable>
                <Pressable onPress={() => setShowTimePicker(true)} style={styles.scheduleInputPicker}>
                  <ThemedText style={[styles.scheduleInputText, !preferredTime && { color: '#88A0B5' }]}>{preferredTime || "Select Time"}</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {showDatePicker && (
              <DateTimePicker value={new Date()} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
            )}
            {showTimePicker && (
              <DateTimePicker value={new Date()} mode="time" display="default" onChange={onTimeChange} />
            )}

            <View style={styles.summaryCard}><ThemedText style={styles.summaryTitle}>Request Summary</ThemedText><SummaryRow label="Service" value={service || 'Select a service'} /><SummaryRow label="Problem" value={problem.trim() || 'Add a description'} /><SummaryRow label="Location" value={address.trim() || 'Add your address'} /><SummaryRow label="Preferred time" value={preferredTimeLabel} /></View>
            {validationMessage ? <ThemedText accessibilityLiveRegion="polite" style={styles.validation}>{validationMessage}</ThemedText> : null}
            <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={handleSubmit} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, isSubmitting && { opacity: 0.7 }]}><ThemedText style={styles.submitText}>{isSubmitting ? (uploadState || 'Creating request...') : 'Find Technicians'}</ThemedText></Pressable>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 21, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B' }, chipActive: { backgroundColor: '#2188D5', borderColor: '#72B9F2' }, chipText: { color: '#C9DAE8', fontSize: 14, fontWeight: '700' }, chipTextActive: { color: '#FFFFFF' }, loadingText: { color: '#88A0B5', fontSize: 14, fontStyle: 'italic' },
  inputCard: { minHeight: 138, borderRadius: 18, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', padding: 14 }, problemInput: { flex: 1, minHeight: 92, color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '500', padding: 0 }, counter: { alignSelf: 'flex-end', color: '#88A0B5', fontSize: 12, fontWeight: '600' },
  photoCard: { minHeight: 96, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDE8EB', flexDirection: 'row', alignItems: 'center', padding: 12, gap: 13, shadowColor: '#152326', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, photoIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#64D9E5', alignItems: 'center', justifyContent: 'center' }, photoIconText: { color: '#123A40', fontSize: 26, lineHeight: 30, fontWeight: '500' }, photoPreview: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#E7F2F3' }, photoCopy: { flex: 1, gap: 2, minWidth: 0 }, photoTitle: { color: '#123A40', fontSize: 16, fontWeight: '800' }, photoDescription: { color: '#68777A', fontSize: 13, lineHeight: 19, fontWeight: '600' }, photoActions: { flexDirection: 'row', gap: 8, marginTop: 6 }, photoAction: { minHeight: 32, justifyContent: 'center', borderRadius: 9, backgroundColor: '#E2F7F9', paddingHorizontal: 9 }, changePhotoText: { color: '#123A40', fontSize: 12, fontWeight: '800' }, removePhotoAction: { minHeight: 32, justifyContent: 'center', borderRadius: 9, paddingHorizontal: 7 }, removePhotoText: { color: '#A43737', fontSize: 12, fontWeight: '800' },
  locationCard: { borderRadius: 18, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', overflow: 'hidden' }, locationAction: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#23435B' }, locationIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#173D59', alignItems: 'center', justifyContent: 'center' }, locationIconText: { color: '#72B9F2', fontSize: 9, fontWeight: '900' }, locationActionText: { color: '#72B9F2', fontSize: 15, fontWeight: '800' }, addressInput: { minHeight: 54, color: '#FFFFFF', fontSize: 16, fontWeight: '500', paddingHorizontal: 14 },
  timingRow: { gap: 9 }, timingOption: { minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B' }, timingOptionActive: { borderColor: '#2188D5', backgroundColor: '#123752' }, radio: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: '#88A0B5', alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: '#5FB3F1' }, radioDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#5FB3F1' }, timingText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, scheduleRow: { flexDirection: 'row', gap: 10 }, scheduleInput: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', color: '#FFFFFF', fontSize: 14, fontWeight: '600', paddingHorizontal: 12 }, scheduleInputPicker: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: '#102D43', borderWidth: 1, borderColor: '#23435B', paddingHorizontal: 12, justifyContent: 'center' }, scheduleInputText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  summaryCard: { marginTop: 8, borderRadius: 20, backgroundColor: '#0C314B', padding: Spacing.three, gap: 12, borderWidth: 1, borderColor: '#24567A' }, summaryTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 25, fontWeight: '800', marginBottom: 2 }, summaryRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }, summaryLabel: { width: 104, color: '#93B4CC', fontSize: 13, lineHeight: 19, fontWeight: '700' }, summaryValue: { flex: 1, color: '#EAF4FC', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'right' }, validation: { color: '#FFD0CC', backgroundColor: '#4A2428', borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontWeight: '600' }, submitButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#2188D5', alignItems: 'center', justifyContent: 'center', marginTop: 2 }, submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.8 },
});



