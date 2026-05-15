// src/routes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to respective dashboard if authenticated but unauthorized role
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'LECTURER') return <Navigate to="/lecturer" replace />;
    return <Navigate to="/student" replace />;
  }

  // Authorized, render child routes (Outlet is provided by React Router for nested routes)
  return <Outlet />;
};

export default ProtectedRoute;
