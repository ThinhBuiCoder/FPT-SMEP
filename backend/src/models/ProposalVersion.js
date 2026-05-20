// backend/src/models/ProposalVersion.js
const mongoose = require("mongoose");

const proposalVersionSchema = new mongoose.Schema({
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Proposal",
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  snapshot: {
    type: Object,
    required: true
  },
  changeNote: {
    type: String,
    default: ""
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("ProposalVersion", proposalVersionSchema);
