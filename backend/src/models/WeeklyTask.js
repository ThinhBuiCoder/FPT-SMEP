// src/models/WeeklyTask.js
const mongoose = require('mongoose');

const normalizeTaskTitle = (title) =>
  title?.trim().toLowerCase().replace(/\s+/g, ' ');

const weeklyTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleNormalized: {
      type: String,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    taskType: {
      type: String,
      enum: ['COURSE_TEMPLATE', 'CLASS_TASK', 'TEAM_TASK'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['COURSE', 'CLASS', 'TEAM'],
      required: true,
    },
    weekNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    courseCode: {
      type: String,
      default: 'EXE101',
      uppercase: true,
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    assigneeStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE'],
      default: 'TODO',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  attachments: {
    type: [
      {
        name: { type: String },
        url: { type: String },
      },
    ],
    default: [],
  },

  checklist: {
    type: [
      {
        text: { type: String, required: true },
        isCompleted: { type: Boolean, default: false },
      },
    ],
    default: [],
  },

  tags: {
    type: [
      {
        type: String,
        trim: true,
      },
    ],
    default: [],
  },

    isTemplate: {
      type: Boolean,
      default: false,
    },
    isMandatory: {
      type: Boolean,
      default: false,
    },
    visibleToStudents: {
      type: Boolean,
      default: true,
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    estimatedHours: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to calculate completion percentage and status
weeklyTaskSchema.pre('save', function (next) {
  this.titleNormalized = normalizeTaskTitle(this.title);

  // If status is marked as COMPLETED, make sure percentage is 100
  if (this.status === 'COMPLETED') {
    this.completionPercentage = 100;
    // Mark all checklist items as completed
    if (this.checklist && this.checklist.length > 0) {
      this.checklist.forEach(item => {
        item.isCompleted = true;
      });
    }
  } else if (this.checklist && this.checklist.length > 0) {
    const totalItems = this.checklist.length;
    const completedItems = this.checklist.filter(item => item.isCompleted).length;
    this.completionPercentage = Math.round((completedItems / totalItems) * 100);
    
    // Auto complete if checklist is 100% done
    if (this.completionPercentage === 100) {
      this.status = 'COMPLETED';
    }
  } else {
    this.completionPercentage = this.status === 'COMPLETED' ? 100 : 0;
  }

  // Auto-set OVERDUE only for TEAM_TASK — course/class templates are static references
  if (
    this.taskType === 'TEAM_TASK' &&
    this.status !== 'COMPLETED' &&
    this.dueDate &&
    new Date(this.dueDate) < new Date()
  ) {
    this.status = 'OVERDUE';
  }

  next();
});

weeklyTaskSchema.index({ taskType: 1, courseCode: 1, weekNumber: 1 });
weeklyTaskSchema.index({ taskType: 1, classId: 1, weekNumber: 1 });
weeklyTaskSchema.index({ taskType: 1, teamId: 1, weekNumber: 1 });
weeklyTaskSchema.index({ teamId: 1, assigneeStudentId: 1, status: 1 });
weeklyTaskSchema.index({ teamId: 1, taskType: 1, priority: 1, weekNumber: 1, createdAt: -1 });
weeklyTaskSchema.index({ teamId: 1, taskType: 1, assigneeStudentId: 1, createdAt: -1 });
weeklyTaskSchema.index({ teamId: 1, taskType: 1, dueDate: 1, status: 1 });
weeklyTaskSchema.index({ title: 'text', description: 'text' });
weeklyTaskSchema.index(
  { taskType: 1, teamId: 1, weekNumber: 1, titleNormalized: 1 },
  { unique: true, partialFilterExpression: { taskType: 'TEAM_TASK', titleNormalized: { $type: 'string' } } }
);
weeklyTaskSchema.index(
  { taskType: 1, classId: 1, weekNumber: 1, titleNormalized: 1 },
  { unique: true, partialFilterExpression: { taskType: 'CLASS_TASK', titleNormalized: { $type: 'string' } } }
);
weeklyTaskSchema.index(
  { taskType: 1, courseCode: 1, weekNumber: 1, titleNormalized: 1 },
  { unique: true, partialFilterExpression: { taskType: 'COURSE_TEMPLATE', titleNormalized: { $type: 'string' } } }
);

module.exports = mongoose.model('WeeklyTask', weeklyTaskSchema);
