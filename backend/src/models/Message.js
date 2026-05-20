// src/models/Message.js — PERSIST CHAT GROUP MESSAGES
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    chatGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatGroup',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['ADMIN', 'LECTURER', 'STUDENT', 'MENTOR'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
