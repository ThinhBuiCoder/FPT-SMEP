import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { Mail, Lock, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useGoogleLogin } from '@react-oauth/google';

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [rejectedStatus, setRejectedStatus]   = useState(false);
  const [resendLoading, setResendLoading]     = useState(false);

  const { login, loginWithGoogle, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill email when redirected from Register
  useEffect(() => {
    if (location.state?.prefillEmail || location.state?.email) {
      setEmail(location.state.prefillEmail || location.state.email);
    }
    if (location.state?.isPending) {
      setPendingApproval(true);
    }
  }, [location.state]);


  // ── Redirect after login ───────────────────────────────────
  const redirectByRole = (user) => {
    if (user.role === 'ADMIN')                          navigate('/admin');
    else if (user.role === 'LECTURER')                  navigate('/lecturer');
    else if (user.role === 'MENTOR')                    navigate('/mentor');
    else                                                navigate('/student');
  };

  // ── Email / password login ────────────────────────────────────
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields.');

    setLoading(true);
    setUnverifiedEmail(null);
    setPendingApproval(false);
    setRejectedStatus(false);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      redirectByRole(user);
    } catch (err) {
      if (err.data?.needVerify) {
        setUnverifiedEmail(err.data?.email || email);
      } else if (err.data?.isPending) {
        setPendingApproval(true);
      } else if (err.response?.status === 403 && err.message?.toLowerCase().includes('rejected')) {
        setRejectedStatus(true);
      } else {
        toast.error(err.message || err.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    try {
      await resendOtp(unverifiedEmail);
      toast.success('A new OTP has been sent! Please check your inbox.');
      // Navigate to register page with email pre-filled and OTP step active
      navigate('/register', { state: { email: unverifiedEmail, step: 'otp' } });
    } catch {
      toast.error('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // ── Google login ───────────────────────────────────────────────
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        // useGoogleLogin returns an access_token; fetch user info from Google userinfo endpoint
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const googleUser = await userInfoRes.json();

        // Send access_token to backend — it will call Google userinfo to build a JWT
        const user = await loginWithGoogle(tokenResponse.access_token);
        toast.success(`Welcome, ${user.name}! 🎉`);
        redirectByRole(user);
      } catch (err) {
        if (err.data?.isPending) {
          setPendingApproval(true);
        } else if (err.response?.status === 403 && err.message?.toLowerCase().includes('rejected')) {
          setRejectedStatus(true);
        } else {
          toast.error(err.response?.data?.message || 'Google sign-in failed.');
        }
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error('Google sign-in was cancelled or failed.');
      setGoogleLoading(false);
    },
    flow: 'implicit',
  });

  const demoAccounts = [
    { label: 'Admin',    email: 'admin@fpt.edu.vn' },
    { label: 'Lecturer', email: 'lecturer@fpt.edu.vn' },
    { label: 'Student',  email: 'student1@fpt.edu.vn' },
  ];

  const fillDemo = (e, roleEmail) => {
    e.preventDefault();
    setEmail(roleEmail);
    setPassword('123456');
  };

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

          {/* Banner: account not verified */}
          {unverifiedEmail && !pendingApproval && !rejectedStatus && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 mb-1">Account not activated</p>
                <p className="text-xs text-amber-700 mb-3">
                  <strong>{unverifiedEmail}</strong> has not been verified yet. Please check your inbox and enter the OTP code.
                </p>
                <button
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Resend OTP →'}
                </button>
              </div>
            </div>
          )}

          {/* Banner: account pending approval */}
          {pendingApproval && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800 mb-1">Pending Approval</p>
                <p className="text-xs text-blue-700">
                  Your email is verified! However, since you registered as a Mentor or Lecturer, an Administrator must review and approve your account before you can log in.
                </p>
              </div>
            </div>
          )}

          {/* Banner: account rejected */}
          {rejectedStatus && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 mb-1">Account Rejected</p>
                <p className="text-xs text-red-700">
                  Your registration request has been declined by the Administrator. Please contact support if you believe this is a mistake.
                </p>
              </div>
            </div>
          )}

          {/* Google Login Button */}
          <button
            type="button"
            onClick={() => { setGoogleLoading(true); googleLogin(); }}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-semibold text-slate-700 shadow-xs disabled:opacity-60 disabled:cursor-not-allowed mb-5"
          >
            {googleLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-caption font-medium text-slate-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
          <div className="mt-5 text-center text-body text-slate-500 pt-4 border-t border-slate-100">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary font-semibold hover:text-primary-dark transition-colors">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
