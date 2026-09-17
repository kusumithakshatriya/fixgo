import { supabase } from '@/lib/supabase';
import { calculateDistanceKm } from '@/lib/location';

export type ServiceEntity = {
  id: number;
  name: string;
  description: string;
  category: string;
  base_price: number;
  is_active: boolean;
};



export interface PartnerProfile {
  id: string;
  bio?: string;
  profile_image_path?: string;
  experience_years: number;
  rating: number;
  totalJobs: number;
  is_verified: boolean;
  is_online: boolean;
  is_available: boolean;
  service_radius_km: number;
  verification_status?: 'incomplete' | 'pending' | 'verified' | 'rejected' | 'suspended';
  rejection_reason?: string;
}

export interface PartnerSkill {
  id: number;
  partner_id: string;
  service_id: number;
  experience_years: number;
  partner_profiles?: PartnerProfile;
  services?: { name: string };
}

export interface TechnicianForCustomer {
  id: string;
  name: string;
  service: string;
  rating: number;
  totalJobs: number;
  experienceYears: number;
  isVerified: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  serviceRadiusKm: number;
  roadDistanceKm: number | null;
  etaMins: number | null;
}

export interface PartnerServiceArea {
  id: number;
  partner_id: string;
  area_name: string;
  latitude: number | null;
  longitude: number | null;
}

