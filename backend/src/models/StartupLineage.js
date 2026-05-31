const mongoose = require('mongoose');

const startupLineageSchema = new mongoose.Schema(
  {
    startupName: { type: String, trim: true, default: '' },
    originalTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    currentTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'PIVOTED'],
      default: 'ACTIVE',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

startupLineageSchema.index({ currentTeamId: 1 });
startupLineageSchema.index({ teamIds: 1 });

module.exports = mongoose.model('StartupLineage', startupLineageSchema);
