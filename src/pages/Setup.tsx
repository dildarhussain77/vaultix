import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  generateDataKey, 
  deriveKeyFromPassword, 
  wrapDataKey, 
  generateRecoveryPhrase,
  bufferToBase64,
} from '../lib/crypto';
import { restoreBackup, type BackupData } from '../lib/backup';
import { Shield, Upload } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';

export default function Setup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (masterPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      if (!user) throw new Error("No authenticated user");

      const dataKey = await generateDataKey();

      const mpSalt = window.crypto.getRandomValues(new Uint8Array(16));
      const rpSalt = window.crypto.getRandomValues(new Uint8Array(16));

      const mpKek = await deriveKeyFromPassword(masterPassword, mpSalt);

      const phrase = generateRecoveryPhrase();
      const rpKek = await deriveKeyFromPassword(phrase, rpSalt);

      const wrappedWithMp = await wrapDataKey(dataKey, mpKek);
      const wrappedWithRp = await wrapDataKey(dataKey, rpKek);

      const { error: insertError } = await supabase.from('wrapped_keys').insert({
        user_id: user.id,
        wrapped_data_key_mp: wrappedWithMp.wrappedKeyBase64,
        iv_mp: '',
        wrapped_data_key_rp: wrappedWithRp.wrappedKeyBase64,
        iv_rp: '', // AES-KW does not use IV
        master_password_salt: bufferToBase64(mpSalt),
        recovery_phrase_salt: bufferToBase64(rpSalt)
      });

      if (insertError) throw insertError;

      alert(`SETUP COMPLETE!\n\nIMPORTANT: Write down this 12-word recovery phrase. If you forget your Master Password, this is the ONLY way to recover your vault.\n\n${phrase}`);
      
      navigate('/unlock');
    } catch (err: any) {
      setError(err.message || "An error occurred during setup");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const text = await file.text();
      const backupData: BackupData = JSON.parse(text);
      
      await restoreBackup(backupData, user.id);
      
      alert('Backup restored successfully! You can now unlock your vault.');
      navigate('/unlock');
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to parse or restore backup file.');
    } finally {
      setIsRestoring(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Shield size={48} color="var(--accent-teal)" style={{ marginBottom: '1rem' }} />
        <h2>Setup Your Vault</h2>
        <p>Create your Master Password. This is the only key that can unlock your vault.</p>
      </div>

      <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
        {error && <div style={{ color: 'var(--error-color)', padding: '0.5rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Master Password</label>
          <input 
            type="password" 
            required 
            value={masterPassword} 
            onChange={(e) => setMasterPassword(e.target.value)}
            placeholder="Make it strong and memorable"
          />
          <PasswordStrength password={masterPassword} />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Confirm Password</label>
          <input 
            type="password" 
            required 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
          {loading ? 'Initializing Vault...' : 'Initialize Vault'}
        </button>
      </form>

      <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
        <h3>Have a backup?</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          If you are reinstalling or lost your database, you can upload your vaultix-backup.json file to restore everything.
        </p>
        
        {restoreError && <div style={{ color: 'var(--error-color)', padding: '0.5rem', marginBottom: '1rem', border: '1px solid var(--error-color)', borderRadius: 'var(--radius-sm)' }}>{restoreError}</div>}
        
        <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', opacity: isRestoring ? 0.7 : 1 }}>
          <Upload size={18} />
          {isRestoring ? 'Restoring...' : 'Upload Backup File'}
          <input type="file" accept=".json" onChange={handleFileUpload} disabled={isRestoring} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
}
