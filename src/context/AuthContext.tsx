import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { registerCurrentDevice, isDeviceRegistered } from '../lib/devices';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isDeviceVerified: boolean;
  setDeviceVerified: (verified: boolean, targetUserId?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeviceVerified, setIsDeviceVerified] = useState(true);

  const checkDeviceVerification = async (userId: string) => {
    const isKnown = await isDeviceRegistered(userId);
    setIsDeviceVerified(isKnown);
    if (isKnown) {
      registerCurrentDevice(userId);
    }
  };

  useEffect(() => {
    // Get active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkDeviceVerification(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkDeviceVerification(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setDeviceVerified = (verified: boolean, targetUserId?: string) => {
    setIsDeviceVerified(verified);
    const uid = targetUserId || user?.id || session?.user?.id;
    if (verified && uid) {
      registerCurrentDevice(uid);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setSession(null);
      setUser(null);
      setIsDeviceVerified(true);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      loading, 
      isDeviceVerified, 
      setDeviceVerified, 
      signOut 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
