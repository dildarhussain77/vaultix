import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider, useVault } from './context/VaultContext';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider } from './context/ToastContext';
import Auth from './pages/Auth';
import Setup from './pages/Setup';
import Unlock from './pages/Unlock';
import Recover from './pages/Recover';
import Vault from './pages/Vault';
import Settings from './pages/Settings';
import Devices from './pages/Devices';
import Notifications from './pages/Notifications';
import SecurityGuide from './pages/SecurityGuide';
import ResetPassword from './pages/ResetPassword';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isDeviceVerified } = useAuth();
  
  if (!session || !isDeviceVerified) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function VaultRoute({ children }: { children: React.ReactNode }) {
  const { dataKey } = useVault();
  
  if (!dataKey) {
    return <Navigate to="/unlock" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { session, isDeviceVerified } = useAuth();
  const { dataKey } = useVault();

  return (
    <Routes>
      <Route path="/auth" element={(!session || !isDeviceVerified) ? <Auth /> : <Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route path="/setup" element={
        <ProtectedRoute>
          <Setup />
        </ProtectedRoute>
      } />
      
      <Route path="/unlock" element={
        <ProtectedRoute>
          {!dataKey ? <Unlock /> : <Navigate to="/" replace />}
        </ProtectedRoute>
      } />

      <Route path="/recover" element={
        <ProtectedRoute>
          {!dataKey ? <Recover /> : <Navigate to="/" replace />}
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <VaultRoute>
            <Settings />
          </VaultRoute>
        </ProtectedRoute>
      } />

      <Route path="/devices" element={
        <ProtectedRoute>
          <VaultRoute>
            <Devices />
          </VaultRoute>
        </ProtectedRoute>
      } />

      <Route path="/notifications" element={
        <ProtectedRoute>
          <VaultRoute>
            <Notifications />
          </VaultRoute>
        </ProtectedRoute>
      } />

      <Route path="/security-guide" element={
        <ProtectedRoute>
          <VaultRoute>
            <SecurityGuide />
          </VaultRoute>
        </ProtectedRoute>
      } />

      <Route path="/*" element={
        <ProtectedRoute>
          <VaultRoute>
            <Vault />
          </VaultRoute>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <HashRouter>
      <ModalProvider>
        <ToastProvider>
          <AuthProvider>
            <VaultProvider>
              <AppRoutes />
            </VaultProvider>
          </AuthProvider>
        </ToastProvider>
      </ModalProvider>
    </HashRouter>
  );
}

export default App;

