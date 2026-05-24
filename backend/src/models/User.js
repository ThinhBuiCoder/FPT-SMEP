// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, required: true, minlength: 6 },
    role:      { type: String, enum: ['ADMIN', 'LECTURER', 'MENTOR', 'STUDENT'], default: 'STUDENT' },
    avatar:    { type: String, default: null },
    phone:     { type: String, default: null },
    studentId: { type: String, default: null }, // Mã sinh viên
    programGroup: { type: String, enum: ['BIT', 'BBA', 'BLA', null], default: null },
    major:     { type: String, default: null },
    bio:       { type: String, default: null },
    resetPasswordToken:   { type: String },
    resetPasswordExpires: { type: Date },
    // OTP Email Verification
    isVerified:  { type: Boolean, default: false },
    otp:         { type: String, default: null },
    otpExpires:  { type: Date,   default: null },
    // Google OAuth
    googleId:    { type: String, default: null },
  },
  { timestamps: true }
);

// Exclude password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
