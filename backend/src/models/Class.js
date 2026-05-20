// src/models/Class.js
const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    // Auto-generated: EXE101_1, EXE101_2 ...
    classCode:   { type: String, required: true, trim: true, uppercase: true },
    // EXE101 | EXE201
    subjectCode: { type: String, required: true, enum: ['EXE101', 'EXE201'], uppercase: true },
    // Numeric index within the batch: 1, 2, 3 ...
    classIndex:  { type: Number, required: true, min: 1 },
    // SP | SU | FA
    semester:    { type: String, required: true, enum: ['SP', 'SU', 'FA'] },
    year:        { type: Number, required: true },
    // Assigned lecturer (User with role LECTURER)
    lectureId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    mentorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    status:      { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true }
);

// Compound unique: same classCode cannot exist in same semester + year
classSchema.index({ classCode: 1, semester: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
