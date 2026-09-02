import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { 
  deriveKeyFromPhrase,
  deriveKeyFromPassword,
  unwrapDataKey,
  wrapDataKey,
  base64ToBuffer,
  bufferToBase64,
  generateSalt,
  generateIV
} from '../lib/crypto';
import { KeyRound, ShieldAlert } from 'lucide-react';

export default function Recover() {
  const { user } = useAuth();
  const { unlockVault } = useVault();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [dataKeyTemp, setDataKeyTemp] = useState<CryptoKey | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyPhrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Not authenticated");

      const { data, error: dbError } = await supabase
        .from('wrapped_keys')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (dbError || !data) throw new Error("Could not fetch key data.");

      const salt = base64ToBuffer(data.recovery_phrase_salt);
      const rpKek = await deriveKeyFromPhrase(recoveryPhrase, salt);

      try {
        const dk = await unwrapDataKey(data.wrapped_data_key_rp, rpKek);
        setDataKeyTemp(dk);
        setStep(2); // Move to reset password step
      } catch (cryptoErr) {
        throw new Error("Invalid Recovery Phrase.");
      }
    } catch (err: any) {
      setError(err.message || "Recovery failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMasterPassword.length < 8) {
      setError("Master Password must be at least 8 characters long.");
      return;
    }
    if (newMasterPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!dataKeyTemp || !user) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Generate new salt and IV for the new Master Password
      const newSalt = generateSalt();
      const newIv = generateIV();

      // 2. Derive new KEK from new Master Password
      const newMpKek = await deriveKeyFromPassword(newMasterPassword, newSalt);

      // 3. Re-wrap the Data Key with the new KEK
      const { wrappedKeyBase64 } = await wrapDataKey(dataKeyTemp, newMpKek);

      // 4. Update the wrapped_keys row in Supabase
      const { error: updateError } = await supabase
        .from('wrapped_keys')
        .update({
          wrapped_data_key_mp: wrappedKeyBase64,
          master_password_salt: bufferToBase64(newSalt),
          iv_mp: bufferToBase64(newIv)
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // 5. Unlock vault and redirect
      unlockVault(dataKeyTemp);
      navigate('/');
      
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <ShieldAlert size={48} color="var(--error-color)" style={{ marginBottom: '1rem' }} />
          <h2>Recover Vault</h2>
          <p>Enter your 12-word recovery phrase to regain access.</p>
        </div>

        <form onSubmit={handleVerifyPhrase} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
          
          <div>
            <textarea 
              required 
              value={recoveryPhrase} 
              onChange={(e) => setRecoveryPhrase(e.target.value.toLowerCase().trim())}
              placeholder="word1 word2 word3..."
              rows={3}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Phrase'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <KeyRound size={48} color="var(--accent-teal)" style={{ marginBottom: '1rem' }} />
        <h2>Set New Master Password</h2>
        <p>Your phrase was verified. Create a new master password to secure your vault again.</p>
      </div>

      <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <div>
          <input 
            type="password" 
            required 
            value={newMasterPassword} 
            onChange={(e) => setNewMasterPassword(e.target.value)}
            placeholder="New Master Password"
          />
        </div>

        <div>
          <input 
            type="password" 
            required 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset Password & Unlock'}
        </button>
      </form>
    </div>
  );
}
