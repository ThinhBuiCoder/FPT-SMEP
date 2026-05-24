import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, Sparkles, ShieldCheck, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { PROGRAM_GROUPS } from '../../constants/majors';

const OTP_EXPIRE_SECONDS = 5 * 60; // 5 minutes
const RESEND_COOLDOWN    = 60;      // 60-second cooldown before allowing resend

const Register = () => {
  // ── State: Step 1 ─────────────────────────────────────────
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('STUDENT');
  const [programGroup, setProgramGroup] = useState('');
  const [major,        setMajor]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [emailTakenError, setEmailTakenError] = useState(false); // email already registered

  // Reset major when programGroup changes
  useEffect(() => {
    setMajor('');
  }, [programGroup]);

  // ── State: Step 2 (OTP) ───────────────────────────────────
  const [step,           setStep]           = useState(1); // 1 = form, 2 = OTP
  const [otpValues,      setOtpValues]      = useState(['', '', '', '', '', '']);
  const [otpLoading,     setOtpLoading]     = useState(false);
  const [countdown,      setCountdown]      = useState(OTP_EXPIRE_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading,  setResendLoading]  = useState(false);
  const otpRefs = useRef([]);

  const { register, verifyOtp, resendOtp } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Receive state from Login (resend OTP flow) ──────────────────
  useEffect(() => {
    if (location.state?.step === 'otp' && location.state?.email) {
      setEmail(location.state.email);
      setStep(2);
      startCountdown();
    }
  }, []);

  // ── OTP expiry countdown ─────────────────────────────────────────
  const startCountdown = () => setCountdown(OTP_EXPIRE_SECONDS);

  useEffect(() => {
    if (step !== 2) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  // ── Resend cooldown countdown ───────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Step 1: Register ──────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim())                               return toast.error('Please enter your full name.');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return toast.error('Please enter a valid email.');
    if (password.length < 6)                        return toast.error('Password must be at least 6 characters.');

    setLoading(true);
    setEmailTakenError(false);
    try {
      await register({ name, email, password, role, programGroup, major });
      toast.success('Account created! Check your email for the OTP code.');
      setStep(2);
      startCountdown();
      setResendCooldown(RESEND_COOLDOWN);
      // Focus the first OTP input box
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      // axiosClient interceptor already unwraps response.data, so:
      //   err.message  = backend error message
      //   err.data     = extra payload from errorResponse()
      const msg = err.message || err.response?.data?.message || 'Registration failed.';

      // Email already registered and verified
      if (err.data?.emailTaken) {
        setEmailTakenError(true);
        return; // banner handles the UI, no toast needed
      }
      // Email registered but not yet verified — backend sent a new OTP
      if (err.data?.needVerify) {
        toast(msg, { icon: '📧' });
        setStep(2);
        startCountdown();
        setResendCooldown(RESEND_COOLDOWN);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else if (err.response?.status === 409) {
        // Email đã tồn tại: hướng người dùng tới trang đăng nhập (prefill email)
        toast.error(msg);
        navigate('/login', { state: { email } });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return; // digits only
    const newOtp = [...otpValues];
    newOtp[index] = value;
    setOtpValues(newOtp);
    // Auto-focus next input
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otpValues];
    pasted.split('').forEach((ch, i) => { newOtp[i] = ch; });
    setOtpValues(newOtp);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpValues.join('');
    if (otp.length !== 6) return toast.error('Please enter all 6 OTP digits.');
    if (countdown <= 0)   return toast.error('OTP has expired. Please request a new one.');

    setOtpLoading(true);
    try {
      const user = await verifyOtp(email, otp);
      toast.success(`Verification successful! Welcome, ${user.name} 🎉`);
      if (user.role === 'ADMIN')         navigate('/admin');
      else if (user.role === 'LECTURER') navigate('/lecturer');
      else if (user.role === 'MENTOR')   navigate('/lecturer'); // Mentor shares lecturer dashboard
      else                               navigate('/student');
    } catch (err) {
      toast.error(err.message || 'Incorrect or expired OTP code.');
      // Clear OTP on failure
      setOtpValues(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    try {
      await resendOtp(email);
      toast.success('A new OTP has been sent to your email!');
      setOtpValues(['', '', '', '', '', '']);
      startCountdown();
      setResendCooldown(RESEND_COOLDOWN);
      otpRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-primary-100/40 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-secondary-100/30 rounded-full blur-[100px]" />

      <div className="w-full max-w-[440px] relative z-10">
        <AnimatePresence mode="wait">

          {/* ── STEP 1: Registration form ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-float p-8 sm:p-10">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-heading font-bold text-slate-900">Create your account</h1>
                  <p className="text-body text-slate-500 mt-1">Join FPT-SMEP mentoring portal</p>
                </div>

                {/* Banner: email already taken */}
                <AnimatePresence>
                  {emailTakenError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start"
                    >
                      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-800 mb-1">Email already registered</p>
                        <p className="text-xs text-red-700 mb-3">
                          <strong>{email}</strong> is already associated with an account.
                        </p>
                        <div className="flex gap-3">
                          <Link
                            to="/login"
                            state={{ prefillEmail: email }}
                            className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                          >
                            Sign in →
                          </Link>
                          <Link
                            to="/forgot-password"
                            className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700"
                          >
                            Forgot password?
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form className="space-y-4" onSubmit={handleRegister}>
                  {/* Name */}
                  <div>
                    <label className="block text-caption font-medium text-slate-600 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={name} onChange={e => setName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="John Doe" type="text" required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-caption font-medium text-slate-600 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="name@fpt.edu.vn" type="email" required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-caption font-medium text-slate-600 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Minimum 6 characters" type="password" required
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-caption font-medium text-slate-600 mb-1.5">Role</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      {[
                        { value: 'STUDENT',  label: 'Student' },
                        { value: 'LECTURER', label: 'Lecturer' },
                        { value: 'MENTOR',   label: 'Mentor' },
                      ].map(({ value, label }) => (
                        <label key={value} className="cursor-pointer">
                          <input
                            checked={role === value} onChange={() => setRole(value)}
                            className="peer sr-only" name="role" type="radio" value={value}
                          />
                          <div className="text-center py-2.5 rounded-lg text-body text-slate-500 peer-checked:bg-white peer-checked:text-primary peer-checked:shadow-sm peer-checked:border peer-checked:border-primary-100 transition-all font-medium">
                            {label}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {role === 'STUDENT' && (
                    <>
                      <div>
                        <label className="block text-caption font-medium text-slate-600 mb-1.5">Program Group</label>
                        <select
                          value={programGroup} onChange={e => setProgramGroup(e.target.value)} required
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        >
                          <option value="">-- Select Program Group --</option>
                          {PROGRAM_GROUPS.map(g => (
                            <option key={g.code} value={g.code}>{g.code} - {g.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-caption font-medium text-slate-600 mb-1.5">Major</label>
                        <select
                          value={major} onChange={e => setMajor(e.target.value)} required disabled={!programGroup}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">-- Select Major --</option>
                          {programGroup && PROGRAM_GROUPS.find(g => g.code === programGroup)?.majors.map(m => (
                            <option key={m.code} value={m.code}>{m.code} - {m.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <Button type="submit" variant="gradient" size="lg" className="w-full mt-2" iconRight={ArrowRight} isLoading={loading}>
                    Create Account
                  </Button>
                </form>

                <div className="mt-6 text-center text-body text-slate-500 pt-5 border-t border-slate-100">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary font-semibold hover:text-primary-dark transition-colors">Sign in</Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Enter OTP ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-float p-8 sm:p-10">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-heading font-bold text-slate-900">Verify your email</h1>
                  <p className="text-body text-slate-500 mt-1">
                    OTP code sent to
                  </p>
                  <p className="text-sm font-semibold text-primary mt-0.5 truncate">{email}</p>
                </div>

                {/* Countdown */}
                <div className={`flex items-center justify-center gap-2 mb-6 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                  countdown > 60 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  countdown > 0  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                   'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <Clock className="w-4 h-4" />
                  {countdown > 0
                    ? `Code expires in: ${formatTime(countdown)}`
                    : 'OTP has expired — please request a new one'}
                </div>

                {/* OTP Input */}
                <form onSubmit={handleVerifyOtp}>
                  <div className="flex gap-2.5 justify-center mb-6" onPaste={handleOtpPaste}>
                    {otpValues.map((val, idx) => (
                      <input
                        key={idx}
                        ref={el => otpRefs.current[idx] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        onChange={e => handleOtpChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none
                          ${val
                            ? 'border-primary bg-primary-50 text-primary'
                            : 'border-slate-200 bg-white text-slate-900'}
                          focus:border-primary focus:ring-2 focus:ring-primary/20`}
                      />
                    ))}
                  </div>

                  <Button
                    type="submit"
                    variant="gradient"
                    size="lg"
                    className="w-full"
                    isLoading={otpLoading}
                    disabled={countdown <= 0}
                  >
                    Verify OTP
                  </Button>
                </form>

                {/* Resend */}
                <div className="mt-5 text-center">
                  <p className="text-sm text-slate-500 mb-2">Didn&apos;t receive the email?</p>
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resendLoading}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : resendLoading ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>

                {/* Back */}
                <button
                  onClick={() => { setStep(1); setOtpValues(['','','','','','']); }}
                  className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Back to edit your details
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default Register;
