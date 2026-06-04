// src/models/AuthEvent.js
const mongoose = require('mongoose');

/**
 * AuthEvent — ghi lại mọi sự kiện xác thực (REGISTER, LOGIN, LOGIN_FAILED, LOGOUT)
 * Dùng để phân tích thống kê cho Admin Dashboard.
 */
const authEventSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email:     { type: String, default: null, lowercase: true, trim: true },
    role:      { type: String, enum: ['ADMIN', 'LECTURER', 'MENTOR', 'STUDENT', null], default: null },
    eventType: {
      type: String,
      enum: ['REGISTER', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT'],
      required: true,
    },
    success:   { type: Boolean, default: true },
    ip:        { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

// Index để query thống kê theo ngày nhanh
authEventSchema.index({ createdAt: -1 });
authEventSchema.index({ eventType: 1, createdAt: -1 });
authEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AuthEvent', authEventSchema);
