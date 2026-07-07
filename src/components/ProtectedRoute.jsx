import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // User is logged in but doesn't have the right role, redirect to their respective dashboard
    if (currentUser.role === 'Admin') return <Navigate to="/admin" replace />;
    if (currentUser.role === 'Captain') return <Navigate to="/captain" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
