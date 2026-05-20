// src/models/SprintTask.js
const mongoose = require('mongoose');

const sprintTaskSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', default: null },

    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    assigneeId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assigneeStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },

    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
      default: 'TODO',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },

    startDate:   { type: Date },
    dueDate:     { type: Date },
    completedAt: { type: Date, default: null },

    position:    { type: Number, default: 0 },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-set completedAt on status change
sprintTaskSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'DONE' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'DONE') {
      this.completedAt = null;
    }
  }
  next();
});

sprintTaskSchema.index({ teamId: 1, milestoneId: 1 });
sprintTaskSchema.index({ teamId: 1, status: 1 });

module.exports = mongoose.model('SprintTask', sprintTaskSchema);
