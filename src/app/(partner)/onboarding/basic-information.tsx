import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function BasicInformationScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [services, setServices] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch available services for skills
        const { data: servicesData } = await supabase.from('services').select('*');
        if (servicesData) setServices(servicesData);

        // Fetch existing user/profile data
        setName(user.name || '');
        setPhone(user.phone || '');
        setEmail(user.email || '');
        setLocation(user.location || '');

        // Fetch existing skills
        const { data: skillsData } = await supabase
          .from('partner_skills')
          .select('service_id')
          .eq('partner_id', user.id);
        
        if (skillsData) {
          setSelectedSkills(skillsData.map(s => s.service_id));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const toggleSkill = (serviceId: string) => {
    setSelectedSkills(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Update users table
      await supabase
        .from('users')
        .update({ name, phone, location })
        .eq('id', user.id);
      
      // Update partner_profiles (just in case it's not created)
      await supabase
        .from('partner_profiles')
        .upsert({ id: user.id, is_online: true }, { onConflict: 'id' });

      // Update skills (delete old, insert new)
      await supabase.from('partner_skills').delete().eq('partner_id', user.id);
      if (selectedSkills.length > 0) {
        const skillsToInsert = selectedSkills.map(serviceId => ({
          partner_id: user.id,
          service_id: serviceId
        }));
        await supabase.from('partner_skills').insert(skillsToInsert);
      }

      Alert.alert('Success', 'Profile information updated successfully.');
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
          <ThemedText style={styles.headerTitle}>Basic Info</ThemedText>
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
            <ThemedText style={styles.label}>Service Location / Area</ThemedText>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g. Indiranagar, Bangalore" />
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
  input: { height: 50, borderWidth: 1, borderColor: FixGoColors.border, borderRadius: Radius.medium, paddingHorizontal: 16, fontSize: 15, fontWeight: '600', color: FixGoColors.text, backgroundColor: FixGoColors.card },
  inputDisabled: { backgroundColor: '#F3F7F7', color: FixGoColors.textSecondary },
  
  skillsSection: { marginTop: 12, marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: FixGoColors.text, marginBottom: 12 },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skillChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border },
  skillChipActive: { backgroundColor: FixGoColors.primary, borderColor: FixGoColors.primary },
  skillChipText: { fontSize: 14, fontWeight: '600', color: FixGoColors.textSecondary },
  skillChipTextActive: { color: FixGoColors.card, fontWeight: '800' },

  footer: { padding: Spacing.four, backgroundColor: FixGoColors.background, borderTopWidth: 1, borderColor: FixGoColors.border },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});
