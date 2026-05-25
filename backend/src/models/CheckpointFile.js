// src/models/CheckpointFile.js
// Stores checkpoint file binary in MongoDB (uses MONGODB_URI from env via Mongoose).
const mongoose = require('mongoose');

const MAX_FILE_BYTES = 15 * 1024 * 1024; // MongoDB single-doc limit is 16MB

const checkpointFileSchema = new mongoose.Schema(
  {
    teamId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    classId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    checkpointNumber: { type: Number, required: true, min: 1, max: 4 },
    fileName:         { type: String, required: true },
    originalName:     { type: String, required: true },
    fileSize:         { type: Number, required: true, max: MAX_FILE_BYTES },
    fileType:         { type: String, required: true }, // pdf | docx | pptx
    mimeType:         { type: String, required: true },
    data:             { type: Buffer, required: true, select: false },
    uploadedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt:       { type: Date, default: Date.now },
  },
  { timestamps: true }
);

checkpointFileSchema.index({ teamId: 1, checkpointNumber: 1 });
checkpointFileSchema.index({ teamId: 1, checkpointNumber: 1, uploadedAt: -1 });

checkpointFileSchema.statics.MAX_FILE_BYTES = MAX_FILE_BYTES;

module.exports = mongoose.model('CheckpointFile', checkpointFileSchema);
