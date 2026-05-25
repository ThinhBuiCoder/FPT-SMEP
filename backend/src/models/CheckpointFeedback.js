// src/models/CheckpointFeedback.js
const mongoose = require('mongoose');

const checkpointFeedbackSchema = new mongoose.Schema(
  {
    teamId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    checkpointNumber:  { type: Number, required: true },
    user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment:           { type: String, required: true, trim: true },
    // parentFeedbackId: if set, this is a reply to another comment
    parentFeedbackId:  { type: mongoose.Schema.Types.ObjectId, ref: 'CheckpointFeedback', default: null },
  },
  { timestamps: true }
);

// Index for quick lookup per team + checkpoint
checkpointFeedbackSchema.index({ teamId: 1, checkpointNumber: 1 });

module.exports = mongoose.model('CheckpointFeedback', checkpointFeedbackSchema);
