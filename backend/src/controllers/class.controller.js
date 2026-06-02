// src/controllers/class.controller.js — Full Class Management (Module 2)
const mongoose = require('mongoose');
const Class   = require('../models/Class');
const Student = require('../models/Student');
const Team    = require('../models/Team');
const User    = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { importStudents }  = require('../services/studentImport.service');
const { sendClassCreatedNotification, sendStudentImportedNotification } = require('../services/email.service');
const { autoGenerateSchedule, validateScheduleConflict } = require('../services/schedule.service');
const { createOrUpdateChatGroupForClass } = require('../services/chatGroup.service');
const { verifyMajors } = require('../services/majorVerify.service');
const { getProgramGroupFromMajor } = require('../constants/majors');
const multer  = require('multer');
const ExcelJS = require('exceljs');
// ─── Multer: memory storage for Excel parsing ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are accepted'), false);
    }
  },
});
exports.uploadMiddleware = upload.single('file');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Determine which semesters a LECTURER can see.
 * Currently active semester + 2 most recent.
 * Simplified: we just return the 3 latest distinct (semester,year) combos.
 */
const getLecturerSemesterFilter = async (lecturerId) => {
  // Cast to ObjectId for aggregation pipeline (aggregation doesn't auto-cast)
  const lecturerOid = new mongoose.Types.ObjectId(lecturerId);
  const distinct = await Class.aggregate([
    { $match: { lectureId: lecturerOid } },
    { $group: { _id: { semester: '$semester', year: '$year' } } },
    { $sort: { '_id.year': -1, '_id.semester': -1 } },
    { $limit: 3 },
  ]);
  if (distinct.length === 0) return null;
  return distinct.map(d => ({ semester: d._id.semester, year: d._id.year }));
};

// ─── POST /api/classes/bulk-create ────────────────────────────────────────────
exports.bulkCreateClasses = async (req, res) => {
  const { subjectCode, count, numberOfClasses, semester, year, lecturerIds, lectureId, mentorIds } = req.body;
  const isLecturer = req.user.role === 'LECTURER' || req.user.role === 'LECTURE';

  // --- Validate inputs ---
  if (!subjectCode) return errorResponse(res, 'subjectCode is required', 400);
  if (!['EXE101', 'EXE201'].includes(subjectCode?.toUpperCase()))
    return errorResponse(res, 'subjectCode must be EXE101 or EXE201', 400);
  if (!semester || !['SP', 'SU', 'FA'].includes(semester?.toUpperCase()))
    return errorResponse(res, 'semester must be SP, SU or FA', 400);
  const numCount = parseInt(count || numberOfClasses, 10);
  if (!numCount || numCount < 1 || numCount > 100)
    return errorResponse(res, 'count must be between 1 and 100', 400);
  const numYear = parseInt(year, 10);
  if (!numYear || numYear < 2020 || numYear > 2100)
    return errorResponse(res, 'Invalid year', 400);

  const semUpper = semester.toUpperCase();
  const subjectUpper = subjectCode.toUpperCase();

  // Validate lecturers
  // If the requester IS a LECTURER, ignore body lecturerIds and auto-assign to themselves.
  const validLecturerIds = [];
  if (isLecturer) {
    validLecturerIds.push(req.user._id.toString());
  } else {
    const incomingLecturers = Array.isArray(lecturerIds) ? lecturerIds : (lectureId ? [lectureId] : []);
    if (incomingLecturers.length > 0) {
      const uniqueLecturerIds = [...new Set(incomingLecturers.filter(Boolean))];
      const lecturers = await User.find({ _id: { $in: uniqueLecturerIds } });
      if (lecturers.length !== uniqueLecturerIds.length) {
        return errorResponse(res, 'One or more lecturer IDs are invalid', 400);
      }
      for (const lect of lecturers) {
        if (lect.role !== 'LECTURER' && lect.role !== 'LECTURE') {
          return errorResponse(res, `User ${lect.name} is not a LECTURER`, 400);
        }
        validLecturerIds.push(lect._id.toString());
      }
    }
  }

  // Optionally validate mentors
  const uniqueMentorIds = Array.isArray(mentorIds) ? [...new Set(mentorIds.filter(Boolean))] : [];
  if (uniqueMentorIds.length > 0) {
    const mentors = await User.find({ _id: { $in: uniqueMentorIds } });
    if (mentors.length !== uniqueMentorIds.length) {
      return errorResponse(res, 'One or more mentor IDs are invalid', 400);
    }
    for (const mentor of mentors) {
      if (mentor.role !== 'MENTOR') {
        return errorResponse(res, `User ${mentor.name} is not a MENTOR`, 400);
      }
    }
  }

  try {
    // Find highest existing classIndex for this subject/semester/year to continue numbering
    const lastClass = await Class.findOne({ subjectCode: subjectUpper, semester: semUpper, year: numYear })
      .sort({ classIndex: -1 });
    const startIndex = lastClass ? lastClass.classIndex + 1 : 1;

    const toCreate = [];
    for (let i = 0; i < numCount; i++) {
      const idx = startIndex + i;
      
      // Round-robin lecturer assignment
      let assignedLecturerId = null;
      if (validLecturerIds.length > 0) {
        assignedLecturerId = validLecturerIds[i % validLecturerIds.length];
      }

      toCreate.push({
        classCode:   `${subjectUpper}_${idx}`,
        subjectCode: subjectUpper,
        classIndex:  idx,
        semester:    semUpper,
        year:        numYear,
        lectureId:   assignedLecturerId,
        mentorIds:   uniqueMentorIds,
        status:      'active',
      });
    }

    // insertMany with ordered:false to report individual duplicate conflicts
    const created = await Class.insertMany(toCreate, { ordered: false });
    
    // Auto-schedule newly created classes
    const scheduleResult = await autoGenerateSchedule(created);

    // Auto-create chat groups for all created classes
    for (const cls of created) {
      try {
        await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
      } catch (chatErr) {
        console.error(`Failed to create chat group for class ${cls.classCode}:`, chatErr.message);
      }
    }

    return successResponse(res, { 
      classes: created, 
      count: created.length,
      scheduledCount: scheduleResult.scheduledCount,
      scheduleWarnings: scheduleResult.warnings
    }, `Created ${created.length} class(es). Scheduled ${scheduleResult.scheduledCount}.`, 201);
  } catch (err) {
    if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
      return errorResponse(res, 'Some class codes already exist for this semester/year', 409);
    }
    console.error(err);
    return errorResponse(res, 'Failed to create classes', 500);
  }
};

