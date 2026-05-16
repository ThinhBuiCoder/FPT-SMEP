import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import Button from '../../components/ui/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      return toast.error('Vui lòng nhập đầy đủ thông tin');
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Chào mừng trở lại, ${user.name}!`);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'LECTURER') navigate('/lecturer');
      else navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (e, roleEmail) => {
    e.preventDefault();
    setEmail(roleEmail);
    setPassword('123456');
  };

  const demoAccounts = [
    { label: 'Admin', email: 'admin@fpt.edu.vn'},
    { label: 'Lecturer', email: 'lecturer@fpt.edu.vn'},
    { label: 'Student', email: 'student1@fpt.edu.vn'},
  ];

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-primary-100/40 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-cyan-100/40 rounded-full blur-[100px]" />
      <div className="absolute top-[30%] right-[15%] w-[250px] h-[250px] bg-secondary-100/30 rounded-full blur-[80px]" />

      <div className="w-full max-w-[440px] relative z-10">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-float p-8 sm:p-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-heading font-bold text-slate-900">Welcome back</h1>
            <p className="text-body text-slate-500 mt-1">Sign in to FPT-SMEP Mentoring Portal</p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-caption font-medium text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="name@fpt.edu.vn"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-caption font-medium text-slate-600">Password</label>
                <Link to="/forgot-password" className="text-caption text-primary hover:text-primary-dark transition-colors font-medium">Forgot?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              isLoading={loading}
              iconRight={ArrowRight}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-body text-slate-500 pt-5 border-t border-slate-100">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:text-primary-dark transition-colors">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
