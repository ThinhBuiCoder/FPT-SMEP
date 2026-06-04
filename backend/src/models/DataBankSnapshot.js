const mongoose = require('mongoose');

const dataBankSnapshotSchema = new mongoose.Schema(
  {
    importBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'DataBankImportBatch', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scope: {
      classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      semester: String,
      subjectCode: String,
      classCode: String,
      datasetType: String,
      rollNumbers: [String],
    },
    studentMasters: [{ type: mongoose.Schema.Types.Mixed }],
    academicDatasets: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

dataBankSnapshotSchema.index({ importBatch: 1 }, { unique: true });

module.exports = mongoose.model('DataBankSnapshot', dataBankSnapshotSchema);
