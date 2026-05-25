// src/models/WorkshopAttendance.js
const mongoose = require('mongoose');

const workshopAttendanceSchema = new mongoose.Schema(
  {
    workshopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workshop',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Mapped to User collection representing the student
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
    },
    mode: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: null,
    },
    status: {
      type: String,
      enum: ['NOT_PARTICIPATED', 'CHECKED_IN', 'VERIFIED', 'REJECTED'],
      default: 'CHECKED_IN',
    },
    evidenceUrl: {
      type: String,
      default: '',
    },
    checkInTime: {
      type: Date,
      default: Date.now,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

workshopAttendanceSchema.index({ workshopId: 1, studentId: 1 }, { unique: true });
workshopAttendanceSchema.index({ classId: 1 });

module.exports = mongoose.model('WorkshopAttendance', workshopAttendanceSchema);
