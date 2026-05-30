// src/models/CheckpointSubmission.js
const mongoose = require('mongoose');

const requirementContentSchema = new mongoose.Schema(
  {
    index:     { type: Number, required: true, min: 0 },
    label:     { type: String, required: true },
    content:   { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date },
  },
  { _id: false }
);

const checkpointSubmissionSchema = new mongoose.Schema(
  {
    teamId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    checkpointNumber: { type: Number, required: true, min: 1, max: 4 },
    files:            [{ type: mongoose.Schema.Types.ObjectId, ref: 'CheckpointFile' }],
    requirementContents: [requirementContentSchema],
  },
  { timestamps: true }
);

checkpointSubmissionSchema.index({ teamId: 1, checkpointNumber: 1 }, { unique: true });

module.exports = mongoose.model('CheckpointSubmission', checkpointSubmissionSchema);
