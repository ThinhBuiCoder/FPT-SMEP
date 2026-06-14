const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const crypto = require('crypto');
const StudentMaster = require('../models/StudentMaster');
const AcademicDataset = require('../models/AcademicDataset');
const DataBankColumn = require('../models/DataBankColumn');
const DataBankImportBatch = require('../models/DataBankImportBatch');
const DataBankFieldHistory = require('../models/DataBankFieldHistory');
const DataBankSnapshot = require('../models/DataBankSnapshot');
const DataBankExportTemplate = require('../models/DataBankExportTemplate');
const DataBankAuditLog = require('../models/DataBankAuditLog');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Team = require('../models/Team');
const {
  isEmptyValue,
  normalizeRollNumber,
  normalizeColumnKey,
  stringifyValue,
  toSafeKey,
} = require('../utils/dataBankNormalize');

const SYSTEM_FIELDS = ['RollNumber', 'FullName', 'Email', 'Major'];
const DATASET_TYPES = ['STUDENT_LIST', 'TEAM_ASSIGNMENT', 'CHECKPOINT', 'EVALUATION', 'PROPOSAL', 'MENTORING', 'CUSTOM'];
const CONFLICT_LEVEL = {
  FullName: 'HIGH',
  Major: 'HIGH',
  Email: 'MEDIUM',
  Phone: 'MEDIUM',
};
const checksumBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const DEFAULT_COLUMNS = [
  { key: 'RollNumber', displayName: 'RollNumber', aliases: ['Roll No', 'Roll Number', 'Student Code'], isSystemField: true },
  { key: 'FullName', displayName: 'FullName', aliases: ['Fullname', 'Full Name', 'Student Name'], isSystemField: true },
  { key: 'Email', displayName: 'Email', aliases: ['FPT Email'], isSystemField: true },
  { key: 'Major', displayName: 'Major', aliases: ['Chuyen Nganh', 'ChuyenNganh'], isSystemField: true },
  { key: 'MemberCode', displayName: 'MemberCode', aliases: ['Member Code'], isSystemField: false },
  { key: 'TeamName', displayName: 'TeamName', aliases: ['Team', 'GroupName', 'Group Name'], isSystemField: false },
  { key: 'TeamCode', displayName: 'TeamCode', aliases: ['Team Code'], isSystemField: false },
  { key: 'ProjectName', displayName: 'ProjectName', aliases: ['Project Name'], isSystemField: false },
  { key: 'Description', displayName: 'Description', aliases: ['Notes', 'Comments'], isSystemField: false },
];

const assertDatasetType = (datasetType) => {
  if (!DATASET_TYPES.includes(datasetType)) {
    const err = new Error('Invalid datasetType');
    err.statusCode = 400;
    throw err;
  }
};

const assertClassAccess = async (classId, user) => {
  if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
    const err = new Error('classId is required');
    err.statusCode = 400;
    throw err;
  }
  const cls = await Class.findById(classId);
  if (!cls) {
    const err = new Error('Class not found');
    err.statusCode = 404;
    throw err;
  }
  if (user.role === 'LECTURER' && cls.lectureId?.toString() !== user._id.toString()) {
    const err = new Error('You cannot access another lecturer class');
    err.statusCode = 403;
    throw err;
  }
  return cls;
};

const formatSemester = (cls) => `${cls.semester || ''}${String(cls.year || '').slice(-2)}`.toUpperCase();

const normalizeScope = async (scope, user) => {
  const cls = await assertClassAccess(scope.classId, user);
  const semester = String(scope.semester || '').trim().toUpperCase();
  const subjectCode = String(scope.subjectCode || '').trim().toUpperCase();
  const classCode = String(scope.classCode || '').trim().toUpperCase();
  const datasetType = String(scope.datasetType || '').trim().toUpperCase();
  if (!datasetType) {
    const err = new Error('datasetType is required');
    err.statusCode = 400;
    throw err;
  }
  assertDatasetType(datasetType);
  return {
    classId: cls._id,
    semester: semester || formatSemester(cls),
    subjectCode: subjectCode || cls.subjectCode,
    classCode: classCode || cls.classCode,
    datasetType,
  };
};

const ensureSystemColumns = async () => {
  for (const column of DEFAULT_COLUMNS) {
    await DataBankColumn.updateOne(
      { normalizedKey: normalizeColumnKey(column.key) },
      { $setOnInsert: { ...column, normalizedKey: normalizeColumnKey(column.key), dataType: 'TEXT', isActive: true } },
      { upsert: true }
    );
  }
};

const getColumns = async () => {
  await ensureSystemColumns();
  return DataBankColumn.find({ isActive: true }).sort({ isSystemField: -1, displayName: 1 });
};

const parseWorkbook = async (buffer) => {
  let rawWorkbook;
  try {
    rawWorkbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  } catch (err) {
    const parseError = new Error(`Failed to parse Excel file. Make sure it is a valid .xlsx or .xls file. (${err.message})`);
    parseError.statusCode = 400;
    throw parseError;
  }
  const worksheets = rawWorkbook.SheetNames.map((name, index) => {
    const sheet = rawWorkbook.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    const columnCount = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
    return {
      id: index + 1,
      name,
      rowCount: rawRows.length,
      columnCount,
      rawRows,
    };
  });
  const workbook = {
    worksheets,
    getWorksheet: (nameOrId) => worksheets.find((sheet) => sheet.name === nameOrId || sheet.id === nameOrId),
  };
  const sheets = worksheets.map(({ id, name, rowCount, columnCount }) => ({ id, name, rowCount, columnCount }));
  if (!sheets.length) {
    const err = new Error('Corrupted Workbook or empty workbook');
    err.statusCode = 400;
    throw err;
  }
  return { workbook, sheets };
};

const cellToValue = (cell) => {
  if (!cell) return '';
  const value = cell.value;
  if (value && typeof value === 'object') {
    if (value.text) return value.text;
    if (value.result !== undefined) return value.result;
    if (value.richText) return value.richText.map((r) => r.text).join('');
    if (value.hyperlink && value.text) return value.text;
  }
  return value ?? '';
};

const extractRows = (worksheet, headerRow = 1) => {
  if (worksheet.rawRows) {
    const rawRows = worksheet.rawRows;
    const headerIndex = Math.max(Number(headerRow || 1) - 1, 0);
    const rawHeaders = rawRows[headerIndex] || [];
    const headers = rawHeaders
      .map((value, idx) => ({ colNumber: idx + 1, displayName: stringifyValue(value).trim(), normalizedKey: normalizeColumnKey(value) }))
      .filter((header) => header.displayName);
    const rows = rawRows
      .slice(headerIndex + 1)
      .map((rawRow, idx) => {
        const values = {};
        let hasData = false;
        for (const header of headers) {
          const rawValue = rawRow[header.colNumber - 1] ?? '';
          if (!isEmptyValue(rawValue)) hasData = true;
          values[header.displayName] = rawValue;
        }
        return { rowNumber: headerIndex + idx + 2, values, hasData };
      })
      .filter((row) => row.hasData)
      .map(({ rowNumber, values }) => ({ rowNumber, values }));
    return { headers, rows };
  }
  const header = worksheet.getRow(Number(headerRow));
  const headers = [];
  header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const displayName = stringifyValue(cellToValue(cell)).trim();
    if (displayName) headers.push({ colNumber, displayName, normalizedKey: normalizeColumnKey(displayName) });
  });
  const rows = [];
  for (let rowNumber = Number(headerRow) + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = {};
    let hasData = false;
    for (const headerCell of headers) {
      const rawValue = cellToValue(row.getCell(headerCell.colNumber));
      if (!isEmptyValue(rawValue)) hasData = true;
      values[headerCell.displayName] = rawValue;
    }
    if (hasData) rows.push({ rowNumber, values });
  }
  return { headers, rows };
};

