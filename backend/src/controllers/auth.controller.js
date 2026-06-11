// src/controllers/auth.controller.js
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const https  = require('https');
const { validationResult } = require('express-validator');
const User   = require('../models/User');
const Student = require('../models/Student');
const AuthEvent = require('../models/AuthEvent');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { sendOtpEmail, sendResetPasswordEmail } = require('../services/emailService');
const { getProgramGroupFromMajor, ALL_TEAM_MAJORS } = require('../constants/majors');

// ── Helper: lấy IP từ request ──────────────────────────────
const getIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;


// ── Helpers ────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

/** Sinh OTP 6 chữ số ngẫu nhiên */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ── POST /api/auth/register ────────────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());

  const { name, email, password, role, studentId, phone, bio, programGroup, major } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      // Account exists but not yet verified — resend a fresh OTP
      if (!exists.isVerified) {
        const otp = generateOtp();
        exists.otp        = otp;
        exists.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await exists.save({ validateBeforeSave: false });
        await sendOtpEmail(email, otp, exists.name);
        return successResponse(res,
          { email, needVerify: true },
          'This email is already registered but not yet verified. A new OTP has been sent — please check your inbox.',
          200
        );
      }
      // Account exists and is fully verified
      return errorResponse(
        res,
        'This email address is already in use. Please sign in or use a different email.',
        409,
        { emailTaken: true, email }
      );
    }

    // Only STUDENT, LECTURER, MENTOR can self-register. ADMIN must be set directly in DB.
    const allowedRoles = ['STUDENT', 'LECTURER', 'MENTOR'];
    const userRole = allowedRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'STUDENT';

    let validProgramGroup = null;
    let validMajor = null;
    if (userRole === 'STUDENT') {
      if (!major) {
        return errorResponse(res, 'Major is required for students.', 400);
      }
      if (!ALL_TEAM_MAJORS.includes(major.toUpperCase())) {
        return errorResponse(res, 'Invalid major selected.', 400);
      }
      validMajor = major.toUpperCase();
      validProgramGroup = getProgramGroupFromMajor(validMajor) || 'BBA';
    }

    // Tạo OTP
    const otp        = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    const status = (userRole === 'LECTURER' || userRole === 'MENTOR') ? 'PENDING' : 'APPROVED';

    const user = await User.create({
      name, email, password,
      role: userRole,
      status,
      studentId: userRole === 'STUDENT' ? studentId : null,
      programGroup: validProgramGroup,
      major: validMajor,
      phone, bio,
      isVerified: false,
      otp,
      otpExpires,
    });

    if (userRole === 'STUDENT') {
      await Student.updateMany({ email }, { $set: { userId: user._id } });
    }

    // Gửi email OTP (không block response nếu gửi thất bại)
    await sendOtpEmail(email, otp, name);

    // ── Tracking: ghi event REGISTER (không làm fail luồng chính) ──
    try {
      await AuthEvent.create({
        userId:    user._id,
        email:     user.email,
        role:      user.role,
        eventType: 'REGISTER',
        success:   true,
        ip:        getIp(req),
        userAgent: req.headers['user-agent'] || null,
      });
    } catch (trackErr) {
      console.warn('[Tracking] Không ghi được REGISTER event:', trackErr.message);
    }

    return successResponse(
      res,
      { email, needVerify: true },
      'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP xác thực.',
      201
    );
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse(res, 'Lỗi server khi đăng ký.', 500);
  }
};

