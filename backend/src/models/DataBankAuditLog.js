const mongoose = require('mongoose');

const dataBankAuditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      required: true,
      enum: [
        'Import',
        'Export',
        'Rollback',
        'Snapshot Restore',
        'Column Mapping',
        'Conflict Resolution',
        'Template Changes',
        'Manual Edit',
        'Manual Delete',
        'Column Management',
        'Row Management',
      ],
    },
    entity: { type: String, required: true, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

dataBankAuditLogSchema.index({ user: 1, createdAt: -1 });
dataBankAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('DataBankAuditLog', dataBankAuditLogSchema);