const resolveColumnMappings = async (headers, incomingMappings = []) => {
  await ensureSystemColumns();
  const columns = await DataBankColumn.find({ isActive: true });
  const byNormalized = new Map();
  for (const column of columns) {
    byNormalized.set(column.normalizedKey, column);
    for (const alias of column.normalizedAliases || []) byNormalized.set(alias, column);
  }
  const manualMap = new Map((incomingMappings || []).map((m) => [normalizeColumnKey(m.sourceHeader), m]));
  const mappings = [];
  for (const header of headers) {
    const manual = manualMap.get(header.normalizedKey);
    if (manual) {
      mappings.push({
        sourceHeader: header.displayName,
        action: manual.action,
        targetKey: manual.targetKey || toSafeKey(manual.newDisplayName || header.displayName),
        targetDisplayName: manual.newDisplayName || manual.targetDisplayName || header.displayName,
        approved: Boolean(manual.approved),
      });
      continue;
    }
    const matched = byNormalized.get(header.normalizedKey);
    if (matched) {
      mappings.push({
        sourceHeader: header.displayName,
        action: 'MAP_TO_EXISTING',
        targetKey: matched.key,
        targetDisplayName: matched.displayName,
        approved: true,
      });
    } else {
      mappings.push({
        sourceHeader: header.displayName,
        action: 'UNMAPPED',
        targetKey: toSafeKey(header.displayName),
        targetDisplayName: header.displayName,
        approved: false,
      });
    }
  }
  return mappings;
};

const buildRowPayload = (rawRow, mappings) => {
  const payload = {};
  for (const mapping of mappings) {
    if (mapping.action === 'IGNORE_COLUMN') continue;
    if (mapping.action === 'UNMAPPED' && !mapping.approved) continue;
    const key = mapping.targetKey;
    if (!key) continue;
    payload[key] = rawRow.values[mapping.sourceHeader];
  }
  return payload;
};

const getRollMapping = (mappings) => mappings.find((m) => m.targetKey === 'RollNumber' && m.action !== 'IGNORE_COLUMN');

const detectDatasetMismatch = (headers, datasetType) => {
  const keys = headers.map((h) => h.normalizedKey).join(' ');
  if (datasetType === 'STUDENT_LIST' && /(score|grade|checkpoint|evaluation|rubric)/i.test(keys)) {
    return 'Possible Dataset Type Mismatch: file looks like scores/evaluation data but STUDENT_LIST was selected.';
  }
  if (datasetType === 'CHECKPOINT' && !/(score|grade|checkpoint|comment|feedback)/i.test(keys)) {
    return 'Possible Dataset Type Mismatch: file does not look like checkpoint data.';
  }
  return null;
};

const analyzeRows = async ({ rows, mappings, scope }) => {
  const rollMapping = getRollMapping(mappings);
  if (!rollMapping) {
    return { blockingIssues: ['Missing RollNumber Column'], duplicateRollNumbers: [], rowAnalyses: [], summary: {} };
  }
  const rollRows = rows
    .map((row) => ({ rowNumber: row.rowNumber, rollNumber: normalizeRollNumber(row.values[rollMapping.sourceHeader]) }))
    .filter((r) => r.rollNumber);
  const seen = new Map();
  const duplicates = [];
  for (const r of rollRows) {
    if (seen.has(r.rollNumber)) duplicates.push({ rollNumber: r.rollNumber, rows: [seen.get(r.rollNumber), r.rowNumber] });
    else seen.set(r.rollNumber, r.rowNumber);
  }
  const rollNumbers = [...new Set(rollRows.map((r) => r.rollNumber))];
  const [students, datasets] = await Promise.all([
    StudentMaster.find({ normalizedRollNumber: { $in: rollNumbers } }),
    AcademicDataset.find({ rollNumber: { $in: rollNumbers }, ...scope }),
  ]);
  const studentMap = new Map(students.map((s) => [s.normalizedRollNumber, s]));
  const datasetMap = new Map(datasets.map((d) => [d.rollNumber, d]));
  const rowAnalyses = [];
  let rowsToInsert = 0;
  let rowsToUpdate = 0;
  const conflicts = [];
  const dataQualityIssues = [];
  for (const row of rows) {
    const payload = buildRowPayload(row, mappings);
    const rollNumber = normalizeRollNumber(payload.RollNumber);
    if (!rollNumber) {
      dataQualityIssues.push({ row: row.rowNumber, severity: 'BLOCK', message: 'Missing RollNumber' });
      continue;
    }
    const student = studentMap.get(rollNumber);
    const dataset = datasetMap.get(rollNumber);
    if (!dataset) rowsToInsert += 1;
    else rowsToUpdate += 1;

    for (const key of Object.keys(payload)) {
      if (key === 'RollNumber' || isEmptyValue(payload[key])) continue;
      const oldValue = SYSTEM_FIELDS.includes(key) ? student?.[key.charAt(0).toLowerCase() + key.slice(1)] : dataset?.dynamicFields?.get?.(key);
      if (oldValue !== undefined && oldValue !== null && stringifyValue(oldValue) !== stringifyValue(payload[key])) {
        conflicts.push({
          row: row.rowNumber,
          rollNumber,
          fieldKey: key,
          oldValue,
          newValue: payload[key],
          severity: CONFLICT_LEVEL[key] || (/comment|note|description/i.test(key) ? 'LOW' : 'MEDIUM'),
        });
      }
    }
    if (payload.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.Email).trim())) {
      dataQualityIssues.push({ row: row.rowNumber, rollNumber, severity: 'WARNING', message: 'Invalid Email' });
    }
    if (isEmptyValue(payload.FullName)) {
      dataQualityIssues.push({ row: row.rowNumber, rollNumber, severity: 'WARNING', message: 'Missing Name' });
    }
    rowAnalyses.push({ row: row.rowNumber, rollNumber, operation: dataset ? 'UPDATE' : 'INSERT' });
  }
  const blockingIssues = duplicates.length ? ['Duplicate RollNumbers'] : [];
  return {
    blockingIssues,
    duplicateRollNumbers: duplicates,
    rowAnalyses,
    conflicts,
    dataQualityIssues,
    summary: {
      rowsTotal: rows.length,
      rowsToInsert,
      rowsToUpdate,
      missingRollNumbers: rows.length - rollRows.length,
    },
  };
};

const createPreview = async ({ buffer, fileName, sheetName, headerRow, scope, mappings, user }) => {
  const normalizedScope = await normalizeScope(scope, user);
  const { workbook, sheets } = await parseWorkbook(buffer);
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) {
    const err = new Error('Invalid Sheet');
    err.statusCode = 400;
    throw err;
  }
  const extracted = extractRows(worksheet, headerRow || 1);
  const resolvedMappings = await resolveColumnMappings(extracted.headers, mappings);
  const analysis = await analyzeRows({
    rows: extracted.rows,
    mappings: resolvedMappings,
    scope: normalizedScope,
  });
  const datasetWarning = detectDatasetMismatch(extracted.headers, normalizedScope.datasetType);
  if (datasetWarning) analysis.dataQualityIssues.push({ severity: 'WARNING', message: datasetWarning });
  const unapprovedColumns = resolvedMappings.filter((m) => !m.approved && m.action !== 'IGNORE_COLUMN');
  const batch = await DataBankImportBatch.create({
    fileName,
    fileChecksum: checksumBuffer(buffer),
    uploadedBy: user._id,
    sheetName: worksheet.name,
    headerRow: Number(headerRow || 1),
    ...normalizedScope,
    rowsSkipped: analysis.summary.missingRollNumbers || 0,
    conflicts: analysis.conflicts || [],
    analysis: {
      ...analysis,
      sheets,
      headers: extracted.headers,
      previewRows: extracted.rows.slice(0, 20).map((r) => ({ rowNumber: r.rowNumber, values: r.values })),
      unapprovedColumns,
    },
    columnMappings: resolvedMappings,
    status: 'PREVIEWED',
  });
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Import',
    entity: 'DataBankImportBatch',
    entityId: batch._id,
    details: { mode: 'PREVIEW_ONLY', fileName, scope: normalizedScope },
  });
  return batch;
};

