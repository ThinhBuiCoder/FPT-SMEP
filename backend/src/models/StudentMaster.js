const mongoose = require('mongoose');
const { normalizeRollNumber } = require('../utils/dataBankNormalize');

const studentMasterSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, trim: true, uppercase: true },
    normalizedRollNumber: { type: String, required: true, trim: true, uppercase: true },
    fullName: { type: String, default: null, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    major: { type: String, default: null, trim: true, uppercase: true },
  },
  { timestamps: true }
);

studentMasterSchema.pre('validate', function normalize(next) {
  this.normalizedRollNumber = normalizeRollNumber(this.normalizedRollNumber || this.rollNumber);
  this.rollNumber = this.normalizedRollNumber;
  next();
});

studentMasterSchema.index({ normalizedRollNumber: 1 }, { unique: true });

module.exports = mongoose.model('StudentMaster', studentMasterSchema);
