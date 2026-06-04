const mongoose = require('mongoose');

const academicDatasetSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentMaster', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    rollNumber: { type: String, required: true, trim: true, uppercase: true },
    semester: { type: String, required: true, trim: true, uppercase: true },
    subjectCode: { type: String, required: true, trim: true, uppercase: true },
    classCode: { type: String, required: true, trim: true, uppercase: true },
    datasetType: {
      type: String,
      required: true,
      enum: ['STUDENT_LIST', 'TEAM_ASSIGNMENT', 'CHECKPOINT', 'EVALUATION', 'PROPOSAL', 'MENTORING', 'CUSTOM'],
    },
    dynamicFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    lastImportBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'DataBankImportBatch', default: null },
  },
  { timestamps: true }
);

academicDatasetSchema.index({ rollNumber: 1, classId: 1, datasetType: 1 }, { unique: true });
academicDatasetSchema.index({ semester: 1, subjectCode: 1, classCode: 1, datasetType: 1 });
academicDatasetSchema.index({ classId: 1, datasetType: 1 });
academicDatasetSchema.index({ ownerId: 1 });

module.exports = mongoose.model('AcademicDataset', academicDatasetSchema);
