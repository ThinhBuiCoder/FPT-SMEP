// src/models/ProposalComment.js
const mongoose = require('mongoose');

const proposalCommentSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    proposalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal', required: true },
    
    sectionKey: { type: String, required: true },
    selectedText: { type: String, default: '' },
    content: { type: String, required: true },
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String },
    
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProposalComment', default: null },
    
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProposalComment', proposalCommentSchema);
