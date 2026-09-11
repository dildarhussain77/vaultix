import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { isDeviceRegistered, registerCurrentDevice } from '../lib/devices';

function maskEmail(str: string): string {
  if (!str || !str.includes('@')) return str;
  const [name, domain] = str.split('@');
  if (name.length <= 3) {
    return `${name[0]}***@${domain}`;
  }
  return `${name.slice(0, 2)}***${name.slice(-2)}@${domain}`;
}

export default function Auth() {
  const { showToast } = useToast();
  const { session, isDeviceVerified, setDeviceVerified } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Two-Step Verification State
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);

  // If there's no active session or user logged out, always reset to the clean Sign In screen
  useEffect(() => {
    if (!session) {
      setAwaitingOtp(false);
      setOtpCode('');
    }
  }, [session]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        
        if (data.user) {
          await registerCurrentDevice(data.user.id);
        }
        navigate('/setup');
      } else {
        // 1. Sign in with password first
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        if (data.user) {
          // 2. Check if this device is already known
          const isKnownDevice = await isDeviceRegistered(data.user.id);

          if (!isKnownDevice) {
            // New device detected! Send OTP and show verification step
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { shouldCreateUser: false }
            });

            if (otpError) {
              console.warn("Could not trigger Email OTP:", otpError);
              // If Supabase email provider is unconfigured, register device and proceed
              setDeviceVerified(true);
            } else {
              setAwaitingOtp(true);
              setMessage(`New device detected! A 6-digit verification code was sent to ${email}.`);
              showToast("Verification code sent to your email", "info");
              return;
            }
          } else {
            // Already known device: mark verified and proceed
            setDeviceVerified(true);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email'
      });

      if (verifyError) throw verifyError;

      if (data.user) {
        // Mark device verified and register it immediately
        setDeviceVerified(true, data.user.id);
        showToast("Device verified successfully!", "success");
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false }
      });
      if (error) throw error;
      showToast("A new 6-digit code has been sent", "info");
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}#/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setMessage('Password reset link sent to your email.');
      showToast('Password reset link sent to your email', 'info');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Shield size={48} color="var(--accent-teal)" style={{ marginBottom: '1rem' }} />
        <h1>Vaultix</h1>
        <p>Zero-Knowledge Credential Manager</p>
      </div>

      {awaitingOtp ? (
        /* --- TWO-STEP VERIFICATION OTP SCREEN --- */
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)', marginBottom: '0.75rem' }}>
            <KeyRound size={20} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>New Device Verification</h2>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            We don't recognize this device. Enter the 6-digit code sent to <strong>{maskEmail(email)}</strong> (or tap the sign-in link in that email) to verify this is you.
          </p>

          {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                6-Digit Security Code
              </label>
              <input 
                type="text" 
                required 
                maxLength={8}
                value={otpCode} 
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="123456"
                style={{ 
                  width: '100%', 
                  textAlign: 'center', 
                  fontSize: '1.35rem', 
                  letterSpacing: '6px', 
                  fontWeight: 700 
                }}
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Verifying...' : 'Verify Device & Continue'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <button 
              type="button" 
              onClick={() => { setAwaitingOtp(false); setOtpCode(''); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>

            <button 
              type="button" 
              onClick={handleResendOtp}
              disabled={resending}
              style={{ color: 'var(--accent-teal)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <RefreshCw size={13} className={resending ? 'spin' : ''} />
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>
      ) : (
        /* --- STANDARD EMAIL + PASSWORD LOGIN SCREEN --- */
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
          {message && <div style={{ color: 'var(--success-color)', padding: '0.5rem', border: '1px solid var(--success-color)', borderRadius: 'var(--radius-sm)' }}>{message}</div>}
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Supabase account password"
              style={{ width: '100%' }}
            />
            {isSignUp && <PasswordStrength password={password} />}
            {!isSignUp && (
              <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                <button type="button" onClick={handleResetPassword} style={{ color: 'var(--accent-teal)', fontSize: '0.85rem' }}>
                  Forgot Login Password?
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>
      )}

      {!awaitingOtp && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ color: 'var(--accent-teal)' }}>
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      )}
    </div>
  );
}

