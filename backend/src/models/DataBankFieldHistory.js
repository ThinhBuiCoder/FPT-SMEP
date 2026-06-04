const mongoose = require('mongoose');

const dataBankFieldHistorySchema = new mongoose.Schema(
  {
    datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicDataset', default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentMaster', default: null },
    rollNumber: { type: String, required: true, trim: true, uppercase: true },
    fieldKey: { type: String, required: true, trim: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    importBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'DataBankImportBatch', required: true },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    importedAt: { type: Date, default: Date.now },
    entity: { type: String, enum: ['StudentMaster', 'AcademicDataset'], required: true },
  },
  { timestamps: true }
);

dataBankFieldHistorySchema.index({ datasetId: 1, fieldKey: 1, importedAt: -1 });
dataBankFieldHistorySchema.index({ importBatch: 1 });

module.exports = mongoose.model('DataBankFieldHistory', dataBankFieldHistorySchema);
