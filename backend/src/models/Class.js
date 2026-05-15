// src/models/Class.js
const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    code:        { type: String, required: true, unique: true, trim: true, uppercase: true },
    semester:    { type: String, required: true },
    description: { type: String, default: '' },
    lecturerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive:    { type: Boolean, default: true },
    // Embedded array of member user IDs
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', classSchema);
