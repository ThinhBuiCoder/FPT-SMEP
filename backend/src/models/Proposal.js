// backend/src/models/Proposal.js
const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true,
    unique: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true
  },

  title: { type: String, default: "" },
  startupName: { type: String, default: "" },
  tagline: { type: String, default: "" },

  problem: { type: String, default: "" },
  solution: { type: String, default: "" },
  targetCustomers: { type: String, default: "" },
  valueProposition: { type: String, default: "" },
  marketSize: { type: String, default: "" },
  competitors: { type: String, default: "" },
  businessModel: { type: String, default: "" },
  revenueModel: { type: String, default: "" },
  marketingStrategy: { type: String, default: "" },
  technology: { type: String, default: "" },
  financialPlan: { type: String, default: "" },
  roadmap: { type: String, default: "" },
  teamIntroduction: { type: String, default: "" },

  status: {
    type: String,
    enum: ["DRAFT", "SUBMITTED", "REVIEWED", "APPROVED", "REJECTED"],
    default: "DRAFT"
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  submittedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("Proposal", proposalSchema);
