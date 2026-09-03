import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        
        // After signup, we need to direct them to the Setup flow to create the Master Password
        navigate('/setup');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        
        // Will be redirected to /unlock by AppRoutes since dataKey is null
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
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
      // Supabase needs the redirect URL to include the /reset-password hash route
      const redirectUrl = `${window.location.origin}${window.location.pathname}#/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setMessage('Password reset link sent to your email.');
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

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ color: 'var(--accent-teal)' }}>
          {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}
