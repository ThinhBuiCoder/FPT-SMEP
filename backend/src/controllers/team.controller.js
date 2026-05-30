// src/controllers/team.controller.js — Full Team Management (Module 2)
const mongoose  = require('mongoose');
const Team      = require('../models/Team');
const Class     = require('../models/Class');
const Student   = require('../models/Student');
const User      = require('../models/User');
const ChatGroup = require('../models/ChatGroup');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { validateTeamStudents, generateTeamCode } = require('../services/teamGeneration.service');
const { createChatGroupForTeam, createOrUpdateChatGroupForClass } = require('../services/chatGroup.service');

// ─── POST /api/classes/:classId/teams/generate ───────────────────────────────
exports.generateTeam = async (req, res) => {
  const { studentIds, mode = 'auto', mentorId } = req.body;
  const { classId } = req.params;

  if (!['auto', 'manual'].includes(mode))
    return errorResponse(res, 'mode must be "auto" or "manual"', 400);

  // 1. Validate students
  const { students, error } = await validateTeamStudents(studentIds, classId, mode);
  if (error) return errorResponse(res, error, 400);

  // 2. Load class for teamCode generation
  const cls = await Class.findById(classId);
  if (!cls) return errorResponse(res, 'Class not found', 404);

  // 3. LECTURER permission check
  if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString())
    return errorResponse(res, 'You do not have permission to manage this class', 403);

  // Validate mentorId
  let assignedMentorId = null;
  if (mentorId) {
    const classMentorIds = cls.mentorIds || [];
    const isValid = classMentorIds.some(m => m.toString() === mentorId.toString());
    if (!isValid) {
      return errorResponse(res, 'Selected mentor is not assigned to this class', 400);
    }
    assignedMentorId = mentorId;
  } else {
    // Auto assign if class has exactly 1 mentor
    if (cls.mentorIds && cls.mentorIds.length === 1) {
      assignedMentorId = cls.mentorIds[0];
    }
  }

  // 4. Generate team code/name
  const { teamCode, teamName, teamIndex } = await generateTeamCode(cls.classCode, classId);

  // 5. Run inside a transaction for atomicity (Team + ChatGroup)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create team
    const groupName = cls.classCode; // e.g., EXE201_11
    const groupExe201 = `${cls.subjectCode}g_${cls.classIndex}G${teamIndex}`; // e.g., EXE201g_11G1

    const [team] = await Team.create(
      [{
        classId,
        teamName,
        teamCode,
        groupName,
        groupExe201,
        lectureId: cls.lectureId || null,
        mentorId: assignedMentorId,
        createdBy: req.user._id,
        members: students.map(s => ({ studentId: s._id, roleInTeam: 'Member' })),
      }],
      { session }
    );

    // Update each student's teamId
    await Student.updateMany(
      { _id: { $in: students.map(s => s._id) } },
      { $set: { teamId: team._id } },
      { session }
    );

    // Auto-create chat group
    const chatGroup = await createChatGroupForTeam(
      team._id,
      { session, createdBy: req.user._id }
    );

    // Link chat group back to team
    team.chatGroupId = chatGroup._id;
    await team.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate for response
    await team.populate([
      { path: 'members.studentId', select: 'fullName email rollNumber major' },
      { path: 'lectureId', select: 'name email' },
      { path: 'mentorId', select: 'name email' }
    ]);

    return successResponse(
      res,
      { team, chatGroup },
      `Team "${teamName}" created with chat group successfully`,
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Team generation error:', err);
    return errorResponse(res, err.message || 'Failed to create team', 500);
  }
};

// ─── GET /api/classes/:classId/teams ─────────────────────────────────────────
exports.getTeamsByClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString())
      return errorResponse(res, 'You do not have permission to view this class', 403);

    const teams = await Team.find({ classId: req.params.classId })
      .populate('members.studentId', 'fullName email rollNumber major avatarUrl')
      .populate('lectureId', 'name email avatar')
      .populate('mentorId', 'name email avatar')
      .sort({ createdAt: 1 });

    return successResponse(res, { teams });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/teams/:teamId ───────────────────────────────────────────────────