export async function fetchTechniciansForService(
  serviceName: string,
  customerLat?: string,
  customerLng?: string
): Promise<TechnicianForCustomer[]> {
  console.log('[fetchTechnicians] Searching for service:', serviceName);

  // Step 1: Find the service ID
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .select('id')
    .ilike('name', serviceName) // Use ilike for case-insensitive match
    .limit(1)
    .maybeSingle();

  if (serviceError) {
    console.error('[fetchTechnicians] Service query error:', serviceError.message);
    return [];
  }

  if (!serviceData) {
    console.log('[fetchTechnicians] Service not found for name:', serviceName);
    return [];
  }

  const serviceId = serviceData.id;

      // Step 2: Query secure RPC to strictly get eligible technicians
    const { data: eligibleData, error: rpcError } = await supabase
      .rpc('get_eligible_technicians_for_service', { p_service_id: serviceId });

    if (rpcError) {
      console.error('[fetchTechnicians] Secure RPC error:', rpcError.message);
      return [];
    }

    if (!eligibleData || eligibleData.length === 0) {
      console.log('[fetchTechnicians] No strictly verified/online/available technicians found.');
      return [];
    }

    // Map RPC data back to expected shape
    const validProfiles = eligibleData.map((row: any) => ({
      id: row.partner_id,
      rating: row.rating,
      total_jobs: row.total_jobs,
      is_verified: true, // Ensured by RPC
      experience_years: row.experience_years,
      service_radius_km: row.service_radius_km
    }));

    const partnerIds = validProfiles.map((p: any) => p.id);

  // Step 3: Fetch the user names from public.users
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, name')
    .in('id', partnerIds);

  if (usersError) {
    console.error('[fetchTechnicians] Users query error:', usersError.message);
    return [];
  }

  const userMap = new Map((usersData || []).map((u: any) => [u.id, u.name]));

  // Step 3.5: Fetch partner_service_areas
  const { data: areasData, error: areasError } = await supabase
    .from('partner_service_areas')
    .select('partner_id, latitude, longitude')
    .in('partner_id', partnerIds);

  if (areasError) {
    console.error('[fetchTechnicians] Service areas query error:', areasError.message);
    // don't fail entirely, just proceed without areas
  }

  const areaMap = new Map((areasData || []).map((a: any) => [a.partner_id, a]));

  const cLat = customerLat ? parseFloat(customerLat) : null;
  const cLng = customerLng ? parseFloat(customerLng) : null;

  // Step 4: Filter by Haversine radius
  let haversinePassedTechnicians: TechnicianForCustomer[] = [];
  let excludedOutsideHaversineRadius = 0;
  let excludedMissingTechCoords = 0;
  let excludedOutsideRoadRadius = 0;

  for (const profile of validProfiles) {
    const area = areaMap.get(profile.id);
    let distanceKm: number | null = null;
    let eligible = true;

    const pLat = area?.latitude;
    const pLng = area?.longitude;
    const serviceRadiusKm = Number(profile.service_radius_km) || 50;

    if (cLat != null && cLng != null && !isNaN(cLat) && !isNaN(cLng)) {
      if (pLat != null && pLng != null) {
        distanceKm = calculateDistanceKm(cLat, cLng, pLat, pLng);
        if (distanceKm > serviceRadiusKm) {
          eligible = false;
          excludedOutsideHaversineRadius++;
        }
      } else {
        eligible = false;
        excludedMissingTechCoords++;
      }
    } else {
      if (pLat == null || pLng == null) {
        eligible = false;
        excludedMissingTechCoords++;
      }
    }

    if (eligible) {
      haversinePassedTechnicians.push({
        id: profile.id,
        name: userMap.get(profile.id) || 'Unknown Technician',
        service: serviceName,
        rating: Number(profile.rating) || 0,
        totalJobs: Number(profile.total_jobs) || 0,
        experienceYears: Number(profile.experience_years) || 0,
        isVerified: profile.is_verified,
        isOnline: profile.is_online,
        isAvailable: profile.is_available,
        latitude: pLat != null ? Number(pLat) : null,
        longitude: pLng != null ? Number(pLng) : null,
        distanceKm,
        serviceRadiusKm,
        roadDistanceKm: null,
        etaMins: null
      });
    }
  }

  // Step 5: Fetch Road Distance & ETA for valid candidates
  let finalTechnicians: TechnicianForCustomer[] = [...haversinePassedTechnicians];
  let sentToRoutesApi = 0;
  let routeResultsObtained = 0;

  if (cLat != null && cLng != null && !isNaN(cLat) && !isNaN(cLng) && haversinePassedTechnicians.length > 0) {
    const destinations = haversinePassedTechnicians
      .filter(t => t.latitude != null && t.longitude != null)
      .slice(0, 20) // MVP limit to 20
      .map(t => ({
        technicianId: t.id,
        latitude: t.latitude!,
        longitude: t.longitude!
      }));

    sentToRoutesApi = destinations.length;

    if (destinations.length > 0) {
      try {
        const { data: routeData, error: routeError } = await supabase.functions.invoke('calculate-eta', {
          body: {
            origin: { latitude: cLat, longitude: cLng },
            destinations
          }
        });

        if (routeError) {
          console.error('[fetchTechnicians] ETA route error:', routeError.message);
        } else if (Array.isArray(routeData)) {
          // Merge results
          finalTechnicians = []; // we rebuild this strictly testing the final radius
          routeResultsObtained = routeData.length;

          const routeMap = new Map(routeData.map((r: any) => [r.technicianId, r]));

          for (const tech of haversinePassedTechnicians) {
            const apiResult = routeMap.get(tech.id);
            if (apiResult) {
              tech.roadDistanceKm = apiResult.roadDistanceKm;
              tech.etaMins = apiResult.etaMins;
            }

            // Final eligibility check based on road distance
            // If roadDistanceKm is available, use it. Otherwise rely on Haversine distance.
            const distanceToCheck = tech.roadDistanceKm !== null ? tech.roadDistanceKm : tech.distanceKm;

            if (distanceToCheck !== null && distanceToCheck > tech.serviceRadiusKm) {
              excludedOutsideRoadRadius++;
            } else {
              finalTechnicians.push(tech);
            }
          }
        }
      } catch (err) {
        console.error('[fetchTechnicians] Exception calling calculate-eta:', err);
        // Fallback: use haversine technicians untouched
      }
    }
  }

  console.log('[fetchTechnicians] --- Safe Diagnostics ---');
  console.log(`Requested service: ${serviceName}`);
  console.log(`Customer coordinates: ${cLat != null && cLng != null ? 'Available' : 'Unavailable'}`);
  console.log(`Candidates before Haversine: ${validProfiles.length}`);
  console.log(`Candidates after Haversine: ${haversinePassedTechnicians.length} (Excluded by radius: ${excludedOutsideHaversineRadius}, Missing tech coords: ${excludedMissingTechCoords})`);
  console.log(`Candidates sent to Routes API: ${sentToRoutesApi}`);
  console.log(`Route results obtained: ${routeResultsObtained}`);
  console.log(`Candidates excluded by final road radius: ${excludedOutsideRoadRadius}`);
  console.log(`Final eligible technicians returned: ${finalTechnicians.length}`);
  console.log('------------------------------------------');
  return finalTechnicians;
}

