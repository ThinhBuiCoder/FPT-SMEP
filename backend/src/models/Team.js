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
    lineageId:  { type: mongoose.Schema.Types.ObjectId, ref: 'StartupLineage', default: null },
    courseCode: { type: String, trim: true, uppercase: true, default: null },
    semester:   { type: String, trim: true, uppercase: true, default: null },
    previousTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    nextTeamId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    members:    [teamMemberSchema],
    // Auto-created chat group reference
    chatGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatGroup', default: null },
    groupName:   { type: String, default: "" },
    groupExe201: { type: String, default: "" },
    projectName: { type: String, default: "" },
    description: { type: String, default: "" },

    // Proposal fields
    status:       { type: String, enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION'], default: 'APPROVED' },
    rejectReason: { type: String, default: null },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:   { type: Date, default: null },
    leaderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
  },
  { timestamps: true }
);

// teamCode must be unique within a class
teamSchema.index({ teamCode: 1, classId: 1 }, { unique: true });
teamSchema.index({ lineageId: 1 });
teamSchema.index({ previousTeamId: 1 });
teamSchema.index({ nextTeamId: 1 });

module.exports = mongoose.model('Team', teamSchema);