// ── POST /api/auth/verify-otp ─────────────────────────────────
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return errorResponse(res, 'Email và mã OTP là bắt buộc.', 400);

  try {
    const user = await User.findOne({ email });
    if (!user) return errorResponse(res, 'Tài khoản không tồn tại.', 404);
    if (user.isVerified) return errorResponse(res, 'Tài khoản đã được xác thực trước đó.', 400);

    if (!user.otp || !user.otpExpires) {
      return errorResponse(res, 'Không có OTP nào đang chờ xác thực. Vui lòng đăng ký lại.', 400);
    }

    if (new Date() > user.otpExpires) {
      return errorResponse(res, 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại.', 400);
    }

    if (user.otp !== String(otp).trim()) {
      return errorResponse(res, 'Mã OTP không đúng.', 400);
    }

    // Kích hoạt tài khoản
    user.isVerified = true;
    user.otp        = null;
    user.otpExpires = null;
    await user.save({ validateBeforeSave: false });

    if (user.status === 'PENDING') {
      return successResponse(
        res, 
        { user, isPending: true }, 
        'Xác thực email thành công! Tài khoản của bạn đang chờ Admin phê duyệt.'
      );
    }

    if (user.status === 'REJECTED') {
      return errorResponse(res, 'Tài khoản của bạn đã bị từ chối.', 403);
    }

    const token = generateToken(user._id);
    return successResponse(res, { user, token }, 'Xác thực thành công! Chào mừng bạn đến với FPT-SMEP 🎉');
  } catch (err) {
    console.error('VerifyOtp error:', err);
    return errorResponse(res, 'Lỗi server khi xác thực OTP.', 500);
  }
};

// ── POST /api/auth/resend-otp ─────────────────────────────────
const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return errorResponse(res, 'Email là bắt buộc.', 400);

  try {
    const user = await User.findOne({ email });
    if (!user) return errorResponse(res, 'Tài khoản không tồn tại.', 404);
    if (user.isVerified) return errorResponse(res, 'Tài khoản đã được xác thực rồi.', 400);

    const otp        = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    user.otp        = otp;
    user.otpExpires = otpExpires;
    await user.save({ validateBeforeSave: false });

    await sendOtpEmail(email, otp, user.name);

    return successResponse(res, { email }, 'OTP mới đã được gửi đến email của bạn.');
  } catch (err) {
    console.error('ResendOtp error:', err);
    return errorResponse(res, 'Lỗi server khi gửi lại OTP.', 500);
  }
};

// ── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      // ── Tracking: LOGIN_FAILED — email không tồn tại ──
      try {
        await AuthEvent.create({
          eventType: 'LOGIN_FAILED',
          email,
          success:   false,
          ip:        getIp(req),
          userAgent: req.headers['user-agent'] || null,
        });
      } catch (trackErr) {
        console.warn('[Tracking] Không ghi được LOGIN_FAILED event:', trackErr.message);
      }
      return errorResponse(res, 'Email hoặc mật khẩu không đúng.', 401);
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      // ── Tracking: LOGIN_FAILED — sai mật khẩu ──
      try {
        await AuthEvent.create({
          userId:    user._id,
          email:     user.email,
          role:      user.role,
          eventType: 'LOGIN_FAILED',
          success:   false,
          ip:        getIp(req),
          userAgent: req.headers['user-agent'] || null,
        });
      } catch (trackErr) {
        console.warn('[Tracking] Không ghi được LOGIN_FAILED event:', trackErr.message);
      }
      return errorResponse(res, 'Email hoặc mật khẩu không đúng.', 401);
    }

    // Kiểm tra tài khoản đã xác thực email chưa
    if (!user.isVerified) {
      return errorResponse(
        res,
        'Tài khoản chưa được xác thực. Vui lòng kiểm tra email và nhập mã OTP.',
        403,
        { needVerify: true, email }
      );
    }

    if (user.status === 'PENDING') {
      return errorResponse(res, 'Your account is pending admin approval.', 403, { isPending: true });
    }
    if (user.status === 'REJECTED') {
      return errorResponse(res, 'Your account registration was rejected.', 403);
    }

    const token = generateToken(user._id);
    
    let isMajorLocked = false;
    if (user.role === 'STUDENT') {
      const enrollments = await Student.find({ userId: user._id }).populate('classId', 'isMajorLocked');
      isMajorLocked = enrollments.some(s => s.classId?.isMajorLocked);
    }
    const userObj = user.toJSON();

    // ── Tracking: LOGIN thành công ──
    try {
      await AuthEvent.create({
        userId:    user._id,
        email:     user.email,
        role:      user.role,
        eventType: 'LOGIN',
        success:   true,
        ip:        getIp(req),
        userAgent: req.headers['user-agent'] || null,
      });
    } catch (trackErr) {
      console.warn('[Tracking] Không ghi được LOGIN event:', trackErr.message);
    }

    return successResponse(res, { user: { ...userObj, isMajorLocked }, token }, 'Đăng nhập thành công!');
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse(res, 'Lỗi server khi đăng nhập.', 500);
  }
};

