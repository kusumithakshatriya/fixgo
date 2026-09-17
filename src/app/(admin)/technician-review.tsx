import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/Button';
import { FixGoColors } from '@/constants/theme';
import {
  fetchTechnicianVerificationDetail,
  fetchAdminTechnicianDocuments,
  createTechnicianDocumentSignedUrl,
  adminProcessDocumentVerification,
  adminProcessTechnicianVerification
} from '@/services/supabase';

export default function TechnicianReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profData, docsData] = await Promise.all([
        fetchTechnicianVerificationDetail(id),
        fetchAdminTechnicianDocuments(id)
      ]);

      const docsWithUrls = await Promise.all(docsData.map(async (doc) => {
        try {
          const url = await createTechnicianDocumentSignedUrl(doc.storage_path);
          return { ...doc, signedUrl: url };
        } catch (e) {
          console.error('Signed URL error', e);
          return { ...doc, signedUrl: null };
        }
      }));

      setProfile(profData);
      setDocuments(docsWithUrls);
    } catch (error) {
      console.error('Error loading technician review', error);
      Alert.alert('Error', 'Failed to load technician data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handleDocumentAction = async (docId: string, decision: 'approved' | 'rejected', reason?: string) => {
    try {
      setProcessing(true);
      await adminProcessDocumentVerification(docId, decision, reason);
      Alert.alert('Success', `Document ${decision}`);
      setShowRejectModal(null);
      setRejectionReason('');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process document');
    } finally {
      setProcessing(false);
    }
  };

  const handleProfileAction = async (decision: 'approved' | 'rejected', reason?: string) => {
    try {
      setProcessing(true);
      await adminProcessTechnicianVerification(id, decision, reason);
      Alert.alert('Success', `Technician ${decision}`);
      router.back();
    } catch (error: any) {
      Alert.alert('Backend Error', error.message || 'Failed to process technician');
    } finally {
      setProcessing(false);
      setShowRejectModal(null);
      setRejectionReason('');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Profile Information</ThemedText>
        <ThemedText>Name: {profile.users?.name}</ThemedText>
        <ThemedText>Phone: {profile.users?.phone}</ThemedText>
        <ThemedText>Experience: {profile.years_of_experience} years</ThemedText>
        <ThemedText>Status: {profile.verification_status}</ThemedText>
        <ThemedText>Bio: {profile.bio}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>KYC Documents</ThemedText>
        <ThemedText style={styles.warningText}>Note: Backend requires ID Proof and Skill Certificate to be APPROVED before profile approval.</ThemedText>

        {documents.map(doc => (
          <View key={doc.id} style={styles.docCard}>
            <ThemedText style={styles.docTitle}>{doc.document_type.replace('_', ' ').toUpperCase()}</ThemedText>
            <ThemedText>Status: {doc.verification_status.toUpperCase()}</ThemedText>
            {doc.rejection_reason && <ThemedText style={{color: FixGoColors.error}}>Reason: {doc.rejection_reason}</ThemedText>}

            {doc.signedUrl ? (
              <Image
                source={{ uri: doc.signedUrl }}
                style={styles.docImage}
                contentFit="contain"
              />
            ) : (
              <View style={styles.noImage}><ThemedText>Preview Not Available</ThemedText></View>
            )}

            {showRejectModal === doc.id ? (
              <View style={styles.rejectContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Rejection Reason..."
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                />
                <Button
                  label="Confirm Reject"
                  onPress={() => handleDocumentAction(doc.id, 'rejected', rejectionReason)}
                  loading={processing}
                  style={{backgroundColor: FixGoColors.error}}
                />
                <Button label="Cancel" variant="outline" onPress={() => setShowRejectModal(null)} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button
                  label="Approve"
                  onPress={() => handleDocumentAction(doc.id, 'approved')}
                  loading={processing}
                  disabled={doc.verification_status === 'approved'}
                  style={styles.actionBtn}
                />
                <Button
                  label="Reject"
                  onPress={() => setShowRejectModal(doc.id)}
                  disabled={doc.verification_status === 'rejected'}
                  style={[styles.actionBtn, { backgroundColor: FixGoColors.error }]}
                />
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.finalActions}>
        {showRejectModal === 'profile' ? (
          <View style={styles.rejectContainer}>
            <TextInput
              style={styles.input}
              placeholder="Technician Rejection Reason..."
              value={rejectionReason}
              onChangeText={setRejectionReason}
            />
            <Button
              label="Confirm Reject Technician"
              onPress={() => handleProfileAction('rejected', rejectionReason)}
              loading={processing}
              style={{backgroundColor: FixGoColors.error}}
            />
            <Button label="Cancel" variant="outline" onPress={() => setShowRejectModal(null)} />
          </View>
        ) : (
          <>
            <Button
              label="Approve Technician"
              onPress={() => handleProfileAction('approved')}
              loading={processing}
              style={{ marginBottom: 12 }}
            />
            <Button
              label="Reject Technician"
              onPress={() => setShowRejectModal('profile')}
              loading={processing}
              style={{ backgroundColor: FixGoColors.error }}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FixGoColors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: FixGoColors.border },
  sectionTitle: { marginBottom: 12 },
  warningText: { fontSize: 12, color: FixGoColors.warning, marginBottom: 12 },
  docCard: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: FixGoColors.border },
  docTitle: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  docImage: { width: '100%', height: 200, backgroundColor: '#f0f0f0', marginVertical: 12, borderRadius: 8 },
  noImage: { width: '100%', height: 100, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginVertical: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1 },
  rejectContainer: { marginTop: 12, gap: 12 },
  input: { borderWidth: 1, borderColor: FixGoColors.border, padding: 12, borderRadius: 8, backgroundColor: '#fff' },
  finalActions: { marginTop: 20 }
});
