import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getDiagnosis, invokeDiagnoseRepair, type AIDiagnosisResult } from '@/services/ai-diagnosis';

export default function AIResultScreen() {
  const params = useLocalSearchParams();
  const { requestId, service, location, description, preferredTime, customerLat, customerLng } = params;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diagnosis, setDiagnosis] = useState<AIDiagnosisResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: ReturnType<typeof setTimeout>;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      if (!isMounted) return;
      try {
        if (!requestId || typeof requestId !== 'string') {
          throw new Error('Invalid request ID');
        }

        const result = await getDiagnosis(requestId);
        if (!result) {
          throw new Error('Diagnosis record not found in database.');
        }

        if (result.status === 'COMPLETED') {
          if (isMounted) {
            setDiagnosis(result);
            setLoading(false);
            clearTimeout(timeoutId);
          }
          return; // Stop polling
        } else if (result.status === 'FAILED') {
          clearTimeout(timeoutId);
          throw new Error('AI analysis failed. Please try again or continue manually.');
        } else if (result.status === 'PENDING' || result.status === 'PROCESSING') {
          // Continue polling
          pollInterval = setTimeout(poll, 2000);
        } else {
          clearTimeout(timeoutId);
          throw new Error(`Unknown status: ${result.status}`);
        }
      } catch (e: any) {
        if (isMounted) {
          clearTimeout(timeoutId);
          setError(e.message || 'Failed to load diagnosis');
          setLoading(false);
        }
      }
    }

    poll();
    // Timeout after 45 seconds
    timeoutId = setTimeout(() => {
      if (isMounted) {
        clearTimeout(pollInterval);
        // If we haven't loaded yet, it means it's still stuck
        setLoading(false);
        setError('AI analysis timed out. Please continue manually.');
      }
    }, 45000);

    return () => {
      isMounted = false;
      clearTimeout(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [requestId, retryCount]);

  const navigateToComparison = () => {
    router.push({
      pathname: '/technician-comparison',
      params: { requestId, service, location, description, preferredTime, customerLat, customerLng }
    } as unknown as Href);
  };

  const handleRetryAI = async () => {
    setLoading(true);
    setError('');
    try {
      if (typeof requestId !== 'string') return;
      await invokeDiagnoseRepair(requestId);
      setRetryCount(c => c + 1); // Trigger polling effect
    } catch (e: any) {
      setError(e.message || 'Failed to retry diagnosis.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator size="large" color="#2188D5" />
        <ThemedText style={styles.loadingText}>Fetching AI Assessment...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>FixGo AI Assessment</ThemedText>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable onPress={handleRetryAI} style={styles.retryButton}>
                <ThemedText style={styles.continueText}>Retry AI Analysis</ThemedText>
              </Pressable>
              <Pressable onPress={navigateToComparison} style={styles.continueButton}>
                <ThemedText style={styles.continueText}>Skip & Continue</ThemedText>
              </Pressable>
            </View>
          ) : diagnosis ? (
            <View style={styles.resultCard}>
              <Section title="Problem" content={diagnosis.diagnosis} />
              
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Section title="Severity" content={diagnosis.severity} highlight />
                </View>
                <View style={styles.halfCol}>
                  <Section title="Confidence" content={`${diagnosis.confidence}%`} />
                </View>
              </View>

              <Section title="Estimated Cost" content={`₹${diagnosis.estimated_min} - ₹${diagnosis.estimated_max}`} />
              
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Section title="Parts" content={`₹${diagnosis.parts_estimate}`} />
                </View>
                <View style={styles.halfCol}>
                  <Section title="Labour" content={`₹${diagnosis.labor_estimate}`} />
                </View>
              </View>

              <Section title="Recommendation" content={diagnosis.recommendation} />

              <Pressable onPress={navigateToComparison} style={styles.continueButton}>
                <ThemedText style={styles.continueText}>Find Technicians</ThemedText>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={[styles.sectionContent, highlight && styles.highlightText]}>{content}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#071A2B' },
  center: { alignItems: 'center', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  content: { padding: Spacing.four, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  loadingText: { color: '#B5C9DA', fontSize: 16, marginTop: 16 },
  errorCard: { backgroundColor: '#4A2428', padding: 20, borderRadius: 16, gap: 16 },
  errorText: { color: '#FFD0CC', fontSize: 16, lineHeight: 22 },
  resultCard: { backgroundColor: '#102D43', borderRadius: 16, padding: 20, gap: 20, borderWidth: 1, borderColor: '#23435B' },
  section: { gap: 4 },
  sectionTitle: { color: '#88A0B5', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionContent: { color: '#EAF4FC', fontSize: 16, lineHeight: 24, fontWeight: '500' },
  highlightText: { color: '#FF9500', fontWeight: '800' },
  row: { flexDirection: 'row', gap: 16 },
  halfCol: { flex: 1 },
  continueButton: { backgroundColor: '#2188D5', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  retryButton: { backgroundColor: '#102D43', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#23435B' },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});
