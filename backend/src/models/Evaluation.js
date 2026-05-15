// src/models/Evaluation.js
const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    startupIdeaId:     { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: true },
    lecturerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    innovationScore:   { type: Number, min: 0, max: 10, default: 0 },
    feasibilityScore:  { type: Number, min: 0, max: 10, default: 0 },
    marketScore:       { type: Number, min: 0, max: 10, default: 0 },
    technicalScore:    { type: Number, min: 0, max: 10, default: 0 },
    presentationScore: { type: Number, min: 0, max: 10, default: 0 },
    totalScore:        { type: Number, default: 0 }, // auto-computed average
    comment:           { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-compute totalScore before save
evaluationSchema.pre('save', function (next) {
  const sum =
    this.innovationScore +
    this.feasibilityScore +
    this.marketScore +
    this.technicalScore +
    this.presentationScore;
  this.totalScore = parseFloat((sum / 5).toFixed(2));
  next();
});

module.exports = mongoose.model('Evaluation', evaluationSchema);