const createSnapshot = async ({ batch, rows, mappings, user }) => {
  const rollMapping = getRollMapping(mappings);
  const rollNumbers = rows.map((row) => normalizeRollNumber(row.values[rollMapping.sourceHeader])).filter(Boolean);
  const [studentMasters, academicDatasets] = await Promise.all([
    StudentMaster.find({ normalizedRollNumber: { $in: rollNumbers } }).lean(),
    AcademicDataset.find({ rollNumber: { $in: rollNumbers }, classId: batch.classId, semester: batch.semester, subjectCode: batch.subjectCode, classCode: batch.classCode, datasetType: batch.datasetType }).lean(),
  ]);
  await DataBankSnapshot.create({
    importBatch: batch._id,
    createdBy: user._id,
    scope: {
      classId: batch.classId,
      semester: batch.semester,
      subjectCode: batch.subjectCode,
      classCode: batch.classCode,
      datasetType: batch.datasetType,
      rollNumbers,
    },
    studentMasters,
    academicDatasets,
  });
};

const applyColumnChanges = async (mappings) => {
  const added = [];
  const ignored = [];
  for (const mapping of mappings) {
    if (mapping.action === 'IGNORE_COLUMN') {
      ignored.push(mapping.sourceHeader);
      continue;
    }
    if (['ADD_NEW_COLUMN', 'RENAME_AND_ADD'].includes(mapping.action) || (mapping.action === 'UNMAPPED' && mapping.approved)) {
      if (!mapping.approved) {
        const err = new Error(`Unknown column "${mapping.sourceHeader}" requires lecturer approval`);
        err.statusCode = 409;
        throw err;
      }
      if (SYSTEM_FIELDS.includes(mapping.targetKey)) {
        const err = new Error('System fields cannot be renamed or re-created');
        err.statusCode = 400;
        throw err;
      }
      const key = mapping.targetKey || toSafeKey(mapping.targetDisplayName || mapping.sourceHeader);
      await DataBankColumn.updateOne(
        { normalizedKey: normalizeColumnKey(key) },
        { $setOnInsert: { key, displayName: mapping.targetDisplayName || key, aliases: [mapping.sourceHeader], isSystemField: false, isActive: true } },
        { upsert: true }
      );
      added.push(key);
    }
  }
  return { added, ignored };
};

const setIfNonEmpty = (target, key, value) => {
  if (isEmptyValue(value)) return false;
  target[key] = typeof value === 'string' ? value.trim() : value;
  return true;
};

const recordHistory = async ({ history, datasetId, studentId, rollNumber, fieldKey, oldValue, newValue, batch, user, entity }) => {
  if (stringifyValue(oldValue) === stringifyValue(newValue)) return;
  history.push({
    datasetId,
    studentId,
    rollNumber,
    fieldKey,
    oldValue,
    newValue,
    importBatch: batch._id,
    importedBy: user._id,
    entity,
  });
};

const commitImport = async ({ batchId, buffer, mappings, user, confirmHighConflicts = false }) => {
  const batch = await DataBankImportBatch.findById(batchId);
  if (!batch) {
    const err = new Error('Import batch not found');
    err.statusCode = 404;
    throw err;
  }
  if (batch.status !== 'PREVIEWED') {
    const err = new Error('Only PREVIEWED batches can be committed');
    err.statusCode = 409;
    throw err;
  }
  if (user.role !== 'ADMIN' && batch.uploadedBy.toString() !== user._id.toString()) {
    const err = new Error('You cannot commit another lecturer import batch');
    err.statusCode = 403;
    throw err;
  }
  await assertClassAccess(batch.classId, user);
  if (batch.fileChecksum && batch.fileChecksum !== checksumBuffer(buffer)) {
    const err = new Error('The uploaded file does not match the file used to create this preview');
    err.statusCode = 409;
    throw err;
  }
  const { workbook } = await parseWorkbook(buffer);
  const worksheet = workbook.getWorksheet(batch.sheetName);
  if (!worksheet) {
    const err = new Error('Invalid Sheet');
    err.statusCode = 400;
    throw err;
  }
  const extracted = extractRows(worksheet, batch.headerRow);
  const resolvedMappings = await resolveColumnMappings(extracted.headers, mappings || batch.columnMappings);
  const analysis = await analyzeRows({
    rows: extracted.rows,
    mappings: resolvedMappings,
    scope: {
      classId: batch.classId,
      semester: batch.semester,
      subjectCode: batch.subjectCode,
      classCode: batch.classCode,
      datasetType: batch.datasetType,
    },
  });
  if (analysis.blockingIssues.length) {
    const err = new Error(`Commit blocked: ${analysis.blockingIssues.join(', ')}`);
    err.statusCode = 409;
    throw err;
  }
  if (!confirmHighConflicts && (analysis.conflicts || []).some((c) => c.severity === 'HIGH')) {
    const err = new Error('High severity conflicts require explicit confirmation');
    err.statusCode = 409;
    err.data = { conflicts: analysis.conflicts.filter((c) => c.severity === 'HIGH') };
    throw err;
  }
  const columnChanges = await applyColumnChanges(resolvedMappings);
  await createSnapshot({ batch, rows: extracted.rows, mappings: resolvedMappings, user });

  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  const history = [];
  for (const row of extracted.rows) {
    const payload = buildRowPayload(row, resolvedMappings);
    const rollNumber = normalizeRollNumber(payload.RollNumber);
    if (!rollNumber) {
      rowsSkipped += 1;
      continue;
    }
    let student = await StudentMaster.findOne({ normalizedRollNumber: rollNumber });
    if (!student) {
      student = new StudentMaster({ rollNumber, normalizedRollNumber: rollNumber });
    }
    const studentWasNew = student.isNew;
    const masterMap = { FullName: 'fullName', Email: 'email', Major: 'major' };
    for (const [fieldKey, docKey] of Object.entries(masterMap)) {
      if (!Object.prototype.hasOwnProperty.call(payload, fieldKey) || isEmptyValue(payload[fieldKey])) continue;
      const newValue = fieldKey === 'Email' ? String(payload[fieldKey]).trim().toLowerCase() : String(payload[fieldKey]).trim();
      await recordHistory({ history, studentId: student._id, rollNumber, fieldKey, oldValue: student[docKey], newValue, batch, user, entity: 'StudentMaster' });
      student[docKey] = newValue;
    }
    await student.save();

    let dataset = await AcademicDataset.findOne({
      rollNumber,
      classId: batch.classId,
      semester: batch.semester,
      subjectCode: batch.subjectCode,
      classCode: batch.classCode,
      datasetType: batch.datasetType,
    });
    if (!dataset) {
      dataset = new AcademicDataset({
        studentId: student._id,
        ownerId: batch.uploadedBy,
        classId: batch.classId,
        rollNumber,
        semester: batch.semester,
        subjectCode: batch.subjectCode,
        classCode: batch.classCode,
        datasetType: batch.datasetType,
        dynamicFields: {},
      });
      rowsInserted += 1;
    } else {
      rowsUpdated += 1;
    }
    dataset.lastImportBatchId = batch._id;
    for (const [key, value] of Object.entries(payload)) {
      if (SYSTEM_FIELDS.includes(key) || key === 'RollNumber' || isEmptyValue(value)) continue;
      const oldValue = dataset.dynamicFields.get(key);
      if (setIfNonEmpty(Object.fromEntries(dataset.dynamicFields), key, value)) {
        dataset.dynamicFields.set(key, value);
        await recordHistory({ history, datasetId: dataset._id, studentId: student._id, rollNumber, fieldKey: key, oldValue, newValue: value, batch, user, entity: 'AcademicDataset' });
      }
    }
    await dataset.save();
    if (studentWasNew) rowsInserted += 0;
  }
  if (history.length) await DataBankFieldHistory.insertMany(history);
  batch.rowsInserted = rowsInserted;
  batch.rowsUpdated = rowsUpdated;
  batch.rowsSkipped = rowsSkipped;
  batch.columnsAdded = columnChanges.added;
  batch.columnsIgnored = columnChanges.ignored;
  batch.conflicts = analysis.conflicts || [];
  batch.analysis = { ...analysis, committedRows: extracted.rows.length };
  batch.columnMappings = resolvedMappings;
  batch.status = 'COMMITTED';
  batch.committedAt = new Date();
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Import',
    entity: 'DataBankImportBatch',
    entityId: batch._id,
    details: { mode: 'COMMIT_IMPORT', rowsInserted, rowsUpdated, rowsSkipped, columnsAdded: columnChanges.added },
  });
  return batch;
};