export async function fetchActiveServices(): Promise<ServiceEntity[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching services:', error);
    throw error;
  }

  return data || [];
}

export async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  try {
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      console.log('Supabase client initialized (WARNING: Credentials missing in .env)');
    } else {
      console.log('Supabase client initialized');
    }

    const services = await fetchActiveServices();
    console.log('Active services query succeeded');
    console.log(`Number of services returned: ${services.length}`);
    return { success: true, count: services.length };
  } catch (error) {
    console.error('Active services query failed:', error);
    return { success: false, error };
  }
}

export async function fetchPartnerServiceArea(partnerId: string): Promise<PartnerServiceArea | null> {
  const { data, error } = await supabase
    .from('partner_service_areas')
    .select('*')
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (error) {
    console.error('[fetchPartnerServiceArea] Error:', error.message);
    throw error;
  }
  return data as PartnerServiceArea | null;
}

export async function upsertPartnerServiceArea(partnerId: string, areaName: string, latitude: number | null, longitude: number | null): Promise<PartnerServiceArea> {
  const existing = await fetchPartnerServiceArea(partnerId);

  let response;
  if (existing) {
    response = await supabase
      .from('partner_service_areas')
      .update({ area_name: areaName, latitude, longitude })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    response = await supabase
      .from('partner_service_areas')
      .insert({ partner_id: partnerId, area_name: areaName, latitude, longitude })
      .select()
      .single();
  }

  if (response.error) {
    console.error('[upsertPartnerServiceArea] Error:', response.error.message);
    throw response.error;
  }

  return response.data as PartnerServiceArea;
}

export interface BookingEntity {
  id: string;
  service_request_id: string;
  customer_id: string;
  technician_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function createBooking(
  serviceRequestId: string,
  technicianId: string
): Promise<BookingEntity> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  // Prevent duplicates
  const { data: existing, error: checkError } = await supabase
    .from('bookings')
    .select('id')
    .eq('service_request_id', serviceRequestId)
    .maybeSingle();

  if (checkError) {
    console.error('Check booking error:', checkError);
    throw new Error('Failed to check existing bookings');
  }

  if (existing) {
    throw new Error('A booking already exists for this repair request.');
  }

  // Create new booking
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      service_request_id: serviceRequestId,
      customer_id: user.id,
      technician_id: technicianId,
      status: 'Technician Assigned' // current project convention
    })
    .select()
    .single();

  if (error) {
    console.error('Create booking error:', error);
    throw new Error('Failed to confirm booking. Please try again later.');
  }

  return data as BookingEntity;
}

export async function fetchCustomerBookings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      service_requests (
        id,
        description,
        services ( name, base_price )
      ),
      users!bookings_technician_id_fkey ( name ),
      payments ( final_amount, payment_method, status )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch bookings error:', error);
    return [];
  }

  const technicianIds = Array.from(new Set(data.map((b: any) => b.technician_id)));

  let profilesMap = new Map();
  if (technicianIds.length > 0) {
    const { data: profiles } = await supabase
      .from('partner_profiles')
      .select('id, is_verified')
      .in('id', technicianIds);

    if (profiles) {
      profilesMap = new Map(profiles.map(p => [p.id, p]));
    }
  }

  return data.map((b: any) => {
    const sr = b.service_requests as any;
    const serviceName = sr?.services?.name || 'Service';
    const basePrice = sr?.services?.base_price || 299;
    const techUser = b.users as any;
    const techProfile = profilesMap.get(b.technician_id);

    const paymentData = Array.isArray(b.payments) ? b.payments[0] : b.payments;

    return {
      id: b.id,
      status: b.status || 'Technician Assigned',
      payment: paymentData || null,
      request: {
        id: b.service_request_id,
        service: serviceName,
        description: sr?.description || ''
      },
      technician: {
        id: b.technician_id,
        name: techUser?.name || 'Technician',
        verified: techProfile?.is_verified || false,
        price: String(basePrice),
        arrival: '15'
      }
    };
  });
}

