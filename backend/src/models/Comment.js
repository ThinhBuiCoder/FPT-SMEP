// src/models/Comment.js — THREADED COMMENTS ON PROPOSALS/EVALUATIONS
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorRole: {
      type: String,
      enum: ['ADMIN', 'LECTURER', 'STUDENT', 'MENTOR'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    // Reference to proposal or evaluation section
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
      index: true,
    },
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evaluation',
      index: true,
    },

    // Comment metadata
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorRole: {
      type: String,
      enum: ['ADMIN', 'LECTURER', 'STUDENT', 'MENTOR'],
      required: true,
    },

    // Section of proposal being commented on
    section: {
      type: String,
      enum: [
        'IDEA',
        'PROBLEM_ANALYSIS',
        'MARKET_RESEARCH',
        'MVP_PROTOTYPE',
        'BUSINESS_MODEL',
        'PITCH_DECK',
        'OVERALL',
      ],
      default: 'OVERALL',
    },

    // Main comment text
    text: {
      type: String,
      required: true,
      trim: true,
    },

    // Threaded replies
    replies: [replySchema],

    // Comment state
    resolved: { type: Boolean, default: false },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: { type: Date, default: null },

    // Checkpoint context
    checkpointNumber: {
      type: Number,
      min: 1,
      max: 4,
    },

    // Team/Class context
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      index: true,
    },
  },
  { timestamps: true }
);

// Indices for efficient querying
commentSchema.index({ proposalId: 1, createdAt: -1 });
commentSchema.index({ evaluationId: 1, createdAt: -1 });
commentSchema.index({ proposalId: 1, section: 1, resolved: 1 });
commentSchema.index({ teamId: 1, checkpointNumber: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
