import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { updateTechnicianProfile } from '@/services/supabase';
import { supabase } from '@/lib/supabase';

export default function BasicInformationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // User fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Profile fields
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [serviceRadius, setServiceRadius] = useState('10');
  
  // Service Area fields
  const [areaName, setAreaName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Skills
  const [services, setServices] = useState<any[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      try {
        // Fetch available services
        const { data: servicesData } = await supabase.from('services').select('*');
        if (servicesData) setServices(servicesData);

        // Fetch existing user data
        setName(user.name || '');
        setPhone(user.phone || '');
        setEmail(user.email || '');

        // Fetch partner_profiles
        const { data: profile } = await supabase
          .from('partner_profiles')
          .select('bio, experience_years, service_radius_km')
          .eq('id', user.id)
          .single();
          
        if (profile) {
          setBio(profile.bio || '');
          setExperienceYears(profile.experience_years?.toString() || '0');
          setServiceRadius(profile.service_radius_km?.toString() || '10');
        }

        // Fetch partner_service_areas
        const { data: area } = await supabase
          .from('partner_service_areas')
          .select('*')
          .eq('partner_id', user.id)
          .maybeSingle();

        if (area) {
          setAreaName(area.area_name || '');
          setLatitude(area.latitude?.toString() || '');
          setLongitude(area.longitude?.toString() || '');
        }

        // Fetch partner_skills
        const { data: skillsData } = await supabase
          .from('partner_skills')
          .select('service_id')
          .eq('partner_id', user.id);
        
        if (skillsData) {
          setSelectedSkills(skillsData.map((s: any) => s.service_id));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const toggleSkill = (serviceId: number) => {
    setSelectedSkills(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Validate inputs
      const exp = parseInt(experienceYears);
      const rad = parseFloat(serviceRadius);
      const lat = latitude ? parseFloat(latitude) : null;
      const lng = longitude ? parseFloat(longitude) : null;

      if (isNaN(exp) || exp < 0) throw new Error('Experience must be a valid positive number');
      if (isNaN(rad) || rad <= 0 || rad > 9999.99) throw new Error('Service radius must be greater than 0 and less than 10000');
      if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) throw new Error('Invalid latitude');
      if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) throw new Error('Invalid longitude');
      if (!areaName.trim()) throw new Error('Service Area Name is required');
      if ((lat === null && lng !== null) || (lat !== null && lng === null)) throw new Error('Both Latitude and Longitude must be provided together, or leave both empty.');

      // Use atomic RPC for all updates
      await updateTechnicianProfile(
        name,
        phone,
        bio,
        exp,
        rad,
        areaName,
        lat,
        lng,
        selectedSkills
      );

      Alert.alert('Success', 'Profile updated successfully.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save information');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name="chevron.left" size={24} tintColor={FixGoColors.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Professional Profile</ThemedText>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          
          <View style={styles.photoSection}>
            <View style={styles.photoPlaceholder}>
              <SymbolView name="person.fill" size={40} tintColor={FixGoColors.textSecondary} />
            </View>
            <Pressable style={styles.editPhotoBtn}>
              <ThemedText style={styles.editPhotoText}>Add Photo</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={styles.sectionTitle}>Basic Information</ThemedText>
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your full name" />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Phone Number</ThemedText>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit number" />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Email Address (Read Only)</ThemedText>
            <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Bio / About Me</ThemedText>
            <TextInput style={[styles.input, { height: 100, paddingTop: 12 }]} value={bio} onChangeText={setBio} placeholder="Describe your experience..." multiline />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Overall Experience (Years)</ThemedText>
            <TextInput style={styles.input} value={experienceYears} onChangeText={setExperienceYears} keyboardType="number-pad" placeholder="e.g. 5" />
          </View>

          <ThemedText style={[styles.sectionTitle, { marginTop: 12 }]}>Service Area</ThemedText>
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Service Location Name *</ThemedText>
            <TextInput style={styles.input} value={areaName} onChangeText={setAreaName} placeholder="e.g. Indiranagar, Bangalore" />
          </View>
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Matching Radius (km) *</ThemedText>
            <TextInput style={styles.input} value={serviceRadius} onChangeText={setServiceRadius} keyboardType="numeric" placeholder="e.g. 10" />
            <ThemedText style={{ fontSize: 11, color: FixGoColors.textSecondary, marginTop: 4 }}>You will only receive jobs within this distance from your location.</ThemedText>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <ThemedText style={styles.label}>Latitude</ThemedText>
              <TextInput style={styles.input} value={latitude} onChangeText={setLatitude} keyboardType="numeric" placeholder="e.g. 12.9716" />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <ThemedText style={styles.label}>Longitude</ThemedText>
              <TextInput style={styles.input} value={longitude} onChangeText={setLongitude} keyboardType="numeric" placeholder="e.g. 77.5946" />
            </View>
          </View>

          <View style={styles.skillsSection}>
            <ThemedText style={styles.sectionTitle}>Your Skills (Select all that apply)</ThemedText>
            <View style={styles.skillsGrid}>
              {services.map(service => (
                <Pressable 
                  key={service.id} 
                  style={[styles.skillChip, selectedSkills.includes(service.id) && styles.skillChipActive]}
                  onPress={() => toggleSkill(service.id)}
                >
                  <ThemedText style={[styles.skillChipText, selectedSkills.includes(service.id) && styles.skillChipTextActive]}>
                    {service.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.primaryBtn, isSaving && { opacity: 0.7 }]} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={FixGoColors.card} /> : <ThemedText style={styles.primaryBtnText}>Save Information</ThemedText>}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.two },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: FixGoColors.text },
  
  content: { paddingHorizontal: Spacing.four, paddingBottom: 40 },
  
  photoSection: { alignItems: 'center', marginVertical: 24 },
  photoPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#E4ECEC', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  editPhotoBtn: { backgroundColor: '#E2F7F9', paddingHorizontal: 16, paddingVertical: 6, borderRadius: Radius.pill },
  editPhotoText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800' },
  
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: FixGoColors.textSecondary, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, paddingHorizontal: 16, fontSize: 15, fontWeight: '600', color: FixGoColors.text, backgroundColor: FixGoColors.card },
  inputDisabled: { backgroundColor: '#F3F7F7', color: FixGoColors.textSecondary },
  
  skillsSection: { marginTop: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: FixGoColors.text, marginBottom: 16 },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skillChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border },
  skillChipActive: { backgroundColor: FixGoColors.primary, borderColor: FixGoColors.primary },
  skillChipText: { fontSize: 14, fontWeight: '600', color: FixGoColors.textSecondary },
  skillChipTextActive: { color: FixGoColors.card, fontWeight: '800' },

  footer: { padding: Spacing.four, backgroundColor: FixGoColors.background, borderTopWidth: 1, borderColor: FixGoColors.border },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});