// ── POST /api/auth/google ─────────────────────────────────────
const googleAuth = async (req, res) => {
  const { googleToken } = req.body;
  if (!googleToken) return errorResponse(res, 'Google token là bắt buộc.', 400);

  try {
    // Verify access_token bằng Google userinfo endpoint
    const googleUser = await getGoogleUserInfo(googleToken);
    if (!googleUser) return errorResponse(res, 'Google token không hợp lệ.', 401);

    const { sub: googleId, email, name, picture } = googleUser;
    if (!email) return errorResponse(res, 'Không lấy được email từ Google.', 400);

    // Tìm user theo googleId hoặc email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    // Check if there is a pre-existing student record added by Admin
    const existingStudent = await Student.findOne({ email });

    if (user) {
      // If user exists but lacks a major, sync it from the student record
      if (user.role === 'STUDENT' && !user.major && existingStudent && existingStudent.major) {
        user.major = existingStudent.major;
        user.programGroup = existingStudent.programGroup || getProgramGroupFromMajor(existingStudent.major);
        if (!user.studentId) user.studentId = existingStudent.rollNumber;
        await user.save({ validateBeforeSave: false });
      }

      // Update googleId if missing
      if (!user.googleId) {
        user.googleId   = googleId;
        user.isVerified = true;
        if (!user.avatar && picture) user.avatar = picture;
        await user.save({ validateBeforeSave: false });
      }

      if (user.status === 'PENDING') {
        return errorResponse(res, 'Your account is pending admin approval.', 403, { isPending: true });
      }
      if (user.status === 'REJECTED') {
        return errorResponse(res, 'Your account registration was rejected.', 403);
      }
    } else {
      // Create new user from Google
      user = await User.create({
        name,
        email,
        password:   googleId + process.env.JWT_SECRET,
        googleId,
        avatar:     picture || null,
        role:       'STUDENT',
        status:     'APPROVED',
        isVerified: true,
        major:      existingStudent ? existingStudent.major : null,
        programGroup: existingStudent ? (existingStudent.programGroup || getProgramGroupFromMajor(existingStudent.major)) : null,
        studentId:  existingStudent ? existingStudent.rollNumber : null
      });
    }

    // Link any existing Student records to this user ID
    if (existingStudent && user.role === 'STUDENT') {
      await Student.updateMany({ email }, { $set: { userId: user._id } });
    }

    const token = generateToken(user._id);

    let isMajorLocked = false;
    if (user.role === 'STUDENT') {
      const enrollments = await Student.find({ userId: user._id }).populate('classId', 'isMajorLocked');
      isMajorLocked = enrollments.some(s => s.classId?.isMajorLocked);
    }
    const userObj = user.toJSON();

    // ── Tracking: Google LOGIN thành công ──
    try {
      await AuthEvent.create({
        userId:    user._id,
        email:     user.email,
        role:      user.role,
        eventType: 'LOGIN',
        success:   true,
        ip:        getIp(req),
        userAgent: req.headers['user-agent'] || null,
      });
    } catch (trackErr) {
      console.warn('[Tracking] Không ghi được Google LOGIN event:', trackErr.message);
    }

    return successResponse(res, { user: { ...userObj, isMajorLocked }, token }, 'Đăng nhập bằng Google thành công!');
  } catch (err) {
    console.error('GoogleAuth error:', err);
    return errorResponse(res, 'Lỗi khi xác thực Google.', 500);
  }
};

