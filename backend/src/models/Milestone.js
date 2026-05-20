// src/models/Milestone.js
const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    startDate:   { type: Date },
    dueDate:     { type: Date, required: true },
    status: {
      type: String,
      enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE',
             // Legacy values kept for backward compat with old data
             'TODO', 'DONE'],
      default: 'PLANNED',
    },
    progress:    { type: Number, default: 0, min: 0, max: 100 },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Normalize legacy status values on read
milestoneSchema.methods.toNormalized = function () {
  const obj = this.toObject();
  if (obj.status === 'TODO') obj.status = 'PLANNED';
  if (obj.status === 'DONE') obj.status = 'COMPLETED';
  return obj;
};

module.exports = mongoose.model('Milestone', milestoneSchema);
