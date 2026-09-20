import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { fetchTechnicianDocuments, uploadTechnicianDocument, submitProfileForVerification, TechnicianDocument } from '@/services/supabase';

export default function DocumentVerificationScreen() {
  const [documents, setDocuments] = useState<TechnicianDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await fetchTechnicianDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (docType: 'id_proof' | 'skill_certificate' | 'address_proof', title: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];

      setIsUploading(docType);

      await uploadTechnicianDocument(
        file.uri,
        file.name,
        file.mimeType || 'application/octet-stream',
        docType
      );

      Alert.alert('Success', `${title} uploaded successfully.`);
      await loadDocuments();
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Could not upload the document.');
    } finally {
      setIsUploading(null);
    }
  };

  const handleSubmitVerification = async () => {
    const hasIdProof = documents.some(d => d.document_type === 'id_proof');
    const hasSkillCert = documents.some(d => d.document_type === 'skill_certificate');

    if (!hasIdProof || !hasSkillCert) {}

    setIsSubmitting(true);
    try {
      await submitProfileForVerification();
      router.replace('/(partner)/(tabs)/home' as any);
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'Could not submit for verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocStatus = (type: string) => {
    // get most recent of type
    const doc = documents.find(d => d.document_type === type);
    return doc ? doc.verification_status : 'pending'; // 'pending' means not uploaded here visually, wait, let's use actual states
  };

  const getDocText = (type: string) => {
    const doc = documents.find(d => d.document_type === type);
    if (!doc) return 'Not Uploaded';
    if (doc.verification_status === 'approved') return 'Verified';
    if (doc.verification_status === 'rejected') return 'Rejected - Tap to Replace';
    return 'Pending Review';
  };

  const UploadCard = ({ title, docType }: { title: string, docType: 'id_proof' | 'skill_certificate' | 'address_proof' }) => {
    const doc = documents.find(d => d.document_type === docType);
    const isUploaded = !!doc;
    const status = doc?.verification_status;
    const isRejected = status === 'rejected';
    const isVerified = status === 'approved';
    const isPending = status === 'pending';

    return (
      <View style={[styles.uploadCard, isRejected && styles.uploadCardRejected]}>
        <View style={styles.uploadInfo}>
          <SymbolView name="doc.text.fill" size={24} tintColor={isVerified ? FixGoColors.success : isRejected ? FixGoColors.error : isUploaded ? FixGoColors.primary : FixGoColors.textSecondary} />
          <View style={styles.uploadTextWrap}>
            <ThemedText style={styles.uploadTitle}>{title}</ThemedText>
            <ThemedText style={[
              styles.uploadStatus,
              isVerified && { color: FixGoColors.success },
              isRejected && { color: FixGoColors.error }
            ]}>
              {getDocText(docType)}
            </ThemedText>
            {isRejected && doc?.rejection_reason && (
              <ThemedText style={styles.rejectionReason}>{doc.rejection_reason}</ThemedText>
            )}
          </View>
        </View>

        {isUploading === docType ? (
          <ActivityIndicator size="small" color={FixGoColors.primary} style={{ marginHorizontal: 16 }} />
        ) : (
          <Pressable
            style={[styles.uploadBtn, isVerified && { opacity: 0.5 }]}
            onPress={() => handleUpload(docType, title)}
            disabled={isVerified}
          >
            <ThemedText style={styles.uploadBtnText}>{isUploaded ? (isRejected ? 'Replace' : 'Update') : 'Upload'}</ThemedText>
          </Pressable>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

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
            <ThemedText style={styles.sectionLabel}>ID Proof (Required)</ThemedText>
            <UploadCard title="Aadhaar Card (Front & Back)" docType="id_proof" />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Professional Details (Required)</ThemedText>
            <UploadCard title="Skill Certificate (ITI / Diploma)" docType="skill_certificate" />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Address Proof (Optional)</ThemedText>
            <UploadCard title="Utility Bill or Passport" docType="address_proof" />
          </View>

          <View style={styles.infoBox}>
            <SymbolView name="lock.shield.fill" size={16} tintColor={FixGoColors.success} />
            <ThemedText style={styles.infoText}>Your data is encrypted and stored securely in a private vault. Customers cannot view these documents.</ThemedText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSubmitVerification}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
               <ActivityIndicator size="small" color={FixGoColors.card} />
            ) : (
               <ThemedText style={styles.primaryBtnText}>Submit for Verification</ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth, justifyContent: 'space-between' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: FixGoColors.text },

  content: { paddingHorizontal: Spacing.four, marginTop: Spacing.four, gap: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: FixGoColors.text },
  subtitle: { fontSize: 14, fontWeight: '600', color: FixGoColors.textSecondary, lineHeight: 20 },

  section: { gap: 12, marginTop: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: FixGoColors.text },

  uploadCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: FixGoColors.card, padding: Spacing.three, borderRadius: Radius.medium, borderWidth: 1, borderColor: FixGoColors.border },
  uploadCardRejected: { borderColor: FixGoColors.error, backgroundColor: '#FFF5F5' },
  uploadInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  uploadTextWrap: { marginLeft: 12, flex: 1 },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: FixGoColors.text },
  uploadStatus: { fontSize: 12, fontWeight: '600', color: FixGoColors.textSecondary, marginTop: 4 },
  rejectionReason: { fontSize: 11, color: FixGoColors.error, marginTop: 4, fontStyle: 'italic' },

  uploadBtn: { backgroundColor: '#E2F7F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill },
  uploadBtnText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800' },

  infoBox: { flexDirection: 'row', backgroundColor: '#E8F5E9', padding: 12, borderRadius: Radius.medium, gap: 8, marginTop: 12 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '600', color: FixGoColors.success, lineHeight: 16 },

  footer: { padding: Spacing.four, borderTopWidth: 1, borderColor: FixGoColors.border },
  primaryBtn: { height: 56, backgroundColor: FixGoColors.primary, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' },
});
