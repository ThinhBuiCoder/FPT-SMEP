// src/services/studentImport.service.js
// Parses an Excel file and bulk-imports students into a class.

const XLSX = require('xlsx');
const Student = require('../models/Student');
const User    = require('../models/User');
const Class   = require('../models/Class');
const { getProgramGroupFromMajor } = require('../constants/majors');

// ─── Excel Parsing ─────────────────────────────────────────────────────────────

// Required columns (case-insensitive header matching)
// Major is NOT required
const REQUIRED_COLS = ['rollnumber', 'fullname', 'email'];

const normalizeHeader = (h) => {
  const normalized = String(h).trim().toLowerCase().replace(/\s+/g, '');
  if (['chuyênngành', 'chuyennganh', 'major'].includes(normalized)) return 'major';
  // Outcome columns: "Outcome 1" → "outcome1", "Outcome 1_Comment" → "outcome1_comment"
  const outcomeMatch = normalized.match(/^outcome(\d+)_?comment$/);
  if (outcomeMatch) return `outcome${outcomeMatch[1]}_comment`;
  const outcomeNumMatch = normalized.match(/^outcome(\d+)$/);
  if (outcomeNumMatch) return `outcome${outcomeNumMatch[1]}`;
  if (normalized === 'examdate')  return 'examdate';
  if (normalized === 'examnote')  return 'examnote';
  if (normalized === 'membercode') return 'membercode';
  if (normalized === 'class')     return 'class'; // read but ignored
  return normalized;
};

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

  return null;
};

/**
 * Parse Excel buffer and return array of row objects with normalized keys.
 * Expected columns: RollNumber, MemberCode, LastName, MiddleName, FirstName, UrlPreImg, Fullname, Email
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

  // --- Find Target Class & Same Semester Classes ---
  const targetClass = await Class.findById(classId);
  if (!targetClass) {
    throw new Error('Target class not found');
  }

  const sameSemesterClasses = await Class.find({
    semester: targetClass.semester,
    year: targetClass.year
  }).select('_id classCode');
  
  const sameSemesterClassIds = sameSemesterClasses.map(c => c._id);

  const incomingEmails = rows.map(r => r.email ? String(r.email).toLowerCase() : '').filter(Boolean);
  const incomingRolls = rows.map(r => r.rollnumber ? String(r.rollnumber).trim().toUpperCase() : '').filter(Boolean);

  // --- Pre-fetch existing students in SAME SEMESTER matching incoming data ---
  let existingStudentsInSemester = [];
  if (incomingEmails.length > 0 || incomingRolls.length > 0) {
    const orConditions = [];
    if (incomingEmails.length > 0) orConditions.push({ email: { $in: incomingEmails } });
    if (incomingRolls.length > 0) orConditions.push({ rollNumber: { $in: incomingRolls } });

    existingStudentsInSemester = await Student.find({
      classId: { $in: sameSemesterClassIds },
      $or: orConditions
    }).populate('classId', 'classCode');
  }

  const sameSemesterRollMap = new Map();
  const sameSemesterEmailMap = new Map();
  for (const s of existingStudentsInSemester) {
    sameSemesterRollMap.set(s.rollNumber.toUpperCase(), s);
    sameSemesterEmailMap.set(s.email.toLowerCase(), s);
  }

  // --- Pre-fetch Users matching incoming emails ---
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
    
    const existingUser = userMap.get(emailLower);
    
    let major = null;
    let programGroup = null;
    
    if (row.major && typeof row.major === 'string') {
      major = row.major.trim().toUpperCase();
      programGroup = getProgramGroupFromMajor(major);
    } else if (existingUser) {
      major = existingUser.major;
      programGroup = existingUser.programGroup;
    }

    // Check duplicate rollNumber in same semester
    const enrolledByRoll = sameSemesterRollMap.get(rollUpper);
    if (enrolledByRoll) {
      if (enrolledByRoll.classId._id.toString() === classId.toString()) {
        // Exists in THIS class
        if (enrolledByRoll.major !== major || enrolledByRoll.programGroup !== programGroup) {
          updatesToExecute.push({
            updateOne: {
              filter: { _id: enrolledByRoll._id },
              update: { $set: { major, programGroup } }
            }
          });
          enrolledByRoll.major = major; // update local cache
          enrolledByRoll.programGroup = programGroup;
        }
        errors.push({ row: rowNum, reason: `RollNumber "${rollUpper}" already exists in this class (major updated to ${major})` });
      } else {
        // Exists in ANOTHER class in the SAME semester
        errors.push({ row: rowNum, reason: `RollNumber "${rollUpper}" is already enrolled in class ${enrolledByRoll.classId.classCode} in the same semester` });
      }
      continue;
    }

    // Check duplicate email in same semester
    const enrolledByEmail = sameSemesterEmailMap.get(emailLower);
    if (enrolledByEmail) {
      if (enrolledByEmail.classId._id.toString() === classId.toString()) {
        // Exists in THIS class
        if (enrolledByEmail.major !== major || enrolledByEmail.programGroup !== programGroup) {
          updatesToExecute.push({
            updateOne: {
              filter: { _id: enrolledByEmail._id },
              update: { $set: { major, programGroup } }
            }
          });
          enrolledByEmail.major = major; // update local cache
          enrolledByEmail.programGroup = programGroup;
        }
        errors.push({ row: rowNum, reason: `Email "${emailLower}" already exists in this class (major updated to ${major})` });
      } else {
        // Exists in ANOTHER class in the SAME semester
        errors.push({ row: rowNum, reason: `Email "${emailLower}" is already enrolled in class ${enrolledByEmail.classId.classCode} in the same semester` });
      }
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
    if (existingUser) {
      linkedUserId = existingUser._id;
      avatarUrl = existingUser.avatar || null;
    }

    // Parse examDate (support formats like MM/DD/YYYY or YYYY-MM-DD)
    let examDate = null;
    if (row.examdate) {
      const parsed = new Date(row.examdate);
      if (!isNaN(parsed.getTime())) examDate = parsed;
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
      programGroup,
      major,
      subjectCode: row.subjectcode ? String(row.subjectcode).trim().toUpperCase() : null,
      classId,
      userId:    linkedUserId,
      avatarUrl,
      // Exam & Outcome fields
      examDate,
      examNote:        row.examnote        || null,
      outcome1:        row.outcome1        || null,
      outcome1Comment: row['outcome1_comment'] || null,
      outcome2:        row.outcome2        || null,
      outcome2Comment: row['outcome2_comment'] || null,
      outcome3:        row.outcome3        || null,
      outcome3Comment: row['outcome3_comment'] || null,
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

module.exports = { parseExcel, importStudents };
