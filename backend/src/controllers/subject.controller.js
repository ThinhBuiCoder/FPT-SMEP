// src/controllers/subject.controller.js
const Subject = require('../models/Subject');
const SystemSetting = require('../models/SystemSetting');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * GET /api/subjects
 * Get all subjects with optional search and status filtering
 */
exports.getSubjects = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { subjectCode: { $regex: search, $options: 'i' } },
        { subjectName: { $regex: search, $options: 'i' } },
      ];
    }

    const subjects = await Subject.find(query).sort({ subjectCode: 1 });
    return successResponse(res, { subjects }, 'Subjects retrieved successfully');
  } catch (err) {
    console.error('getSubjects error:', err);
    return errorResponse(res, 'Failed to retrieve subjects', 500);
  }
};

/**
 * GET /api/subjects/active
 * Get active subjects for dropdowns and selectors
 */
exports.getActiveSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ status: 'active' }).sort({ subjectCode: 1 });
    return successResponse(res, { subjects }, 'Active subjects retrieved successfully');
  } catch (err) {
    console.error('getActiveSubjects error:', err);
    return errorResponse(res, 'Failed to retrieve active subjects', 500);
  }
};

/**
 * POST /api/subjects
 * Create a new subject
 */
exports.createSubject = async (req, res) => {
  try {
    const { subjectCode, subjectName, status } = req.body;

    if (!subjectCode || !subjectCode.trim()) {
      return errorResponse(res, 'Subject code is required', 400);
    }
    if (!subjectName || !subjectName.trim()) {
      return errorResponse(res, 'Subject name is required', 400);
    }

    const normalizedCode = subjectCode.trim().toUpperCase();

    // Check duplicate code
    const existing = await Subject.findOne({ subjectCode: normalizedCode });
    if (existing) {
      return errorResponse(res, 'Subject code already exists.', 400);
    }

    const subject = await Subject.create({
      subjectCode: normalizedCode,
      subjectName: subjectName.trim(),
      status: status || 'active',
    });

    return successResponse(res, { subject }, 'Subject created successfully', 201);
  } catch (err) {
    console.error('createSubject error:', err);
    if (err.code === 11000) {
      return errorResponse(res, 'Subject code already exists.', 400);
    }
    return errorResponse(res, 'Failed to create subject', 500);
  }
};

/**
 * PUT /api/subjects/:id
 * Update an existing subject's details (except subjectCode)
 */
exports.updateSubject = async (req, res) => {
  try {
    const { subjectCode, subjectName, status } = req.body;
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return errorResponse(res, 'Subject not found', 404);
    }

    // Business rule: Do not allow modifying subjectCode
    if (subjectCode && subjectCode.trim().toUpperCase() !== subject.subjectCode) {
      return errorResponse(res, 'Subject code cannot be changed after creation.', 400);
    }

    if (subjectName !== undefined) {
      if (!subjectName.trim()) {
        return errorResponse(res, 'Subject name cannot be empty', 400);
      }
      subject.subjectName = subjectName.trim();
    }

    if (status !== undefined) {
      if (!['active', 'disabled'].includes(status)) {
        return errorResponse(res, 'Invalid status value', 400);
      }
      subject.status = status;
    }

    await subject.save();
    return successResponse(res, { subject }, 'Subject updated successfully');
  } catch (err) {
    console.error('updateSubject error:', err);
    return errorResponse(res, 'Failed to update subject', 500);
  }
};

/**
 * DELETE /api/subjects/:id
 * Soft disable a subject (mark as disabled)
 */
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);

    if (!subject) {
      return errorResponse(res, 'Subject not found', 404);
    }

    subject.status = 'disabled';
    await subject.save();

    return successResponse(res, { subject }, 'Subject disabled successfully');
  } catch (err) {
    console.error('deleteSubject error:', err);
    return errorResponse(res, 'Failed to disable subject', 500);
  }
};

/**
 * GET /api/subjects/current-semester
 * Get active semester config + available year options based on current month
 */
exports.getCurrentSemester = async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ key: 'current_semester' });
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed

    const defaultVal = { semester: 'SP', year: currentYear };
    const currentSemester = setting ? setting.value : defaultVal;

    // In December (month 12), admins may also plan for next year
    const availableYears = [currentYear];
    if (currentMonth === 12) {
      availableYears.push(currentYear + 1);
    }

    return successResponse(res, {
      currentSemester,
      availableYears,
      isDecember: currentMonth === 12,
    }, 'Current semester configuration retrieved');
  } catch (err) {
    console.error('getCurrentSemester error:', err);
    return errorResponse(res, 'Failed to retrieve current semester config', 500);
  }
};

/**
 * POST /api/subjects/current-semester
 * Update active semester config.
 * Year rules:
 *   - Current year: always allowed.
 *   - Next year:    allowed ONLY if current month is December.
 */
exports.updateCurrentSemester = async (req, res) => {
  try {
    const { semester, year } = req.body;

    if (!semester || !['SP', 'SU', 'FA'].includes(semester.toUpperCase())) {
      return errorResponse(res, 'Invalid semester value. Must be SP, SU or FA.', 400);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const nextYear = currentYear + 1;

    // Determine the target year
    let targetYear = currentYear;
    if (year !== undefined) {
      const parsedYear = parseInt(year, 10);
      if (isNaN(parsedYear)) {
        return errorResponse(res, 'Invalid year value.', 400);
      }
      if (parsedYear === currentYear) {
        targetYear = currentYear;
      } else if (parsedYear === nextYear && currentMonth === 12) {
        targetYear = nextYear;
      } else {
        const msg = currentMonth === 12
          ? `Year must be ${currentYear} or ${nextYear} in December.`
          : `Year must be ${currentYear}. Next year can only be selected in December.`;
        return errorResponse(res, msg, 400);
      }
    }

    const configValue = {
      semester: semester.toUpperCase(),
      year: targetYear,
    };

    const setting = await SystemSetting.findOneAndUpdate(
      { key: 'current_semester' },
      { value: configValue },
      { upsert: true, new: true }
    );

    return successResponse(res, { currentSemester: setting.value }, 'Current semester updated successfully');
  } catch (err) {
    console.error('updateCurrentSemester error:', err);
    return errorResponse(res, 'Failed to update current semester', 500);
  }
};
