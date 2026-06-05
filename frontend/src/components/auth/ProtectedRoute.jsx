import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { ALL_TEAM_MAJOR_CODES } from '../../constants/majors';

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

  // Force students without a valid major to go to settings before using the app.
  // Valid = exists AND is in the TEAM_MAJOR_GROUPS list.
  const hasValidMajor = user.major && ALL_TEAM_MAJOR_CODES.includes(user.major.toUpperCase());
  if (
    normalizedUserRole === 'STUDENT' &&
    !hasValidMajor &&
    location.pathname !== '/settings'
  ) {
    return <Navigate to="/settings" state={{ message: 'Vui lòng chọn Chuyên ngành trước khi sử dụng hệ thống.' }} replace />;
  }

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
