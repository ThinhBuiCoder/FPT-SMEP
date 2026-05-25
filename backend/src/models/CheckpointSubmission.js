// src/models/CheckpointSubmission.js
const mongoose = require('mongoose');

const checkpointSubmissionSchema = new mongoose.Schema(
  {
    teamId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    checkpointNumber: { type: Number, required: true, min: 1, max: 4 },
    files:            [{ type: mongoose.Schema.Types.ObjectId, ref: 'CheckpointFile' }],
  },
  { timestamps: true }
);

checkpointSubmissionSchema.index({ teamId: 1, checkpointNumber: 1 }, { unique: true });

module.exports = mongoose.model('CheckpointSubmission', checkpointSubmissionSchema);
