// src/controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/register ──────────────────────────────
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());

  const { name, email, password, role, studentId, phone, bio } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists) return errorResponse(res, 'Email đã được sử dụng.', 409);

    // Chỉ cho tạo STUDENT hoặc LECTURER từ public endpoint
    const allowedRoles = ['STUDENT', 'LECTURER'];
    const userRole = allowedRoles.includes(role) ? role : 'STUDENT';

    const user = await User.create({
      name, email, password, role: userRole,
      studentId: userRole === 'STUDENT' ? studentId : null,
      phone, bio,
    });

    const token = generateToken(user._id);
    return successResponse(res, { user, token }, 'Đăng ký thành công!', 201);
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse(res, 'Lỗi server khi đăng ký.', 500);
  }
};

// ── POST /api/auth/login ─────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) return errorResponse(res, 'Email hoặc mật khẩu không đúng.', 401);

    const ok = await user.comparePassword(password);
    if (!ok) return errorResponse(res, 'Email hoặc mật khẩu không đúng.', 401);

    const token = generateToken(user._id);
    // toJSON() removes password automatically
    return successResponse(res, { user, token }, 'Đăng nhập thành công!');
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse(res, 'Lỗi server khi đăng nhập.', 500);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────
const getMe = async (req, res) => {
  return successResponse(res, { user: req.user });
};

// ── PUT /api/auth/update-profile ─────────────────────────
const updateProfile = async (req, res) => {
  const { name, bio, phone, studentId } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, bio, phone, studentId },
      { new: true, runValidators: true }
    );
    return successResponse(res, { user }, 'Cập nhật profile thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// ── PUT /api/auth/change-password ────────────────────────
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
      // MVP: Simply set a mock token in DB or just log it
      user.resetPasswordToken = 'mock-reset-token-' + user._id;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();
      console.log(`[MVP] Reset link for ${email}: http://localhost:5173/reset-password/${user.resetPasswordToken}`);
    }
    // Always return success to prevent email enumeration
    return successResponse(res, null, 'If this email exists, a reset link has been sent.');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ── POST /api/auth/reset-password/:token ───────────────────
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  
  if (!password || password.length < 6) return errorResponse(res, 'Password must be at least 6 characters', 400);

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return errorResponse(res, 'Invalid or expired reset token', 400);

    user.password = password; // pre-save will hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return successResponse(res, null, 'Password reset successful');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword, forgotPassword, resetPassword };
