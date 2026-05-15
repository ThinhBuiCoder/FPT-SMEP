// src/models/Team.js
const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roleInTeam: { type: String, default: 'Member' }, // CEO, CTO, CMO, Developer, Designer...
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    members:     [teamMemberSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
