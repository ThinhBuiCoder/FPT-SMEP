// src/models/Milestone.js
const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    dueDate:     { type: Date, required: true },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'DONE', 'OVERDUE'],
      default: 'TODO',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Milestone', milestoneSchema);
