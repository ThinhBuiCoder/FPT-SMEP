const mongoose = require('mongoose');

const dataBankExportTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    selectedColumns: [{ type: String }],
    columnOrder: [{ type: String }],
    headerAliases: { type: Map, of: String, default: {} },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

dataBankExportTemplateSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('DataBankExportTemplate', dataBankExportTemplateSchema);