exports.updateTeam = async (req, res) => {
  const { teamName, description, groupName, groupExe201, projectName } = req.body;
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return errorResponse(res, 'Team not found', 404);

    // Validate permission for students
    if (req.user.role === 'STUDENT') {
      const studentRecord = await Student.findOne({ userId: req.user._id, classId: team.classId });
      if (!studentRecord || studentRecord.teamId?.toString() !== team._id.toString()) {
        return errorResponse(res, 'You do not have permission to update this team', 403);
      }
    }

    if (teamName !== undefined)    team.teamName    = teamName;
    if (description !== undefined) team.description = description;
    if (groupName !== undefined)   team.groupName   = groupName;
    if (groupExe201 !== undefined) team.groupExe201 = groupExe201;
    if (projectName !== undefined) team.projectName = projectName;
    
    await team.save();

    return successResponse(res, { team }, 'Team updated');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── DELETE /api/teams/:teamId ────────────────────────────────────────────────
exports.deleteTeam = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const team = await Team.findById(req.params.teamId).session(session);
    if (!team) { await session.abortTransaction(); session.endSession(); return errorResponse(res, 'Team not found', 404); }

    // Unassign students
    await Student.updateMany(
      { teamId: team._id },
      { $set: { teamId: null } },
      { session }
    );

    // Remove chat group
    if (team.chatGroupId) {
      await ChatGroup.findByIdAndDelete(team.chatGroupId).session(session);
    }

    await Team.findByIdAndDelete(team._id).session(session);
    await session.commitTransaction();
    session.endSession();

    return successResponse(res, null, 'Team deleted');
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/teams/:teamId/assign-mentor ─────────────────────────────────────
exports.assignMentor = async (req, res) => {
  const { mentorId } = req.body;
  if (!mentorId) return errorResponse(res, 'mentorId is required', 400);

  try {
    const [team, mentor] = await Promise.all([
      Team.findById(req.params.teamId),
      User.findById(mentorId),
    ]);
    if (!team)   return errorResponse(res, 'Team not found', 404);
    if (!mentor) return errorResponse(res, 'Mentor not found', 404);
    if (mentor.role !== 'MENTOR') return errorResponse(res, 'User is not a MENTOR', 400);

    team.mentorId = mentorId;
    await team.save();
    await team.populate('mentorId', 'name email avatar');

    return successResponse(res, { team }, 'Mentor assigned');
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── GET /api/teams/:teamId/chat-group ───────────────────────────────────────
exports.getChatGroup = async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return errorResponse(res, 'Team not found', 404);

    const chatGroup = await ChatGroup.findOne({ teamId: team._id })
      .populate('members.userId', 'name email avatar')
      .populate('members.studentId', 'fullName email');

    if (!chatGroup) return errorResponse(res, 'No chat group found for this team', 404);
    return successResponse(res, { chatGroup });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── Keep legacy routes functional (old Class.members-based system) ────────────
exports.createTeam  = async (req, res) => errorResponse(res, 'Use POST /api/classes/:classId/teams/generate', 400);
exports.getTeams    = async (req, res) => {
  // Redirect to class-scoped query if classId provided
  const { classId } = req.query;
  if (classId) {
    req.params.classId = classId;
    return exports.getTeamsByClass(req, res);
  }
  try {
    const teams = await Team.find()
      .populate('members.studentId', 'fullName email rollNumber')
      .sort({ createdAt: -1 });
    return successResponse(res, { teams });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};
exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('classId', 'classCode semester year')
      .populate('members.studentId', 'fullName email rollNumber major avatarUrl');
    if (!team) return errorResponse(res, 'Team not found', 404);
    return successResponse(res, { team });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};
exports.addMember    = async (req, res) => errorResponse(res, 'Use team generation API', 400);
exports.removeMember = async (req, res) => errorResponse(res, 'Use team generation API', 400);

// ─── POST /api/classes/:classId/backfill-chats ───────────────────────────────
exports.backfillChatGroups = async (req, res) => {
  const { id } = req.params; // Class ID
  const classId = id || req.params.classId;
  try {
    const cls = await Class.findById(classId);
    if (!cls) return errorResponse(res, 'Class not found', 404);

    const teams = await Team.find({ classId });
    let createdCount = 0;
    let attachedExistingCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const team of teams) {
      try {
        if (team.chatGroupId) {
          const chatGroupObj = await ChatGroup.findById(team.chatGroupId);
          if (chatGroupObj) {
            skippedCount++;
            continue;
          }
        }

        // Check if ChatGroup exists by teamId
        const existing = await ChatGroup.findOne({ teamId: team._id });
        if (existing) {
          team.chatGroupId = existing._id;
          await team.save();
          attachedExistingCount++;
          continue;
        }

        // Otherwise create one
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const chatGroup = await createChatGroupForTeam(team._id, { session, createdBy: req.user._id });
          team.chatGroupId = chatGroup._id;
          await team.save({ session });
          await session.commitTransaction();
          session.endSession();
          createdCount++;
        } catch (innerErr) {
          await session.abortTransaction();
          session.endSession();
          console.error(`Failed to backfill chat for team ${team.teamName}:`, innerErr);
          failedCount++;
        }
      } catch (err) {
        console.error(`Error processing backfill for team ${team._id}:`, err);
        failedCount++;
      }
    }

    // Also backfill the class general chat group
    try {
      await createOrUpdateChatGroupForClass(cls._id, { createdBy: req.user._id });
    } catch (classChatErr) {
      console.error(`Failed to backfill general chat for class ${cls.classCode}:`, classChatErr);
    }

    return successResponse(res, {
      totalTeams: teams.length,
      createdCount,
      attachedExistingCount,
      skippedCount,
      failedCount,
    }, 'Backfill completed');
  } catch (err) {
    console.error('backfillChatGroups error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};
