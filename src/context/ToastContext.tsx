import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          pointerEvents: 'none',
          maxWidth: '90vw',
        }}
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';

          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                backgroundColor: 'rgba(28, 28, 28, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: 'var(--text-primary)',
                border: `1px solid ${
                  isError ? 'var(--error-color)' : isSuccess ? 'var(--accent-teal)' : 'var(--border-color)'
                }`,
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
                fontSize: '0.88rem',
                fontWeight: 500,
                minWidth: '200px',
                animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isSuccess && <CheckCircle2 size={16} color="var(--accent-teal)" style={{ flexShrink: 0 }} />}
              {isError && <AlertCircle size={16} color="var(--error-color)" style={{ flexShrink: 0 }} />}
              {!isSuccess && !isError && <Info size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
              
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{toast.message}</span>

              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  color: 'var(--text-muted)',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '0.25rem',
                  opacity: 0.7,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
