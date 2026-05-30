const mongoose = require('mongoose');

const evaluationHistorySchema = new mongoose.Schema(
  {
    evaluationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluation', required: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    proposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
    checkpointNumber: { type: Number, min: 1, max: 4 },
    action: {
      type: String,
      enum: ['CREATED', 'UPDATED', 'SUBMITTED', 'PUBLISHED'],
      required: true,
    },
    version: { type: Number, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedByRole: { type: String, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

evaluationHistorySchema.index({ evaluationId: 1, version: 1 }, { unique: true });
evaluationHistorySchema.index({ teamId: 1, checkpointNumber: 1, createdAt: -1 });

module.exports = mongoose.model('EvaluationHistory', evaluationHistorySchema);