// src/models/AiAnalysis.js
const mongoose = require('mongoose');

const aiAnalysisSchema = new mongoose.Schema(
  {
    startupIdeaId:       { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: true },
    strengths:           { type: [String], default: [] },
    weaknesses:          { type: [String], default: [] },
    feasibilityAnalysis: { type: String, default: '' },
    marketPotential:     { type: String, default: '' },
    risks:               { type: [String], default: [] },
    similarIdeas:        { type: mongoose.Schema.Types.Mixed, default: [] }, // Array of objects
    suggestions:         { type: [String], default: [] },
    aiScore:             { type: Number, min: 0, max: 100, default: 0 },
    model:               { type: String, default: 'mock' }, // 'mock' | 'gpt-4o'
  },
  { timestamps: true }
);

module.exports = mongoose.model('AiAnalysis', aiAnalysisSchema);
