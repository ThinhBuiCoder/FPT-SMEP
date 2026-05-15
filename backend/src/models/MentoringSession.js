// src/models/MentoringSession.js
const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const mentoringSessionSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    lecturerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:       { type: String, required: true },
    meetingDate: { type: Date, required: true },
    notes:       { type: String, default: '' },
    meetingUrl:  { type: String, default: null },
    actionItems: { type: [actionItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MentoringSession', mentoringSessionSchema);
