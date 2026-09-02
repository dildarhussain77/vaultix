import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

interface VaultContextType {
  dataKey: CryptoKey | null;
  unlockVault: (key: CryptoKey) => void;
  lockVault: () => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const lockVault = () => {
    setDataKey(null);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    if (dataKey) {
      timeoutRef.current = window.setTimeout(() => {
        lockVault();
      }, AUTO_LOCK_MS);
    }
  };

  const unlockVault = (key: CryptoKey) => {
    setDataKey(key);
    // Timer is started by the useEffect since dataKey changes
  };

  useEffect(() => {
    // Only set up activity listeners if the vault is unlocked
    if (!dataKey) return;

    let timeout: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeout);
      // Lock after 5 minutes of inactivity
      timeout = setTimeout(lockVault, AUTO_LOCK_MS);
    };

    // Listen for user activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('click', resetTimer);

    // Start timer initially
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [dataKey]);

  return (
    <VaultContext.Provider value={{ dataKey, unlockVault, lockVault }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
