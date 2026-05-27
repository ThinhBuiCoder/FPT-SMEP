// src/models/Evaluation.js
const mongoose = require('mongoose');

const rubricScoreSchema = new mongoose.Schema(
  {
    criterionKey: String,
    criterionName: String,
    description: String,
    score: { type: Number, min: 0, default: 0 },
    maxScore: { type: Number, default: 10 },
    weight: { type: Number, default: 1 },
    selectedLevel: { type: String, default: '' },
    weightedScore: { type: Number, default: 0 },
    scoreMode: { type: String, enum: ['LEVEL', 'MANUAL'], default: 'MANUAL' },
    comment: String,
  },
  { _id: false }
);

const evaluationSchema = new mongoose.Schema(
  {
    // Legacy fields (Module 1)
    startupIdeaId:     { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: false },
    innovationScore:   { type: Number, min: 0, max: 10, default: 0 },
    feasibilityScore:  { type: Number, min: 0, max: 10, default: 0 },
    marketScore:       { type: Number, min: 0, max: 10, default: 0 },
    technicalScore:    { type: Number, min: 0, max: 10, default: 0 },
    presentationScore: { type: Number, min: 0, max: 10, default: 0 },
    comment:           { type: String, default: '' },

    // New fields (Module 4)
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    proposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
    pitchDeckId: { type: mongoose.Schema.Types.ObjectId, ref: 'PitchDeck' },
    checkpointNumber: { type: Number, min: 1, max: 4 },
    checkpointTitle: { type: String, default: '' },

    // Evaluator info (lecturerId is kept for compatibility)
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    evaluatorRole: { type: String, enum: ['LECTURER', 'MENTOR', 'ADMIN'], default: 'LECTURER' },

    // Module 4 Grading
    rubricScores: [rubricScoreSchema],
    totalScore: { type: Number, default: 0 },
    maxTotalScore: { type: Number, default: 0 },
    totalWeight: { type: Number, default: 0 },
    checkpointTotal: { type: Number, default: 0 },
    weightedScore: { type: Number, default: 0 },

    overallFeedback: { type: String, default: '' },
    strengths: { type: String, default: '' },
    weaknesses: { type: String, default: '' },
    suggestions: { type: String, default: '' },

    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'PUBLISHED'], default: 'DRAFT' },
    submittedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    historyVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-compute totalScore before save
evaluationSchema.pre('save', function (next) {
  if (this.rubricScores && this.rubricScores.length > 0) {
    let total = 0;
    let maxTotal = 0;
    let weighted = 0;
    let totalWeight = 0;

    for (const rs of this.rubricScores) {
      const score = Number(rs.score || 0);
      const weight = Number(rs.weight || 0);
      total += score;
      maxTotal += (rs.maxScore || 10);
      weighted += score * (weight / 100);
      totalWeight += weight;
      rs.weightedScore = Number((score * (weight / 100)).toFixed(2));
    }

    this.totalScore = parseFloat(total.toFixed(2));
    this.maxTotalScore = maxTotal;
    this.totalWeight = totalWeight;
    this.checkpointTotal = parseFloat(weighted.toFixed(2));
    this.weightedScore = parseFloat(weighted.toFixed(2));
  } else {
    const sum =
      this.innovationScore +
      this.feasibilityScore +
      this.marketScore +
      this.technicalScore +
      this.presentationScore;
    this.totalScore = parseFloat((sum / 5).toFixed(2));
  }
  next();
});

evaluationSchema.index({ teamId: 1, checkpointNumber: 1, lecturerId: 1 }, { unique: false });
evaluationSchema.index({ proposalId: 1, checkpointNumber: 1, status: 1 });

module.exports = mongoose.model('Evaluation', evaluationSchema);
