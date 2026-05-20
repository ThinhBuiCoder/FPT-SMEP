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
const multer  = require('multer');

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

  // Validate lecturers (support both singular lectureId for backward compatibility and array lecturerIds)
  const validLecturerIds = [];
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

    // Update class chat group members to include the new students
    try {
      await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
    } catch (chatErr) {
      console.error(`Failed to update chat group members for class ${cls.classCode}:`, chatErr.message);
    }

    // Send email to imported students
    let emailNotification = { sent: false, error: "Not attempted" };
    if (result.imported && result.imported.length > 0) {
      try {
        emailNotification = await sendStudentImportedNotification({
          importedStudents: result.imported,
          classInfo: cls,
        });
      } catch (emailError) {
        console.error("Failed to send import notification:", emailError.message);
        emailNotification = { sent: false, error: emailError.message };
      }
    }

    const msg = `Import complete: ${result.successCount} added, ${result.failedCount} failed. ${emailNotification.sent ? 'Notification sent.' : 'Notification skipped/failed.'}`;
    return successResponse(res, { ...result, emailNotification }, msg);
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
    const student = await Student.findOne({
      $or: [
        { userId: req.user._id },
        { email: req.user.email.toLowerCase() }
      ]
    });

    if (!student) {
      return successResponse(res, { classes: [] }, 'Student not enrolled in any class');
    }

    const cls = await Class.findById(student.classId)
      .populate('lectureId', 'name email avatar role bio')
      .populate('mentorIds', 'name email avatar role bio');

    const classes = cls ? [cls] : [];
    return successResponse(res, { classes });
  } catch (err) {
    console.error('getMyClasses error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── GET /api/classes/my-team ─────────────────────────────────────────────────
exports.getMyTeam = async (req, res) => {
  try {
    let student = await Student.findOne({
      $or: [
        { userId: req.user._id },
        { email: req.user.email.toLowerCase() }
      ],
      teamId: { $ne: null }
    });

    if (!student) {
      student = await Student.findOne({
        $or: [
          { userId: req.user._id },
          { email: req.user.email.toLowerCase() }
        ]
      });
    }

    if (!student) {
      return successResponse(res, null, 'Student record not found');
    }

    if (!student.teamId) {
      return successResponse(res, null, 'You have not been assigned to a team yet.');
    }

    const team = await Team.findById(student.teamId)
      .populate('lectureId', 'name email avatar')
      .populate('mentorId', 'name email avatar')
      .populate('chatGroupId');

    if (!team) {
      return successResponse(res, null, 'You have not been assigned to a team yet.');
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

