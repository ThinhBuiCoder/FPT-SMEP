// backend/src/models/Shortcut.js
const mongoose = require('mongoose');

const shortcutSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    lineageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StartupLineage',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Fast lookup: all shortcuts for a team, newest first
shortcutSchema.index({ teamId: 1, createdAt: -1 });
shortcutSchema.index({ lineageId: 1, createdAt: -1 });
shortcutSchema.index({ teamId: 1, url: 1 }, { unique: true });

module.exports = mongoose.model('Shortcut', shortcutSchema);