const listDatasets = async ({ filters, user }) => {
  const query = {};
  for (const key of ['semester', 'subjectCode', 'classCode', 'datasetType']) {
    if (filters[key]) query[key] = String(filters[key]).trim().toUpperCase();
  }
  if (filters.classId) {
    if (!mongoose.Types.ObjectId.isValid(filters.classId)) {
      const err = new Error('Invalid classId');
      err.statusCode = 400;
      throw err;
    }
    await assertClassAccess(filters.classId, user);
    query.classId = filters.classId;
  } else if (user.role !== 'ADMIN') {
    const accessibleClasses = await Class.find({ lectureId: user._id }).select('_id');
    query.classId = { $in: accessibleClasses.map((cls) => cls._id) };
  }
  if (filters.importBatch) query.lastImportBatchId = filters.importBatch;
  const datasets = await AcademicDataset.find(query)
    .populate('studentId')
    .sort({ semester: -1, subjectCode: 1, classCode: 1, rollNumber: 1 })
    .limit(Math.min(Number(filters.limit || 200), 1000));
  return datasets.filter((d) => !filters.major || d.studentId?.major === String(filters.major).trim().toUpperCase());
};

const buildExportRows = (datasets, selectedColumns, selectedRollNumbers = null) => {
  const columns = selectedColumns?.length ? [...selectedColumns] : ['RollNumber', 'FullName', 'Email', 'Major'];
  if (!columns.includes('RollNumber')) columns.unshift('RollNumber');
  const rowMap = new Map();
  for (const dataset of datasets) {
    const rollNumber = dataset.rollNumber;
    if (!rowMap.has(rollNumber)) {
      const row = Object.fromEntries(columns.map((column) => [column, '']));
      row.RollNumber = rollNumber;
      rowMap.set(rollNumber, row);
    }
    const row = rowMap.get(rollNumber);
    for (const column of columns) {
      if (column === 'RollNumber') row[column] = rollNumber;
      else if (column === 'FullName') row[column] = row[column] || dataset.studentId?.fullName || '';
      else if (column === 'Email') row[column] = row[column] || dataset.studentId?.email || '';
      else if (column === 'Major') row[column] = row[column] || dataset.studentId?.major || '';
      else if ((row[column] === undefined || row[column] === '') && dataset.dynamicFields?.get?.(column) !== undefined) {
        row[column] = dataset.dynamicFields.get(column);
      }
    }
  }
  const rows = [...rowMap.values()];
  if (!Array.isArray(selectedRollNumbers)) return rows;
  const selectedSet = new Set(selectedRollNumbers);
  const order = new Map(selectedRollNumbers.map((rollNumber, index) => [rollNumber, index]));
  return rows
    .filter((row) => selectedSet.has(row.RollNumber))
    .sort((a, b) => (order.get(a.RollNumber) ?? 0) - (order.get(b.RollNumber) ?? 0));
};

const exportWorkbook = async ({ filters, selectedColumns, selectedRollNumbers, headerAliases, user }) => {
  const datasets = await listDatasets({ filters, user });
  const rows = buildExportRows(datasets, selectedColumns, selectedRollNumbers);
  const columns = selectedColumns?.length ? [...selectedColumns] : ['RollNumber', 'FullName', 'Email', 'Major'];
  if (!columns.includes('RollNumber')) columns.unshift('RollNumber');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data Bank Export', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((key) => ({ header: headerAliases?.[key] || key, key, width: Math.max(14, String(headerAliases?.[key] || key).length + 4) }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { ...cell.font, bold: false };
    });
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Export',
    entity: 'AcademicDataset',
    details: { filters, selectedColumns: columns, rowCount: rows.length },
  });
  return { workbook, rowCount: rows.length };
};

const rollbackLatestBatch = async ({ batchId, user, forceSnapshotRestore = false }) => {
  const batch = await DataBankImportBatch.findById(batchId);
  if (!batch) {
    const err = new Error('Import batch not found');
    err.statusCode = 404;
    throw err;
  }
  if (batch.status !== 'COMMITTED') {
    const err = new Error('Only committed batches can be rolled back');
    err.statusCode = 409;
    throw err;
  }
  await assertClassAccess(batch.classId, user);
  const newer = await DataBankImportBatch.findOne({ classId: batch.classId, status: 'COMMITTED', committedAt: { $gt: batch.committedAt } }).sort({ committedAt: -1 });
  if (newer && !(user.role === 'ADMIN' && forceSnapshotRestore)) {
    const err = new Error('Only latest batch can be rolled back. Older rollback requires Admin snapshot restore confirmation.');
    err.statusCode = 409;
    throw err;
  }
  const snapshot = await DataBankSnapshot.findOne({ importBatch: batch._id });
  if (!snapshot) {
    const err = new Error('Snapshot not found; rollback blocked');
    err.statusCode = 409;
    throw err;
  }
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    const rollNumbers = snapshot.scope.rollNumbers || [];
    await AcademicDataset.deleteMany({
      ...(snapshot.scope.fullScope ? {} : { rollNumber: { $in: rollNumbers } }),
      classId: snapshot.scope.classId,
      semester: snapshot.scope.semester,
      subjectCode: snapshot.scope.subjectCode,
      classCode: snapshot.scope.classCode,
      datasetType: snapshot.scope.datasetType,
    }).session(session);
    if (snapshot.studentMasters.length) {
      await StudentMaster.bulkWrite(
        snapshot.studentMasters.map((student) => ({
          replaceOne: {
            filter: { normalizedRollNumber: student.normalizedRollNumber },
            replacement: student,
            upsert: true,
          },
        })),
        { session }
      );
    }
    if (snapshot.academicDatasets.length) await AcademicDataset.insertMany(snapshot.academicDatasets, { session });
    batch.status = 'ROLLED_BACK';
    batch.rolledBackAt = new Date();
    await batch.save({ session });
  });
  await session.endSession();
  await DataBankAuditLog.create({
    user: user._id,
    action: forceSnapshotRestore ? 'Snapshot Restore' : 'Rollback',
    entity: 'DataBankImportBatch',
    entityId: batch._id,
    details: { forceSnapshotRestore },
  });
  return batch;
};

