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
      trim: true,
      default: '',
    },
    messageType: {
      type: String,
      enum: ['TEXT', 'STICKER'],
      default: 'TEXT',
    },
    sticker: {
      emoji: { type: String, default: null },
      label: { type: String, default: null },
    },
    mentions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, trim: true, default: '' },
    }],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    attachment: {
      url: { type: String, default: null },
      name: { type: String, default: null },
      fileType: { type: String, default: null }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
