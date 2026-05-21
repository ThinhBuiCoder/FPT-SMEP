import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, Sparkles, ShieldCheck, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

const OTP_EXPIRE_SECONDS = 5 * 60; // 5 phút
const RESEND_COOLDOWN    = 60;      // 60 giây cooldown trước khi resend

const Register = () => {
  // ── State: Step 1 ─────────────────────────────────────────
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('STUDENT');
  const [loading,  setLoading]  = useState(false);

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

  // ── Nhận state từ Login (resend OTP) ─────────────────────
  useEffect(() => {
    if (location.state?.step === 'otp' && location.state?.email) {
      setEmail(location.state.email);
      setStep(2);
      startCountdown();
    }
  }, []);

  // ── Countdown OTP hết hạn ─────────────────────────────────
  const startCountdown = () => setCountdown(OTP_EXPIRE_SECONDS);

  useEffect(() => {
    if (step !== 2) return;
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  // ── Countdown resend cooldown ─────────────────────────────
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

  // ── Step 1: Đăng ký ──────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim())                              return toast.error('Vui lòng nhập họ tên');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return toast.error('Email không hợp lệ');
    if (password.length < 6)                       return toast.error('Mật khẩu phải ít nhất 6 ký tự');

    setLoading(true);
    try {
      await register({ name, email, password, role });
      toast.success('Đăng ký thành công! Kiểm tra email để lấy mã OTP.');
      setStep(2);
      startCountdown();
      setResendCooldown(RESEND_COOLDOWN);
      // Focus ô OTP đầu tiên
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (err) {
      const msg = err.response?.data?.message || 'Đăng ký thất bại';
      // Nếu email chưa verify, backend vẫn gửi OTP mới
      if (err.response?.data?.data?.needVerify) {
        toast(msg, { icon: '📧' });
        setStep(2);
        startCountdown();
        setResendCooldown(RESEND_COOLDOWN);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return; // chỉ nhập số
    const newOtp = [...otpValues];
    newOtp[index] = value;
    setOtpValues(newOtp);
    // Tự động focus ô tiếp theo
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

  // ── Step 2: Xác thực OTP ─────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpValues.join('');
    if (otp.length !== 6) return toast.error('Vui lòng nhập đủ 6 chữ số OTP');
    if (countdown <= 0)   return toast.error('OTP đã hết hạn. Vui lòng yêu cầu gửi lại.');

    setOtpLoading(true);
    try {
      const user = await verifyOtp(email, otp);
      toast.success(`Xác thực thành công! Chào mừng ${user.name} 🎉`);
      if (user.role === 'ADMIN')         navigate('/admin');
      else if (user.role === 'LECTURER') navigate('/lecturer');
      else                               navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn');
      // Xoá OTP khi sai
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
      toast.success('OTP mới đã được gửi đến email của bạn!');
      setOtpValues(['', '', '', '', '', '']);
      startCountdown();
      setResendCooldown(RESEND_COOLDOWN);
      otpRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể gửi lại OTP');
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

          {/* ── STEP 1: Form đăng ký ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-float p-8 sm:p-10">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-heading font-bold text-slate-900">Create your account</h1>
                  <p className="text-body text-slate-500 mt-1">Join FPT-SMEP mentoring portal</p>
                </div>

                <form className="space-y-4" onSubmit={handleRegister}>
                  {/* Name */}
                  <div>
                    <label className="block text-caption font-medium text-slate-600 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={name} onChange={e => setName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Nguyễn Văn A" type="text" required
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
                        placeholder="Tối thiểu 6 ký tự" type="password" required
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-caption font-medium text-slate-600 mb-1.5">Role</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      {['STUDENT', 'LECTURER'].map(r => (
                        <label key={r} className="cursor-pointer">
                          <input
                            checked={role === r} onChange={() => setRole(r)}
                            className="peer sr-only" name="role" type="radio" value={r}
                          />
                          <div className="text-center py-2.5 rounded-lg text-body text-slate-500 peer-checked:bg-white peer-checked:text-primary peer-checked:shadow-sm peer-checked:border peer-checked:border-primary-100 transition-all font-medium">
                            {r === 'STUDENT' ? 'Student' : 'Lecturer'}
                          </div>
                        </label>
                      ))}
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
            </motion.div>
          )}

          {/* ── STEP 2: Nhập OTP ── */}
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
                  <h1 className="text-heading font-bold text-slate-900">Xác thực Email</h1>
                  <p className="text-body text-slate-500 mt-1">
                    Mã OTP đã gửi tới
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
                    ? `OTP hết hạn sau: ${formatTime(countdown)}`
                    : 'OTP đã hết hạn — vui lòng gửi lại'}
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
                    Xác nhận OTP
                  </Button>
                </form>

                {/* Resend */}
                <div className="mt-5 text-center">
                  <p className="text-sm text-slate-500 mb-2">Không nhận được email?</p>
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resendLoading}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0
                      ? `Gửi lại sau ${resendCooldown}s`
                      : resendLoading ? 'Đang gửi...' : 'Gửi lại OTP'}
                  </button>
                </div>

                {/* Back */}
                <button
                  onClick={() => { setStep(1); setOtpValues(['','','','','','']); }}
                  className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Quay lại chỉnh sửa thông tin
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
