import { SearchX } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NotFound = () => {
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
        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
          <SearchX className="w-12 h-12 text-slate-500" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">404</h1>
        <h2 className="text-2xl font-bold text-slate-800">Page not found</h2>
        <p className="text-slate-500 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <Button variant="primary" size="lg" className="w-full" onClick={handleBack}>
            Return to Safety
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