const listImportHistory = async ({ user, limit = 50, classId }) => {
  const query = {};
  if (classId) {
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      const err = new Error('Invalid classId');
      err.statusCode = 400;
      throw err;
    }
    await assertClassAccess(classId, user);
    query.classId = classId;
  } else if (user.role !== 'ADMIN') {
    const accessibleClasses = await Class.find({ lectureId: user._id }).select('_id');
    query.classId = { $in: accessibleClasses.map((cls) => cls._id) };
  }
  return DataBankImportBatch.find(query).populate('uploadedBy', 'name email role').sort({ createdAt: -1 }).limit(Math.min(Number(limit), 200));
};

const listAccessibleClasses = async ({ user }) => {
  const query = user.role === 'ADMIN' ? {} : { lectureId: user._id };
  return Class.find(query)
    .select('classCode subjectCode semester year lectureId status')
    .sort({ year: -1, semester: 1, classIndex: 1 });
};

const createSyncSnapshot = async ({ batch, rollNumbers, user }) => {
  const [studentMasters, academicDatasets] = await Promise.all([
    StudentMaster.find({ normalizedRollNumber: { $in: rollNumbers } }).lean(),
    AcademicDataset.find({ classId: batch.classId, datasetType: batch.datasetType }).lean(),
  ]);
  await DataBankSnapshot.create({
    importBatch: batch._id,
    createdBy: user._id,
    scope: {
      classId: batch.classId,
      semester: batch.semester,
      subjectCode: batch.subjectCode,
      classCode: batch.classCode,
      datasetType: batch.datasetType,
      rollNumbers,
      fullScope: true,
    },
    studentMasters,
    academicDatasets,
  });
};

const upsertStudentMasterFromRoster = async ({ rosterStudent, batch, user, history }) => {
  const rollNumber = normalizeRollNumber(rosterStudent.rollNumber);
  if (!rollNumber) return null;
  let master = await StudentMaster.findOne({ normalizedRollNumber: rollNumber });
  if (!master) master = new StudentMaster({ rollNumber, normalizedRollNumber: rollNumber });
  const masterFields = {
    FullName: ['fullName', rosterStudent.fullName],
    Email: ['email', rosterStudent.email ? String(rosterStudent.email).trim().toLowerCase() : null],
    Major: ['major', rosterStudent.major],
  };
  for (const [fieldKey, [docKey, value]] of Object.entries(masterFields)) {
    if (isEmptyValue(value)) continue;
    const normalizedValue = fieldKey === 'Email'
      ? String(value).trim().toLowerCase()
      : String(value).trim();
    if (stringifyValue(master[docKey]) === stringifyValue(normalizedValue)) continue;
    await recordHistory({
      history,
      studentId: master._id,
      rollNumber,
      fieldKey,
      oldValue: master[docKey],
      newValue: normalizedValue,
      batch,
      user,
      entity: 'StudentMaster',
    });
    master[docKey] = normalizedValue;
  }
  await master.save();
  return master;
};

const syncStudentListDataset = async ({ cls, students, user }) => {
  const rollNumbers = students.map((s) => normalizeRollNumber(s.rollNumber)).filter(Boolean);
  const batch = await DataBankImportBatch.create({
    fileName: `INITIAL_SYNC_${cls.classCode}_STUDENT_LIST`,
    uploadedBy: user._id,
    classId: cls._id,
    sheetName: 'Class Roster',
    headerRow: 1,
    semester: formatSemester(cls),
    subjectCode: cls.subjectCode,
    classCode: cls.classCode,
    datasetType: 'STUDENT_LIST',
    status: 'COMMITTED',
    committedAt: new Date(),
  });
  await createSyncSnapshot({ batch, rollNumbers, user });
  const history = [];
  let inserted = 0;
  let updated = 0;
  for (const rosterStudent of students) {
    const master = await upsertStudentMasterFromRoster({ rosterStudent, batch, user, history });
    if (!master) continue;
    const rollNumber = normalizeRollNumber(rosterStudent.rollNumber);
    let dataset = await AcademicDataset.findOne({ rollNumber, classId: cls._id, datasetType: 'STUDENT_LIST' });
    if (!dataset) {
      dataset = new AcademicDataset({
        studentId: master._id,
        ownerId: cls.lectureId || user._id,
        classId: cls._id,
        rollNumber,
        semester: formatSemester(cls),
        subjectCode: cls.subjectCode,
        classCode: cls.classCode,
        datasetType: 'STUDENT_LIST',
        dynamicFields: {},
      });
      inserted += 1;
    } else {
      updated += 1;
    }
    const fields = {
      MemberCode: rosterStudent.memberCode,
      ProgramGroup: rosterStudent.programGroup,
      SubjectCode: rosterStudent.subjectCode || cls.subjectCode,
    };
    for (const [fieldKey, value] of Object.entries(fields)) {
      const oldValue = dataset.dynamicFields.get(fieldKey);
      if (isEmptyValue(value)) {
        if (isEmptyValue(oldValue)) continue;
        dataset.dynamicFields.delete(fieldKey);
        await recordHistory({ history, datasetId: dataset._id, studentId: master._id, rollNumber, fieldKey, oldValue, newValue: null, batch, user, entity: 'AcademicDataset' });
        continue;
      }
      if (stringifyValue(oldValue) === stringifyValue(value)) continue;
      dataset.dynamicFields.set(fieldKey, value);
      await recordHistory({ history, datasetId: dataset._id, studentId: master._id, rollNumber, fieldKey, oldValue, newValue: value, batch, user, entity: 'AcademicDataset' });
    }
    dataset.lastImportBatchId = batch._id;
    await dataset.save();
  }
  const staleDatasets = await AcademicDataset.find({
    classId: cls._id,
    datasetType: 'STUDENT_LIST',
    rollNumber: { $nin: rollNumbers },
  });
  for (const dataset of staleDatasets) {
    for (const [fieldKey, oldValue] of dataset.dynamicFields.entries()) {
      await recordHistory({
        history,
        datasetId: dataset._id,
        studentId: dataset.studentId,
        rollNumber: dataset.rollNumber,
        fieldKey,
        oldValue,
        newValue: null,
        batch,
        user,
        entity: 'AcademicDataset',
      });
    }
  }
  if (staleDatasets.length) {
    await AcademicDataset.deleteMany({ _id: { $in: staleDatasets.map((dataset) => dataset._id) } });
  }
  if (history.length) await DataBankFieldHistory.insertMany(history);
  batch.rowsInserted = inserted;
  batch.rowsUpdated = updated;
  batch.rowsSkipped = staleDatasets.length;
  batch.analysis = {
    mode: 'INITIAL_SYNC',
    source: 'Student',
    rowsTotal: students.length,
    staleRowsRemoved: staleDatasets.length,
  };
  await batch.save();
  return batch;
};

