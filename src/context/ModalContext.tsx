import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Info, X, ShieldAlert } from 'lucide-react';

export type ModalType = 'info' | 'success' | 'warning' | 'error';

export interface AlertOptions {
  title?: string;
  message: string | React.ReactNode;
  type?: ModalType;
  confirmText?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string | React.ReactNode;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface ModalContextType {
  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    isConfirm: boolean;
    title: string;
    message: string | React.ReactNode;
    type: ModalType;
    confirmText: string;
    cancelText: string;
    isDestructive: boolean;
    resolve: (value: any) => void;
  } | null>(null);

  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        isConfirm: false,
        title: options.title || 'Notice',
        message: options.message,
        type: options.type || 'info',
        confirmText: options.confirmText || 'Got it',
        cancelText: 'Cancel',
        isDestructive: false,
        resolve: () => resolve(),
      });
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        isConfirm: true,
        title: options.title || 'Are you sure?',
        message: options.message,
        type: options.type || (options.isDestructive ? 'error' : 'warning'),
        confirmText: options.confirmText || (options.isDestructive ? 'Delete' : 'Confirm'),
        cancelText: options.cancelText || 'Cancel',
        isDestructive: !!options.isDestructive,
        resolve: (val: boolean) => resolve(val),
      });
    });
  }, []);

  const handleConfirm = () => {
    if (modalState) {
      modalState.resolve(true);
      setModalState(null);
    }
  };

  const handleCancel = () => {
    if (modalState) {
      modalState.resolve(false);
      setModalState(null);
    }
  };

  const renderIcon = (type: ModalType, isDestructive: boolean) => {
    if (isDestructive || type === 'error') {
      return <AlertTriangle size={28} color="var(--error-color)" />;
    }
    if (type === 'success') {
      return <CheckCircle size={28} color="var(--success-color)" />;
    }
    if (type === 'warning') {
      return <ShieldAlert size={28} color="#f59e0b" />;
    }
    return <Info size={28} color="var(--accent-teal)" />;
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {modalState && modalState.isOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            animation: 'fadeIn 0.15s ease-out'
          }}
          onClick={handleCancel}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '440px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div 
                style={{ 
                  flexShrink: 0, 
                  backgroundColor: 'var(--bg-tertiary)', 
                  padding: '0.6rem', 
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {renderIcon(modalState.type, modalState.isDestructive)}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  {modalState.title}
                </h3>
                <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                  {modalState.message}
                </div>
              </div>
              <button
                onClick={handleCancel}
                style={{
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              {modalState.isConfirm && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-secondary"
                  style={{ minWidth: '85px', padding: '0.6rem 1.1rem' }}
                >
                  {modalState.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className="btn-primary"
                style={{
                  minWidth: '95px',
                  padding: '0.6rem 1.25rem',
                  backgroundColor: modalState.isDestructive ? 'var(--error-color)' : undefined
                }}
                autoFocus
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
