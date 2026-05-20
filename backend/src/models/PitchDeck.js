// backend/src/models/PitchDeck.js
const mongoose = require("mongoose");

const pitchDeckSchema = new mongoose.Schema({
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
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Proposal"
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    default: "pdf"
  },
  mimeType: String,
  fileSize: Number,
  versionNumber: {
    type: Number,
    default: 1
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["ACTIVE", "ARCHIVED"],
    default: "ACTIVE"
  }
}, { timestamps: true });

module.exports = mongoose.model("PitchDeck", pitchDeckSchema);
