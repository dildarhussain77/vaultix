import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for the password recovery event
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event == "PASSWORD_RECOVERY") {
          // The user clicked the link and is now ready to set a new password
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      
      if (updateError) throw updateError;
      
      // Successfully updated password, redirect to login
      navigate('/auth');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Shield size={48} color="var(--accent-teal)" style={{ marginBottom: '1rem' }} />
        <h2>Set New Login Password</h2>
        <p>This is for your Supabase account, NOT your Master Password.</p>
      </div>

      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>New Password</label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Supabase password"
          />
          <PasswordStrength password={password} />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
