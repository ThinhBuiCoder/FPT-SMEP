const mongoose = require('mongoose');
const { normalizeColumnKey } = require('../utils/dataBankNormalize');

const dataBankColumnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    normalizedKey: { type: String, required: true, trim: true },
    dataType: { type: String, enum: ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN'], default: 'TEXT' },
    aliases: [{ type: String, trim: true }],
    normalizedAliases: [{ type: String, trim: true }],
    isSystemField: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dataBankColumnSchema.pre('validate', function normalize(next) {
  this.normalizedKey = normalizeColumnKey(this.normalizedKey || this.key);
  this.normalizedAliases = (this.aliases || []).map(normalizeColumnKey).filter(Boolean);
  next();
});

dataBankColumnSchema.index({ normalizedKey: 1 }, { unique: true });
dataBankColumnSchema.index({ normalizedAliases: 1 });

module.exports = mongoose.model('DataBankColumn', dataBankColumnSchema);
