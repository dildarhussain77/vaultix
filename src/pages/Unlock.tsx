import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { 
  deriveKeyFromPassword, 
  unwrapDataKey,
  base64ToBuffer
} from '../lib/crypto';
import { loadEncryptedVaultCache } from '../lib/cache';
import { Lock, LogOut } from 'lucide-react';

export default function Unlock() {
  const { user, signOut } = useAuth();
  const { unlockVault } = useVault();
  const navigate = useNavigate();

  const [masterPassword, setMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if they need setup
  useEffect(() => {
    async function checkSetup() {
      if (!user) return;
      try {
        const { data, error } = await supabase.from('wrapped_keys').select('user_id').eq('user_id', user.id).single();
        if (error || !data) {
          // If offline, supabase throws. We should check cache first before redirecting to setup.
          const cache = await loadEncryptedVaultCache(user.id);
          if (!cache || !cache.wrapped_keys) {
            navigate('/setup');
          }
        }
      } catch (err) {
        const cache = await loadEncryptedVaultCache(user.id);
        if (!cache || !cache.wrapped_keys) {
           navigate('/setup');
        }
      }
    }
    checkSetup();
  }, [user, navigate]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("No authenticated user");

      // 1. Try to fetch from Supabase, fallback to cache if offline
      let keyData: any;
      try {
        const { data, error: dbError } = await supabase
          .from('wrapped_keys')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (dbError) throw dbError;
        keyData = data;
      } catch (fetchErr) {
        console.warn("Could not reach Supabase, falling back to local cache.");
        const cache = await loadEncryptedVaultCache(user.id);
        if (cache && cache.wrapped_keys) {
          keyData = cache.wrapped_keys;
        } else {
          throw new Error("You are offline and have no local cache. Please connect to the internet.");
        }
      }

      // 2. Derive KEK from Master Password and Salt
      const salt = base64ToBuffer(keyData.master_password_salt);
      const mpKek = await deriveKeyFromPassword(masterPassword, salt);

      // 3. Unwrap the Data Key
      try {
        const dataKey = await unwrapDataKey(keyData.wrapped_data_key_mp, mpKek);
        
        // Success! Provide Data Key to Vault Context and redirect
        unlockVault(dataKey);
        navigate('/');
      } catch (cryptoErr) {
        throw new Error("Invalid Master Password.");
      }

    } catch (err: any) {
      setError(err.message || "Failed to unlock vault.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Lock size={48} color="var(--accent-teal)" style={{ marginBottom: '1rem' }} />
        <h2>Vault Locked</h2>
        <p>Enter your Master Password to decrypt your data.</p>
      </div>

      <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <div>
          <input 
            type="password" 
            required 
            value={masterPassword} 
            onChange={(e) => setMasterPassword(e.target.value)}
            placeholder="Master Password"
            autoFocus
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Decrypting...' : 'Unlock Vault'}
        </button>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
        <Link to="/recover" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Forgot Password?
        </Link>
        
        <button onClick={() => { if(window.confirm("Are you sure you want to sign out?")) signOut(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
