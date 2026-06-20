// src/models/Class.js
const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    // Auto-generated: EXE101_1, EXE101_2 ...
    classCode:   { type: String, required: true, trim: true, uppercase: true },
    // EXE101 | EXE201 ... dynamic validation in controller
    subjectCode: { type: String, required: true, uppercase: true, trim: true },
    // Numeric index within subject + semester + year: 1, 2, 3 ...
    classIndex:  { type: Number, required: true, min: 1 },
    // SP | SU | FA
    semester:    { type: String, required: true, enum: ['SP', 'SU', 'FA'] },
    year:        { type: Number, required: true },
    // Assigned lecturer (User with role LECTURER)
    lectureId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    mentorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    schedule: {
      dayOfWeek: { type: String, enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] },
      slot:      { type: Number, min: 1, max: 4 },
      startTime: { type: String },
      endTime:   { type: String },
      room:      { type: String, default: 'TBD' }
    },
    chatGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatGroup', default: null },
    // Lecturer can lock/unlock student ability to change their major
    isMajorLocked: { type: Boolean, default: false },
    status:        { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true }
);

// Class codes are shared by Admin and Lecturer within the same semester/year.
// A later semester can reuse EXE101_1, EXE101_2, ...
classSchema.index({ classCode: 1, semester: 1, year: 1 }, { unique: true });
classSchema.index({ subjectCode: 1, semester: 1, year: 1, classIndex: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