const syncTeamAssignmentDataset = async ({ cls, students, teams, user }) => {
  const byStudentId = new Map();
  for (const team of teams) {
    for (const member of team.members || []) {
      if (member.studentId) byStudentId.set(member.studentId.toString(), team);
    }
  }
  const rollNumbers = students.map((s) => normalizeRollNumber(s.rollNumber)).filter(Boolean);
  const batch = await DataBankImportBatch.create({
    fileName: `INITIAL_SYNC_${cls.classCode}_TEAM_ASSIGNMENT`,
    uploadedBy: user._id,
    classId: cls._id,
    sheetName: 'Class Teams',
    headerRow: 1,
    semester: formatSemester(cls),
    subjectCode: cls.subjectCode,
    classCode: cls.classCode,
    datasetType: 'TEAM_ASSIGNMENT',
    status: 'COMMITTED',
    committedAt: new Date(),
  });
  await createSyncSnapshot({ batch, rollNumbers, user });
  const history = [];
  let inserted = 0;
  let updated = 0;
  const assignedRollNumbers = [];
  for (const rosterStudent of students) {
    const team = byStudentId.get(rosterStudent._id.toString());
    if (!team) continue;
    const master = await upsertStudentMasterFromRoster({ rosterStudent, batch, user, history });
    if (!master) continue;
    const rollNumber = normalizeRollNumber(rosterStudent.rollNumber);
    assignedRollNumbers.push(rollNumber);
    let dataset = await AcademicDataset.findOne({ rollNumber, classId: cls._id, datasetType: 'TEAM_ASSIGNMENT' });
    if (!dataset) {
      dataset = new AcademicDataset({
        studentId: master._id,
        ownerId: cls.lectureId || user._id,
        classId: cls._id,
        rollNumber,
        semester: formatSemester(cls),
        subjectCode: cls.subjectCode,
        classCode: cls.classCode,
        datasetType: 'TEAM_ASSIGNMENT',
        dynamicFields: {},
      });
      inserted += 1;
    } else {
      updated += 1;
    }
    const fields = {
      TeamName: team.teamName || team.groupName,
      TeamCode: team.teamCode,
      GroupName: team.groupName,
      GroupExe201: team.groupExe201,
      ProjectName: team.projectName,
      Description: team.description,
    };
    for (const [fieldKey, value] of Object.entries(fields)) {
      const oldValue = dataset.dynamicFields.get(fieldKey);
      if (isEmptyValue(value)) {
        if (isEmptyValue(oldValue)) continue;
        dataset.dynamicFields.delete(fieldKey);
        await recordHistory({ history, datasetId: dataset._id, studentId: master._id, rollNumber, fieldKey, oldValue, newValue: null, batch, user, entity: 'AcademicDataset' });
        continue;
      }
      if (stringifyValue(oldValue) === stringifyValue(value)) continue;
      dataset.dynamicFields.set(fieldKey, value);
      await recordHistory({ history, datasetId: dataset._id, studentId: master._id, rollNumber, fieldKey, oldValue, newValue: value, batch, user, entity: 'AcademicDataset' });
    }
    dataset.lastImportBatchId = batch._id;
    await dataset.save();
  }
  const staleDatasets = await AcademicDataset.find({
    classId: cls._id,
    datasetType: 'TEAM_ASSIGNMENT',
    rollNumber: { $nin: assignedRollNumbers },
  });
  for (const dataset of staleDatasets) {
    for (const [fieldKey, oldValue] of dataset.dynamicFields.entries()) {
      await recordHistory({
        history,
        datasetId: dataset._id,
        studentId: dataset.studentId,
        rollNumber: dataset.rollNumber,
        fieldKey,
        oldValue,
        newValue: null,
        batch,
        user,
        entity: 'AcademicDataset',
      });
    }
  }
  if (staleDatasets.length) {
    await AcademicDataset.deleteMany({ _id: { $in: staleDatasets.map((dataset) => dataset._id) } });
  }
  if (history.length) await DataBankFieldHistory.insertMany(history);
  batch.rowsInserted = inserted;
  batch.rowsUpdated = updated;
  batch.rowsSkipped = staleDatasets.length;
  batch.analysis = {
    mode: 'INITIAL_SYNC',
    source: 'Team',
    rowsTotal: students.length,
    teamCount: teams.length,
    staleAssignmentsRemoved: staleDatasets.length,
  };
  await batch.save();
  return batch;
};

const syncClassData = async ({ classId, user }) => {
  await ensureSystemColumns();
  const cls = await assertClassAccess(classId, user);
  const [students, teams] = await Promise.all([
    Student.find({ classId: cls._id }).sort({ fullName: 1 }),
    Team.find({ classId: cls._id }),
  ]);
  const batches = [];
  batches.push(await syncStudentListDataset({ cls, students, user }));
  batches.push(await syncTeamAssignmentDataset({ cls, students, teams, user }));
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Import',
    entity: 'Class',
    entityId: cls._id,
    details: { mode: 'INITIAL_SYNC', studentCount: students.length, teamCount: teams.length, batchIds: batches.map((b) => b._id) },
  });
  return { class: cls, batches, studentCount: students.length, teamCount: teams.length };
};

const upsertTemplate = async ({ id, body, user }) => {
  const payload = {
    name: body.name,
    ownerId: user._id,
    selectedColumns: body.selectedColumns || [],
    columnOrder: body.columnOrder || body.selectedColumns || [],
    headerAliases: body.headerAliases || {},
    filters: body.filters || {},
  };
  let template;
  if (id) {
    template = await DataBankExportTemplate.findOneAndUpdate(
      { _id: id, ...(user.role === 'ADMIN' ? {} : { ownerId: user._id }) },
      payload,
      { new: true, upsert: false }
    );
  } else {
    template = await DataBankExportTemplate.create(payload);
  }
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Template Changes',
    entity: 'DataBankExportTemplate',
    entityId: template?._id,
    details: { name: body.name },
  });
  return template;
};

const createManualBatch = async ({ cls, user, datasetType = 'CUSTOM', fileName }) => {
  assertDatasetType(datasetType);
  return DataBankImportBatch.create({
    fileName,
    uploadedBy: user._id,
    classId: cls._id,
    sheetName: 'Manual Grid Edit',
    headerRow: 1,
    semester: formatSemester(cls),
    subjectCode: cls.subjectCode,
    classCode: cls.classCode,
    datasetType,
    status: 'COMMITTED',
    committedAt: new Date(),
  });
};

const getSystemDocKey = (fieldKey) => {
  const map = { RollNumber: 'rollNumber', FullName: 'fullName', Email: 'email', Major: 'major' };
  return map[fieldKey] || null;
};

const getOrCreateStudentMaster = async ({ rollNumber, values = {} }) => {
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  if (!normalizedRollNumber) {
    const err = new Error('RollNumber is required');
    err.statusCode = 400;
    throw err;
  }
  let student = await StudentMaster.findOne({ normalizedRollNumber });
  if (!student) {
    student = new StudentMaster({ rollNumber: normalizedRollNumber, normalizedRollNumber });
  }
  if (!isEmptyValue(values.FullName) && isEmptyValue(student.fullName)) student.fullName = String(values.FullName).trim();
  if (!isEmptyValue(values.Email) && isEmptyValue(student.email)) student.email = String(values.Email).trim().toLowerCase();
  if (!isEmptyValue(values.Major) && isEmptyValue(student.major)) student.major = String(values.Major).trim().toUpperCase();
  await student.save();
  return student;
};

const getOrCreateDataset = async ({ cls, student, rollNumber, datasetType, ownerId }) => {
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  let dataset = await AcademicDataset.findOne({ rollNumber: normalizedRollNumber, classId: cls._id, datasetType });
  if (!dataset) {
    dataset = new AcademicDataset({
      studentId: student._id,
      ownerId,
      classId: cls._id,
      rollNumber: normalizedRollNumber,
      semester: formatSemester(cls),
      subjectCode: cls.subjectCode,
      classCode: cls.classCode,
      datasetType,
      dynamicFields: {},
    });
  }
  return dataset;
};

