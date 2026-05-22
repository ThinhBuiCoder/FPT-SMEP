import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import axiosClient from '../../api/axiosClient'; // Assuming auth is handled directly or via context

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim()) { return toast.error('Full name is required'); }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { return toast.error('Valid email is required'); }
    if (password.length < 6) { return toast.error('Password must be at least 6 characters'); }
    
    setLoading(true);
    try {
      // Direct API call since register isn't in AuthContext
      await axiosClient.post('/auth/register', { name, email, password, role });
      toast.success('Account created successfully! Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.message || err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-primary-100/40 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-secondary-100/30 rounded-full blur-[100px]" />

      <div className="w-full max-w-[440px] relative z-10">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-float p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-heading font-bold text-slate-900">Create your account</h1>
            <p className="text-body text-slate-500 mt-1">Join FPT-SMEP mentoring portal</p>
          </div>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="block text-caption font-medium text-slate-600 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="John Doe" type="text" required />
              </div>
            </div>

            <div>
              <label className="block text-caption font-medium text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="name@fpt.edu.vn" type="email" required />
              </div>
            </div>

            <div>
              <label className="block text-caption font-medium text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Min 6 characters" type="password" required />
              </div>
            </div>

            <div>
              <label className="block text-caption font-medium text-slate-600 mb-1.5">Role</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <label className="cursor-pointer">
                  <input checked={role === 'STUDENT'} onChange={() => setRole('STUDENT')} className="peer sr-only" name="role" type="radio" value="STUDENT" />
                  <div className="text-center py-2.5 rounded-lg text-body text-slate-500 peer-checked:bg-white peer-checked:text-primary peer-checked:shadow-sm peer-checked:border peer-checked:border-primary-100 transition-all font-medium">
                    Student
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input checked={role === 'LECTURER'} onChange={() => setRole('LECTURER')} className="peer sr-only" name="role" type="radio" value="LECTURER" />
                  <div className="text-center py-2.5 rounded-lg text-body text-slate-500 peer-checked:bg-white peer-checked:text-primary peer-checked:shadow-sm peer-checked:border peer-checked:border-primary-100 transition-all font-medium">
                    Lecturer
                  </div>
                </label>
              </div>
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full mt-2" iconRight={ArrowRight} isLoading={loading}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-body text-slate-500 pt-5 border-t border-slate-100">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:text-primary-dark transition-colors">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
