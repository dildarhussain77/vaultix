import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { 
  getNotificationHistory, 
  deleteNotification, 
  deleteNotifications, 
  clearNotificationHistory,
  markAllNotificationsAsRead,
  type AppNotification 
} from '../lib/notifications';
import { 
  ArrowLeft, 
  Bell, 
  Trash2, 
  CheckSquare, 
  Square, 
  ShieldAlert, 
  Info, 
  CheckCircle, 
  AlertTriangle,
  X
} from 'lucide-react';

export default function Notifications() {
  const navigate = useNavigate();
  const { showConfirm } = useModal();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Long press handling with scroll cancellation
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const isScrollingRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const loadNotifs = () => {
    const list = getNotificationHistory();
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifs();
    markAllNotificationsAsRead();

    const onUpdate = () => loadNotifs();
    window.addEventListener('vaultix-notifications-updated', onUpdate);
    return () => window.removeEventListener('vaultix-notifications-updated', onUpdate);
  }, []);

  // Cancel any active long-press timer
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Selection toggle
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  // Touch start
  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    cancelLongPress();
    isLongPressRef.current = false;
    isScrollingRef.current = false;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setSelectionMode(true);
      setSelectedIds(prev => new Set(prev).add(id));
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms long press threshold
  };

  // Only cancel if actual scrolling gesture (>15px)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (dx > 15 || dy > 15) {
      isScrollingRef.current = true;
      cancelLongPress();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    touchStartPosRef.current = null;
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    cancelLongPress();
    isLongPressRef.current = false;
    isScrollingRef.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setSelectionMode(true);
      setSelectedIds(prev => new Set(prev).add(id));
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStartPosRef.current) return;
    const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
    if (dx > 12 || dy > 12) {
      isScrollingRef.current = true;
      cancelLongPress();
    }
  };

  const handleMouseUp = () => {
    cancelLongPress();
    touchStartPosRef.current = null;
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  };

  const handleCardClick = (id: string) => {
    // If long press triggered, do not click
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    // If scrolling, do not select
    if (isScrollingRef.current) {
      return;
    }

    if (selectionMode) {
      toggleSelect(id);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;

    const confirmed = await showConfirm({
      title: `Delete ${count} Alert${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count} selected notification${count > 1 ? 's' : ''}?`,
      confirmText: "Delete",
      type: "warning",
      isDestructive: true
    });

    if (!confirmed) return;

    deleteNotifications(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectionMode(false);
    showToast(`${count} notification${count > 1 ? 's' : ''} deleted`, "info");
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification(id);
    showToast("Notification deleted", "info");
  };

  const handleClearAll = async () => {
    const confirmed = await showConfirm({
      title: "Clear All Notifications",
      message: "Are you sure you want to clear your entire security alerts history?",
      confirmText: "Clear All",
      type: "warning",
      isDestructive: true
    });

    if (!confirmed) return;

    clearNotificationHistory();
    setSelectedIds(new Set());
    setSelectionMode(false);
    showToast("All notifications cleared", "info");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
      case 'security':
        return <ShieldAlert size={18} color="#f59e0b" />;
      case 'success':
        return <CheckCircle size={18} color="var(--accent-teal)" />;
      default:
        return <Info size={18} color="var(--accent-teal)" />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', padding: '1rem 0.85rem 5rem', overflowY: 'auto' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Top Header Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '1.5rem', 
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '0.75rem',
          minHeight: '44px'
        }}>
          {selectionMode ? (
            /* Selection Actions Bar */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                >
                  <X size={20} />
                </button>
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedIds.size} selected
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  onClick={selectAll} 
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                >
                  {selectedIds.size === notifications.length ? <CheckSquare size={14} /> : <Square size={14} />}
                  <span>{selectedIds.size === notifications.length ? 'Deselect All' : 'Select All'}</span>
                </button>

                <button 
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.size === 0}
                  style={{ 
                    background: '#ef4444', 
                    color: '#ffffff', 
                    border: 'none', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '0.35rem 0.75rem', 
                    fontSize: '0.78rem',
                    cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    opacity: selectedIds.size > 0 ? 1 : 0.5
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Navigation Bar */
            <>
              <button 
                onClick={() => navigate('/')} 
                className="btn-secondary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
              >
                <ArrowLeft size={15} /> Back to Vault
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={() => setSelectionMode(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.4rem' }}
                    >
                      Select
                    </button>
                    <button
                      onClick={handleClearAll}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', padding: '0.4rem' }}
                    >
                      Clear All
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Page Title */}
        {!selectionMode && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-teal)', marginBottom: '0.25rem' }}>
              <Bell size={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Security Activity
              </span>
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem', lineHeight: 1.25 }}>
              Notifications
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Recent security and activity alerts for your vault.
            </p>
          </div>
        )}

        {/* Notifications List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.length === 0 ? (
            <div style={{ 
              padding: '2.5rem 1.25rem', 
              textAlign: 'center', 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)', 
              color: 'var(--text-muted)' 
            }}>
              <Bell size={32} color="var(--text-muted)" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No Security Notifications
              </div>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>
                You have no recent alerts. New events will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isSelected = selectedIds.has(notif.id);

              return (
                <div
                  key={notif.id}
                  onTouchStart={(e) => handleTouchStart(notif.id, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={cancelLongPress}
                  onMouseDown={(e) => handleMouseDown(notif.id, e)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={cancelLongPress}
                  onClick={() => handleCardClick(notif.id)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.08)' : 'var(--bg-secondary)',
                    border: `1px solid ${isSelected ? 'var(--accent-teal)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.7rem 0.85rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.7rem',
                    cursor: selectionMode ? 'pointer' : 'default',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div style={{ marginTop: '0.1rem', color: isSelected ? 'var(--accent-teal)' : 'var(--text-muted)', flexShrink: 0 }}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  )}

                  {/* Icon */}
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    backgroundColor: 'rgba(255,255,255,0.04)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '0.05rem'
                  }}>
                    {getIcon(notif.type)}
                  </div>

                  {/* Text Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {notif.title}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(notif.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      {notif.body}
                    </p>
                  </div>

                  {/* Single Item Delete Button */}
                  {!selectionMode && (
                    <button
                      onClick={(e) => handleDeleteSingle(notif.id, e)}
                      title="Delete notification"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-sm)',
                        flexShrink: 0,
                        opacity: 0.6
                      }}
                      className="btn-revoke-hover"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
