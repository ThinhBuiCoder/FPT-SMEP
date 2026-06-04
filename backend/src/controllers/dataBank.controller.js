const multer = require('multer');
const DataBankExportTemplate = require('../models/DataBankExportTemplate');
const DataBankFieldHistory = require('../models/DataBankFieldHistory');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const dataBankService = require('../services/dataBank.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) return cb(null, true);
    return cb(new Error('Only .xlsx and .xls files are accepted'), false);
  },
});

exports.uploadExcel = upload.single('file');

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
};

const handleError = (res, err, fallback = 'Data Bank request failed') => {
  console.error('[DataBank]', err);
  return errorResponse(res, err.message || fallback, err.statusCode || 500, err.data || null);
};

exports.getColumns = async (_req, res) => {
  try {
    const columns = await dataBankService.getColumns();
    return successResponse(res, { columns });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getClasses = async (req, res) => {
  try {
    const classes = await dataBankService.listAccessibleClasses({ user: req.user });
    return successResponse(res, { classes });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.syncClass = async (req, res) => {
  try {
    const result = await dataBankService.syncClassData({ classId: req.params.classId, user: req.user });
    return successResponse(res, result, 'Class data synced into Data Bank');
  } catch (err) {
    return handleError(res, err, 'Class sync failed');
  }
};

exports.inspectWorkbook = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload an Excel file', 400);
    const result = await dataBankService.parseWorkbook(req.file.buffer);
    return successResponse(res, { sheets: result.sheets });
  } catch (err) {
    return handleError(res, err, 'Workbook inspection failed');
  }
};

exports.previewImport = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload an Excel file', 400);
    const scope = parseJsonField(req.body.scope, req.body);
    const mappings = parseJsonField(req.body.mappings, []);
    const batch = await dataBankService.createPreview({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      sheetName: req.body.sheetName,
      headerRow: req.body.headerRow || 1,
      scope,
      mappings,
      user: req.user,
    });
    return successResponse(res, { batch }, 'Preview created');
  } catch (err) {
    return handleError(res, err, 'Preview failed');
  }
};

exports.commitImport = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please re-upload the exact Excel file used for preview', 400);
    const mappings = parseJsonField(req.body.mappings, null);
    const batch = await dataBankService.commitImport({
      batchId: req.params.batchId,
      buffer: req.file.buffer,
      mappings,
      user: req.user,
      confirmHighConflicts: req.body.confirmHighConflicts === 'true' || req.body.confirmHighConflicts === true,
    });
    return successResponse(res, { batch }, 'Import committed');
  } catch (err) {
    return handleError(res, err, 'Commit failed');
  }
};

