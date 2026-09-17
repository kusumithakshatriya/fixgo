import { type ComponentProps, useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View, ActivityIndicator, Modal, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText as BaseThemedText } from '@/components/themed-text';
import { FixGoColors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getActiveRequest, getConfirmedBooking } from '@/data/customer-flow';
import { 
  subscribeToBookingUpdates, 
  subscribeToTechnicianLocation, 
  TechnicianLocation,
  fetchBookingAdditionalCharges,
  subscribeToAdditionalChargeUpdates,
  updateAdditionalChargeStatus,
  AdditionalChargeRequest,
  fetchBookingPayment,
  selectPaymentMethod,
  createRazorpayOrder, verifyRazorpayPayment, confirmCashPayment,
  subscribeToPaymentUpdates,
  Payment,
  cancelBooking,
  fetchBookingCancellation,
  subscribeToCancellationUpdates,
  BookingCancellation
} from '@/services/supabase';
import { calculateDistanceKm } from '@/lib/location';
import { supabase } from '@/lib/supabase';

function ThemedText({ style, ...props }: ComponentProps<typeof BaseThemedText>) {
  return <BaseThemedText {...props} style={[styles.sans, style]} />;
}

import { fetchPartnerJobs } from '@/services/supabase';
import * as Location from 'expo-location';
import RazorpayCheckout from 'react-native-razorpay';

const CANCEL_REASONS = [
  'Changed my mind',
  'Technician is taking too long',
  'Found another technician',
  'Price is too high',
  'Wrong service selected',
  'Other'
];