export interface PartnerJob {
  id: string;
  status: string;
  createdAt: string;
  offerExpiresAt?: string;
  payment?: any;
  request: {
    id: string;
    service: string;
    description: string;
    preferredDate?: string;
    preferredTime?: string;
  };
  customer: {
    id: string;
    name: string;
  };
}

export async function processTechnicianOffer(bookingId: string, action: 'accept' | 'reject' | 'expire'): Promise<{success: boolean, new_status: string}> {
  const { data, error } = await supabase.rpc('process_technician_offer', {
    p_booking_id: bookingId,
    p_action: action
  });
  if (error) throw error;
  return data;
}

export async function fetchPartnerBookingById(bookingId: string): Promise<PartnerJob | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      service_request_id,
      customer_id,
      technician_id,
      status,
      created_at,
      offer_expires_at,
      service_requests (
        id,
        description,
        preferred_date,
        preferred_time,
        services ( name )
      ),
      users!bookings_customer_id_fkey ( name )
    `)
    .eq('id', bookingId)
    .eq('technician_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  const sr: any = data.service_requests;
  return {
    id: data.id,
    status: data.status,
    createdAt: data.created_at,
    offerExpiresAt: data.offer_expires_at,
    request: {
      id: sr.id,
      service: Array.isArray(sr.services) ? sr.services[0]?.name : sr.services?.name || 'Unknown',
      description: sr.description,
      preferredDate: sr.preferred_date,
      preferredTime: sr.preferred_time,
    },
    customer: {
      id: data.customer_id,
      name: (data.users as any)?.name || 'Customer'
    }
  };
}

export async function fetchPartnerJobs(): Promise<PartnerJob[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      service_request_id,
      customer_id,
      technician_id,
      status,
      created_at,
      offer_expires_at,
      service_requests (
        id,
        description,
        preferred_date,
        preferred_time,
        services ( name )
      ),
      users!bookings_customer_id_fkey ( name ),
      payments ( final_amount, payment_method, status )
    `)
    .eq('technician_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch partner jobs error:', error);
    return [];
  }

  return data.map((b: any) => {
    const sr = b.service_requests as any;
    const serviceName = sr?.services?.name || 'Service';
    const customerUser = b.users as any;
    const paymentData = Array.isArray(b.payments) ? b.payments[0] : b.payments;

    return {
      id: b.id,
      status: b.status,
      createdAt: b.created_at,
      offerExpiresAt: b.offer_expires_at,
      payment: paymentData || null,
      request: {
        id: b.service_request_id,
        service: serviceName,
        description: sr?.description || '',
        preferredDate: sr?.preferred_date,
        preferredTime: sr?.preferred_time,
      },
      customer: {
        id: b.customer_id,
        name: customerUser?.name || 'Customer'
      }
    };
  });
}

export async function updateBookingStatus(bookingId: string, requestId: string, newStatus: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  // 1. Update Booking
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)
    .eq('technician_id', user.id);

  if (bookingError) {
    console.error('Update booking error:', bookingError);
    throw new Error('Failed to update booking status.');
  }

  // 2. Update Service Request
  const { error: requestError } = await supabase
    .from('service_requests')
    .update({ status: newStatus })
    .eq('id', requestId);

  if (requestError) {
    console.error('Update service request error:', requestError);
    // Ignore error so the UI still succeeds for the booking side
  }

  return true;
}

export interface PartnerDashboardData {
  isOnline: boolean;
  name: string;
  rating: number;
  totalJobs: number;
  isVerified: boolean;
  verification_status?: 'incomplete' | 'pending' | 'verified' | 'rejected' | 'suspended';
  rejection_reason?: string;
  todaysJobsCount: number;
  todaysEarnings: number;
  activeJobsCount: number;
}

