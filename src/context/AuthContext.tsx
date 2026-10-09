import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const hadUserRef = useRef(false);
  const otpVerifiedUserRef = useRef<string | null>(null);

  const checkDeviceVerification = async (userId: string) => {
    const isKnown = await isDeviceRegistered(userId);
    // Device just passed OTP in this session: its DB registration may still be in flight,
    // so don't let a stale "not registered" result downgrade it.
    const isVerified = isKnown || otpVerifiedUserRef.current === userId;
    setIsDeviceVerified(isVerified);
    if (isVerified) {
      registerCurrentDevice(userId);
    }
  };

  useEffect(() => {
    // Get active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      hadUserRef.current = !!session?.user;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkDeviceVerification(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // A fresh login must be treated as unverified until the device check finishes.
      // Otherwise /auth briefly redirects away (isDeviceVerified defaults to true),
      // unmounting <Auth /> and losing its OTP step.
      if (session?.user && !hadUserRef.current) {
        setIsDeviceVerified(false);
      }
      hadUserRef.current = !!session?.user;
      if (!session) otpVerifiedUserRef.current = null;
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
      otpVerifiedUserRef.current = uid;
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
