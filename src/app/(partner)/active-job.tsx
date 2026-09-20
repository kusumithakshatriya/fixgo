import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Linking, Modal, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import * as Location from 'expo-location';
import {
  fetchPartnerJobs,
  updateBookingStatus,
  updateTechnicianLocation,
  PartnerJob,
  fetchBookingAdditionalCharges,
  createAdditionalChargeRequest,
  subscribeToAdditionalChargeUpdates,
  AdditionalChargeRequest,
  createOrGetPayment,
  fetchBookingPayment,
  requestCashPayment,
  subscribeToPaymentUpdates,
  Payment,
  cancelBooking,
  subscribeToBookingUpdates
} from '@/services/supabase';

const CANCEL_REASONS = [
  'Customer unavailable',
  'Wrong address',
  'Unsafe working conditions',
  'Required parts unavailable',
  'Other'
];

export default function ActiveJobScreen() {
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState<any>(null);
  const [charges, setCharges] = useState<AdditionalChargeRequest[]>([]);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeReason, setChargeReason] = useState('');
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Off');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isConfirmingCash, setIsConfirmingCash] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDescription, setCancelDescription] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const loadJob = async () => {
    try {
      const jobs = await fetchPartnerJobs();
      const found = jobs.find(j => j.id === id);
      if (found) {
        setJob(found);
        const fetchedCharges = await fetchBookingAdditionalCharges(found.id);
        setCharges(fetchedCharges);

        const fetchedPayment = await fetchBookingPayment(found.id);
        setPayment(fetchedPayment);
      } else {
        Alert.alert('Error', 'Job not found');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadJob();
  }, [id]);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    let isMounted = true;
    const unsubscribeBooking = subscribeToBookingUpdates(id, (payload) => {
      if (!isMounted) return;
      const newStatus = payload.new?.status;
      if (newStatus) {
        setJob((prev: any) => {
          if (!prev) return prev;
          return { ...prev, status: newStatus };
        });

        if (newStatus === 'Cancelled') {
          Alert.alert(
            'Booking Cancelled',
            'The customer has cancelled this booking.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          loadJob();
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeBooking();
    };
  }, [id]);

  useEffect(() => {
    if (!job) return;
    const unsubscribe = subscribeToAdditionalChargeUpdates(job.id, (payload) => {
      loadJob();
    });

    let unsubscribePayment: (() => void) | undefined;
    if (payment) {
      unsubscribePayment = subscribeToPaymentUpdates(payment.id, () => {
        loadJob();
      });
    }

    return () => {
      unsubscribe();
      if (unsubscribePayment) unsubscribePayment();
    };
  }, [job?.id, payment?.id]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      if (!job) return;
      const validStatuses = ['Accepted', 'On The Way', 'Arrived', 'Work In Progress'];
      if (!validStatuses.includes(job.status)) {
        setLocationStatus('Off');
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationStatus('Denied');
          return;
        }

        setLocationStatus('Sharing');
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 15,
          },
          (location) => {
            updateTechnicianLocation(location.coords.latitude, location.coords.longitude);
          }
        );
      } catch (err) {
        console.error('Location tracking error:', err);
        setLocationStatus('Error');
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [job?.status]);

  const handleSubmitCharge = async () => {
    if (!job) return;
    const amountNum = parseFloat(chargeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!chargeReason.trim()) {
      Alert.alert('Invalid Reason', 'Please provide a reason for the additional charge.');
      return;
    }

    setIsSubmittingCharge(true);
    try {
      await createAdditionalChargeRequest(job.id, job.customer.id, amountNum, chargeReason.trim());
      setChargeAmount('');
      setChargeReason('');
      setShowChargeForm(false);
      Alert.alert('Success', 'Additional charge request sent.');
      await loadJob();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to send additional charge request. Please try again.');
    } finally {
      setIsSubmittingCharge(false);
    }
  };

  const handleConfirmCash = async () => {
    if (!payment) return;
    setIsConfirmingCash(true);
    try {
      await requestCashPayment(payment.id);
      await loadJob();
      Alert.alert('Success', 'Customer notified. Waiting for their confirmation.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not request cash payment.');
    } finally {
      setIsConfirmingCash(false);
    }
  };

  const handleNextAction = async () => {
    if (!job) return;

    // Check if there are pending charges before generating invoice
    if (job.status === 'Work In Progress') {
      const hasPending = charges.some(c => c.status === 'pending');
      if (hasPending) {
        Alert.alert(
          'Pending Approval',
          'Customer approval is pending for an additional charge. Please wait for the customer to respond before generating the final invoice.'
        );
        return;
      }

      // Generate payment / transition to Awaiting Payment
      setIsProcessing(true);
      try {
        await createOrGetPayment(job.id);
        await loadJob();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Could not generate payment invoice.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    let nextStatus = '';
    switch (job.status) {
      case 'Accepted': nextStatus = 'On The Way'; break;
      case 'On The Way': nextStatus = 'Arrived'; break;
      case 'Arrived': nextStatus = 'Work In Progress'; break;
      default: return;
    }

    setIsProcessing(true);
    try {
      await updateBookingStatus(job.id, job.request.id, nextStatus);
      await loadJob();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionText = () => {
    switch (job?.status) {
      case 'Accepted': return 'Start Journey';
      case 'On The Way': return 'Mark as Arrived';
      case 'Arrived': return 'Start Work';
      case 'Work In Progress': return 'Generate Final Invoice';
      default: return null;
    }
  };

  const handleCancelJob = () => {
    setCancelReason('');
    setCancelDescription('');
    setShowCancelModal(true);
  };

  const handleConfirmCancellation = async () => {
    if (!job) return;
    if (!cancelReason) {
      Alert.alert('Error', 'Please select a reason for cancellation.');
      return;
    }
    if (cancelReason === 'Other' && !cancelDescription.trim()) {
      Alert.alert('Error', 'Please provide a description.');
      return;
    }

    setIsCancelling(true);
    try {
      await cancelBooking(job.id, cancelReason, cancelDescription.trim() || undefined);
      setShowCancelModal(false);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={FixGoColors.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Job not found.</ThemedText>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}><ThemedText>Go Back</ThemedText></Pressable>
      </View>
    );
  }

  const actionText = getActionText();

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <SymbolView name="chevron.left" size={18} tintColor={FixGoColors.primary} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Job Details</ThemedText>
          <View style={styles.iconButton}>
            <SymbolView name="phone.fill" size={18} tintColor={FixGoColors.primary} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <View style={styles.statusBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SymbolView name="info.circle.fill" size={16} tintColor={FixGoColors.primary} />
              <ThemedText style={styles.statusText}>Current Status: {job.status}</ThemedText>
            </View>
            {locationStatus === 'Sharing' && (
              <View style={styles.locationBadge}>
                <SymbolView name="location.fill" size={10} tintColor={FixGoColors.success} />
                <ThemedText style={styles.locationText}>Live location shared</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.customerCard}>
            <View style={styles.customerAvatar}>
              <ThemedText style={styles.customerAvatarText}>{job.customer.name?.charAt(0) || 'C'}</ThemedText>
            </View>
            <View style={styles.customerInfo}>
              <ThemedText style={styles.customerName}>{job.customer.name}</ThemedText>
              <ThemedText style={styles.customerDetail}>Customer</ThemedText>
            </View>
            <Pressable style={styles.navBtn} onPress={() => Alert.alert('Navigate', 'Maps integration coming soon')}>
              <SymbolView name="location.fill" size={14} tintColor={FixGoColors.primary} />
              <ThemedText style={styles.navBtnText}>Navigate</ThemedText>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.serviceHeader}>
              <ThemedText style={styles.sectionTitle}>Service Details</ThemedText>
              <ThemedText style={styles.serviceName}>{job.request.service}</ThemedText>
            </View>
            <View style={styles.divider} />
            <ThemedText style={styles.label}>Problem Description</ThemedText>
            <ThemedText style={styles.value}>{job.request.description || 'No description provided.'}</ThemedText>

            <View style={{ marginTop: 12 }}>
              <ThemedText style={styles.label}>Scheduled For</ThemedText>
              <ThemedText style={styles.value}>{job.request.preferredDate || 'Any Date'} at {job.request.preferredTime || 'Any Time'}</ThemedText>
            </View>
          </View>

          {charges.length > 0 && (
            <View style={styles.card}>
              <ThemedText style={styles.sectionTitle}>Additional Charges</ThemedText>
              <View style={styles.divider} />
              {charges.map(c => (
                <View key={c.id} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '800', color: FixGoColors.text }}>â‚¹{c.amount}</ThemedText>
                    <View style={{
                      backgroundColor: c.status === 'approved' ? '#E4F4EC' : c.status === 'rejected' ? '#FCE8E8' : '#FFF4E5',
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4
                    }}>
                      <ThemedText style={{
                        fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
                        color: c.status === 'approved' ? FixGoColors.success : c.status === 'rejected' ? '#E74C3C' : '#E65100'
                      }}>
                        {c.status === 'pending' ? 'Pending Approval' : c.status}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={{ fontSize: 13, color: FixGoColors.textSecondary, marginTop: 4 }}>{c.reason}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {(job.status === 'Work In Progress' || job.status === 'Arrived') && (
            <View style={styles.card}>
              <ThemedText style={styles.sectionTitle}>Extra Charges (Optional)</ThemedText>
              <ThemedText style={styles.label}>If any parts or extra labour were required, you can request customer approval here.</ThemedText>

              {!showChargeForm ? (
                <Pressable style={styles.addBtn} onPress={() => setShowChargeForm(true)}>
                  <SymbolView name="plus" size={14} tintColor={FixGoColors.primary} />
                  <ThemedText style={styles.addBtnText}>Request Additional Charge</ThemedText>
                </Pressable>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <ThemedText style={styles.label}>Amount (â‚¹)</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 500"
                    keyboardType="numeric"
                    value={chargeAmount}
                    onChangeText={setChargeAmount}
                  />
                  <View style={{ marginTop: 12 }}>
                    <ThemedText style={styles.label}>Reason</ThemedText>
                    <TextInput
                      style={[styles.input, { height: 80 }]}
                      placeholder="e.g. Compressor replacement required"
                      multiline
                      value={chargeReason}
                      onChangeText={setChargeReason}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <Pressable style={[styles.submitBtn, { backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, flex: 1 }]} onPress={() => setShowChargeForm(false)}>
                      <ThemedText style={[styles.submitBtnText, { color: FixGoColors.text }]}>Cancel</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.submitBtn, { flex: 1 }, isSubmittingCharge && { opacity: 0.7 }]} onPress={handleSubmitCharge} disabled={isSubmittingCharge}>
                      {isSubmittingCharge ? <ActivityIndicator size="small" color={FixGoColors.card} /> : (
                        <ThemedText style={styles.submitBtnText}>Send Request</ThemedText>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {job.status === 'Awaiting Payment' && payment && (
            <View style={[styles.card, { borderColor: '#BCEBED', backgroundColor: FixGoColors.accentSurface }]}>
              <ThemedText style={[styles.sectionTitle, { color: FixGoColors.primary }]}>Final Invoice</ThemedText>
              <View style={[styles.divider, { backgroundColor: '#BCEBED' }]} />

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText style={{ color: FixGoColors.text, fontWeight: '700' }}>Base Service</ThemedText>
                  <ThemedText style={{ color: FixGoColors.text, fontWeight: '700' }}>â‚¹{payment.base_amount}</ThemedText>
                </View>
                {payment.additional_charges_amount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ color: FixGoColors.text, fontWeight: '700' }}>Extra Charges</ThemedText>
                    <ThemedText style={{ color: FixGoColors.text, fontWeight: '700' }}>â‚¹{payment.additional_charges_amount}</ThemedText>
                  </View>
                )}
                <View style={[styles.divider, { backgroundColor: '#BCEBED', marginVertical: 8 }]} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText style={{ color: FixGoColors.primary, fontSize: 18, fontWeight: '900' }}>Total</ThemedText>
                  <ThemedText style={{ color: FixGoColors.primary, fontSize: 18, fontWeight: '900' }}>â‚¹{payment.final_amount}</ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: '#BCEBED', marginVertical: 12 }]} />

              {!payment.payment_method ? (
                <View style={{ alignItems: 'center', padding: 12 }}>
                  <ActivityIndicator size="small" color={FixGoColors.primary} style={{ marginBottom: 12 }} />
                  <ThemedText style={{ color: FixGoColors.primary, fontWeight: '800', textAlign: 'center' }}>
                    Waiting for customer to select payment method...
                  </ThemedText>
                </View>
              ) : payment.payment_method === 'cash' ? (
                <View style={{ gap: 12 }}>
                  <ThemedText style={{ color: FixGoColors.primary, fontWeight: '800', textAlign: 'center' }}>
                    Cash payment selected
                  </ThemedText>
                  <ThemedText style={{ color: FixGoColors.text, fontWeight: '700', textAlign: 'center', fontSize: 16 }}>
                    Collect â‚¹{payment.final_amount} from customer
                  </ThemedText>
                  <Pressable
                    style={[styles.actionBtn, { marginTop: 8 }, isConfirmingCash && { opacity: 0.7 }]}
                    onPress={handleConfirmCash}
                    disabled={isConfirmingCash}
                  >
                    {isConfirmingCash ? <ActivityIndicator size="small" color={FixGoColors.card} /> : (
                      <ThemedText style={styles.actionBtnText}>Confirm Cash Received</ThemedText>
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={{ alignItems: 'center', padding: 12 }}>
                  <ActivityIndicator size="small" color={FixGoColors.primary} style={{ marginBottom: 12 }} />
                  <ThemedText style={{ color: FixGoColors.primary, fontWeight: '800', textAlign: 'center' }}>
                    Waiting for online payment to complete...
                  </ThemedText>
                </View>
              )}
            </View>
          )}

        </ScrollView>

        {(actionText || job.status === 'Accepted' || job.status === 'On The Way') && (
          <View style={[styles.footer, { gap: 12, flexDirection: 'row' }]}>
            {(job.status === 'Accepted' || job.status === 'On The Way') && (
              <Pressable
                style={[styles.actionBtn, { flex: 0.4, backgroundColor: '#FEF2F2', borderColor: '#E74C3C', borderWidth: 1 }]}
                onPress={handleCancelJob}
                disabled={isProcessing}
              >
                <ThemedText style={[styles.actionBtnText, { color: '#E74C3C' }]}>Cancel</ThemedText>
              </Pressable>
            )}
            {actionText && (
              <Pressable
                style={[styles.actionBtn, { flex: 1 }, isProcessing && { opacity: 0.7 }]}
                onPress={handleNextAction}
                disabled={isProcessing}
              >
                {isProcessing ? <ActivityIndicator size="small" color={FixGoColors.card} /> : (
                  <ThemedText style={styles.actionBtnText}>{actionText}</ThemedText>
                )}
              </Pressable>
            )}
          </View>
        )}

        <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>Cancel Job</ThemedText>
              <ThemedText style={styles.modalSubtitle}>Please select a reason for cancelling this job.</ThemedText>

              <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
                {CANCEL_REASONS.map(reason => (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.reasonOption, cancelReason === reason && styles.reasonSelected]}
                    onPress={() => setCancelReason(reason)}
                  >
                    <View style={[styles.radioOuter, cancelReason === reason && styles.radioOuterSelected]}>
                      {cancelReason === reason && <View style={styles.radioInner} />}
                    </View>
                    <ThemedText style={styles.reasonText}>{reason}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {cancelReason === 'Other' && (
                <TextInput
                  style={styles.textInput}
                  placeholder="Please describe..."
                  placeholderTextColor={FixGoColors.textSecondary}
                  value={cancelDescription}
                  onChangeText={setCancelDescription}
                  multiline
                  maxLength={200}
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setShowCancelModal(false)}>
                  <ThemedText style={styles.modalBtnSecondaryText}>Back</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnPrimary, !cancelReason && { opacity: 0.5 }]}
                  onPress={handleConfirmCancellation}
                  disabled={!cancelReason || isCancelling}
                >
                  {isCancelling ? <ActivityIndicator size="small" color={FixGoColors.card} /> : <ThemedText style={styles.modalBtnPrimaryText}>Confirm Cancel</ThemedText>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: FixGoColors.background },
  safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: FixGoColors.card, borderRadius: 20 },
  headerTitle: { color: FixGoColors.text, fontSize: 18, fontWeight: '900' },

  content: { padding: Spacing.four, gap: 16 },

  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E2F7F9', padding: 12, borderRadius: Radius.medium },
  statusText: { color: FixGoColors.primary, fontSize: 14, fontWeight: '800' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E4F4EC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  locationText: { color: FixGoColors.success, fontSize: 10, fontWeight: '800' },

  customerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: FixGoColors.card, padding: Spacing.three, borderRadius: Radius.large, borderWidth: 1, borderColor: FixGoColors.border },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E4ECEC', justifyContent: 'center', alignItems: 'center' },
  customerAvatarText: { color: FixGoColors.primary, fontSize: 18, fontWeight: '900' },
  customerInfo: { flex: 1, marginLeft: 12 },
  customerName: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' },
  customerDetail: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '600' },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F7F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill },
  navBtnText: { color: FixGoColors.primary, fontSize: 12, fontWeight: '800' },

  card: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.four, borderWidth: 1, borderColor: FixGoColors.border },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' },
  serviceName: { color: FixGoColors.primary, fontSize: 14, fontWeight: '800', backgroundColor: '#E2F7F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  divider: { height: 1, backgroundColor: FixGoColors.border, marginVertical: 12 },
  label: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  value: { color: FixGoColors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: FixGoColors.primary, borderStyle: 'dashed', padding: 12, borderRadius: Radius.medium, marginTop: 12 },
  addBtnText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '800' },

  input: { backgroundColor: '#F3F7F7', borderRadius: Radius.medium, padding: 12, color: FixGoColors.text, fontSize: 14, minHeight: 48, textAlignVertical: 'top' },
  submitBtn: { height: 48, borderRadius: Radius.medium, backgroundColor: FixGoColors.primary, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: FixGoColors.card, fontSize: 14, fontWeight: '900' },

  chargeAmountInput: { backgroundColor: '#F8F9F9', borderRadius: Radius.small, padding: 12, fontSize: 16, color: FixGoColors.text, fontWeight: '800', borderWidth: 1, borderColor: FixGoColors.border },
  chargeReasonInput: { backgroundColor: '#F8F9F9', borderRadius: Radius.small, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: FixGoColors.text, borderWidth: 1, borderColor: FixGoColors.border },
  chargeBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  chargeBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.medium },
  chargeBtnCancelText: { color: FixGoColors.textSecondary, fontSize: 14, fontWeight: '800' },
  chargeBtnSubmit: { backgroundColor: FixGoColors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.medium },
  chargeBtnSubmitText: { color: FixGoColors.card, fontSize: 14, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  modalContent: { width: '100%', maxWidth: MaxContentWidth, backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.four },
  modalTitle: { color: FixGoColors.text, fontSize: 18, fontWeight: '900', marginBottom: 4 },
  modalSubtitle: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '600' },
  reasonOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: FixGoColors.border },
  reasonSelected: { backgroundColor: '#F8F9F9' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#C5D5D6', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  radioOuterSelected: { borderColor: FixGoColors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: FixGoColors.primary },
  reasonText: { color: FixGoColors.text, fontSize: 14, fontWeight: '700' },
  textInput: { backgroundColor: '#F8F9F9', borderRadius: Radius.medium, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: FixGoColors.text, borderWidth: 1, borderColor: FixGoColors.border, marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalBtnSecondary: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.medium },
  modalBtnSecondaryText: { color: FixGoColors.textSecondary, fontSize: 14, fontWeight: '800' },
  modalBtnPrimary: { backgroundColor: '#E74C3C', paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.medium },
  modalBtnPrimaryText: { color: FixGoColors.card, fontSize: 14, fontWeight: '900' },

  footer: { padding: Spacing.four, backgroundColor: FixGoColors.card, borderTopWidth: 1, borderColor: FixGoColors.border },
  actionBtn: { height: 54, borderRadius: Radius.medium, backgroundColor: FixGoColors.primary, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' }
});

