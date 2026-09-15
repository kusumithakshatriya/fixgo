import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function DocumentVerificationScreen() {
  const handleUpload = (docName: string) => {
    Alert.alert('Upload Document', `Picker for ${docName} would open here.`);
  };

  const UploadCard = ({ title, status }: { title: string, status: 'Pending' | 'Uploaded' | 'Verified' }) => (
    <View style={styles.uploadCard}>
      <View style={styles.uploadInfo}>
        <SymbolView name="doc.text.fill" size={24} tintColor={status === 'Pending' ? FixGoColors.textSecondary : FixGoColors.primary} />
        <View style={styles.uploadTextWrap}>
          <ThemedText style={styles.uploadTitle}>{title}</ThemedText>
          <ThemedText style={[styles.uploadStatus, status === 'Verified' && { color: FixGoColors.success }]}>{status}</ThemedText>
        </View>
      </View>
      <Pressable style={styles.uploadBtn} onPress={() => handleUpload(title)}>
        <ThemedText style={styles.uploadBtnText}>{status === 'Pending' ? 'Upload' : 'Update'}</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name="chevron.left" size={24} tintColor={FixGoColors.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Verification</ThemedText>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={styles.title}>Identity & Skills</ThemedText>
          <ThemedText style={styles.subtitle}>Upload your documents to verify your profile. Documents will be reviewed by our team.</ThemedText>

          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>ID Proof</ThemedText>
            <UploadCard title="Aadhaar Card (Front & Back)" status="Pending" />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Professional Details</ThemedText>
            <UploadCard title="Skill Certificate (ITI / Diploma)" status="Pending" />
            <UploadCard title="Work Experience Proof" status="Pending" />
          </View>

          <View style={styles.infoBox}>
            <SymbolView name="lock.shield.fill" size={16} tintColor={FixGoColors.success} />
            <ThemedText style={styles.infoText}>Your data is encrypted and stored securely. We do not share your documents with customers.</ThemedText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <ThemedText style={styles.primaryBtnText}>Continue</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth, justifyContent: 'space-between' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: FixGoColors.text },
  
  content: { paddingHorizontal: Spacing.four, marginTop: Spacing.four, gap: 16 },
  title: { fontSize: 24, fontWeight: '900', color: FixGoColors.text },
  subtitle: { fontSize: 14, fontWeight: '600', color: FixGoColors.textSecondary, lineHeight: 20 },
  
  section: { gap: 12, marginTop: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: FixGoColors.text },
  
  uploadCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: FixGoColors.card, padding: Spacing.three, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border },
  uploadInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  uploadTextWrap: { marginLeft: 12, flex: 1 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: FixGoColors.text },
  uploadStatus: { fontSize: 12, fontWeight: '600', color: FixGoColors.textSecondary, marginTop: 4 },
  
  uploadBtn: { backgroundColor: '#E2F7F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill },
  uploadBtnText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800' },
  
  infoBox: { flexDirection: 'row', backgroundColor: '#E8F5E9', padding: 12, borderRadius: Radius.medium, gap: 8, marginTop: 12 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '600', color: FixGoColors.success, lineHeight: 16 },

  footer: { padding: Spacing.four },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});