const addManualColumn = async ({ classId, fieldKey, displayName, user }) => {
  await assertClassAccess(classId, user);
  const key = toSafeKey(fieldKey || displayName);
  if (!key) {
    const err = new Error('Column key is required');
    err.statusCode = 400;
    throw err;
  }
  if (SYSTEM_FIELDS.includes(key)) {
    const err = new Error('System fields already exist and cannot be recreated');
    err.statusCode = 400;
    throw err;
  }
  const column = await DataBankColumn.findOneAndUpdate(
    { normalizedKey: normalizeColumnKey(key) },
    {
      $setOnInsert: {
        key,
        displayName: displayName || key,
        aliases: [],
        isSystemField: false,
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Column Management',
    entity: 'DataBankColumn',
    entityId: column._id,
    details: { mode: 'ADD_COLUMN', classId, key },
  });
  return column;
};

const addManualRow = async ({ classId, datasetType = 'CUSTOM', values, user }) => {
  const cls = await assertClassAccess(classId, user);
  const rollNumber = normalizeRollNumber(values?.RollNumber);
  const existing = await AcademicDataset.findOne({ rollNumber, classId: cls._id, datasetType });
  if (existing) {
    const err = new Error(`Row ${rollNumber} already exists in ${datasetType}`);
    err.statusCode = 409;
    throw err;
  }
  const batch = await createManualBatch({ cls, user, datasetType, fileName: `MANUAL_ADD_ROW_${rollNumber}` });
  const history = [];
  const student = await getOrCreateStudentMaster({ rollNumber, values });
  const dataset = await getOrCreateDataset({ cls, student, rollNumber, datasetType, ownerId: cls.lectureId || user._id });
  for (const [key, value] of Object.entries(values || {})) {
    if (SYSTEM_FIELDS.includes(key) || key === 'RollNumber' || isEmptyValue(value)) continue;
    dataset.dynamicFields.set(key, value);
    await recordHistory({ history, datasetId: dataset._id, studentId: student._id, rollNumber, fieldKey: key, oldValue: null, newValue: value, batch, user, entity: 'AcademicDataset' });
  }
  dataset.lastImportBatchId = batch._id;
  await dataset.save();
  if (history.length) await DataBankFieldHistory.insertMany(history);
  batch.rowsInserted = 1;
  batch.analysis = { mode: 'MANUAL_ADD_ROW', rollNumber };
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Row Management',
    entity: 'AcademicDataset',
    entityId: dataset._id,
    details: { mode: 'ADD_ROW', classId, datasetType, rollNumber },
  });
  return dataset.populate('studentId');
};

const editManualCell = async ({ classId, rollNumber, fieldKey, value, datasetType = 'CUSTOM', user }) => {
  const cls = await assertClassAccess(classId, user);
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  if (!normalizedRollNumber || !fieldKey) {
    const err = new Error('rollNumber and fieldKey are required');
    err.statusCode = 400;
    throw err;
  }
  if (fieldKey === 'RollNumber') {
    const err = new Error('RollNumber cannot be edited');
    err.statusCode = 400;
    throw err;
  }
  if (isEmptyValue(value)) {
    const err = new Error('Empty edit is blocked. Use Clear Cell for explicit deletion.');
    err.statusCode = 400;
    throw err;
  }
  const batch = await createManualBatch({ cls, user, datasetType, fileName: `MANUAL_EDIT_${normalizedRollNumber}_${fieldKey}` });
  const history = [];
  const student = await getOrCreateStudentMaster({ rollNumber: normalizedRollNumber });
  const systemDocKey = getSystemDocKey(fieldKey);
  if (systemDocKey) {
    const newValue = fieldKey === 'Email' ? String(value).trim().toLowerCase() : String(value).trim();
    await recordHistory({ history, studentId: student._id, rollNumber: normalizedRollNumber, fieldKey, oldValue: student[systemDocKey], newValue, batch, user, entity: 'StudentMaster' });
    student[systemDocKey] = newValue;
    await student.save();
  } else {
    let dataset = await AcademicDataset.findOne({
      rollNumber: normalizedRollNumber,
      classId: cls._id,
      datasetType,
      [`dynamicFields.${fieldKey}`]: { $exists: true },
    });
    if (!dataset) dataset = await getOrCreateDataset({ cls, student, rollNumber: normalizedRollNumber, datasetType, ownerId: cls.lectureId || user._id });
    const oldValue = dataset.dynamicFields.get(fieldKey);
    dataset.dynamicFields.set(fieldKey, value);
    dataset.lastImportBatchId = batch._id;
    await recordHistory({ history, datasetId: dataset._id, studentId: student._id, rollNumber: normalizedRollNumber, fieldKey, oldValue, newValue: value, batch, user, entity: 'AcademicDataset' });
    await dataset.save();
  }
  if (history.length) await DataBankFieldHistory.insertMany(history);
  batch.rowsUpdated = 1;
  batch.analysis = { mode: 'MANUAL_EDIT_CELL', rollNumber: normalizedRollNumber, fieldKey };
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Manual Edit',
    entity: 'AcademicDataset',
    details: { classId, rollNumber: normalizedRollNumber, fieldKey, datasetType },
  });
  return { rollNumber: normalizedRollNumber, fieldKey, value };
};

const editManualCellsBulk = async ({ classId, updates, user }) => {
  const cls = await assertClassAccess(classId, user);
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 1000) {
    const err = new Error('updates must contain between 1 and 1000 cells');
    err.statusCode = 400;
    throw err;
  }

  const normalizedUpdates = updates.map((update) => ({
    rollNumber: normalizeRollNumber(update.rollNumber),
    fieldKey: String(update.fieldKey || '').trim(),
    value: update.value,
    datasetType: String(update.datasetType || 'CUSTOM').trim().toUpperCase(),
  }));
  for (const update of normalizedUpdates) {
    if (!update.rollNumber || !update.fieldKey || update.fieldKey === 'RollNumber' || isEmptyValue(update.value)) {
      const err = new Error('Each update requires rollNumber, editable fieldKey, and a non-empty value');
      err.statusCode = 400;
      throw err;
    }
    assertDatasetType(update.datasetType);
  }

  const batch = await createManualBatch({
    cls,
    user,
    datasetType: normalizedUpdates[0].datasetType,
    fileName: `MANUAL_FILL_${normalizedUpdates[0].fieldKey}_${normalizedUpdates.length}`,
  });
  const history = [];

  for (const update of normalizedUpdates) {
    const student = await getOrCreateStudentMaster({ rollNumber: update.rollNumber });
    const systemDocKey = getSystemDocKey(update.fieldKey);
    if (systemDocKey) {
      const newValue = update.fieldKey === 'Email'
        ? String(update.value).trim().toLowerCase()
        : String(update.value).trim();
      await recordHistory({
        history,
        studentId: student._id,
        rollNumber: update.rollNumber,
        fieldKey: update.fieldKey,
        oldValue: student[systemDocKey],
        newValue,
        batch,
        user,
        entity: 'StudentMaster',
      });
      student[systemDocKey] = newValue;
      await student.save();
      continue;
    }

    let dataset = await AcademicDataset.findOne({
      rollNumber: update.rollNumber,
      classId: cls._id,
      datasetType: update.datasetType,
      [`dynamicFields.${update.fieldKey}`]: { $exists: true },
    });
    if (!dataset) {
      dataset = await getOrCreateDataset({
        cls,
        student,
        rollNumber: update.rollNumber,
        datasetType: update.datasetType,
        ownerId: cls.lectureId || user._id,
      });
    }
    const oldValue = dataset.dynamicFields.get(update.fieldKey);
    dataset.dynamicFields.set(update.fieldKey, update.value);
    dataset.lastImportBatchId = batch._id;
    await recordHistory({
      history,
      datasetId: dataset._id,
      studentId: student._id,
      rollNumber: update.rollNumber,
      fieldKey: update.fieldKey,
      oldValue,
      newValue: update.value,
      batch,
      user,
      entity: 'AcademicDataset',
    });
    await dataset.save();
  }

  if (history.length) await DataBankFieldHistory.insertMany(history);
  batch.rowsUpdated = history.length;
  batch.analysis = {
    mode: 'MANUAL_FILL_CELLS',
    fieldKey: normalizedUpdates[0].fieldKey,
    requestedCells: normalizedUpdates.length,
    updatedCells: history.length,
  };
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Manual Edit',
    entity: 'AcademicDataset',
    details: {
      mode: 'FILL_CELLS',
      classId,
      fieldKey: normalizedUpdates[0].fieldKey,
      requestedCells: normalizedUpdates.length,
      updatedCells: history.length,
    },
  });
  return { requestedCells: normalizedUpdates.length, updatedCells: history.length };
};

