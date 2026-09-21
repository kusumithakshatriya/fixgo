import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { 
  createDemoBooking, 
  updateDemoBookingStatusDb, 
  fetchActiveDemoBookingsForTechnician,
  subscribeToDemoBookingUpdates,
  subscribeToAllDemoBookingsForTechnician
} from '@/services/supabase';

export type DemoBookingStatus = 'Technician Assigned' | 'Accepted' | 'On The Way' | 'Arrived' | 'Work In Progress' | 'Awaiting Payment' | 'Completed' | 'Cancelled' | null;

interface DemoState {
  hasDemoBooking: boolean;
  demoBookingStatus: DemoBookingStatus;
  demoBookingDetails: any;
  setDemoBooking: (details: any) => Promise<void>;
  updateDemoStatus: (status: DemoBookingStatus) => Promise<void>;
  clearDemo: () => Promise<void>;
}

const DemoContext = createContext<DemoState | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [hasDemoBooking, setHasDemoBooking] = useState(false);
  const [demoBookingStatus, setDemoBookingStatus] = useState<DemoBookingStatus>(null);
  const [demoBookingDetails, setDemoBookingDetails] = useState<any>(null);
  const [isPartner, setIsPartner] = useState(false);

  useEffect(() => {
    // Check if we are a demo partner
    SecureStore.getItemAsync('partner_demo_logged_in').then(val => {
      if (val === 'true') {
        setIsPartner(true);
        loadPartnerDemoJobs();
      } else {
        // Customer side loading
        SecureStore.getItemAsync('demo_booking').then(val => {
          if (val) {
            try {
              const parsed = JSON.parse(val);
              setHasDemoBooking(true);
              setDemoBookingStatus(parsed.status);
              setDemoBookingDetails(parsed);
              if (parsed.dbId) {
                subscribeToDemoBookingUpdates(parsed.dbId, (payload) => {
                  if (payload.new && payload.new.status) {
                    setDemoBookingStatus(payload.new.status);
                    setDemoBookingDetails((prev: any) => ({ ...prev, status: payload.new.status }));
                  }
                });
              }
            } catch (e) {}
          }
        });
      }
    });
  }, []);

  const loadPartnerDemoJobs = async () => {
    try {
      const activeBookings = await fetchActiveDemoBookingsForTechnician('demo-tech-1'); // Default demo tech
      if (activeBookings && activeBookings.length > 0) {
        const dbJob = activeBookings[0];
        const localDetails = {
          dbId: dbJob.id,
          requestId: dbJob.id,
          service: dbJob.service,
          description: dbJob.description,
          location: dbJob.location,
          price: dbJob.price,
          technicianId: dbJob.technician_id,
          status: dbJob.status
        };
        setHasDemoBooking(true);
        setDemoBookingStatus(dbJob.status);
        setDemoBookingDetails(localDetails);
      }

      subscribeToAllDemoBookingsForTechnician('demo-tech-1', (payload) => {
        if (payload.new) {
          const dbJob = payload.new;
          const localDetails = {
            dbId: dbJob.id,
            requestId: dbJob.id,
            service: dbJob.service,
            description: dbJob.description,
            location: dbJob.location,
            price: dbJob.price,
            technicianId: dbJob.technician_id,
            status: dbJob.status
          };
          setHasDemoBooking(true);
          setDemoBookingStatus(dbJob.status);
          setDemoBookingDetails(localDetails);
        }
      });
    } catch (e) {
      console.error('Failed to load partner demo jobs', e);
    }
  };

  const setDemoBooking = async (details: any) => {
    const payload = { ...details, status: 'Technician Assigned' };
    
    try {
      // Create remote demo booking
      const dbRecord = await createDemoBooking(payload);
      payload.dbId = dbRecord.id;
      
      // Subscribe immediately to remote updates
      subscribeToDemoBookingUpdates(dbRecord.id, (payload) => {
        if (payload.new && payload.new.status) {
          setDemoBookingStatus(payload.new.status);
          setDemoBookingDetails((prev: any) => ({ ...prev, status: payload.new.status }));
        }
      });
    } catch (e) {
      console.error('Failed to create remote demo booking', e);
    }

    setHasDemoBooking(true);
    setDemoBookingStatus('Technician Assigned');
    setDemoBookingDetails(payload);
    await SecureStore.setItemAsync('demo_booking', JSON.stringify(payload));
  };

  const updateDemoStatus = async (status: DemoBookingStatus) => {
    setDemoBookingStatus(status);
    if (demoBookingDetails) {
      const updated = { ...demoBookingDetails, status };
      setDemoBookingDetails(updated);
      
      if (updated.dbId) {
        try {
          await updateDemoBookingStatusDb(updated.dbId, status as string);
        } catch (e) {
          console.error('Failed to update remote demo booking', e);
        }
      }
      
      if (!isPartner) {
        await SecureStore.setItemAsync('demo_booking', JSON.stringify(updated));
      }
    }
  };

  const clearDemo = async () => {
    setHasDemoBooking(false);
    setDemoBookingStatus(null);
    setDemoBookingDetails(null);
    await SecureStore.deleteItemAsync('demo_booking');
  };

  return (
    <DemoContext.Provider value={{
      hasDemoBooking, demoBookingStatus, demoBookingDetails,
      setDemoBooking, updateDemoStatus, clearDemo
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within a DemoProvider');
  return context;
}