export async function fetchPartnerDashboardData(): Promise<PartnerDashboardData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch Profile
  const { data: profile } = await supabase
    .from('partner_profiles')
    .select('is_online, rating, total_jobs, is_verified, verification_status, rejection_reason, users(name)')
    .eq('id', user.id)
    .single();

  // Fetch today's bookings
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      status,
      created_at,
      service_requests (
        services ( base_price )
      ),
      payments ( final_amount, status )
    `)
    .eq('technician_id', user.id)
    .gte('created_at', today.toISOString());

  let todaysJobsCount = 0;
  let todaysEarnings = 0;
  let activeJobs: any[] = [];

  if (bookings) {
    bookings.forEach((b: any) => {
      const paymentData = Array.isArray(b.payments) ? b.payments[0] : b.payments;
      if (b.status === 'Completed' || b.status === 'Awaiting Payment') {
        todaysJobsCount++;
        if (paymentData && paymentData.status === 'completed') {
          todaysEarnings += Number(paymentData.final_amount);
        } else if (b.status === 'Completed' && !paymentData) {
          // Fallback for legacy completed bookings without a payment record
          todaysEarnings += Number(b.service_requests?.services?.base_price || 0);
        }
      } else if (b.status !== 'Rejected' && b.status !== 'Cancelled') {
        activeJobs.push(b);
      }
    });
  }

  return {
    name: (Array.isArray(profile?.users) ? profile?.users[0]?.name : (profile?.users as any)?.name) || 'Technician',
    isOnline: profile?.is_online || false,
    rating: profile?.rating || 0,
    totalJobs: profile?.total_jobs || 0,
    isVerified: profile?.is_verified || false,
    verification_status: profile?.verification_status || 'incomplete',
    rejection_reason: profile?.rejection_reason,
    todaysJobsCount,
    todaysEarnings,
    activeJobsCount: activeJobs.length,
  };
}

export async function togglePartnerOnlineStatus(isOnline: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('partner_profiles')
    .update({ is_online: isOnline })
    .eq('id', user.id);
}

export function subscribeToBookingUpdates(
  bookingId: string,
  onUpdate: (payload: any) => void
): () => void {
  const channel = supabase
    .channel(`bookings-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      (payload) => {
        console.log(`[Realtime] Received UPDATE for booking ${bookingId}:`, payload);
        onUpdate(payload);
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Subscription status for booking ${bookingId}: ${status}`);
    });

  return () => {
    console.log(`[Realtime] Unsubscribing from booking ${bookingId}`);
    supabase.removeChannel(channel);
  };
}

export interface TechnicianLocation {
  technician_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export async function updateTechnicianLocation(latitude: number, longitude: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('technician_locations')
    .upsert({
      technician_id: user.id,
      latitude,
      longitude,
      updated_at: new Date().toISOString()
    }, { onConflict: 'technician_id' });

  if (error) {
    console.error('[Location] Failed to update technician location:', error.message);
  }
}

export function subscribeToTechnicianLocation(
  technicianId: string,
  onUpdate: (location: TechnicianLocation) => void
): () => void {
  const channel = supabase
    .channel(`technician_location_${technicianId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'technician_locations',
        filter: `technician_id=eq.${technicianId}`,
      },
      (payload) => {
        if (payload.new && (payload.new as any).latitude) {
          onUpdate(payload.new as TechnicianLocation);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Technician location sub status: ${status}`);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export type AdditionalChargeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AdditionalChargeRequest {
  id: string;
  booking_id: string;
  technician_id: string;
  customer_id: string;
  amount: number;
  reason: string;
  status: AdditionalChargeStatus;
  created_at: string;
  updated_at: string;
}

export async function createAdditionalChargeRequest(
  bookingId: string,
  customerId: string,
  amount: number,
  reason: string
): Promise<AdditionalChargeRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('additional_charge_requests')
    .insert({
      booking_id: bookingId,
      technician_id: user.id,
      customer_id: customerId,
      amount,
      reason,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating additional charge request:', error);
    throw new Error('Unable to send additional charge request. Please try again.');
  }

  return data as AdditionalChargeRequest;
}

export async function fetchBookingAdditionalCharges(bookingId: string): Promise<AdditionalChargeRequest[]> {
  const { data, error } = await supabase
    .from('additional_charge_requests')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching additional charges:', error);
    return [];
  }

  return data as AdditionalChargeRequest[];
}

export async function updateAdditionalChargeStatus(requestId: string, status: AdditionalChargeStatus): Promise<void> {
  const { error } = await supabase
    .from('additional_charge_requests')
    .update({ status })
    .eq('id', requestId);

  if (error) {
    console.error('Error updating additional charge status:', error);
    throw new Error('Could not update request status.');
  }
}

export function subscribeToAdditionalChargeUpdates(
  bookingId: string,
  onUpdate: (payload: any) => void
): () => void {
  const channel = supabase
    .channel(`additional_charges_${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'additional_charge_requests',
        filter: `booking_id=eq.${bookingId}`,
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


export type PaymentMethod = 'cash' | 'online';

export type PaymentStatus = 'pending' | 'order_created' | 'processing' | 'completed' | 'failed' | 'refunded';

export type Payment = {
  id: string;
  booking_id: string;
  customer_id: string;
  technician_id: string;
  base_amount: number;
  additional_charges_amount: number;
  final_amount: number;
  payment_method: PaymentMethod | null;
  status: PaymentStatus;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function createOrGetPayment(bookingId: string): Promise<Payment> {
  const { data, error } = await supabase.rpc('create_or_get_payment', { p_booking_id: bookingId });
  if (error) {
    console.error('Error creating payment:', error);
    throw new Error(error.message || 'Could not generate payment.');
  }
  return data as Payment;
}

export async function fetchBookingPayment(bookingId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching payment:', error);
    return null;
  }
  return data as Payment | null;
}

export async function selectPaymentMethod(paymentId: string, method: PaymentMethod): Promise<void> {
  const { error } = await supabase.rpc('select_payment_method', { p_payment_id: paymentId, p_method: method });
  if (error) {
    console.error('Error selecting payment method:', error);
    throw new Error(error.message || 'Could not select payment method.');
  }
}

export async function createRazorpayOrder(bookingId: string) {
  const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
    body: { booking_id: bookingId }
  });
  if (error) throw new Error(error.message || 'Failed to create order');
  return data;
}

export async function verifyRazorpayPayment(payload: {
  booking_id: string;
  payment_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount: number;
}) {
  const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
    body: payload
  });
  if (error) throw new Error(error.message || 'Failed to verify payment');
  return data;
}

