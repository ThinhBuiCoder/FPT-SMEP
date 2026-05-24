// src/models/Student.js
// Represents a student enrolled in a specific class.
// A student can have a linked User account (if they log in) or exist only as a roster entry.
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, trim: true },
    memberCode: { type: String, trim: true, default: null },
    lastName:   { type: String, trim: true, default: '' },
    middleName: { type: String, trim: true, default: '' },
    firstName:  { type: String, trim: true, default: '' },
    fullName:   { type: String, required: true, trim: true },
    email:      { type: String, required: true, lowercase: true, trim: true },
    // avatar is taken from linked User profile if available
    avatarUrl:  { type: String, default: null },
    programGroup: { type: String, enum: ['BIT', 'BBA', 'BLA', null], default: null },
    major:      { type: String, default: null, trim: true, uppercase: true },
    subjectCode: { type: String, default: null, trim: true, uppercase: true },
    // Which class this student belongs to
    classId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    // Optional link to a registered User account
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Which team (if any) this student has been assigned to within the class
    teamId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  },
  { timestamps: true }
);

// A student (identified by rollNumber) can only appear once per class
studentSchema.index({ rollNumber: 1, classId: 1 }, { unique: true });
// Prevent same email in same class
studentSchema.index({ email: 1, classId: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