export default function RepairTrackingScreen() {
  const { 
    bookingId,
    technicianId,
    initialStatus = 'Assigned',
    requestId, 
    name = 'Expert Technician', 
    service = 'Service', 
    price = 'TBD', 
    arrival = 'TBD', 
    location = 'Customer address', 
    description, 
    preferredTime 
  } = useLocalSearchParams<{ 
    bookingId?: string;
    technicianId?: string;
    initialStatus?: string;
    requestId?: string; 
    name?: string; 
    service?: string; 
    price?: string; 
    arrival?: string; 
    location?: string; 
    description?: string; 
    preferredTime?: string; 
  }>();

  const [bookingStatus, setBookingStatus] = useState<string>(initialStatus);
  const [techLocation, setTechLocation] = useState<TechnicianLocation | null>(null);
  const [customerLocation, setCustomerLocation] = useState<Location.LocationObject | null>(null);
  const [charges, setCharges] = useState<AdditionalChargeRequest[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [cancellation, setCancellation] = useState<BookingCancellation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDescription, setCancelDescription] = useState('');

  const [techDetails, setTechDetails] = useState<{name: string, rating: number, jobs: number} | null>(null);
  const [currentTechId, setCurrentTechId] = useState<string | undefined>(technicianId);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getLastKnownPositionAsync({});
          if (loc) setCustomerLocation(loc);
        }
      } catch (err) {
        console.log('Customer location unavailable');
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentTechId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('partner_profiles')
          .select('rating, total_jobs, users(name)')
          .eq('id', currentTechId)
          .single();
        if (!error && data) {
          setTechDetails({
            name: (data.users as any)?.name || 'Technician',
            rating: data.rating || 5.0,
            jobs: data.total_jobs || 0
          });
        }
      } catch (err) {
        console.error('Failed to load tech details:', err);
      }
    })();
  }, [currentTechId]);

  const loadCharges = async (id: string) => {
    const fetched = await fetchBookingAdditionalCharges(id);
    setCharges(fetched);
  };

  const loadCancellation = async (id: string) => {
    const fetched = await fetchBookingCancellation(id);
    setCancellation(fetched);
  };

  const loadPayment = async (id: string) => {
    const p = await fetchBookingPayment(id);
    setPayment(p);
  };

  useEffect(() => {
    if (!bookingId) return;

    loadCharges(bookingId);
    loadPayment(bookingId);
    loadCancellation(bookingId);

    const unsubscribeBooking = subscribeToBookingUpdates(bookingId, (payload) => {
      if (payload.new && payload.new.status) {
        setBookingStatus(payload.new.status);
        if (payload.new.technician_id && payload.new.technician_id !== currentTechId) {
          setCurrentTechId(payload.new.technician_id);
        }
        if (payload.new.status === 'Awaiting Payment' || payload.new.status === 'Completed') {
          loadPayment(bookingId);
        }
        if (payload.new.status === 'Cancelled') {
          loadCancellation(bookingId);
        }
      }
    });

    const unsubscribeCharges = subscribeToAdditionalChargeUpdates(bookingId, () => {
      loadCharges(bookingId);
    });

    const unsubscribeCancellation = subscribeToCancellationUpdates(bookingId, () => {
      loadCancellation(bookingId);
    });

    let unsubscribePayment: (() => void) | undefined;
    if (payment) {
      unsubscribePayment = subscribeToPaymentUpdates(payment.id, () => {
        loadPayment(bookingId);
      });
    }

    let unsubscribeLocation: (() => void) | undefined;
    if (technicianId && bookingStatus !== 'Completed' && bookingStatus !== 'Cancelled') {
      unsubscribeLocation = subscribeToTechnicianLocation(technicianId, (location) => {
        setTechLocation(location);
      });
    }

    return () => {
      unsubscribeBooking();
      unsubscribeCharges();
      unsubscribeCancellation();
      if (unsubscribePayment) unsubscribePayment();
      if (unsubscribeLocation) unsubscribeLocation();
    };
  }, [bookingId, technicianId, payment?.id, bookingStatus]);

  const handleSelectPaymentMethod = async (method: 'cash' | 'online') => {
    if (!payment) return;
    try {
      await selectPaymentMethod(payment.id, method);
      await loadPayment(bookingId!);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not select payment method');
    }
  };

  const handlePayOnline = async () => {
    if (!payment) return;
    setIsProcessingPayment(true);
    try {
      const orderData = await createRazorpayOrder(bookingId!);
      
      const options = {
        description: 'FixGo Service Payment',
        image: 'https://reactnative.dev/img/tiny_logo.png',
        currency: orderData.currency,
        key: orderData.key_id,
        amount: orderData.amount,
        name: 'FixGo',
        order_id: orderData.order_id,
        theme: {color: '#123A40'}
      };
      
      const data = await RazorpayCheckout.open(options);
      
      await verifyRazorpayPayment({
        booking_id: bookingId!,
        payment_id: orderData.payment_id,
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        amount: orderData.amount
      });
      
      Alert.alert('Payment Successful', 'Your payment has been completed.');
      await loadPayment(bookingId!);
    } catch (e: any) {
      Alert.alert('Payment Failed', e.description || e.message || 'Payment could not be completed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancelBooking = () => {
    setCancelReason('');
    setCancelDescription('');
    setShowCancelModal(true);
  };

  const handleConfirmCancellation = async () => {
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
      await cancelBooking(bookingId!, cancelReason, cancelDescription.trim() || undefined);
      setShowCancelModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleChargeAction = (requestId: string, amount: number, isApprove: boolean) => {
    Alert.alert(
      isApprove ? `Approve Ã¢â€šÂ¹${amount} additional charge?` : `Reject this additional charge?`,
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: isApprove ? 'Approve' : 'Reject', 
          style: isApprove ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await updateAdditionalChargeStatus(requestId, isApprove ? 'approved' : 'rejected');
              await loadCharges(bookingId!);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not update status');
            }
          }
        }
      ]
    );
  };
  
  const booking = getConfirmedBooking();
  const request = booking?.request ?? getActiveRequest();
  
  const displayService = request?.service ?? service;
  const displayLocation = request?.location ?? (location === 'Gxjvcickkkc' || location === 'Customer repair address' ? 'Service location' : location);
  const displayDescription = request?.description ?? description ?? `Your ${displayService.toLowerCase()} repair request`;
  
  const technicianName = techDetails?.name || booking?.technician?.name || name;
  const displayArrival = arrival;
  const displayPrice = price;
  
  const rating = techDetails?.rating || booking?.technician?.rating || 5.0;
  const jobs = techDetails?.jobs || booking?.technician?.jobs || 0;
  
  const initials = technicianName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TX';
  const showPlaceholder = (action: 'Call' | 'Chat') => Alert.alert(`${action} ${technicianName}`, `${action} options will be connected in a future FixGo update.`);

  // Map database status to customer-friendly text
  let statusTitle = "Technician Assigned";
  let statusDetail = `${technicianName} is assigned to your request.`;
  let liveText = "ASSIGNED";
  
  const bStatus = bookingStatus || 'Assigned';
  const isCompleted = bStatus === 'Completed';

  if (bStatus === 'Accepted') {
    statusTitle = "Technician Accepted";
    statusDetail = `${technicianName} has accepted your repair request.`;
    liveText = "ACCEPTED";
  } else if (bStatus === 'On The Way') {
    statusTitle = "Technician is on the way";
    statusDetail = `${technicianName} is heading to your location.`;
    liveText = "ON THE WAY";
  } else if (bStatus === 'Arrived') {
    statusTitle = "Technician has arrived";
    statusDetail = `${technicianName} has arrived at your location.`;
    liveText = "ARRIVED";
  } else if (bStatus === 'Work In Progress') {
    statusTitle = "Service in progress";
    statusDetail = `${technicianName} is working on your request.`;
    liveText = "IN PROGRESS";
  } else if (bStatus === 'Awaiting Payment') {
    statusTitle = "Payment required";
    statusDetail = `Please complete the payment for your service.`;
    liveText = "AWAITING PAYMENT";
  } else if (bStatus === 'Completed') {
    statusTitle = "Service completed";
    statusDetail = `Your service has been completed successfully.`;
    liveText = "COMPLETED";
  } else if (bStatus === 'Cancelled') {
    statusTitle = "Booking Cancelled";
    statusDetail = `This booking has been cancelled.`;
    if (cancellation?.refund_status === 'pending') {
      statusDetail = `Refund Status: Pending. Amount: Ã¢â€šÂ¹${cancellation.refund_amount}`;
    }
    liveText = "CANCELLED";
  }

  const checkStatus = (step: string) => {
    const order = ['Assigned', 'Accepted', 'On The Way', 'Arrived', 'Work In Progress', 'Completed'];
    const currentIdx = order.indexOf(bStatus);
    
    if (step === 'Assigned') return { 
      complete: currentIdx >= order.indexOf('On The Way'), 
      active: bStatus === 'Assigned' || bStatus === 'Accepted' 
    };
    if (step === 'On The Way') return { 
      complete: currentIdx >= order.indexOf('Work In Progress'), 
      active: bStatus === 'On The Way' || bStatus === 'Arrived' 
    };
    if (step === 'Work In Progress') return { 
      complete: currentIdx >= order.indexOf('Completed'), 
      active: bStatus === 'Work In Progress' 
    };
    if (step === 'Completed') return { 
      complete: bStatus === 'Completed', 
      active: false 
    };
    
    return { complete: false, active: false };
  };

  let distanceText = '';
  if (techLocation && customerLocation) {
    const dist = calculateDistanceKm(
      customerLocation.coords.latitude, customerLocation.coords.longitude,
      techLocation.latitude, techLocation.longitude
    );
    distanceText = `${dist.toFixed(1)} km away`;
  }

  return <View style={styles.page}><SafeAreaView edges={['top']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><SymbolView name="chevron.left" size={16} tintColor={FixGoColors.primary} /><ThemedText style={styles.backText}>Back</ThemedText></Pressable><ThemedText style={styles.headerTitle}>Track Your Repair</ThemedText><View style={styles.headerSpacer} /></View>

      <View style={styles.statusCard}><View style={styles.statusTop}><View style={styles.statusIcon}><SymbolView name="checkmark" size={18} tintColor={FixGoColors.card} /></View><View style={styles.statusCopy}><ThemedText style={styles.statusKicker}>BOOKING STATUS</ThemedText><ThemedText style={styles.statusTitle}>{statusTitle}</ThemedText><ThemedText style={styles.statusDetail}>{statusDetail}</ThemedText></View></View><View style={styles.etaRow}><View><ThemedText style={styles.etaLabel}>{isCompleted ? 'SERVICE' : 'EXPECTED ARRIVAL'}</ThemedText><ThemedText style={styles.eta}>{isCompleted ? 'COMPLETED' : 'ETA unavailable'}</ThemedText></View><View style={[styles.liveBadge, isCompleted && { backgroundColor: FixGoColors.success }]}><View style={[styles.liveDot, isCompleted && { backgroundColor: FixGoColors.card }]} /><ThemedText style={[styles.liveText, isCompleted && { color: FixGoColors.card }]}>{liveText}</ThemedText></View></View></View>

      {bStatus !== 'Cancelled' && (
        <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View>
            <ThemedText style={styles.mapTitle}>Technician route</ThemedText>
            <ThemedText style={styles.mapSubtitle}>
              {techLocation 
                ? `Live: ${techLocation.latitude.toFixed(4)}, ${techLocation.longitude.toFixed(4)}`
                : 'Visual placeholder Ã‚Â· live location coming soon'}
            </ThemedText>
          </View>
          <View style={styles.mapEta}>
            {distanceText ? (
              <ThemedText style={styles.mapEtaText}>{distanceText}</ThemedText>
            ) : (
              <ThemedText style={styles.mapEtaText}>N/A</ThemedText>
            )}
          </View>
        </View>
        <View style={styles.mapVisual}><View style={styles.mapGrid} /><View style={styles.route}><View style={styles.routeLine} /><View style={styles.routeDot} /></View><View style={styles.techPin}><SymbolView name="wrench.and.screwdriver.fill" size={15} tintColor={FixGoColors.card} /></View><View style={styles.homePin}><SymbolView name="house.fill" size={15} tintColor={FixGoColors.card} /></View><View style={styles.techCaption}><ThemedText style={styles.captionText}>Technician</ThemedText></View><View style={styles.homeCaption}><ThemedText style={styles.captionText}>Your home</ThemedText></View></View>
      </View>
      )}

      {bStatus !== 'Cancelled' && (
        <>
          <SectionTitle icon="person.fill" title="Your technician" />
          <View style={styles.technicianCard}><View style={styles.techTop}><View style={styles.avatar}><ThemedText style={styles.avatarText}>{initials}</ThemedText></View><View style={styles.techInfo}><View style={styles.nameRow}><ThemedText style={styles.name}>{technicianName}</ThemedText><View style={styles.verified}><SymbolView name="checkmark.seal.fill" size={14} tintColor={FixGoColors.success} /><ThemedText style={styles.verifiedText}>Verified</ThemedText></View></View><ThemedText style={styles.specialty}>{displayService} Specialist</ThemedText></View></View><View style={styles.metrics}><Metric icon="star.fill" value={`${rating}`} label="rating" accent /><Metric icon="briefcase.fill" value={`${jobs} jobs`} label="completed" /><Metric icon="clock.fill" value={`${displayArrival}`} label="ETA" /></View><View style={styles.techActions}><Pressable accessibilityRole="button" onPress={() => showPlaceholder('Call')} style={styles.secondaryButton}><SymbolView name="phone.fill" size={15} tintColor={FixGoColors.primary} /><ThemedText style={styles.secondaryText}>Call</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={() => showPlaceholder('Chat')} style={styles.secondaryButton}><SymbolView name="message.fill" size={15} tintColor={FixGoColors.primary} /><ThemedText style={styles.secondaryText}>Chat</ThemedText></Pressable></View></View>
        </>
      )}

      {charges.length > 0 && bookingStatus !== 'Awaiting Payment' && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <SectionTitle icon="wrench.and.screwdriver.fill" title="Additional Charges" />
          {charges.map(charge => (
            <View key={charge.id} style={styles.chargeCard}>
              <ThemedText style={styles.chargeKicker}>ADDITIONAL CHARGE REQUEST</ThemedText>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <ThemedText style={styles.chargeAmount}>Ã¢â€šÂ¹{charge.amount}</ThemedText>
                {charge.status !== 'pending' && (
                  <View style={{ 
                    backgroundColor: charge.status === 'approved' ? '#E4F4EC' : '#FCE8E8',
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4
                  }}>
                    <ThemedText style={{ 
                      fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
                      color: charge.status === 'approved' ? FixGoColors.success : '#E74C3C'
                    }}>
                      {charge.status}
                    </ThemedText>
                  </View>
                )}
              </View>
              
              <View style={{ marginTop: 12, marginBottom: charge.status === 'pending' ? 16 : 0 }}>
                <ThemedText style={styles.chargeReasonLabel}>Reason:</ThemedText>
                <ThemedText style={styles.chargeReason}>{charge.reason}</ThemedText>
              </View>

              {charge.status === 'pending' && (
                <View style={{ gap: 8 }}>
                  <ThemedText style={styles.chargePendingText}>Status: Waiting for your approval</ThemedText>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <Pressable style={[styles.chargeBtn, { backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, flex: 1 }]} onPress={() => handleChargeAction(charge.id, charge.amount, false)}>
                      <ThemedText style={[styles.chargeBtnText, { color: FixGoColors.text }]}>Reject</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.chargeBtn, { backgroundColor: FixGoColors.primary, flex: 1 }]} onPress={() => handleChargeAction(charge.id, charge.amount, true)}>
                      <ThemedText style={[styles.chargeBtnText, { color: FixGoColors.card }]}>Approve</ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {bookingStatus === 'Awaiting Payment' && payment && (
        <View style={{ gap: 12, marginTop: 8 }}>
          <SectionTitle icon="chart.bar.fill" title="PAYMENT" />
          <View style={styles.paymentCard}>
            <View style={{ gap: 8 }}>
              <View style={styles.paymentRow}>
                <ThemedText style={styles.paymentLabel}>Base Service</ThemedText>
                <ThemedText style={styles.paymentLabel}>Ã¢â€šÂ¹{payment.base_amount}</ThemedText>
              </View>
              {payment.additional_charges_amount > 0 && (
                <View style={styles.paymentRow}>
                  <ThemedText style={styles.paymentLabel}>Approved Additional Charges</ThemedText>
                  <ThemedText style={styles.paymentLabel}>Ã¢â€šÂ¹{payment.additional_charges_amount}</ThemedText>
                </View>
              )}
            </View>
            <View style={styles.divider} />
            <View style={styles.paymentRow}>
              <ThemedText style={styles.paymentTotal}>Total Amount</ThemedText>
              <ThemedText style={styles.paymentTotal}>Ã¢â€šÂ¹{payment.final_amount}</ThemedText>
            </View>
            <View style={styles.divider} />

            {!payment.payment_method ? (
              <View style={{ gap: 12 }}>
                <ThemedText style={{ color: FixGoColors.primary, fontWeight: '900', fontSize: 16 }}>Choose Payment Method</ThemedText>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable style={styles.methodBtn} onPress={() => handleSelectPaymentMethod('cash')}>
                    <SymbolView name="banknote.fill" size={20} tintColor={FixGoColors.primary} />
                    <ThemedText style={styles.methodText}>Cash</ThemedText>
                  </Pressable>
                  <Pressable style={styles.methodBtn} onPress={() => handleSelectPaymentMethod('online')}>
                    <SymbolView name="creditcard.fill" size={20} tintColor={FixGoColors.primary} />
                    <ThemedText style={styles.methodText}>Online</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : payment.payment_method === 'cash' && (payment.status === 'pending' || payment.status === 'order_created' || payment.status === 'processing') ? (
              <View style={{ gap: 12, alignItems: 'center', paddingVertical: 12 }}>
                <ThemedText style={{ color: FixGoColors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
                  Pay â‚¹{payment.final_amount} in cash to the technician.
                </ThemedText>
                {payment.status === 'processing' ? (
                  <Pressable 
                    style={[styles.chargeBtn, { backgroundColor: FixGoColors.primary, minHeight: 52 }, isProcessingPayment && { opacity: 0.7 }]} 
                    onPress={async () => {
                      setIsProcessingPayment(true);
                      try {
                        await confirmCashPayment(payment.id);
                        Alert.alert('Payment Successful', 'You have confirmed the cash payment.');
                        await loadPayment(bookingId!);
                      } catch (e: any) {
                        Alert.alert('Error', e.message || 'Payment confirmation failed');
                      } finally {
                        setIsProcessingPayment(false);
                      }
                    }}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? <ActivityIndicator size="small" color={FixGoColors.card} /> : (
                      <ThemedText style={[styles.chargeBtnText, { color: FixGoColors.card }]}>Confirm Cash Paid</ThemedText>
                    )}
                  </Pressable>
                ) : (
                  <>
                    <ActivityIndicator size="small" color={FixGoColors.primary} style={{ marginTop: 8 }} />
                    <ThemedText style={{ color: FixGoColors.primary, fontWeight: '700' }}>
                      Waiting for technician to request cash...
                    </ThemedText>
                  </>
                )}
              </View>
            ) : payment.payment_method === 'online' && (payment.status === 'pending' || payment.status === 'order_created') ? (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF4E5', padding: 8, borderRadius: 8 }}>
                  <SymbolView name="exclamationmark.triangle.fill" size={14} tintColor="#E67E22" />
                  <ThemedText style={{ color: '#E67E22', fontWeight: '800', fontSize: 12 }}>Demo Payment</ThemedText>
                </View>
                <Pressable 
                  style={[styles.chargeBtn, { backgroundColor: FixGoColors.primary, minHeight: 52 }, isProcessingPayment && { opacity: 0.7 }]} 
                  onPress={handlePayOnline}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <ActivityIndicator size="small" color={FixGoColors.card} />
                  ) : (
                    <ThemedText style={[styles.chargeBtnText, { color: FixGoColors.card, fontSize: 16 }]}>Pay Ã¢â€šÂ¹{payment.final_amount} Now</ThemedText>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8, alignItems: 'center', paddingVertical: 12 }}>
                <SymbolView name="checkmark.circle.fill" size={40} tintColor={FixGoColors.success} />
                <ThemedText style={{ color: FixGoColors.success, fontSize: 18, fontWeight: '900' }}>Payment Successful</ThemedText>
                {payment.transaction_id && (
                  <ThemedText style={{ color: FixGoColors.textSecondary, fontWeight: '700' }}>Transaction ID: {payment.transaction_id}</ThemedText>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      <SectionTitle icon="wrench.and.screwdriver.fill" title="Repair summary" />
      <View style={styles.summaryCard}>
        {requestId ? <><Detail icon="doc.text.fill" label="Request ID" value={String(requestId)} /><Divider /></> : null}
        <Detail icon="wrench.and.screwdriver.fill" label="Selected service" value={displayService} /><Divider /><Detail icon="text.alignleft" label="Request" value={displayDescription} /><Divider /><Detail icon="location.fill" label="Location" value={displayLocation} />
      </View>

      {bStatus !== 'Cancelled' && (
        <>
          <SectionTitle icon="chart.bar.fill" title="Repair progress" />
          <View style={styles.timelineCard}>
            <Timeline label="Booking Confirmed" complete />
            <Timeline label="Technician Assigned" {...checkStatus('Assigned')} />
            <Timeline label="On the Way" {...checkStatus('On The Way')} />
            <Timeline label="Repair in Progress" {...checkStatus('Work In Progress')} />
            <Timeline label="Completed" {...checkStatus('Completed')} />
          </View>
        </>
      )}

      {bStatus !== 'Cancelled' && (
        <View style={styles.priceCard}><View><ThemedText style={styles.priceKicker}>EXPECTED CHARGE</ThemedText><ThemedText style={styles.price}>Ã¢â€šÂ¹{displayPrice}</ThemedText></View><View style={styles.priceCopy}><ThemedText style={styles.priceLabel}>Pay after service</ThemedText><ThemedText style={styles.priceHint}>Final cost may vary if parts are needed.</ThemedText></View></View>
      )}
      
      {(bookingStatus === 'Assigned' || bookingStatus === 'Accepted' || bookingStatus === 'On The Way') && (
        <Pressable 
          style={[styles.chargeBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E74C3C', marginTop: 8 }]} 
          onPress={handleCancelBooking}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#E74C3C" />
          ) : (
            <ThemedText style={[styles.chargeBtnText, { color: '#E74C3C' }]}>Cancel Booking</ThemedText>
          )}
        </Pressable>
      )}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.ctaWrap}><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.ctaButton}><ThemedText style={styles.ctaText}>View Booking Details</ThemedText><SymbolView name="arrow.right" size={16} tintColor={FixGoColors.card} /></Pressable></SafeAreaView>

      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Cancel Booking</ThemedText>
            <ThemedText style={styles.modalSubtitle}>Please select a reason for cancelling this booking.</ThemedText>
            
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
    </SafeAreaView></View>;
}

function SectionTitle({ icon, title }: { icon: 'person.fill' | 'wrench.and.screwdriver.fill' | 'chart.bar.fill'; title: string }) { return <View style={styles.sectionTitle}><SymbolView name={icon} size={15} tintColor={FixGoColors.primary} /><ThemedText style={styles.sectionText}>{title}</ThemedText></View>; }
function Metric({ icon, value, label, accent = false }: { icon: 'star.fill' | 'briefcase.fill' | 'location.fill' | 'clock.fill'; value: string; label: string; accent?: boolean }) { return <View style={styles.metric}><SymbolView name={icon} size={13} tintColor={accent ? '#D89617' : FixGoColors.primary} /><ThemedText style={styles.metricValue}>{value}</ThemedText><ThemedText style={styles.metricLabel}>{label}</ThemedText></View>; }
function Detail({ icon, label, value }: { icon: 'wrench.and.screwdriver.fill' | 'text.alignleft' | 'location.fill' | 'doc.text.fill'; label: string; value: string }) { return <View style={styles.detail}><View style={styles.detailIcon}><SymbolView name={icon} size={15} tintColor={FixGoColors.primary} /></View><View style={styles.detailCopy}><ThemedText style={styles.detailLabel}>{label}</ThemedText><ThemedText numberOfLines={2} style={styles.detailValue}>{value}</ThemedText></View></View>; }
function Divider() { return <View style={styles.divider} />; }
function Timeline({ label, complete = false, active = false }: { label: string; complete?: boolean; active?: boolean }) { return <View style={styles.timelineRow}><View style={styles.timelineIndicator}><View style={[styles.dot, complete && styles.completeDot, active && styles.activeDot]}>{complete ? <SymbolView name="checkmark" size={11} tintColor={FixGoColors.card} /> : active ? <View style={styles.activeInner} /> : null}</View><View style={[styles.timelineLine, label === 'Completed' && styles.lastLine]} /></View><ThemedText style={[styles.timelineText, (complete || active) && styles.timelineActive]}>{label}</ThemedText>{active ? <ThemedText style={styles.now}>NOW</ThemedText> : null}</View>; }

const styles = StyleSheet.create({
  sans: { fontFamily: 'sans-serif' },
  page: { flex: 1, backgroundColor: FixGoColors.background }, safeArea: { flex: 1, width: '100%', alignSelf: 'center', maxWidth: MaxContentWidth }, content: { padding: Spacing.four, paddingBottom: 104, gap: 14 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 }, backText: { color: FixGoColors.primary, fontSize: 15, fontWeight: '800' }, headerTitle: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' }, headerSpacer: { width: 43 },
  statusCard: { gap: 15, borderRadius: Radius.large, padding: Spacing.three, backgroundColor: FixGoColors.primary, shadowColor: FixGoColors.shadow, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 }, statusTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, statusIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.success }, statusCopy: { flex: 1, gap: 2 }, statusKicker: { color: FixGoColors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 }, statusTitle: { color: FixGoColors.card, fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.5 }, statusDetail: { color: '#C5DEE0', fontSize: 12, lineHeight: 17, fontWeight: '600' }, etaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2D5A60' }, etaLabel: { color: '#A9CED1', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 }, eta: { color: FixGoColors.card, fontSize: 17, fontWeight: '900', marginTop: 2 }, liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#1E575E' }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: FixGoColors.accent }, liveText: { color: FixGoColors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  mapCard: { minHeight: 218, borderRadius: Radius.large, overflow: 'hidden', backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, shadowColor: FixGoColors.shadow, shadowOpacity: 0.05, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, mapHeader: { padding: Spacing.three, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, mapTitle: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' }, mapSubtitle: { color: FixGoColors.textSecondary, marginTop: 3, fontSize: 10, fontWeight: '600' }, mapEta: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: FixGoColors.accentSurface }, mapEtaText: { color: FixGoColors.primary, fontSize: 11, fontWeight: '900' }, mapVisual: { flex: 1, minHeight: 138, overflow: 'hidden', backgroundColor: '#EAF4F3' }, mapGrid: { ...StyleSheet.absoluteFill, opacity: 0.55, backgroundColor: '#EAF4F3', borderWidth: 1, borderColor: '#D7EAE8' }, route: { position: 'absolute', left: '24%', right: '24%', top: '51%', alignItems: 'center' }, routeLine: { width: '100%', height: 4, borderRadius: 2, backgroundColor: FixGoColors.accent }, routeDot: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: FixGoColors.primary, borderWidth: 3, borderColor: FixGoColors.card }, techPin: { position: 'absolute', left: '17%', top: '38%', width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary, borderWidth: 3, borderColor: FixGoColors.card }, homePin: { position: 'absolute', right: '17%', top: '38%', width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.success, borderWidth: 3, borderColor: FixGoColors.card }, techCaption: { position: 'absolute', left: '11%', top: '68%' }, homeCaption: { position: 'absolute', right: '10%', top: '68%' }, captionText: { color: FixGoColors.textSecondary, fontSize: 10, fontWeight: '800' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }, sectionText: { color: FixGoColors.text, fontSize: 16, fontWeight: '900' }, technicianCard: { gap: 14, borderRadius: Radius.large, padding: Spacing.three, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.accent, shadowColor: FixGoColors.shadow, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, techTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.primary }, avatarText: { color: FixGoColors.card, fontSize: 16, fontWeight: '900' }, techInfo: { flex: 1, gap: 4 }, nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }, name: { color: FixGoColors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' }, verified: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECF8F1', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 3 }, verifiedText: { color: FixGoColors.success, fontSize: 9, fontWeight: '900' }, specialty: { color: FixGoColors.textSecondary, fontSize: 13, fontWeight: '700' }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, metric: { minWidth: '22%', flexGrow: 1, gap: 2, borderRadius: Radius.small, padding: 9, backgroundColor: '#F3F7F7' }, metricValue: { color: FixGoColors.text, fontSize: 12, fontWeight: '900' }, metricLabel: { color: FixGoColors.textSecondary, fontSize: 9, fontWeight: '700' }, techActions: { flexDirection: 'row', gap: 9 }, secondaryButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: Radius.small, borderWidth: 1, borderColor: FixGoColors.border }, secondaryText: { color: FixGoColors.primary, fontSize: 13, fontWeight: '900' },
  chargeCard: { backgroundColor: FixGoColors.card, borderRadius: Radius.large, padding: Spacing.four, borderWidth: 1, borderColor: '#F5B041' },
  chargeKicker: { color: '#E67E22', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  chargeAmount: { color: FixGoColors.text, fontSize: 24, fontWeight: '900' },
  chargeReasonLabel: { color: FixGoColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  chargeReason: { color: FixGoColors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  chargePendingText: { color: '#E67E22', fontSize: 12, fontWeight: '800' },
  chargeBtn: { height: 44, borderRadius: Radius.medium, justifyContent: 'center', alignItems: 'center' },
  chargeBtnText: { fontSize: 14, fontWeight: '900' },
  summaryCard: { borderRadius: Radius.large, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, paddingHorizontal: Spacing.three }, detail: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, detailIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.accentSurface }, detailCopy: { flex: 1, gap: 2 }, detailLabel: { color: FixGoColors.textSecondary, fontSize: 11, fontWeight: '700' }, detailValue: { color: FixGoColors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: FixGoColors.border },
  timelineCard: { borderRadius: Radius.large, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, padding: Spacing.three, paddingBottom: 5 }, timelineRow: { minHeight: 42, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, timelineIndicator: { width: 20, alignItems: 'center' }, dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: FixGoColors.card, borderWidth: 2, borderColor: '#C5D5D6' }, completeDot: { backgroundColor: FixGoColors.success, borderColor: FixGoColors.success }, activeDot: { backgroundColor: FixGoColors.accentSurface, borderColor: FixGoColors.primary }, activeInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: FixGoColors.primary }, timelineLine: { width: 2, height: 22, backgroundColor: '#D9E6E6' }, lastLine: { backgroundColor: 'transparent' }, timelineText: { flex: 1, color: FixGoColors.textSecondary, fontSize: 13, lineHeight: 20, fontWeight: '700' }, timelineActive: { color: FixGoColors.text, fontWeight: '900' }, now: { color: FixGoColors.primary, borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: FixGoColors.accentSurface, fontSize: 9, fontWeight: '900' },
  priceCard: { borderRadius: Radius.large, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: FixGoColors.accentSurface, borderWidth: 1, borderColor: '#BCEBED' }, priceKicker: { color: FixGoColors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, price: { color: FixGoColors.primary, marginTop: 2, fontSize: 27, lineHeight: 32, fontWeight: '900' }, priceCopy: { maxWidth: 148, gap: 2 }, priceLabel: { color: FixGoColors.text, fontSize: 12, fontWeight: '900' }, priceHint: { color: FixGoColors.textSecondary, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  ctaWrap: { borderTopWidth: 1, borderColor: FixGoColors.border, backgroundColor: FixGoColors.card, padding: 12 }, ctaButton: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', minHeight: 52, borderRadius: Radius.medium, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: FixGoColors.primary }, ctaText: { color: FixGoColors.card, fontSize: 14, fontWeight: '900' },
  paymentCard: { borderRadius: Radius.large, padding: Spacing.four, backgroundColor: FixGoColors.card, borderWidth: 1, borderColor: FixGoColors.border, gap: 12 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentLabel: { color: FixGoColors.textSecondary, fontSize: 14, fontWeight: '700' },
  paymentTotal: { color: FixGoColors.primary, fontSize: 18, fontWeight: '900' },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: FixGoColors.accentSurface, borderRadius: Radius.medium, borderWidth: 1, borderColor: '#BCEBED' },
  methodText: { color: FixGoColors.primary, fontSize: 14, fontWeight: '900' },
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
});


