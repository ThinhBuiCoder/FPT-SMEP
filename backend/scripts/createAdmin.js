// scripts/createAdmin.js — Tạo tài khoản ADMIN
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGODB_URI = 'mongodb+srv://thinhbuicoder_db_user:Q5lkUyujP2eC6nGs@cluster0.um6upmj.mongodb.net/';

async function createAdmin() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const existing = await User.findOne({ email: 'admin@fpt.edu.vn' });
  if (existing) {
    console.log('⚠️  Tài khoản admin@fpt.edu.vn đã tồn tại!');
    await mongoose.disconnect();
    return;
  }

  const admin = await User.create({
    name:       'Admin',
    email:      'admin@fpt.edu.vn',
    password:   '123456',
    role:       'ADMIN',
    status:     'APPROVED',
    isVerified: true,
  });

  console.log('🎉 Tạo tài khoản ADMIN thành công!');
  console.log('   Email   :', admin.email);
  console.log('   Role    :', admin.role);
  console.log('   ID      :', admin._id);

  await mongoose.disconnect();
}

createAdmin().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
