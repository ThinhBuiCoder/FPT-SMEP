// src/models/ChatGroup.js
// Automatically created when a team is formed.
const mongoose = require('mongoose');

const chatGroupMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // studentId populated from Student model (no User account yet)
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    role: { type: String, enum: ['lecture', 'student', 'admin', 'mentor', 'LECTURE', 'LECTURER', 'STUDENT', 'MENTOR', 'ADMIN'], default: 'student' },
  },
  { _id: false }
);

const chatGroupSchema = new mongoose.Schema(
  {
    teamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, unique: true },
    classId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    groupName: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members:   [chatGroupMemberSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatGroup', chatGroupSchema);
