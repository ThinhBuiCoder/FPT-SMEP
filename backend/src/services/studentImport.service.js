// src/services/studentImport.service.js
// Parses an Excel file and bulk-imports students into a class.
// Major is auto-parsed from the first 2 letters of RollNumber.

const XLSX = require('xlsx');
const Student = require('../models/Student');
const User    = require('../models/User');

// ─── Major Helper ──────────────────────────────────────────────────────────────

/**
 * Extract the 2-letter major code from a RollNumber.
 * Examples:
 *   DE170600 => "DE"
 *   SE170601 => "SE"
 *   IA180999 => "IA"
 *
 * @param {string} rollNumber
 * @returns {string} 2-letter uppercase major code
 * @throws {Error} if rollNumber is missing or doesn't start with 2 letters
 */
function getMajorFromRollNumber(rollNumber) {
  if (!rollNumber || typeof rollNumber !== 'string') {
    throw new Error('RollNumber is required');
  }

  const normalized = rollNumber.trim().toUpperCase();
  const match = normalized.match(/^[A-Z]{2}/);

  if (!match) {
    throw new Error('Invalid RollNumber format, cannot detect major');
  }

  return match[0];
}

// ─── Excel Parsing ─────────────────────────────────────────────────────────────

// Required columns (case-insensitive header matching)
// Major is NOT required — it is auto-parsed from RollNumber
const REQUIRED_COLS = ['rollnumber', 'fullname', 'email'];

const normalizeHeader = (h) => String(h).trim().toLowerCase().replace(/\s+/g, '');

/**
 * Validate a single row object.
 * @returns {string|null} error message or null if valid
 */
const validateRow = (row) => {
  if (!row.rollnumber) return 'RollNumber is required';
  if (!row.fullname)   return 'FullName is required';
  if (!row.email)      return 'Email is required';

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(row.email)) return `Email "${row.email}" is invalid`;

  // Validate RollNumber format for major extraction
  try {
    getMajorFromRollNumber(row.rollnumber);
  } catch (e) {
    return e.message;
  }

  return null;
};

/**
 * Parse Excel buffer and return array of row objects with normalized keys.
 * Expected columns: RollNumber, MemberCode, LastName, MiddleName, FirstName, UrlPreImg, Fullname, Email
 * Major column is NOT expected — auto-parsed from RollNumber.
 *
 * @param {Buffer} buffer
 * @returns {{ headers: string[], rows: object[], error: string|null }}
 */
const parseExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { headers: [], rows: [], error: 'Excel file is empty' };

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length < 2)
      return { headers: [], rows: [], error: 'No data rows found. File must have a header row + at least 1 data row.' };

    const rawHeaders = rawRows[0].map(normalizeHeader);

    // Validate required columns exist
    for (const req of REQUIRED_COLS) {
      if (!rawHeaders.includes(req)) {
        return {
          headers: rawHeaders,
          rows: [],
          error: `Missing required column: "${req}". Found columns: ${rawHeaders.join(', ')}`,
        };
      }
    }

    // Filter out completely empty rows
    const rows = rawRows
      .slice(1)
      .map((rawRow) => {
        const obj = {};
        rawHeaders.forEach((h, idx) => { obj[h] = String(rawRow[idx] ?? '').trim(); });
        return obj;
      })
      .filter((obj) => obj.rollnumber || obj.email || obj.fullname);

    if (rows.length === 0)
      return { headers: rawHeaders, rows: [], error: 'All data rows are empty' };

    return { headers: rawHeaders, rows, error: null };
  } catch (err) {
    return {
      headers: [],
      rows: [],
      error: `Failed to parse Excel file. Make sure it is a valid .xlsx or .xls file. (${err.message})`,
    };
  }
};

// ─── Import Logic ──────────────────────────────────────────────────────────────

/**
 * Import students from Excel buffer into a class.
 * Major is auto-parsed from the first 2 letters of RollNumber.
 * If a User with matching email already exists, links the student to that User.
 * UrlPreImg column is read but NOT used.
 *
 * @param {Buffer}   buffer  - raw Excel file buffer
 * @param {ObjectId} classId - target class
 * @returns {object} import result summary
 */
