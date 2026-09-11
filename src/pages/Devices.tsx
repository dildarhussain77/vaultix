import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { 
  fetchUserDevices, 
  revokeDevice, 
  getOrCreateDeviceId, 
  type UserDevice 
} from '../lib/devices';
import { 
  ArrowLeft, 
  Laptop, 
  Smartphone, 
  Trash2, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export default function Devices() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const { showToast } = useToast();

  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const currentDeviceId = getOrCreateDeviceId();

  const loadDevices = async () => {
    if (!user) return;
    setLoading(true);
    const list = await fetchUserDevices(user.id);
    setDevices(list);
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, [user]);

  const handleRevoke = async (device: UserDevice) => {
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

  const formatLastActive = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return "Active just now";
    if (diffMins < 60) return `Active ${diffMins} min ago`;
    if (diffHours < 24) return `Active ${diffHours} hr ago`;
    return `Last active ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '1rem 0.85rem 4rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Navigation Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '0.75rem',
          marginBottom: '1.5rem', 
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '0.75rem' 
        }}>
          <button 
            onClick={() => navigate('/settings')} 
            className="btn-secondary" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.4rem', 
              padding: '0.4rem 0.75rem', 
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <ArrowLeft size={15} /> Back to Settings
          </button>
          <span style={{ 
            fontSize: '0.72rem', 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em'
          }}>
            Active Sessions
          </span>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-teal)', marginBottom: '0.35rem' }}>
            <ShieldCheck size={18} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Device Security
            </span>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', lineHeight: 1.3 }}>
            Logged-in Devices
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            These devices have signed into your Vaultix account. If you lose a device or don't recognize one, log it out immediately.
          </p>
        </div>

        {/* Devices List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Loading registered devices...
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Only this current device is signed in.
            </div>
          ) : (
            devices.map((device) => {
              const isCurrent = device.device_id === currentDeviceId;
              const Icon = device.device_type === 'mobile' ? Smartphone : Laptop;

              return (
                <div 
                  key={device.id}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: `1px solid ${isCurrent ? 'rgba(13, 148, 136, 0.4)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    
                    {/* Device Details */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        backgroundColor: isCurrent ? 'rgba(13, 148, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: isCurrent ? 'var(--accent-teal)' : 'var(--text-secondary)',
                        marginTop: '0.1rem'
                      }}>
                        <Icon size={18} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {device.os_name} · {device.browser_name}
                          </span>
                          {isCurrent && (
                            <span style={{ 
                              fontSize: '0.68rem', 
                              backgroundColor: 'rgba(13, 148, 136, 0.2)', 
                              color: 'var(--accent-teal)', 
                              padding: '0.1rem 0.45rem', 
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              This Device
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: isCurrent ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                          <Clock size={13} />
                          <span>{isCurrent ? 'Active now' : formatLastActive(device.last_active)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleRevoke(device)}
                      style={{
                        background: 'none',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.35rem 0.65rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.76rem',
                        borderRadius: 'var(--radius-sm)',
                        flexShrink: 0
                      }}
                      title="Log out device"
                    >
                      <Trash2 size={13} />
                      <span>Log out</span>
                    </button>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
