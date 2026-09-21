import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import {
  IdCard, Wrench, FileCheck2, IndianRupee, Bell, Globe, Moon, CircleHelp, Shield, FileText, Star, LogOut, ChevronRight
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDemo } from '@/context/demo-flow-context';

import * as SecureStore from 'expo-secure-store';

export default function PartnerSettingsScreen() {
  const { user, logout } = useAuth();
  const { clearDemo } = useDemo();

  const handleLogout = async () => {
    try {
      if (user) {
        await logout();
      }
      // Clear demo login state
      await clearDemo();
      await SecureStore.deleteItemAsync('partner_demo_logged_in');
      router.replace('/(partner)/auth/login' as any);
    } catch (e) {
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  const OptionRow = ({ icon, title, onPress }: { icon: React.ReactNode, title: string, onPress?: () => void }) => (
    <Pressable style={styles.optionRow} onPress={onPress}>
      <View style={styles.optionIcon}>
        {icon}
      </View>
      <ThemedText style={styles.optionText}>{title}</ThemedText>
      <ChevronRight size={16} color={FixGoColors.textSecondary} />
    </Pressable>
  );

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText style={styles.headerTitle}>Profile & Settings</ThemedText>
          </View>
          
          {/* Header Profile */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'T'}</ThemedText>
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>{user?.name || 'Technician Partner'}</ThemedText>
              <ThemedText style={styles.profilePhone}>{user?.phone || user?.email || 'No contact info'}</ThemedText>
            </View>
            <Pressable style={styles.editBtn} onPress={() => router.push('/(partner)/onboarding/basic-information' as any)}>
              <ThemedText style={styles.editBtnText}>Edit</ThemedText>
            </Pressable>
          </View>

          <Section title="Account Setup">
            <OptionRow icon={<IdCard size={18} color={FixGoColors.primary} />} title="Basic Information" onPress={() => router.push('/(partner)/onboarding/basic-information' as any)} />
            <OptionRow icon={<Wrench size={18} color={FixGoColors.primary} />} title="Skills & Specializations" onPress={() => router.push('/(partner)/onboarding/basic-information' as any)} />
            <OptionRow icon={<FileCheck2 size={18} color={FixGoColors.primary} />} title="Document Verification" onPress={() => router.push('/(partner)/onboarding/document-verification' as any)} />
            <OptionRow icon={<IndianRupee size={18} color={FixGoColors.primary} />} title="Payment Methods" onPress={() => router.push('/(partner)/onboarding/payment-methods' as any)} />
          </Section>

          <Section title="Preferences">
            <OptionRow icon={<Bell size={18} color={FixGoColors.primary} />} title="Notifications" />
            <OptionRow icon={<Globe size={18} color={FixGoColors.primary} />} title="Language" />
            <OptionRow icon={<Moon size={18} color={FixGoColors.primary} />} title="Theme" />
          </Section>

          <Section title="Support & About">
            <OptionRow icon={<CircleHelp size={18} color={FixGoColors.primary} />} title="Help Center" />
            <OptionRow icon={<Shield size={18} color={FixGoColors.primary} />} title="Privacy Policy" />
            <OptionRow icon={<FileText size={18} color={FixGoColors.primary} />} title="Terms & Conditions" />
            <OptionRow icon={<Star size={18} color={FixGoColors.primary} />} title="Rate the App" />
          </Section>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={18} color="#B54747" />
            <ThemedText style={styles.logoutText}>Logout</ThemedText>
          </Pressable>
          
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, paddingBottom: 100, gap: 24 },
  
  header: { paddingBottom: Spacing.two },
  headerTitle: { color: FixGoColors.text, fontSize: 24, fontWeight: '900' },
  
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: FixGoColors.card, padding: Spacing.three, borderRadius: Radius.large, borderWidth: 1, borderColor: FixGoColors.border },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: FixGoColors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: FixGoColors.card, fontSize: 20, fontWeight: '900' },
  profileInfo: { flex: 1, marginLeft: 12 },
  profileName: { color: FixGoColors.text, fontSize: 18, fontWeight: '900' },
  profilePhone: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  editBtn: { backgroundColor: FixGoColors.accentSurface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill },
  editBtnText: { color: FixGoColors.primary, fontSize: 12, fontWeight: '800' },

  section: { gap: 8 },
  sectionTitle: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginLeft: 4 },
  sectionCard: { backgroundColor: FixGoColors.card, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border, overflow: 'hidden' },
  
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: FixGoColors.border },
  optionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F7F7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionText: { flex: 1, color: FixGoColors.text, fontSize: 15, fontWeight: '700' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: '#FDECEC', borderRadius: Radius.medium, marginTop: 12 },
  logoutText: { color: '#B54747', fontSize: 15, fontWeight: '800' }
});