const importStudents = async (buffer, classId) => {
  const { rows, error } = parseExcel(buffer);

  if (error) {
    throw new Error(error);
  }

  const totalRows = rows.length;
  let successCount = 0;
  const errors = [];
  const imported = [];
  
  if (totalRows === 0) {
    return { totalRows, successCount, failedCount: 0, errors, imported };
  }

  // --- Pre-fetch existing students for this class ---
  const existingStudents = await Student.find({ classId });
  const rollMap = new Map();
  const emailMap = new Map();
  for (const s of existingStudents) {
    rollMap.set(s.rollNumber.toUpperCase(), s);
    emailMap.set(s.email.toLowerCase(), s);
  }

  // --- Pre-fetch Users matching incoming emails ---
  const incomingEmails = rows.map(r => r.email ? String(r.email).toLowerCase() : '').filter(Boolean);
  const existingUsers = await User.find({ email: { $in: incomingEmails } });
  const userMap = new Map();
  for (const u of existingUsers) {
    userMap.set(u.email.toLowerCase(), u);
  }

  const studentsToInsert = [];
  const updatesToExecute = [];
  // Keep track of what we're inserting in this batch to avoid duplicates within the file itself
  const pendingRolls = new Set();
  const pendingEmails = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, offset by header row

    // --- Validate ---
    const validationError = validateRow(row);
    if (validationError) {
      errors.push({ row: rowNum, reason: validationError });
      continue;
    }

    const emailLower = row.email.toLowerCase();
    const rollUpper  = row.rollnumber.trim().toUpperCase();
    
    // Parse major from RollNumber
    let major;
    try {
      major = getMajorFromRollNumber(rollUpper);
    } catch (e) {
      errors.push({ row: rowNum, reason: e.message });
      continue;
    }

    // Check duplicate rollNumber within this class
    const existsByRoll = rollMap.get(rollUpper);
    if (existsByRoll) {
      // Update major if it changed or was missing
      if (!existsByRoll.major || existsByRoll.major !== major) {
        updatesToExecute.push({
          updateOne: {
            filter: { _id: existsByRoll._id },
            update: { $set: { major } }
          }
        });
        existsByRoll.major = major; // update local cache
      }
      errors.push({ row: rowNum, reason: `RollNumber "${rollUpper}" already exists in this class (major updated to ${major})` });
      continue;
    }

    // Check duplicate email within this class
    const existsByEmail = emailMap.get(emailLower);
    if (existsByEmail) {
      // Update major if needed
      if (!existsByEmail.major || existsByEmail.major !== major) {
        updatesToExecute.push({
          updateOne: {
            filter: { _id: existsByEmail._id },
            update: { $set: { major } }
          }
        });
        existsByEmail.major = major; // update local cache
      }
      errors.push({ row: rowNum, reason: `Email "${emailLower}" already exists in this class (major updated to ${major})` });
      continue;
    }

    // Check for duplicates within the current upload file
    if (pendingRolls.has(rollUpper)) {
       errors.push({ row: rowNum, reason: `Duplicate RollNumber "${rollUpper}" within the Excel file` });
       continue;
    }
    if (pendingEmails.has(emailLower)) {
       errors.push({ row: rowNum, reason: `Duplicate Email "${emailLower}" within the Excel file` });
       continue;
    }

    // Link to existing User account if one exists
    let linkedUserId = null;
    let avatarUrl = null;
    const existingUser = userMap.get(emailLower);
    if (existingUser) {
      linkedUserId = existingUser._id;
      avatarUrl = existingUser.avatar || null;
    }

    // Build student document
    const studentData = {
      rollNumber: rollUpper,
      memberCode: row.membercode || null,
      lastName:   row.lastname   || '',
      middleName: row.middlename || '',
      firstName:  row.firstname  || '',
      fullName:   row.fullname,
      email:      emailLower,
      major,
      classId,
      userId:    linkedUserId,
      avatarUrl,
    };

    studentsToInsert.push(studentData);
    pendingRolls.add(rollUpper);
    pendingEmails.add(emailLower);
  }

  // Execute bulk update for majors if needed
  if (updatesToExecute.length > 0) {
    try {
      await Student.bulkWrite(updatesToExecute);
    } catch (err) {
      console.error('Failed to bulk update existing student majors:', err);
    }
  }

  // Execute bulk insert for new students
  if (studentsToInsert.length > 0) {
    try {
      const inserted = await Student.insertMany(studentsToInsert, { ordered: false });
      imported.push(...inserted);
      successCount = inserted.length;
    } catch (dbErr) {
      // If ordered: false fails, it still inserts valid ones, but throws an error.
      // The inserted docs are in err.insertedDocs
      if (dbErr.code === 11000 || dbErr.name === 'MongoBulkWriteError') {
        const actuallyInserted = dbErr.insertedDocs || [];
        imported.push(...actuallyInserted);
        successCount = actuallyInserted.length;
        
        // Find which ones failed
        const failedCount = studentsToInsert.length - successCount;
        errors.push({ row: 'N/A', reason: `Database bulk insertion failed for ${failedCount} row(s) (likely duplicate constraints)` });
      } else {
        throw new Error(`Database error during bulk insert: ${dbErr.message}`);
      }
    }
  }

  return {
    totalRows,
    successCount,
    failedCount: errors.length,
    errors,
    imported,
  };
};

module.exports = { parseExcel, importStudents, getMajorFromRollNumber };
