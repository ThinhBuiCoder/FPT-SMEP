import { ShieldAlert } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Forbidden = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    if (!user) navigate('/login');
    else if (user.role === 'ADMIN') navigate('/admin');
    else if (user.role === 'LECTURER') navigate('/lecturer');
    else navigate('/student');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">403</h1>
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 leading-relaxed">
          You do not have permission to view this page. If you believe this is an error, please contact your administrator.
        </p>
        <div className="pt-4">
          <Button variant="primary" size="lg" className="w-full" onClick={handleBack}>
            Go back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Forbidden;
