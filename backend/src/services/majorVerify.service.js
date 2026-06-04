// src/services/majorVerify.service.js
// Parse Excel file and cross-check student majors against DB records.

const XLSX = require('xlsx');
const Student = require('../models/Student');

/**
 * Normalize a header cell to a consistent key.
 */
const normalizeHeader = (h) => {
  // Convert to string, normalize Unicode, trim, lowercase, remove all whitespace
  let s = String(h).normalize('NFC').trim().toLowerCase().replace(/\s+/g, '');
  
  // Remove Vietnamese accents for robust matching
  const noAccent = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

  if (['chuyennganh', 'major', 'chuyenganh'].includes(noAccent) || ['chuyênngành'].includes(s)) return 'major';
  if (['id', 'rollnumber', 'mssv', 'studentid'].includes(noAccent)) return 'id';
  if (['email'].includes(noAccent)) return 'email';
  if (['fullname', 'hovaten', 'hoten', 'name'].includes(noAccent)) return 'fullname';
  if (['class', 'lop'].includes(noAccent)) return 'class';
  return noAccent;
};

/**
 * Parse the Excel buffer and return rows with normalized keys.
 * At minimum expects columns: id (rollNumber) OR email, AND major.
 */
const parseVerifyExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { rows: [], error: 'Excel file is empty' };

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length < 2)
      return { rows: [], error: 'No data rows found. File must have a header row + at least 1 data row.' };

    const rawHeaders = rawRows[0].map(normalizeHeader);

    // Must have at least one identifier and a major column
    const hasMajor = rawHeaders.includes('major');
    const hasId    = rawHeaders.includes('id');
    const hasEmail = rawHeaders.includes('email');

    if (!hasMajor)
      return { rows: [], error: 'Missing required column: "Chuyên ngành" / "Major"' };
    if (!hasId && !hasEmail)
      return { rows: [], error: 'Missing required column: "ID" (RollNumber) or "Email"' };

    const rows = rawRows
      .slice(1)
      .map((rawRow) => {
        const obj = {};
        rawHeaders.forEach((h, idx) => { obj[h] = String(rawRow[idx] ?? '').trim(); });
        return obj;
      })
      .filter((obj) => obj.id || obj.email); // at least one identifier

    if (rows.length === 0)
      return { rows: [], error: 'All data rows are empty' };

    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: `Failed to parse Excel: ${err.message}` };
  }
};

/**
 * Main verify function.
 * Parses the Excel file and compares each student's major to the DB.
 *
 * @param {Buffer}   buffer  - raw Excel buffer
 * @param {ObjectId} classId - class to verify against
 * @returns {object} verification report
 */
const verifyMajors = async (buffer, classId) => {
  const { rows, error } = parseVerifyExcel(buffer);
  if (error) throw new Error(error);

  // Load all students in the class once
  const classStudents = await Student.find({ classId }).lean();

  // Build lookup maps
  const byRoll  = new Map();
  const byEmail = new Map();
  for (const s of classStudents) {
    if (s.rollNumber) byRoll.set(s.rollNumber.toUpperCase(), s);
    if (s.email)      byEmail.set(s.email.toLowerCase(), s);
  }

  const matched    = []; // major in file === major in DB
  const mismatched = []; // major in file !== major in DB
  const missing    = []; // student found but no major in DB yet
  const notFound   = []; // rollNumber/email not in this class

  for (const row of rows) {
    const rollKey  = row.id    ? row.id.trim().toUpperCase()    : null;
    const emailKey = row.email ? row.email.trim().toLowerCase() : null;
    const majorInFile = row.major ? row.major.trim().toUpperCase() : null;

    // Find the student record
    let student = null;
    if (rollKey)  student = byRoll.get(rollKey);
    if (!student && emailKey) student = byEmail.get(emailKey);

    const entry = {
      rollNumber:   row.id       || '—',
      email:        row.email    || '—',
      fullName:     row.fullname || student?.fullName || '—',
      majorInFile,
      majorInDB:    student?.major || null,
      studentId:    student?._id?.toString() || null,
    };

    if (!student) {
      notFound.push(entry);
      continue;
    }

    const majorInDB = student.major ? student.major.toUpperCase() : null;

    if (!majorInDB) {
      missing.push(entry);
    } else if (majorInDB === majorInFile) {
      matched.push(entry);
    } else {
      mismatched.push(entry);
    }
  }

  return {
    totalRows:  rows.length,
    matched,
    mismatched,
    missing,
    notFound,
    summary: {
      matched:    matched.length,
      mismatched: mismatched.length,
      missing:    missing.length,
      notFound:   notFound.length,
    },
  };
};

module.exports = { verifyMajors };
