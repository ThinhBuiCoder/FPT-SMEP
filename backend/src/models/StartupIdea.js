// src/models/StartupIdea.js
const mongoose = require('mongoose');

const startupIdeaSchema = new mongoose.Schema(
  {
    teamId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    startupName:    { type: String, required: true, trim: true },
    problem:        { type: String, required: true },
    targetCustomer: { type: String, default: '' },
    solution:       { type: String, required: true },
    businessModel:  { type: String, default: '' },
    technology:     { type: String, default: '' },
    marketAnalysis: { type: String, default: '' },
    competitors:    { type: String, default: '' },
    stage:          { type: String, default: 'Idea' }, // Idea, MVP, Growth, Scale
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'REVIEWED', 'IMPROVING', 'APPROVED'],
      default: 'DRAFT',
    },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StartupIdea', startupIdeaSchema);
