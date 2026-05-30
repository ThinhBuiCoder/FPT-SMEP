// src/models/Workshop.js
const mongoose = require('mongoose');

const workshopSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['WORKSHOP', 'SEMINAR'],
      default: 'WORKSHOP',
    },

    // ── Class groups ──────────────────────────────────────────────
    onlineClassIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    offlineClassIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],

    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],

    targetAudience: {
      type: String,
      enum: ['ALL_STUDENTS', 'CLASS', 'TEAM', 'LECTURER', 'MENTOR'],
      default: 'CLASS',
    },

    // Auto-derived: ONLINE | OFFLINE | HYBRID
    format: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'HYBRID'],
      default: 'OFFLINE',
    },
    bannerUrl: { type: String, default: '' },
    attachments: [{ type: String }],
    checkInDeadline: { type: Date },
    mentors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    startDate:   { type: Date, required: true },
    endDate:     { type: Date, required: true },
    startTime:   { type: String, required: true }, // HH:MM
    endTime:     { type: String, required: true }, // HH:MM

    location:    { type: String, default: '' },
    meetingLink: { type: String, default: '' },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'CANCELLED'],
      default: 'PUBLISHED',
    },
  },
  { timestamps: true }
);

workshopSchema.index({ onlineClassIds: 1 });
workshopSchema.index({ offlineClassIds: 1 });
workshopSchema.index({ status: 1 });

module.exports = mongoose.model('Workshop', workshopSchema);