// ─── GET /api/classes ─────────────────────────────────────────────────────────
exports.getClasses = async (req, res) => {
  try {
    const { semester, year, subjectCode, search, status } = req.query;
    // Use $and array to avoid $or key conflicts
    const andConditions = [];

    // LECTURER sees only their classes + limited to current + 2 recent semesters
    if (req.user.role === 'LECTURER') {
      andConditions.push({ lectureId: req.user._id });
      if (!semester && !year) {
        const allowed = await getLecturerSemesterFilter(req.user._id);
        if (allowed && allowed.length > 0) {
          andConditions.push({ $or: allowed.map(s => ({ semester: s.semester, year: s.year })) });
        }
      }
    }

    if (semester)    andConditions.push({ semester: semester.toUpperCase() });
    if (year)        andConditions.push({ year: parseInt(year, 10) });
    if (subjectCode) andConditions.push({ subjectCode: subjectCode.toUpperCase() });
    if (status)      andConditions.push({ status });
    if (search) {
      andConditions.push({ classCode: { $regex: search, $options: 'i' } });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const classes = await Class.find(query)
      .populate('lectureId', 'name email avatar role')
      .populate('mentorIds', 'name email avatar role')
      .sort({ year: -1, semester: 1, classIndex: 1 });

    // Attach student & team counts
    const classIds = classes.map(c => c._id);
    const [studentCounts, teamCounts] = await Promise.all([
      Student.aggregate([
        { $match: { classId: { $in: classIds } } },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
      Team.aggregate([
        { $match: { classId: { $in: classIds } } },
        { $group: { _id: '$classId', count: { $sum: 1 } } },
      ]),
    ]);

    const studentMap = Object.fromEntries(studentCounts.map(s => [s._id.toString(), s.count]));
    const teamMap    = Object.fromEntries(teamCounts.map(t => [t._id.toString(), t.count]));

    const result = classes.map(c => ({
      ...c.toObject(),
      studentCount: studentMap[c._id.toString()] || 0,
      teamCount:    teamMap[c._id.toString()]    || 0,
    }));

    return successResponse(res, { classes: result });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to get classes', 500);
  }
};

// ─── GET /api/classes/:id ─────────────────────────────────────────────────────
exports.getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('lectureId', 'name email avatar role bio')
      .populate('mentorIds', 'name email avatar role bio');
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Access control
    if (req.user.role === 'LECTURER' && (!cls.lectureId || cls.lectureId._id.toString() !== req.user._id.toString()))
      return errorResponse(res, 'You do not have permission to access this class', 403);

    // Students & teams
    const [students, teams] = await Promise.all([
      Student.find({ classId: cls._id }).sort({ fullName: 1 }),
      Team.find({ classId: cls._id })
        .populate('members.studentId', 'fullName email rollNumber major avatarUrl')
        .populate('lectureId', 'name email')
        .populate('mentorId', 'name email')
        .sort({ createdAt: 1 }),
    ]);

    return successResponse(res, { class: cls, students, teams });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/classes/:id ─────────────────────────────────────────────────────
exports.updateClass = async (req, res) => {
  const { semester, year, status, lectureId } = req.body;
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString())
      return errorResponse(res, 'No permission to edit this class', 403);

    const updates = {};
    if (semester && ['SP','SU','FA'].includes(semester.toUpperCase())) updates.semester = semester.toUpperCase();
    if (year)   updates.year   = parseInt(year, 10);
    if (status && ['active','disabled'].includes(status)) updates.status = status;
    if (lectureId) {
      const lect = await User.findById(lectureId);
      if (!lect || lect.role !== 'LECTURER') return errorResponse(res, 'Invalid lectureId', 400);
      updates.lectureId = lectureId;
    }

    const updated = await Class.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('lectureId', 'name email avatar role')
      .populate('mentorIds', 'name email avatar role');

    try {
      await createOrUpdateChatGroupForClass(updated._id, { createdBy: req.user._id });
    } catch (chatErr) {
      console.error(`Failed to update chat group for class ${updated.classCode}:`, chatErr.message);
    }

    return successResponse(res, { class: updated }, 'Class updated');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── DELETE /api/classes/:id (soft disable) ───────────────────────────────────
exports.deleteClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Soft delete — set status to disabled
    cls.status = 'disabled';
    await cls.save();
    return successResponse(res, null, 'Class disabled successfully');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/classes/:id/assign-lecture ─────────────────────────────────────
exports.assignLecture = async (req, res) => {
  const { lectureId } = req.body;
  if (!lectureId) return errorResponse(res, 'lectureId is required', 400);

  try {
    const [cls, lecturer] = await Promise.all([
      Class.findById(req.params.id),
      User.findById(lectureId),
    ]);

    if (!cls)      return errorResponse(res, 'Class not found', 404);
    if (!lecturer) return errorResponse(res, 'Lecturer not found', 404);
    if (lecturer.role !== 'LECTURER' && lecturer.role !== 'LECTURE') {
      return errorResponse(res, 'User is not a LECTURER or LECTURE', 400);
    }

    cls.lectureId = lectureId;
    await cls.save();

    let scheduleWarnings = [];
    if (!cls.schedule || !cls.schedule.dayOfWeek) {
      const scheduleResult = await autoGenerateSchedule([cls]);
      if (scheduleResult.warnings && scheduleResult.warnings.length > 0) {
        scheduleWarnings = scheduleResult.warnings;
      }
    }

    await cls.populate([
      { path: 'lectureId', select: 'name email avatar role bio' },
      { path: 'mentorIds', select: 'name email avatar role bio' }
    ]);

    try {
      await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
    } catch (chatErr) {
      console.error(`Failed to update chat group for class ${cls.classCode}:`, chatErr.message);
    }

    return successResponse(res, { class: cls, scheduleWarnings }, 'Lecturer assigned');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/classes/:id/assign-mentors ─────────────────────────────────────
exports.assignMentors = async (req, res) => {
  const { mentorIds } = req.body;
  if (!Array.isArray(mentorIds)) return errorResponse(res, 'mentorIds must be an array', 400);

  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Deduplicate
    const uniqueMentorIds = [...new Set(mentorIds.filter(Boolean))];

    if (uniqueMentorIds.length > 0) {
      const mentors = await User.find({ _id: { $in: uniqueMentorIds } });
      if (mentors.length !== uniqueMentorIds.length) {
        return errorResponse(res, 'One or more mentor IDs are invalid', 400);
      }
      for (const mentor of mentors) {
        if (mentor.role !== 'MENTOR') {
          return errorResponse(res, `User ${mentor.name} is not a MENTOR`, 400);
        }
      }
    }

    cls.mentorIds = uniqueMentorIds;
    await cls.save();
    await cls.populate([
      { path: 'lectureId', select: 'name email avatar role bio' },
      { path: 'mentorIds', select: 'name email avatar role bio' }
    ]);

    try {
      await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
    } catch (chatErr) {
      console.error(`Failed to update chat group for class ${cls.classCode}:`, chatErr.message);
    }

    return successResponse(res, { class: cls }, 'Mentors assigned successfully');
  } catch (err) {
    console.error('assignMentors error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── POST /api/classes/:classId/import-students ───────────────────────────────
exports.importStudents = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // LECTURER can only import into their own class
    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString())
      return errorResponse(res, 'You do not have permission to import into this class', 403);

    if (!req.file) return errorResponse(res, 'Please upload an Excel file', 400);

    const result = await importStudents(req.file.buffer, cls._id);

    // ── Trả response ngay lập tức — không chờ email/chat (fire-and-forget) ──
    const emailNotification = { sent: false, error: "Sending in background" };
    const msg = `Import complete: ${result.successCount} added, ${result.failedCount} failed. Notification sending in background.`;
    successResponse(res, { ...result, emailNotification }, msg);

    // Cập nhật chat group (background — không block response, không crash server)
    Promise.resolve()
      .then(() => createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id }))
      .catch(chatErr =>
        console.error(`[ImportStudents] Chat group update failed for ${cls.classCode}:`, chatErr.message)
      );

    // Gửi email thông báo cho sinh viên vừa import (background — không block response)
    if (result.imported && result.imported.length > 0) {
      Promise.resolve()
        .then(() => sendStudentImportedNotification({
          importedStudents: result.imported,
          classInfo: cls,
        }))
        .catch(emailError =>
          console.error("[ImportStudents] Email notification failed:", emailError.message)
        );
    }
  } catch (err) {
    return errorResponse(res, err.message || 'Import failed', 400);
  }
};

// ─── GET /api/classes/:classId/students ───────────────────────────────────────
exports.getStudents = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString())
      return errorResponse(res, 'You do not have permission to view this class', 403);

    const { search, major } = req.query;
    const query = { classId: cls._id };
    if (search) query.$or = [
      { fullName:   { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
      { email:      { $regex: search, $options: 'i' } },
    ];
    if (major) query.major = { $regex: major, $options: 'i' };

    const students = await Student.find(query).sort({ fullName: 1 });
    return successResponse(res, { students });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── GET /api/classes/my-classes ──────────────────────────────────────────────
exports.getMyClasses = async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      const classes = await Class.find()
        .populate('lectureId', 'name email avatar role bio')
        .populate('mentorIds', 'name email avatar role bio')
        .sort({ year: -1, semester: 1, classIndex: 1 });
      return successResponse(res, { classes });
    }

    if (req.user.role === 'LECTURER' || req.user.role === 'LECTURE') {
      const classes = await Class.find({ lectureId: req.user._id })
        .populate('lectureId', 'name email avatar role bio')
        .populate('mentorIds', 'name email avatar role bio')
        .sort({ year: -1, semester: 1, classIndex: 1 });
      return successResponse(res, { classes });
    }

    if (req.user.role === 'MENTOR') {
      const teams = await Team.find({ mentorId: req.user._id });
      const teamClassIds = teams.map(t => t.classId);
      const classes = await Class.find({
        $or: [
          { mentorIds: req.user._id },
          { _id: { $in: teamClassIds } }
        ]
      })
        .populate('lectureId', 'name email avatar role bio')
        .populate('mentorIds', 'name email avatar role bio')
        .sort({ year: -1, semester: 1, classIndex: 1 });
      return successResponse(res, { classes });
    }

    const students = await Student.find({
      $or: [
        { userId: req.user._id },
        { email: req.user.email.toLowerCase() }
      ]
    });

    if (!students || students.length === 0) {
      return successResponse(res, { classes: [] }, 'Student not enrolled in any class');
    }

    const classIds = students.map(s => s.classId);

    const classes = await Class.find({ _id: { $in: classIds }, status: { $ne: 'disabled' } })
      .populate('lectureId', 'name email avatar role bio')
      .populate('mentorIds', 'name email avatar role bio')
      .sort({ year: -1, semester: 1, classIndex: 1 });

    return successResponse(res, { classes });
  } catch (err) {
    console.error('getMyClasses error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── GET /api/classes/my-team ─────────────────────────────────────────────────
exports.getMyTeam = async (req, res) => {
  try {
    const semesterRank = { SP: 1, SU: 2, FA: 3 };
    const students = await Student.find({
      $or: [
        { userId: req.user._id },
        { email: req.user.email.toLowerCase() }
      ]
    }).populate({
      path: 'classId',
      match: { status: { $ne: 'disabled' } },
      select: 'classCode subjectCode semester year status'
    });

    if (!students || students.length === 0) {
      return successResponse(res, null, 'Student record not found');
    }

    const activeStudents = students
      .filter((s) => s.classId)
      .sort((a, b) => {
        const yearDiff = Number(b.classId.year || 0) - Number(a.classId.year || 0);
        if (yearDiff) return yearDiff;
        return (semesterRank[b.classId.semester] || 0) - (semesterRank[a.classId.semester] || 0);
      });

    const student = activeStudents[0] || null;

    if (!student) {
      return successResponse(res, null, 'Student record not found or class is disabled');
    }

    if (!student.teamId) {
      return successResponse(res, null, 'You have joined this class but have not been assigned to a team yet.');
    }

    const team = await Team.findOne({ _id: student.teamId, classId: student.classId._id || student.classId })
      .populate('lectureId', 'name email avatar')
      .populate('mentorId', 'name email avatar')
      .populate('chatGroupId');

    if (!team) {
      return successResponse(res, null, 'Your saved team no longer matches your current class. Please contact your lecturer or administrator.');
    }

    const cls = await Class.findById(team.classId);
    const members = await Student.find({ teamId: team._id }).sort({ fullName: 1 });

    return successResponse(res, {
      team,
      class: cls,
      members,
      chatGroup: team.chatGroupId
    });
  } catch (err) {
    console.error('getMyTeam error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── GET /api/classes/my-class-detail/:classId ─────────────────────────────────
exports.getMyClassDetail = async (req, res) => {
  try {
    const classId = req.params.classId;

    const student = await Student.findOne({
      classId,
      $or: [
        { userId: req.user._id },
        { email: req.user.email.toLowerCase() }
      ]
    });

    if (!student) {
      return errorResponse(res, 'You do not belong to this class', 403);
    }

    const cls = await Class.findById(classId)
      .populate('lectureId', 'name email avatar role bio')
      .populate('mentorIds', 'name email avatar role bio');

    if (!cls) return errorResponse(res, 'Class not found', 404);

    const [students, teams] = await Promise.all([
      Student.find({ classId: cls._id }).sort({ fullName: 1 }),
      Team.find({ classId: cls._id })
        .populate('members.studentId', 'fullName email rollNumber major avatarUrl')
        .populate('lectureId', 'name email')
        .populate('mentorId', 'name email')
        .sort({ createdAt: 1 }),
    ]);

    return successResponse(res, { class: cls, students, teams });
  } catch (err) {
    console.error('getMyClassDetail error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/classes/:classId/schedule ─────────────────────────────────────
exports.updateSchedule = async (req, res) => {
  const { dayOfWeek, slot, room } = req.body;
  if (!dayOfWeek || !slot) return errorResponse(res, 'dayOfWeek and slot are required', 400);

  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    if (cls.lectureId) {
      const hasConflict = await validateScheduleConflict(cls.lectureId, cls.semester, cls.year, dayOfWeek, slot, cls._id);
      if (hasConflict) {
        return errorResponse(res, 'Lecturer already has another class in this time slot.', 409);
      }
    }

    const SLOT_TIMES = {
      1: { startTime: '07:30', endTime: '09:00' },
      2: { startTime: '09:10', endTime: '10:40' },
      3: { startTime: '12:30', endTime: '14:00' },
      4: { startTime: '14:10', endTime: '15:40' }
    };

    cls.schedule = {
      dayOfWeek,
      slot: parseInt(slot, 10),
      startTime: SLOT_TIMES[slot].startTime,
      endTime: SLOT_TIMES[slot].endTime,
      room: room || 'TBD'
    };

    await cls.save();
    return successResponse(res, { class: cls }, 'Schedule updated successfully');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/classes/:classId/teaching-assignment ────────────────────────────
exports.updateTeachingAssignment = async (req, res) => {
  const { lectureId, schedule } = req.body;

  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    if (lectureId) {
      const lecturer = await User.findById(lectureId);
      if (!lecturer || (lecturer.role !== 'LECTURER' && lecturer.role !== 'LECTURE')) {
        return errorResponse(res, 'Invalid lectureId', 400);
      }
      cls.lectureId = lectureId;
    }

    if (schedule && schedule.dayOfWeek && schedule.slot) {
      const hasConflict = await validateScheduleConflict(cls.lectureId, cls.semester, cls.year, schedule.dayOfWeek, schedule.slot, cls._id);
      if (hasConflict) {
        return errorResponse(res, 'Lecturer already has another class in this time slot.', 409);
      }

      const SLOT_TIMES = {
        1: { startTime: '07:30', endTime: '09:00' },
        2: { startTime: '09:10', endTime: '10:40' },
        3: { startTime: '12:30', endTime: '14:00' },
        4: { startTime: '14:10', endTime: '15:40' }
      };

      cls.schedule = {
        dayOfWeek: schedule.dayOfWeek,
        slot: parseInt(schedule.slot, 10),
        startTime: SLOT_TIMES[schedule.slot].startTime,
        endTime: SLOT_TIMES[schedule.slot].endTime,
        room: schedule.room || 'TBD'
      };
    }

    await cls.save();
    await cls.populate([
      { path: 'lectureId', select: 'name email avatar role bio' },
      { path: 'mentorIds', select: 'name email avatar role bio' }
    ]);

    try {
      await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
    } catch (chatErr) {
      console.error(`Failed to update chat group for class ${cls.classCode}:`, chatErr.message);
    }

    return successResponse(res, { class: cls }, 'Teaching assignment updated successfully');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── GET /api/classes/:classId/export-excel ──────────────────────────────────
exports.exportClassExcel = async (req, res) => {
  try {
    const classId = req.params.classId;
    const cls = await Class.findById(classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Permission check
    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'You do not have permission to export this class', 403);
    }
    if (req.user.role === 'MENTOR') {
      const isMentor = cls.mentorIds && cls.mentorIds.some(m => m.toString() === req.user._id.toString());
      if (!isMentor) return errorResponse(res, 'You do not have permission to export this class', 403);
    }
    if (req.user.role === 'STUDENT') {
      return errorResponse(res, 'Students cannot export class data', 403);
    }

    // Load students
    const students = await Student.find({ classId }).sort({ fullName: 1 });
    // Load teams for this class
    const teams = await Team.find({ classId });
    const teamMap = new Map();
    teams.forEach(t => teamMap.set(t._id.toString(), t));

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(cls.classCode || 'Students', {
      views: [{ state: 'frozen', ySplit: 1 }] // freeze first row
    });

    // Define columns
    sheet.columns = [
      { header: 'RollNumber', key: 'rollNumber', width: 18 },
      { header: 'Fullname', key: 'fullName', width: 30 },
      { header: 'Major', key: 'major', width: 18 },
      { header: 'SubjectCode', key: 'subjectCode', width: 16 },
      { header: 'GroupName', key: 'groupName', width: 20 },
      { header: 'Group EXE201', key: 'groupExe201', width: 20 },
      { header: 'Project Name', key: 'projectName', width: 30 },
      { header: 'Description', key: 'description', width: 50 }
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' } // Yellow
      };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Auto filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length }
    };

    // Add rows
    students.forEach(student => {
      let groupName = '';
      let groupExe201 = '';
      let projectName = '';
      let description = '';

      if (student.teamId) {
        const team = teamMap.get(student.teamId.toString());
        if (team) {
          groupName = team.groupName || '';
          groupExe201 = team.groupExe201 || '';
          projectName = team.projectName || '';
          description = team.description || '';
        }
      }

      const row = sheet.addRow({
        rollNumber: student.rollNumber || '',
        fullName: student.fullName || '',
        major: student.major || '',
        subjectCode: student.subjectCode || cls.subjectCode || '',
        groupName,
        groupExe201,
        projectName,
        description
      });

      // Wrap text in description and add borders
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        if (colNumber === 8) { // Description column
          cell.alignment = { wrapText: true, vertical: 'top' };
        } else {
          cell.alignment = { vertical: 'top' };
        }
      });
    });

    // Prepare response
    const filename = `${cls.classCode || 'class'}_students.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel Error:', err);
    return errorResponse(res, 'Server error during export', 500);
  }
};

// ─── PUT /api/classes/:id/rename ─────────────────────────────────────────────
exports.renameClass = async (req, res) => {
  const { classCode } = req.body;
  if (!classCode || !classCode.trim())
    return errorResponse(res, 'classCode is required', 400);

  const newCode = classCode.trim().toUpperCase();

  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Permission: LECTURER can only rename their own class
    if ((req.user.role === 'LECTURER' || req.user.role === 'LECTURE') &&
        cls.lectureId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'You do not have permission to rename this class', 403);
    }

    // Check uniqueness: (classCode, semester, year)
    if (newCode !== cls.classCode) {
      const conflict = await Class.findOne({
        classCode: newCode,
        semester: cls.semester,
        year: cls.year,
        _id: { $ne: cls._id },
      });
      if (conflict) {
        return errorResponse(res, `Class code "${newCode}" already exists for ${cls.semester} ${cls.year}`, 409);
      }
    }

    cls.classCode = newCode;
    await cls.save();

    // Sync chat group name if exists
    try {
      await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
    } catch (chatErr) {
      console.error(`Failed to update chat group after rename ${cls.classCode}:`, chatErr.message);
    }

    await cls.populate([
      { path: 'lectureId', select: 'name email avatar role' },
      { path: 'mentorIds', select: 'name email avatar role' },
    ]);

    return successResponse(res, { class: cls }, 'Class renamed successfully');
  } catch (err) {
    if (err.code === 11000) {
      return errorResponse(res, 'Class code already exists for this semester/year', 409);
    }
    console.error('renameClass error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── POST /api/classes/:classId/verify-majors ─────────────────────────────────
exports.verifyMajors = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Permission: LECTURER can only verify their own class
    if ((req.user.role === 'LECTURER' || req.user.role === 'LECTURE') &&
        cls.lectureId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'You do not have permission to verify this class', 403);
    }

    if (!req.file) return errorResponse(res, 'Please upload an Excel file', 400);

    const report = await verifyMajors(req.file.buffer, cls._id);
    return successResponse(res, report, 'Major verification complete');
  } catch (err) {
    console.error('verifyMajors error:', err);
    return errorResponse(res, err.message || 'Verification failed', 400);
  }
};

// ─── PATCH /api/classes/:classId/students/:studentId/major ────────────────────
exports.updateStudentMajor = async (req, res) => {
  const { major } = req.body;
  if (!major || !major.trim())
    return errorResponse(res, 'major is required', 400);

  const newMajor = major.trim().toUpperCase();

  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Permission: LECTURER can only update their own class
    if ((req.user.role === 'LECTURER' || req.user.role === 'LECTURE') &&
        cls.lectureId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'No permission', 403);
    }

    const student = await Student.findOne({ _id: req.params.studentId, classId: cls._id });
    if (!student) return errorResponse(res, 'Student not found in this class', 404);

    const programGroup = getProgramGroupFromMajor(newMajor) || null;
    student.major = newMajor;
    student.programGroup = programGroup;
    await student.save();

    // Also sync linked User's major if they have one
    if (student.userId) {
      await User.findByIdAndUpdate(student.userId, { major: newMajor, programGroup });
    }

    return successResponse(res, { student }, 'Student major updated');
  } catch (err) {
    console.error('updateStudentMajor error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PATCH /api/classes/:classId/toggle-major-lock ────────────────────────────
exports.toggleMajorLock = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    // Permission: LECTURER can only toggle their own class
    if ((req.user.role === 'LECTURER' || req.user.role === 'LECTURE') &&
        cls.lectureId?.toString() !== req.user._id.toString()) {
      return errorResponse(res, 'No permission', 403);
    }

    // Toggle
    cls.isMajorLocked = !cls.isMajorLocked;
    await cls.save();

    const msg = cls.isMajorLocked
      ? 'Major change is now LOCKED for students in this class'
      : 'Major change is now UNLOCKED for students in this class';

    return successResponse(res, { isMajorLocked: cls.isMajorLocked }, msg);
  } catch (err) {
    console.error('toggleMajorLock error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};
