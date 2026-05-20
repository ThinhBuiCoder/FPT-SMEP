import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-body text-slate-500 animate-pulse">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = user.role?.toUpperCase();
  const normalizedUserRole = userRole === 'USER' ? 'STUDENT' : userRole;
  const mappedAllowedRoles = allowedRoles ? allowedRoles.map(r => r.toUpperCase()) : null;
  const hasAccess = !mappedAllowedRoles || 
    mappedAllowedRoles.includes(userRole) || 
    (normalizedUserRole === 'STUDENT' && mappedAllowedRoles.includes('STUDENT'));

  if (!hasAccess) {
    return <Navigate to="/403" replace />;
  }

  return children;
};

export default ProtectedRoute;