exports.getDatasets = async (req, res) => {
  try {
    const datasets = await dataBankService.listDatasets({ filters: req.query, user: req.user });
    return successResponse(res, { datasets });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.exportPreview = async (req, res) => {
  try {
    const selectedColumns = parseJsonField(req.body.selectedColumns, []);
    const selectedRollNumbers = parseJsonField(req.body.selectedRollNumbers, []);
    const datasets = await dataBankService.listDatasets({ filters: req.body.filters || {}, user: req.user });
    const columns = selectedColumns.length ? selectedColumns : ['RollNumber', 'FullName', 'Email', 'Major'];
    if (!columns.includes('RollNumber')) columns.unshift('RollNumber');
    const rowMap = new Map();
    for (const dataset of datasets) {
      const rollNumber = dataset.rollNumber;
      if (!rowMap.has(rollNumber)) {
        rowMap.set(rollNumber, {
          RollNumber: rollNumber,
          FullName: dataset.studentId?.fullName || '',
          Email: dataset.studentId?.email || '',
          Major: dataset.studentId?.major || '',
        });
      }
      const row = rowMap.get(rollNumber);
      for (const col of columns) {
        if (['RollNumber', 'FullName', 'Email', 'Major'].includes(col)) continue;
        if ((row[col] === undefined || row[col] === '') && dataset.dynamicFields?.get?.(col) !== undefined) {
          row[col] = dataset.dynamicFields.get(col);
        }
      }
    }
    let rows = [...rowMap.values()];
    if (selectedRollNumbers.length) {
      const selectedSet = new Set(selectedRollNumbers);
      const order = new Map(selectedRollNumbers.map((rollNumber, index) => [rollNumber, index]));
      rows = rows
        .filter((row) => selectedSet.has(row.RollNumber))
        .sort((a, b) => (order.get(a.RollNumber) ?? 0) - (order.get(b.RollNumber) ?? 0));
    }
    const previewRows = rows.slice(0, 50);
    return successResponse(res, { rows: previewRows, total: rowMap.size });
  } catch (err) {
    return handleError(res, err, 'Export preview failed');
  }
};

exports.downloadExport = async (req, res) => {
  try {
    const selectedColumns = parseJsonField(req.body.selectedColumns, []);
    const selectedRollNumbers = parseJsonField(req.body.selectedRollNumbers, []);
    const headerAliases = parseJsonField(req.body.headerAliases, {});
    const { workbook } = await dataBankService.exportWorkbook({
      filters: req.body.filters || {},
      selectedColumns,
      selectedRollNumbers,
      headerAliases,
      user: req.user,
    });
    const filename = `data-bank-${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return handleError(res, err, 'Export failed');
  }
};

exports.getHistory = async (req, res) => {
  try {
    const history = await dataBankService.listImportHistory({ user: req.user, limit: req.query.limit || 50, classId: req.query.classId });
    return successResponse(res, { history });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.rollbackBatch = async (req, res) => {
  try {
    const batch = await dataBankService.rollbackLatestBatch({
      batchId: req.params.batchId,
      user: req.user,
      forceSnapshotRestore: req.body.forceSnapshotRestore === true,
    });
    return successResponse(res, { batch }, 'Rollback completed');
  } catch (err) {
    return handleError(res, err, 'Rollback failed');
  }
};

exports.getFieldHistory = async (req, res) => {
  try {
    const query = { rollNumber: String(req.query.rollNumber || '').trim().toUpperCase() };
    if (!query.rollNumber) return errorResponse(res, 'rollNumber is required', 400);
    if (req.query.fieldKey) query.fieldKey = req.query.fieldKey;
    const history = await DataBankFieldHistory.find(query)
      .populate('importBatch', 'fileName status committedAt')
      .populate('importedBy', 'name email')
      .sort({ importedAt: -1 })
      .limit(200);
    return successResponse(res, { history });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const query = req.user.role === 'ADMIN' ? {} : { ownerId: req.user._id };
    const templates = await DataBankExportTemplate.find(query).sort({ updatedAt: -1 });
    return successResponse(res, { templates });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.saveTemplate = async (req, res) => {
  try {
    const template = await dataBankService.upsertTemplate({ id: req.params.id, body: req.body, user: req.user });
    if (!template) return errorResponse(res, 'Template not found', 404);
    return successResponse(res, { template }, 'Template saved');
  } catch (err) {
    return handleError(res, err, 'Template save failed');
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const query = { _id: req.params.id, ...(req.user.role === 'ADMIN' ? {} : { ownerId: req.user._id }) };
    const deleted = await DataBankExportTemplate.findOneAndDelete(query);
    if (!deleted) return errorResponse(res, 'Template not found', 404);
    return successResponse(res, null, 'Template deleted');
  } catch (err) {
    return handleError(res, err, 'Template delete failed');
  }
};

exports.addGridColumn = async (req, res) => {
  try {
    const column = await dataBankService.addManualColumn({ ...req.body, user: req.user });
    return successResponse(res, { column }, 'Column added');
  } catch (err) {
    return handleError(res, err, 'Column add failed');
  }
};

exports.deleteGridColumn = async (req, res) => {
  try {
    const result = await dataBankService.deleteManualColumn({ ...req.body, user: req.user });
    return successResponse(res, result, 'Column deleted from class data');
  } catch (err) {
    return handleError(res, err, 'Column delete failed');
  }
};

exports.addGridRow = async (req, res) => {
  try {
    const dataset = await dataBankService.addManualRow({ ...req.body, user: req.user });
    return successResponse(res, { dataset }, 'Row added');
  } catch (err) {
    return handleError(res, err, 'Row add failed');
  }
};

exports.deleteGridRow = async (req, res) => {
  try {
    const result = await dataBankService.deleteManualRow({ ...req.body, user: req.user });
    return successResponse(res, result, 'Row deleted');
  } catch (err) {
    return handleError(res, err, 'Row delete failed');
  }
};

exports.editGridCell = async (req, res) => {
  try {
    const result = await dataBankService.editManualCell({ ...req.body, user: req.user });
    return successResponse(res, result, 'Cell updated');
  } catch (err) {
    return handleError(res, err, 'Cell update failed');
  }
};

exports.clearGridCell = async (req, res) => {
  try {
    const result = await dataBankService.clearManualCell({ ...req.body, user: req.user });
    return successResponse(res, result, 'Cell cleared');
  } catch (err) {
    return handleError(res, err, 'Cell clear failed');
  }
};
