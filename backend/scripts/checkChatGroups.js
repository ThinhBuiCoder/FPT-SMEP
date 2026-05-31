// scripts/checkChatGroups.js — Kiểm tra ChatGroup trong DB
require('dotenv').config();
const mongoose = require('mongoose');
const ChatGroup = require('../src/models/ChatGroup');
const Message = require('../src/models/Message');
require('../src/models/Class'); // register Class schema
require('../src/models/Team');  // register Team schema


const MONGODB_URI = 'mongodb+srv://thinhbuicoder_db_user:Q5lkUyujP2eC6nGs@cluster0.um6upmj.mongodb.net/';

async function check() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const groups = await ChatGroup.find()
    .populate('classId', 'classCode')
    .populate('teamId', 'teamName teamCode')
    .lean();

  console.log(`📦 Tổng số ChatGroup: ${groups.length}`);
  console.log('─'.repeat(60));

  for (const g of groups) {
    const msgCount = await Message.countDocuments({ chatGroupId: g._id });
    console.log(`\n🗂  ${g.groupName}`);
    console.log(`   ID      : ${g._id}`);
    console.log(`   Class   : ${g.classId?.classCode || 'N/A'}`);
    console.log(`   Team    : ${g.teamId?.teamCode || 'General'}`);
    console.log(`   Members : ${g.members.length} người`);
    console.log(`   Messages: ${msgCount} tin nhắn`);
    // Check members có userId
    const withUserId = g.members.filter(m => m.userId).length;
    const withoutUserId = g.members.filter(m => !m.userId).length;
    console.log(`   UserId  : ${withUserId} có / ${withoutUserId} chưa link`);
  }

  await mongoose.disconnect();
}

check().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