export async function requestCashPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('request_cash_payment', { p_payment_id: paymentId });
  if (error) throw new Error(error.message || 'Could not request cash payment.');
}

export async function confirmCashPayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_cash_payment', { p_payment_id: paymentId });
  if (error) {
    console.error('Error confirming cash payment:', error);
    throw new Error(error.message || 'Could not confirm cash payment.');
  }
}

export function subscribeToPaymentUpdates(paymentId: string, onUpdate: (payload: any) => void): () => void {
  const channel = supabase
    .channel('payment_' + paymentId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: 'id=eq.' + paymentId,
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


export type CancellationRefundStatus = 'not_applicable' | 'pending' | 'processing' | 'completed' | 'failed';

export interface BookingCancellation {
  id: string;
  booking_id: string;
  cancelled_by: string;
  cancelled_by_role: 'customer' | 'technician';
  reason: string;
  description?: string;
  refund_status: CancellationRefundStatus;
  refund_amount: number;
  refund_transaction_id?: string;
  created_at: string;
}

export async function cancelBooking(bookingId: string, reason: string, description?: string): Promise<BookingCancellation> {
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason,
    p_description: description || null
  });
  if (error) throw error;
  return data as BookingCancellation;
}


export async function fetchBookingCancellation(bookingId: string): Promise<BookingCancellation | null> {
  const { data, error } = await supabase
    .from('booking_cancellations')
    .select('*')
    .eq('booking_id', bookingId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data as BookingCancellation;
}

export function subscribeToCancellationUpdates(bookingId: string, onUpdate: (payload: any) => void): () => void {
  const channel = supabase
    .channel('cancellation_' + bookingId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'booking_cancellations',
        filter: 'booking_id=eq.' + bookingId,
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


export type NotificationType =
  | 'booking_assigned'
  | 'booking_accepted'
  | 'technician_on_the_way'
  | 'technician_arrived'
  | 'service_started'
  | 'additional_charge_requested'
  | 'additional_charge_approved'
  | 'additional_charge_rejected'
  | 'booking_cancelled'
  | 'payment_completed'
  | 'refund_completed'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  booking_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export const fetchNotifications = async (): Promise<Notification[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
  return data as Notification[];
};

export const fetchUnreadNotificationCount = async (): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
  return count || 0;
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });

  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  const { error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const subscribeToNotifications = (
  userId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`notifications:user_id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
};












export type DocumentType = 'id_proof' | 'address_proof' | 'skill_certificate' | 'profile_photo' | 'other';
export type DocumentVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface TechnicianDocument {
  id: string;
  technician_id: string;
  document_type: DocumentType;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  verification_status: DocumentVerificationStatus;
  rejection_reason?: string;
  uploaded_at: string;
}

export async function fetchTechnicianDocuments(): Promise<TechnicianDocument[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('technician_documents')
    .select('*')
    .eq('technician_id', user.id)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
  return data as TechnicianDocument[];
}

export async function uploadTechnicianDocument(
  fileUri: string,
  fileName: string,
  mimeType: string,
  docType: DocumentType
): Promise<TechnicianDocument> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = fileName.split('.').pop() || 'jpg';
  const filePath = `${user.id}/${Date.now()}_${docType}.${fileExt}`;

  // Read file as base64 or blob. Since this is React Native, we can use fetch blob
    const response = await fetch(fileUri);
  const arrayBuffer = await response.arrayBuffer();

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('kyc-documents')
    .upload(filePath, arrayBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload document file.');
  }

  // Record in database
  const { data, error: dbError } = await supabase
    .from('technician_documents')
    .insert({
      technician_id: user.id,
      document_type: docType,
      storage_path: filePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size: arrayBuffer.byteLength,
      verification_status: 'pending'
    })
    .select()
    .single();

  if (dbError) {
    console.error('DB Insert error:', dbError);
    throw new Error('Failed to record document in database.');
  }

  return data as TechnicianDocument;
}

export async function submitProfileForVerification(): Promise<void> {
  const { error } = await supabase.rpc('submit_for_verification');
  if (error) {
    console.error('Error submitting profile for verification:', error);
    throw new Error(error.message || 'Failed to submit profile for verification.');
  }
}

// --- ADMIN API ENDPOINTS ---

export async function fetchAllTechnicians(): Promise<any[]> {
  const { data, error } = await supabase
    .from('partner_profiles')
    .select('*, users(name, phone, email)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchTechnicianVerificationDetail(technicianId: string): Promise<any> {
  const { data, error } = await supabase
    .from('partner_profiles')
    .select('*, users(name, phone, email)')
    .eq('id', technicianId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAdminTechnicianDocuments(technicianId: string): Promise<TechnicianDocument[]> {
  const { data, error } = await supabase
    .from('technician_documents')
    .select('*')
    .eq('technician_id', technicianId)
    .order('uploaded_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createTechnicianDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from('kyc-documents')
    .createSignedUrl(storagePath, 300); // 5 minutes expiry

  if (error) throw error;
  return data.signedUrl;
}

export async function adminProcessDocumentVerification(
  documentId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  const { error } = await supabase.rpc('process_document_verification', {
    p_document_id: documentId,
    p_decision: decision,
    p_rejection_reason: rejectionReason || null,
  });

  if (error) throw error;
}

export async function adminProcessTechnicianVerification(
  technicianId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  const { error } = await supabase.rpc('process_technician_verification', {
    p_technician_id: technicianId,
    p_decision: decision,
    p_rejection_reason: rejectionReason || null,
  });

  if (error) throw error;
}


export async function updateTechnicianProfile(
  name: string,
  phone: string,
  bio: string,
  experienceYears: number,
  serviceRadiusKm: number,
  areaName: string,
  latitude: number | null,
  longitude: number | null,
  serviceIds: number[]
) {
  const { error } = await supabase.rpc('update_technician_profile', {
    p_name: name,
    p_phone: phone,
    p_bio: bio,
    p_experience_years: experienceYears,
    p_service_radius_km: serviceRadiusKm,
    p_area_name: areaName,
    p_latitude: latitude,
    p_longitude: longitude,
    p_service_ids: serviceIds
  });

  if (error) {
    console.error('[updateTechnicianProfile] Error:', error.message);
    throw error;
  }
}