const clearManualCell = async ({ classId, rollNumber, fieldKey, datasetType, user }) => {
  const cls = await assertClassAccess(classId, user);
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  if (!normalizedRollNumber || !fieldKey || SYSTEM_FIELDS.includes(fieldKey) || fieldKey === 'RollNumber') {
    const err = new Error('Only dynamic fields can be cleared from the grid');
    err.statusCode = 400;
    throw err;
  }
  const dataset = await AcademicDataset.findOne({
    rollNumber: normalizedRollNumber,
    classId: cls._id,
    ...(datasetType ? { datasetType } : {}),
    [`dynamicFields.${fieldKey}`]: { $exists: true },
  });
  if (!dataset) return { cleared: false };
  const batch = await createManualBatch({ cls, user, datasetType: dataset.datasetType, fileName: `MANUAL_CLEAR_${normalizedRollNumber}_${fieldKey}` });
  const oldValue = dataset.dynamicFields.get(fieldKey);
  dataset.dynamicFields.delete(fieldKey);
  dataset.lastImportBatchId = batch._id;
  await dataset.save();
  await DataBankFieldHistory.create({
    datasetId: dataset._id,
    studentId: dataset.studentId,
    rollNumber: normalizedRollNumber,
    fieldKey,
    oldValue,
    newValue: null,
    importBatch: batch._id,
    importedBy: user._id,
    entity: 'AcademicDataset',
  });
  batch.rowsUpdated = 1;
  batch.analysis = { mode: 'MANUAL_CLEAR_CELL', rollNumber: normalizedRollNumber, fieldKey };
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Manual Delete',
    entity: 'AcademicDataset',
    entityId: dataset._id,
    details: { mode: 'CLEAR_CELL', classId, rollNumber: normalizedRollNumber, fieldKey },
  });
  return { cleared: true };
};

const deleteManualRow = async ({ classId, rollNumber, user }) => {
  const cls = await assertClassAccess(classId, user);
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  const datasets = await AcademicDataset.find({ rollNumber: normalizedRollNumber, classId: cls._id });
  if (!datasets.length) return { deletedCount: 0 };
  const batch = await createManualBatch({ cls, user, datasetType: 'CUSTOM', fileName: `MANUAL_DELETE_ROW_${normalizedRollNumber}` });
  await AcademicDataset.deleteMany({ rollNumber: normalizedRollNumber, classId: cls._id });
  batch.rowsSkipped = datasets.length;
  batch.analysis = { mode: 'MANUAL_DELETE_ROW', rollNumber: normalizedRollNumber, deletedDatasetIds: datasets.map((d) => d._id) };
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Manual Delete',
    entity: 'AcademicDataset',
    details: { mode: 'DELETE_ROW', classId, rollNumber: normalizedRollNumber, deletedCount: datasets.length },
  });
  return { deletedCount: datasets.length };
};

const deleteManualColumn = async ({ classId, fieldKey, user }) => {
  const cls = await assertClassAccess(classId, user);
  if (!fieldKey || SYSTEM_FIELDS.includes(fieldKey) || fieldKey === 'RollNumber') {
    const err = new Error('System fields cannot be deleted');
    err.statusCode = 400;
    throw err;
  }
  const normalizedFieldKey = normalizeColumnKey(fieldKey);
  const datasets = await AcademicDataset.find({ classId: cls._id, [`dynamicFields.${fieldKey}`]: { $exists: true } });
  const batch = await createManualBatch({ cls, user, datasetType: 'CUSTOM', fileName: `MANUAL_DELETE_COLUMN_${fieldKey}` });
  const history = [];
  for (const dataset of datasets) {
    const oldValue = dataset.dynamicFields.get(fieldKey);
    dataset.dynamicFields.delete(fieldKey);
    dataset.lastImportBatchId = batch._id;
    await dataset.save();
    history.push({
      datasetId: dataset._id,
      studentId: dataset.studentId,
      rollNumber: dataset.rollNumber,
      fieldKey,
      oldValue,
      newValue: null,
      importBatch: batch._id,
      importedBy: user._id,
      entity: 'AcademicDataset',
    });
  }
  if (history.length) await DataBankFieldHistory.insertMany(history);
  const deletedColumn = await DataBankColumn.findOneAndDelete({
    normalizedKey: normalizedFieldKey,
    isSystemField: false,
  });
  const templates = await DataBankExportTemplate.find({
    ownerId: user._id,
    'filters.classId': classId.toString(),
    $or: [
      { selectedColumns: fieldKey },
      { columnOrder: fieldKey },
      { [`headerAliases.${fieldKey}`]: { $exists: true } },
    ],
  });
  for (const template of templates) {
    template.selectedColumns = template.selectedColumns.filter((key) => key !== fieldKey);
    template.columnOrder = template.columnOrder.filter((key) => key !== fieldKey);
    if (template.headerAliases instanceof Map) template.headerAliases.delete(fieldKey);
    else if (template.headerAliases) delete template.headerAliases[fieldKey];
    await template.save();
  }
  batch.rowsUpdated = datasets.length;
  batch.analysis = {
    mode: 'MANUAL_DELETE_COLUMN',
    fieldKey,
    affectedRows: datasets.length,
    columnDefinitionDeleted: Boolean(deletedColumn),
    templatesUpdated: templates.length,
  };
  await batch.save();
  await DataBankAuditLog.create({
    user: user._id,
    action: 'Column Management',
    entity: 'AcademicDataset',
    entityId: deletedColumn?._id,
    details: {
      mode: 'DELETE_COLUMN_PERMANENTLY',
      classId,
      fieldKey,
      affectedRows: datasets.length,
      columnDefinitionDeleted: Boolean(deletedColumn),
      templatesUpdated: templates.length,
    },
  });
  return {
    affectedRows: datasets.length,
    columnDefinitionDeleted: Boolean(deletedColumn),
    templatesUpdated: templates.length,
  };
};

const getBatchIdsForClass = async (classId) => {
  const batches = await DataBankImportBatch.find({ classId }).select('_id');
  return batches.map((batch) => batch._id);
};

module.exports = {
  DATASET_TYPES,
  SYSTEM_FIELDS,
  getColumns,
  buildExportRows,
  parseWorkbook,
  createPreview,
  commitImport,
  listDatasets,
  listAccessibleClasses,
  syncClassData,
  exportWorkbook,
  listImportHistory,
  rollbackLatestBatch,
  upsertTemplate,
  addManualColumn,
  addManualRow,
  editManualCell,
  editManualCellsBulk,
  clearManualCell,
  deleteManualRow,
  deleteManualColumn,
  assertClassAccess,
  getBatchIdsForClass,
};
