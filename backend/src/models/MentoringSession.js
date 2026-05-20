// src/models/MentoringSession.js
const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema(
  {
    item: { type: String }, // Legacy field
    content: { type: String }, // New field
    done: { type: Boolean, default: false }, // Legacy field
    completed: { type: Boolean, default: false }, // New field
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: { type: Date }
  },
  { _id: true }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    name: String,
    email: String,
    attended: { type: Boolean, default: false }
  },
  { _id: true }
);

const mentoringSessionSchema = new mongoose.Schema(
  {
    teamId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Class' }, // New field
    lecturerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Can represent mentor or lecturer
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    meetingDate: { type: Date, required: true },
    
    // Time & Location
    startTime:   { type: String, default: '' },
    endTime:     { type: String, default: '' },
    location:    { type: String, default: '' },
    meetingUrl:  { type: String, default: null }, // Legacy mapping to meetingLink
    meetingLink: { type: String, default: '' },
    
    status: { type: String, enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'], default: 'SCHEDULED' },

    notes:       { type: String, default: '' },
    actionItems: { type: [actionItemSchema], default: [] },
    attendance:  { type: [attendanceSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('MentoringSession', mentoringSessionSchema);
