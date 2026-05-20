// src/models/Evaluation.js
const mongoose = require('mongoose');

const rubricScoreSchema = new mongoose.Schema(
  {
    criterionKey: String,
    criterionName: String,
    score: { type: Number, min: 0, default: 0 },
    maxScore: { type: Number, default: 10 },
    weight: { type: Number, default: 1 },
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

    // Evaluator info (lecturerId is kept for compatibility)
    lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    evaluatorRole: { type: String, enum: ['LECTURER', 'MENTOR', 'ADMIN'], default: 'LECTURER' },

    // Module 4 Grading
    rubricScores: [rubricScoreSchema],
    totalScore: { type: Number, default: 0 },
    maxTotalScore: { type: Number, default: 0 },
    weightedScore: { type: Number, default: 0 },

    overallFeedback: { type: String, default: '' },
    strengths: { type: String, default: '' },
    weaknesses: { type: String, default: '' },
    suggestions: { type: String, default: '' },

    status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'PUBLISHED'], default: 'DRAFT' }
  },
  { timestamps: true }
);

// Auto-compute totalScore before save
evaluationSchema.pre('save', function (next) {
  if (this.rubricScores && this.rubricScores.length > 0) {
    // New logic (Module 4)
    let total = 0;
    let maxTotal = 0;
    let weighted = 0;
    let totalWeight = 0;

    for (const rs of this.rubricScores) {
      total += (rs.score || 0);
      maxTotal += (rs.maxScore || 10);
      const w = rs.weight || 1;
      weighted += (rs.score || 0) * w;
      totalWeight += w;
    }

    this.totalScore = parseFloat(total.toFixed(2));
    this.maxTotalScore = maxTotal;
    if (totalWeight > 0) {
      // Normalizing weighted score out of 10 if total max is considered
      this.weightedScore = parseFloat((weighted / totalWeight).toFixed(2));
    }
  } else {
    // Legacy logic (Module 1)
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

module.exports = mongoose.model('Evaluation', evaluationSchema);
