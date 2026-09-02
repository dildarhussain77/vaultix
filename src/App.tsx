import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider, useVault } from './context/VaultContext';
import Auth from './pages/Auth';
import Setup from './pages/Setup';
import Unlock from './pages/Unlock';
import Recover from './pages/Recover';
import Vault from './pages/Vault';
import ResetPassword from './pages/ResetPassword';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  
  if (!session) {
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
  const { session } = useAuth();
  const { dataKey } = useVault();

  return (
    <Routes>
      <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" replace />} />
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
      <AuthProvider>
        <VaultProvider>
          <AppRoutes />
        </VaultProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;