/**
 * Lấy thông tin user từ Google bằng access_token.
 * Trả về { sub, email, name, picture } hoặc null nếu thất bại.
 */
const getGoogleUserInfo = (accessToken) => {
  return new Promise((resolve) => {
    https.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
      (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error || !parsed.email) return resolve(null);
            resolve(parsed);
          } catch {
            resolve(null);
          }
        });
      }
    ).on('error', () => resolve(null));
  });
};

// ── GET /api/auth/me ─────────────────────────────────────────
const getMe = async (req, res) => {
  let isMajorLocked = false;
  if (req.user.role === 'STUDENT') {
    const enrollments = await Student.find({ userId: req.user._id }).populate('classId', 'isMajorLocked');
    isMajorLocked = enrollments.some(s => s.classId?.isMajorLocked);
  }
  const userObj = req.user.toObject ? req.user.toObject() : { ...req.user };
  return successResponse(res, { user: { ...userObj, isMajorLocked } });
};

// ── PUT /api/auth/update-profile ─────────────────────────────
const updateProfile = async (req, res) => {
  const { name, bio, phone, studentId, programGroup, major, avatar } = req.body;
  
  if (req.user.role === 'STUDENT' && major) {
    if (!ALL_TEAM_MAJORS.includes(major.toUpperCase())) {
      return errorResponse(res, 'Invalid major selected.', 400);
    }

    // Check if any enrolled class is locked
    const enrollments = await Student.find({ userId: req.user._id }).populate('classId', 'isMajorLocked');
    const isLocked = enrollments.some(s => s.classId?.isMajorLocked);
    if (isLocked) {
      return errorResponse(res, 'Không thể thay đổi chuyên ngành vì giảng viên đã khóa tính năng này trong một lớp bạn đang tham gia.', 403);
    }
  }

  try {
    const updateData = { name, bio, phone, studentId };
    if (avatar !== undefined) updateData.avatar = avatar;
    
    let computedProgramGroup = programGroup;
    if (req.user.role === 'STUDENT' && major) {
      computedProgramGroup = getProgramGroupFromMajor(major.toUpperCase()) || programGroup || 'BBA';
      updateData.programGroup = computedProgramGroup;
      updateData.major = major.toUpperCase();
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Sync to Student model
    if (req.user.role === 'STUDENT' && major) {
      await Student.updateMany(
        { email: user.email },
        { $set: { programGroup: computedProgramGroup, major: major.toUpperCase(), userId: user._id } }
      );
    }

    return successResponse(res, { user }, 'Cập nhật profile thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// ── PUT /api/auth/change-password ────────────────────────────
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6)
    return errorResponse(res, 'Mật khẩu mới phải ≥ 6 ký tự.', 400);

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword)))
      return errorResponse(res, 'Mật khẩu hiện tại không đúng.', 400);

    user.password = newPassword; // pre-save hook sẽ hash lại
    await user.save();
    return successResponse(res, null, 'Đổi mật khẩu thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// ── POST /api/auth/forgot-password ─────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return errorResponse(res, 'Email is required', 400);

  try {
    const user = await User.findOne({ email });
    if (user) {
      // Generate a secure random token (64 hex chars)
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken   = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save({ validateBeforeSave: false });

      // Build reset URL pointing to the frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      // Send real email
      await sendResetPasswordEmail(email, resetUrl, user.name);
    }
    // Always return success to prevent email enumeration
    return successResponse(res, null, 'If this email exists, a reset link has been sent.');
  } catch (err) {
    console.error('Forgot password error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ── POST /api/auth/reset-password/:token ───────────────────────
const resetPassword = async (req, res) => {
  const { token }    = req.params;
  const { password } = req.body;

  if (!password || password.length < 6)
    return errorResponse(res, 'Password must be at least 6 characters', 400);

  try {
    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return errorResponse(res, 'Invalid or expired reset token', 400);

    user.password             = password; // pre-save will hash
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return successResponse(res, null, 'Password reset successful');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  googleAuth,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};
