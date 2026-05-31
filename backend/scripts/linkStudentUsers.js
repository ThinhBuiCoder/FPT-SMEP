// scripts/linkStudentUsers.js — Link Student records với User accounts theo email
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const ChatGroup = require('../src/models/ChatGroup');

const MONGODB_URI = 'mongodb+srv://thinhbuicoder_db_user:Q5lkUyujP2eC6nGs@cluster0.um6upmj.mongodb.net/';

async function linkStudentUsers() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // 1. Link tất cả Student với User theo email
  const students = await Student.find({ userId: null });
  console.log(`📋 Tìm thấy ${students.length} student chưa link với User account`);

  let linked = 0;
  for (const student of students) {
    if (!student.email) continue;
    const user = await User.findOne({ email: student.email.toLowerCase() });
    if (user) {
      student.userId = user._id;
      await student.save();
      linked++;
      console.log(`   ✅ Linked: ${student.email} → User ${user._id}`);
    }
  }
  console.log(`\n🔗 Đã link: ${linked}/${students.length} student\n`);

  // 2. Cập nhật lại members.userId trong tất cả ChatGroup
  const groups = await ChatGroup.find();
  console.log(`📦 Cập nhật ${groups.length} ChatGroup...`);

  let updatedGroups = 0;
  for (const group of groups) {
    let changed = false;
    for (const member of group.members) {
      if (!member.userId && member.studentId) {
        const student = await Student.findById(member.studentId);
        if (student && student.userId) {
          member.userId = student.userId;
          changed = true;
        }
      }
    }
    if (changed) {
      await group.save();
      updatedGroups++;
      console.log(`   ✅ Updated ChatGroup: ${group.groupName}`);
    }
  }

  console.log(`\n🎉 Xong! Đã cập nhật ${updatedGroups} ChatGroup.`);
  console.log('   Giờ Student đã có thể thấy Group Chat của mình rồi!');

  await mongoose.disconnect();
}

linkStudentUsers().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
