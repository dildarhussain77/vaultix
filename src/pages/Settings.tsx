import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { 
  generateRecoveryPhrase, 
  generateSalt, 
  deriveKeyFromPhrase, 
  wrapDataKey, 
  bufferToBase64 
} from '../lib/crypto';
import { loadEncryptedVaultCache } from '../lib/cache';
import { restoreBackup, type BackupData } from '../lib/backup';
import { 
  isBiometricsAvailable, 
  getBiometricConfig, 
  registerBiometrics, 
  disableBiometrics 
} from '../lib/biometrics';
import {
  fetchUserDevices,
  revokeDevice,
  getOrCreateDeviceId,
  type UserDevice
} from '../lib/devices';
import {
  isNotificationsEnabled,
  enableNotifications,
  disableNotifications,
  isNotificationSupported
} from '../lib/notifications';
import { 
  ArrowLeft, 
  Fingerprint, 
  Download, 
  Upload, 
  ShieldAlert, 
  BookOpen, 
  ChevronRight, 
  Lock, 
  LogOut, 
  AlertTriangle,
  Smartphone,
  Laptop,
  Trash2,
  CheckCircle2,
  Bell,
  BellOff
} from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { dataKey, lockVault } = useVault();
  const { showAlert, showConfirm } = useModal();
  const { showToast } = useToast();

  // Biometrics State
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  
  // Phrase Regeneration State
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Logged-in Devices State
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const currentDeviceId = getOrCreateDeviceId();

  // Notifications State
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    setNotificationsSupported(isNotificationSupported());
    setNotificationsEnabled(isNotificationsEnabled());
  }, []);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      disableNotifications();
      setNotificationsEnabled(false);
      showToast("Notifications disabled", "info");
    } else {
      try {
        const granted = await enableNotifications();
        if (granted) {
          setNotificationsEnabled(true);
          showToast("Security notifications enabled", "success");
        } else {
          showToast("Notification permission denied", "error");
        }
      } catch (err: any) {
        showAlert({
          title: "Notifications",
          message: err.message || "Failed to enable notifications.",
          type: "error"
        });
      }
    }
  };

  useEffect(() => {
    async function checkBio() {
      if (!user) return;
      const available = await isBiometricsAvailable();
      setBiometricsAvailable(available);
      const config = getBiometricConfig(user.id);
      setBiometricsEnabled(!!config?.enabled);
    }
    checkBio();
  }, [user]);

  // Load registered devices
  const loadDevices = async () => {
    if (!user) return;
    setLoadingDevices(true);
    const list = await fetchUserDevices(user.id);
    setDevices(list);
    setLoadingDevices(false);
  };

  useEffect(() => {
    loadDevices();
  }, [user]);

  const handleRevokeDevice = async (device: UserDevice) => {
    const isCurrent = device.device_id === currentDeviceId;
    const confirmed = await showConfirm({
      title: isCurrent ? "Log out this device?" : "Log out remote device?",
      message: isCurrent 
        ? "This is your current device. Logging it out will sign you out of Vaultix."
        : `Are you sure you want to log out ${device.os_name} (${device.browser_name})?`,
      confirmText: "Log out device",
      type: "warning"
    });

    if (!confirmed) return;

    try {
      await revokeDevice(device.id);
      showToast("Device logged out", "info");

      // Send security alert notification to in-app notification center and OS
      const { sendNotification } = await import('../lib/notifications');
      sendNotification(
        'Vaultix Security: Device Logged Out',
        `${device.os_name} (${device.browser_name}) session was revoked.`,
        'warning'
      );

      if (isCurrent) {
        navigator.clipboard.writeText('').catch(() => {});
        signOut();
      } else {
        await loadDevices();
      }
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err.message || "Failed to log out device",
        type: "error"
      });
    }
  };

  // --- BIOMETRIC TOGGLE ---
  const handleToggleBiometrics = async () => {
    if (!user) return;
    if (biometricsEnabled) {
      const confirmed = await showConfirm({
        title: "Disable Biometrics",
        message: "Are you sure you want to disable biometric verification on this device?",
        confirmText: "Disable",
        isDestructive: true
      });
      if (confirmed) {
        disableBiometrics(user.id);
        setBiometricsEnabled(false);
        showToast("Device biometrics disabled", "info");
      }
    } else {
      try {
        await registerBiometrics(user.id, user.email || "user@vaultix");
        setBiometricsEnabled(true);
        showToast("Device biometrics enabled", "success");
      } catch (err: any) {
        await showAlert({
          title: "Biometrics Failed",
          message: err.message || "Failed to enable biometrics.",
          type: "error"
        });
      }
    }
  };

  // --- EXPORT BACKUP ---
  const exportBackup = async () => {
    if (!user) return;
    try {
      const cache = await loadEncryptedVaultCache(user.id);
      if (!cache) throw new Error("No local data found to backup");

      const backup = {
        version: "1.0",
        export_date: new Date().toISOString(),
        user_id: user.id,
        wrapped_keys: cache.wrapped_keys,
        folders: cache.folders,
        credentials: cache.credentials
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaultix-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Backup exported", "success");
    } catch (err) {
      console.error("Backup failed", err);
      await showAlert({ title: "Backup Failed", message: "Failed to generate encrypted backup file.", type: "error" });
    }
  };

  // --- IMPORT BACKUP ---
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const confirmed = await showConfirm({
      title: "Import Backup",
      message: "Importing a backup will merge matching credentials and restore your folders into Supabase. Do you want to proceed?",
      confirmText: "Import",
      type: "info"
    });

    if (!confirmed) {
      if (e.target) e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const backupData: BackupData = JSON.parse(text);

      await restoreBackup(backupData, user.id);
      showToast("Backup restored successfully", "success");
    } catch (err: any) {
      await showAlert({ title: "Restore Failed", message: err.message || 'Failed to restore backup.', type: "error" });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // --- REGENERATE PHRASE ---
  const handleRegeneratePhrase = async () => {
    if (!user || !dataKey) return;

    const confirmed = await showConfirm({
      title: "Regenerate Recovery Phrase",
      message: "Generating a new phrase will instantly invalidate your old recovery phrase. Are you sure you want to continue?",
      confirmText: "Regenerate",
      type: "warning",
      isDestructive: true
    });

    if (!confirmed) return;

    setIsRegenerating(true);
    try {
      const phrase = generateRecoveryPhrase();
      const salt = generateSalt();
      const recoveryKek = await deriveKeyFromPhrase(phrase, salt);
      const wrappedDataKey = await wrapDataKey(dataKey, recoveryKek);

      const { error } = await supabase
        .from('wrapped_keys')
        .update({
          recovery_phrase_salt: bufferToBase64(salt),
          wrapped_data_key_rp: wrappedDataKey.wrappedKeyBase64
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setNewRecoveryPhrase(phrase);
      showToast("Recovery phrase updated", "success");
    } catch (err) {
      console.error(err);
      await showAlert({ title: "Regeneration Failed", message: "Failed to regenerate recovery phrase.", type: "error" });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '1.25rem 1rem 3rem' }}>
      <div className="container" style={{ maxWidth: '440px', margin: '0 auto' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <button 
            onClick={() => navigate('/')} 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', fontSize: '0.88rem' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Settings</h1>
          </div>
        </div>

        {/* Section: Device Biometrics */}
        {biometricsAvailable && (
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Device Security
            </span>
            <button
              onClick={handleToggleBiometrics}
              className="btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                color: biometricsEnabled ? 'var(--accent-teal)' : 'var(--text-primary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Fingerprint size={18} color={biometricsEnabled ? 'var(--accent-teal)' : 'var(--text-secondary)'} />
                <span style={{ fontWeight: 500 }}>
                  {biometricsEnabled ? 'Device Biometrics: Enabled' : 'Enable Device Biometrics'}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: biometricsEnabled ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                {biometricsEnabled ? 'Turn Off' : 'Turn On'}
              </span>
            </button>
          </div>
        )}

        {/* Section: System Notifications */}
        {notificationsSupported && (
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Alerts & Notifications
            </span>
            <button
              onClick={handleToggleNotifications}
              className="btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                color: notificationsEnabled ? 'var(--accent-teal)' : 'var(--text-primary)',
                marginBottom: notificationsEnabled ? '0.5rem' : '0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Bell size={18} color={notificationsEnabled ? 'var(--accent-teal)' : 'var(--text-secondary)'} />
                <span style={{ fontWeight: 500 }}>
                  {notificationsEnabled ? 'System Notifications: Enabled' : 'Enable Security Notifications'}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: notificationsEnabled ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                {notificationsEnabled ? 'Turn Off' : 'Turn On'}
              </span>
            </button>

            {notificationsEnabled && (
              <button
                onClick={async () => {
                  const { sendNotification } = await import('../lib/notifications');
                  await sendNotification('Vaultix Test Alert', 'This is a test notification from Vaultix.', 'info');
                  showToast('Test notification sent!', 'success');
                }}
                className="btn-secondary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--accent-teal)'
                }}
              >
                <Bell size={14} />
                <span>Send Test Notification</span>
              </button>
            )}
          </div>
        )}

        {/* Section: Backups & Vault Maintenance */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Backup & Recovery
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              onClick={exportBackup} 
              className="btn-secondary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1rem' }}
            >
              <Download size={18} color="var(--accent-teal)" />
              <span style={{ fontWeight: 500 }}>Export Backup (.json)</span>
            </button>

            <label 
              className="btn-secondary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1rem', cursor: 'pointer' }}
            >
              <Upload size={18} color="var(--accent-teal)" />
              <span style={{ fontWeight: 500 }}>Import Backup File</span>
              <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
            </label>

            <button 
              onClick={handleRegeneratePhrase} 
              disabled={isRegenerating} 
              className="btn-secondary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1rem', color: '#c084fc' }}
            >
              <ShieldAlert size={18} />
              <span style={{ fontWeight: 500 }}>{isRegenerating ? 'Generating...' : 'Regenerate Recovery Phrase'}</span>
            </button>
          </div>
        </div>

        {/* Section: Logged-in Devices (One-line card to dedicated page) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Devices & Sessions
          </span>
          <button 
            onClick={() => navigate('/devices')} 
            className="btn-secondary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Laptop size={18} color="var(--accent-teal)" />
              <span style={{ fontWeight: 500 }}>Logged-in Devices</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {devices.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {devices.length} active
                </span>
              )}
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          </button>
        </div>

        {/* Section: Guidelines & Security */}
        <div style={{ marginBottom: '1.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            About & Protection
          </span>
          <button 
            onClick={() => navigate('/security-guide')} 
            className="btn-secondary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <BookOpen size={18} color="var(--accent-teal)" />
              <span style={{ fontWeight: 500 }}>Security & User Guidelines</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        </div>

        {/* Section: Quick Actions */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            onClick={async () => { 
              const confirmed = await showConfirm({
                title: "Lock Vault",
                message: "Are you sure you want to lock your vault now?",
                confirmText: "Lock",
                cancelText: "Stay"
              });
              if (confirmed) {
                navigator.clipboard.writeText('').catch(() => {});
                lockVault();
              }
            }} 
            className="btn-secondary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
          >
            <Lock size={16} /> Lock Vault
          </button>
          
          <button 
            onClick={async () => { 
              const confirmed = await showConfirm({
                title: "Sign out",
                message: "Are you sure you want to sign out of your account?",
                confirmText: "Sign out",
                cancelText: "Cancel"
              });
              if (confirmed) {
                navigator.clipboard.writeText('').catch(() => {});
                signOut();
              }
            }} 
            style={{ width: '100%', padding: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>

        {/* Modal for New Recovery Phrase */}
        {newRecoveryPhrase && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-md)', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <AlertTriangle size={48} color="var(--accent-purple)" style={{ marginBottom: '1rem' }} />
              <h2 style={{ color: 'var(--accent-purple)', marginBottom: '1rem' }}>New Recovery Phrase</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Your old recovery phrase is now completely invalid. Please write down these 12 words in order and keep them safe.
              </p>
              
              <div style={{ 
                backgroundColor: 'var(--bg-tertiary)', 
                padding: '1.25rem', 
                borderRadius: 'var(--radius-sm)', 
                fontSize: '1.15rem', 
                fontWeight: 'bold', 
                letterSpacing: '1px', 
                lineHeight: '1.6',
                marginBottom: '1.75rem'
              }}>
                {newRecoveryPhrase}
              </div>

              <button 
                onClick={() => setNewRecoveryPhrase(null)} 
                className="btn-primary" 
                style={{ width: '100%', backgroundColor: 'var(--accent-purple)' }}
              >
                I have written it down
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
