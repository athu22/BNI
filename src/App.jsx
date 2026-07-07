import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import SeedAdmin from './pages/SeedAdmin';
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Members from './pages/admin/Members';
import Tables from './pages/admin/Tables';
import Rounds from './pages/admin/Rounds';
import UserManagement from './pages/admin/UserManagement';
import Referrals from './pages/admin/Referrals';
import CaptainDashboard from './pages/captain/CaptainDashboard';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/seed" element={<SeedAdmin />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="tables" element={<Tables />} />
              <Route path="rounds" element={<Rounds />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="referrals" element={<Referrals />} />
            </Route>

            {/* Captain Routes */}
            <Route
              path="/captain/*"
              element={
                <ProtectedRoute allowedRoles={['Captain']}>
                  <CaptainDashboard />
                </ProtectedRoute>
              }
            />

            {/* Default redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
