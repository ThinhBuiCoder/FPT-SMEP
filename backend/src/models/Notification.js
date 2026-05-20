// src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recipientEmail: { type: String, required: true, lowercase: true, trim: true },

    type: {
      type: String,
      enum: [
        'SYSTEM',
        'WORKSHOP',
        'SEMINAR',
        'EVALUATION',
        'MENTORING',
        'MILESTONE',
        'TASK',
        'CLASS',
        'TEAM'
      ],
      required: true,
    },

    title:   { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link:    { type: String, default: null },

    data:    { type: mongoose.Schema.Types.Mixed, default: {} },

    isRead:  { type: Boolean, default: false },
    readAt:  { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ recipientEmail: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
