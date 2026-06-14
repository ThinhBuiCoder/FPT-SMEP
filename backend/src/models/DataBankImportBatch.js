const mongoose = require('mongoose');

const dataBankImportBatchSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileChecksum: { type: String, default: null, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sheetName: { type: String, default: null, trim: true },
    headerRow: { type: Number, default: 1 },
    semester: { type: String, required: true, trim: true, uppercase: true },
    subjectCode: { type: String, required: true, trim: true, uppercase: true },
    classCode: { type: String, required: true, trim: true, uppercase: true },
    datasetType: { type: String, required: true },
    rowsInserted: { type: Number, default: 0 },
    rowsUpdated: { type: Number, default: 0 },
    rowsSkipped: { type: Number, default: 0 },
    columnsAdded: [{ type: String }],
    columnsIgnored: [{ type: String }],
    conflicts: [{ type: mongoose.Schema.Types.Mixed }],
    analysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    columnMappings: [{ type: mongoose.Schema.Types.Mixed }],
    status: { type: String, enum: ['PREVIEWED', 'COMMITTED', 'FAILED', 'ROLLED_BACK'], default: 'PREVIEWED' },
    committedAt: { type: Date, default: null },
    rolledBackAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dataBankImportBatchSchema.index({ uploadedAt: 1 });
dataBankImportBatchSchema.index({ createdAt: -1 });
dataBankImportBatchSchema.index({ classId: 1, createdAt: -1 });
dataBankImportBatchSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('DataBankImportBatch', dataBankImportBatchSchema);
