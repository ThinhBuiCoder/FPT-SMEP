// src/models/Team.js
const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    roleInTeam: { type: String, default: 'Member' },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    classId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    teamName:   { type: String, required: true, trim: true },   // e.g. "Team 1"
    teamCode:   { type: String, required: true, trim: true, uppercase: true }, // e.g. "EXE101_1_TEAM_1"
    mentorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lectureId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members:    [teamMemberSchema],
    // Auto-created chat group reference
    chatGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatGroup', default: null },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// teamCode must be unique within a class
teamSchema.index({ teamCode: 1, classId: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
