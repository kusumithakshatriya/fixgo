import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

export type User = {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  location?: string;
  role?: string;
};

export type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    let lastProcessedUrl = '';

    const handleDeepLink = async (url: string) => {
      if (!url || url === lastProcessedUrl) return;
      lastProcessedUrl = url;

      let queryString = '';
      if (url.includes('#access_token=')) {
        queryString = url.split('#')[1];
      } else if (url.includes('?')) {
        queryString = url.split('?')[1].split('#')[0];
      }
      
      if (queryString) {
        const pairs = queryString.split('&');
        const params: Record<string, string> = {};
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) params[key] = decodeURIComponent(value);
        }
        
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        } else if (params.code) {
          await supabase.auth.exchangeCodeForSession(params.code);
        }
      }
    };

    const sub = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (data) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          phone: data.phone,
          name: data.name,
          location: data.location,
          role: data.role,
        });
      } else {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
        });
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string) => {
    // Generate a robust deep link URL with a path to prevent Android intent failures.
    const redirectTo = Linking.createURL('/(auth)/otp-verification');
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: redirectTo,
      }
    });
    if (error) throw error;
  };

  const updateProfile = async (data: Partial<User>) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const currentUserId = authUser?.id || user?.id;
    const currentUserEmail = authUser?.email || user?.email || '';
    
    if (!currentUserId || !authUser) throw new Error('Not authenticated');

    const profileData = {
      id: currentUserId,
      name: data.name,
      email: currentUserEmail,
      phone: data.phone,
      location: data.location,
      role: 'customer',
    };

    const { error } = await supabase
      .from('users')
      .upsert(profileData);

    if (error) throw error;

    setUser(prev => prev ? { ...prev, ...profileData } : profileData as User);
  };

  const logout = async () => {
    setUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        updateProfile,
        logout,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
