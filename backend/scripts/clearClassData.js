// scripts/clearClassData.js — Xoá toàn bộ dữ liệu lớp để import lại
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://thinhbuicoder_db_user:Q5lkUyujP2eC6nGs@cluster0.um6upmj.mongodb.net/';

async function clearClassData() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;

  const collections = [
    'classes',
    'students',
    'teams',
    'chatgroups',
    'messages',
    'milestones',
    'evaluations',
    'startupideas',
    'checkpoints',
    'sprints',
    'sprinttasks',
    'weeklytasks',
    'workspaces',
    'workshops',
    'comments',
    'rankings',
    'mentoringsessions',
    'notifications',
  ];

  console.log('🗑️  Đang xoá dữ liệu...\n');
  for (const name of collections) {
    try {
      const result = await db.collection(name).deleteMany({});
      if (result.deletedCount > 0) {
        console.log(`   ✅ ${name}: đã xoá ${result.deletedCount} documents`);
      } else {
        console.log(`   ⚪ ${name}: rỗng (0 documents)`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${name}: ${err.message}`);
    }
  }

  // Kiểm tra User accounts còn lại
  const userCount = await db.collection('users').countDocuments();
  console.log(`\n👤 User accounts được giữ lại: ${userCount} tài khoản`);
  console.log('\n🎉 Xong! Bạn có thể import lại dữ liệu lớp mới rồi.');

  await mongoose.disconnect();
}

clearClassData().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
