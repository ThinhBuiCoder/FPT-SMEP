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

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const validateName = (value, label) => {
  const clean = normalizeText(value);
  if (clean.length < 3 || clean.length > 60) {
    return { value: clean, error: `${label} must be 3-60 characters` };
  }
  return { value: clean, error: null };
};

const validateDescription = (value, { required = false } = {}) => {
  const clean = normalizeText(value);
  if (required && !clean) {
    return { value: clean, error: 'Project description is required' };
  }
  if (clean && (clean.length < 20 || clean.length > 500)) {
    return { value: clean, error: 'Project description must be 20-500 characters' };
  }
  return { value: clean, error: null };
};

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

// ─── POST /api/classes/:classId/teams/student-proposal ───────────────────────
exports.createStudentProposal = async (req, res) => {
  const { studentIds, groupName, projectName, description, isProjectNameSameAsGroup } = req.body;
  const { classId } = req.params;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return errorResponse(res, 'No students selected', 400);
  }

  const groupValidation = validateName(groupName, 'Group name');
  if (groupValidation.error) return errorResponse(res, groupValidation.error, 400);

  const finalProjectName = isProjectNameSameAsGroup === true
    ? groupValidation.value
    : projectName;
  const projectValidation = validateName(finalProjectName, 'Project name');
  if (projectValidation.error) return errorResponse(res, projectValidation.error, 400);

  const descriptionValidation = validateDescription(description, { required: true });
  if (descriptionValidation.error) return errorResponse(res, descriptionValidation.error, 400);

  // Load class
  const cls = await Class.findById(classId);
  if (!cls) return errorResponse(res, 'Class not found', 404);

  // Check unique groupName in class
  const existingName = await Team.findOne({
    classId,
    groupName: groupValidation.value,
    status: { $ne: 'REJECTED' }
  });
  if (existingName) {
    return errorResponse(res, 'Group name is already taken in this class', 400);
  }

  // Deduplicate studentIds
  const uniqueIds = [...new Set(studentIds.map(String))];
  
  // Ensure the creator is among the selected students
  // Find current student record
  const currentStudent = await Student.findOne({
    classId,
    $or: [
      { userId: req.user._id },
      { email: req.user.email?.toLowerCase() }
    ]
  });
  if (!currentStudent) {
    return errorResponse(res, 'You are not a student in this class', 403);
  }
  if (!uniqueIds.includes(currentStudent._id.toString())) {
    return errorResponse(res, 'You must include yourself in the team', 400);
  }

  const students = await Student.find({ _id: { $in: uniqueIds }, classId }).populate('userId', 'major');
  if (students.length !== uniqueIds.length) {
    return errorResponse(res, 'One or more students do not belong to this class', 400);
  }

  // Check if any student already has a team
  const alreadyAssigned = students.filter(s => s.teamId);
  if (alreadyAssigned.length > 0) {
    const names = alreadyAssigned.map(s => s.fullName).join(', ');
    return errorResponse(res, `These students are already in a team: ${names}`, 400);
  }

  // Validation Rules
  let isValidSize = students.length >= 4 && students.length <= 6;
  
  // Major check
  const groupsPresent = new Set();
  const { getTeamGroupFromMajor } = require('../constants/majors');
  for (const s of students) {
    const major = s.major || (s.userId && s.userId.major) || null;
    if (major) {
      const group = getTeamGroupFromMajor(major);
      if (group) groupsPresent.add(group);
    }
  }
  const isValidMajors = groupsPresent.has('GROUP_1') && groupsPresent.has('GROUP_2');

  const isFullyValid = isValidSize && isValidMajors;
  const canRequestException = (students.length === 3 || students.length === 7) && isValidMajors;
  if (!isFullyValid && !canRequestException) {
    return errorResponse(
      res,
      'Team must have 4-6 students from both major groups. Only 3- or 7-member teams with both major groups can be submitted for review.',
      400
    );
  }
  const initialStatus = isFullyValid ? 'APPROVED' : 'PENDING';

  // Generate teamCode
  const { generateTeamCode } = require('../services/teamGeneration.service');
  const { teamCode, teamName, teamIndex } = await generateTeamCode(cls.classCode, classId);
  
  const groupExe201 = `${cls.subjectCode}g_${cls.classIndex}G${teamIndex}`; // e.g., EXE201g_11G1

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const membersList = students.map(s => ({
      studentId: s._id,
      roleInTeam: s._id.toString() === currentStudent._id.toString() ? 'Leader' : 'Member'
    }));

    const [team] = await Team.create(
      [{
        classId,
        teamName,
        teamCode,
        groupName: groupValidation.value,
        projectName: projectValidation.value,
        description: descriptionValidation.value,
        groupExe201,
        lectureId: cls.lectureId || null,
        createdBy: req.user._id,
        leaderId: currentStudent._id,
        status: initialStatus,
        members: membersList,
      }],
      { session }
    );

    // If APPROVED automatically, assign students immediately.
    // If PENDING, we still assign them so they don't get double booked?
    // Wait, if PENDING, should we assign teamId to students? Yes, otherwise they can create another team.
    await Student.updateMany(
      { _id: { $in: uniqueIds } },
      { $set: { teamId: team._id } },
      { session }
    );

    // Only create chat group if APPROVED
    let chatGroup = null;
    if (initialStatus === 'APPROVED') {
      const { createChatGroupForTeam } = require('../services/chatGroup.service');
      chatGroup = await createChatGroupForTeam(team._id, { session, createdBy: req.user._id });
      team.chatGroupId = chatGroup._id;
      await team.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Populate for response
    await team.populate([
      { path: 'members.studentId', select: 'fullName email rollNumber major avatarUrl' },
      { path: 'leaderId', select: 'fullName email avatarUrl' }
    ]);

    if (initialStatus === 'PENDING') {
      try {
        const { createBulkNotifications } = require('../services/notification.service');
        const reviewerQuery = [{ role: 'ADMIN' }];
        if (cls.lectureId) reviewerQuery.push({ _id: cls.lectureId });
        const reviewers = await User.find({ $or: reviewerQuery }).select('email name');
        const recipients = reviewers
          .filter(u => u.email)
          .map(u => ({ id: u._id, email: u.email }));

        await createBulkNotifications(recipients, {
          type: 'TEAM',
          title: 'Có đề xuất nhóm cần duyệt',
          message: `Nhóm "${team.groupName}" đã gửi đề xuất ngoại lệ (${students.length} thành viên) cho lớp ${cls.classCode}.`,
          link: `/classes/${classId}`,
          data: { teamId: team._id, classId },
          createdBy: req.user._id
        });
      } catch (notifErr) {
        console.error('Failed to notify reviewers about team proposal:', notifErr);
      }
    }

    return successResponse(
      res,
      { team, isFullyValid },
      isFullyValid ? 'Tạo nhóm thành công' : 'Đã gửi đề xuất nhóm chờ duyệt',
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Student Proposal Error:', err);
    return errorResponse(res, err.message || 'Failed to create team proposal', 500);
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
      .populate('leaderId', 'fullName email avatarUrl')
      .sort({ createdAt: 1 });

    // Ensure leaderId is also in members with role 'Leader' just for compatibility
    teams.forEach(t => {
      if (t.leaderId) {
        const leaderMember = t.members.find(m => m.studentId && m.studentId._id.toString() === t.leaderId._id.toString());
        if (leaderMember && leaderMember.roleInTeam !== 'Leader') {
          leaderMember.roleInTeam = 'Leader';
        }
      }
    });

    return successResponse(res, { teams });
  } catch (err) {
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/teams/:teamId/review ───────────────────────────────────────────
exports.reviewTeamProposal = async (req, res) => {
  const {
    status,
    rejectReason,
    newMemberIds,
    groupName,
    projectName,
    description,
  } = req.body;
  if (!['APPROVED', 'REJECTED', 'NEEDS_REVISION'].includes(status)) {
    return errorResponse(res, 'Invalid status', 400);
  }
  const reviewNote = normalizeText(rejectReason);
  if (['REJECTED', 'NEEDS_REVISION'].includes(status) && !reviewNote) {
    return errorResponse(
      res,
      status === 'REJECTED'
        ? 'Rejection reason is required'
        : 'Revision request is required',
      400
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const team = await Team.findById(req.params.teamId).session(session);
    if (!team) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, 'Team not found', 404);
    }

    const cls = await Class.findById(team.classId).session(session);
    if (!cls) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, 'Class not found', 404);
    }

    if (req.user.role === 'LECTURER' && cls.lectureId?.toString() !== req.user._id.toString()) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, 'You do not have permission to review this team', 403);
    }

    if (team.status !== 'PENDING' && team.status !== 'NEEDS_REVISION') {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, 'Team is not pending review', 400);
    }

    const groupValidation = validateName(groupName ?? team.groupName, 'Group name');
    if (groupValidation.error) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, groupValidation.error, 400);
    }
    const projectValidation = validateName(projectName ?? team.projectName, 'Project name');
    if (projectValidation.error) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, projectValidation.error, 400);
    }
    const descriptionValidation = validateDescription(
      description ?? team.description,
      { required: true }
    );
    if (descriptionValidation.error) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, descriptionValidation.error, 400);
    }

    const conflictingGroup = await Team.findOne({
      _id: { $ne: team._id },
      classId: team.classId,
      groupName: groupValidation.value,
      status: { $ne: 'REJECTED' }
    }).session(session);
    if (conflictingGroup) {
      await session.abortTransaction(); session.endSession();
      return errorResponse(res, 'Group name is already taken in this class', 400);
    }

    const notificationStudentIds = new Set(team.members.map(m => m.studentId.toString()));

    team.groupName = groupValidation.value;
    team.projectName = projectValidation.value;
    team.description = descriptionValidation.value;
    team.status = status;
    team.reviewedBy = req.user._id;
    team.reviewedAt = new Date();
    team.rejectReason = reviewNote || null;

    if (status === 'REJECTED') {
      // Unassign students
      await Student.updateMany(
        { teamId: team._id },
        { $set: { teamId: null } },
        { session }
      );
      // We keep the Team document for history, or delete it? We'll keep it as REJECTED.
    } else if (status === 'APPROVED') {
      // If new members were provided by lecturer, update them
      if (newMemberIds && Array.isArray(newMemberIds)) {
        const uniqueNewMemberIds = [...new Set(newMemberIds.map(String))];
        const nextStudents = await Student.find({
          _id: { $in: uniqueNewMemberIds },
          classId: team.classId
        }).session(session);

        if (nextStudents.length !== uniqueNewMemberIds.length) {
          await session.abortTransaction(); session.endSession();
          return errorResponse(res, 'One or more selected students do not belong to this class', 400);
        }

        const assignedElsewhere = nextStudents.filter(s => (
          s.teamId && s.teamId.toString() !== team._id.toString()
        ));
        if (assignedElsewhere.length > 0) {
          await session.abortTransaction(); session.endSession();
          return errorResponse(
            res,
            `These students are already in another team: ${assignedElsewhere.map(s => s.fullName).join(', ')}`,
            400
          );
        }

        uniqueNewMemberIds.forEach(id => notificationStudentIds.add(id));

        // Find current members
        const currentIds = team.members.map(m => m.studentId.toString());
        const idsToAdd = uniqueNewMemberIds.filter(id => !currentIds.includes(id));
        const idsToRemove = currentIds.filter(id => !uniqueNewMemberIds.includes(id));

        if (idsToRemove.length > 0) {
          await Student.updateMany(
            { _id: { $in: idsToRemove } },
            { $set: { teamId: null } },
            { session }
          );
        }
        if (idsToAdd.length > 0) {
          await Student.updateMany(
            { _id: { $in: idsToAdd } },
            { $set: { teamId: team._id } },
            { session }
          );
        }

    // Rebuild members array
        team.members = uniqueNewMemberIds.map(id => ({
          studentId: id,
          roleInTeam: id === team.leaderId?.toString() ? 'Leader' : 'Member'
        }));
      }

      // Create Chat Group if it doesn't exist
      if (!team.chatGroupId) {
        const { createChatGroupForTeam } = require('../services/chatGroup.service');
        const chatGroup = await createChatGroupForTeam(team._id, { session, createdBy: req.user._id });
        team.chatGroupId = chatGroup._id;
      }
    }

    await team.save({ session });
    await session.commitTransaction();
    session.endSession();

    await team.populate([
      { path: 'members.studentId', select: 'fullName email rollNumber major avatarUrl userId' },
      { path: 'leaderId', select: 'fullName email avatarUrl userId' }
    ]);

    // --- Send Notifications ---
    try {
      const { createBulkNotifications } = require('../services/notification.service');
      const notificationStudents = await Student.find({
        _id: { $in: [...notificationStudentIds] }
      }).select('userId email');
      const recipients = notificationStudents
        .map(s => ({ id: s.userId, email: s.email }))
        .filter(r => r.email);

      if (recipients.length > 0) {
        const statusCopy = {
          APPROVED: {
            title: 'Đề xuất nhóm được chấp nhận',
            action: 'được chấp nhận',
          },
          NEEDS_REVISION: {
            title: 'Đề xuất nhóm cần chỉnh sửa',
            action: 'được yêu cầu chỉnh sửa',
          },
          REJECTED: {
            title: 'Đề xuất nhóm bị từ chối',
            action: 'bị từ chối',
          },
        }[status];
        const payload = {
          type: 'TEAM',
          title: statusCopy.title,
          message: `Đề xuất cho nhóm "${team.groupName}" - Project: "${team.projectName}" đã ${statusCopy.action}.${reviewNote ? ` Phản hồi: ${reviewNote}` : ''}`,
          link: `/student/classes/${team.classId}`,
          data: { teamId: team._id, classId: team.classId, status },
          createdBy: req.user._id
        };
        await createBulkNotifications(recipients, payload);
      }
    } catch (notifErr) {
      console.error('Failed to send notifications for team review:', notifErr);
    }

    return successResponse(res, { team }, `Proposal ${status.toLowerCase()}`);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Review Proposal Error:', err);
    return errorResponse(res, 'Server error', 500);
  }
};

// ─── PUT /api/teams/:teamId ───────────────────────────────────────────────────
exports.updateTeam = async (req, res) => {
  const { teamName, description, groupName, projectName } = req.body;
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return errorResponse(res, 'Team not found', 404);

    if (req.user.role === 'LECTURER') {
      const cls = await Class.findById(team.classId);
      if (!cls) return errorResponse(res, 'Class not found', 404);
      if (cls.lectureId?.toString() !== req.user._id.toString()) {
        return errorResponse(res, 'You do not have permission to update this team', 403);
      }
    }

    // Validate permission for students
    if (req.user.role === 'STUDENT') {
      if (teamName !== undefined) {
        return errorResponse(res, 'Only admins or lecturers can rename teams', 403);
      }
      const studentRecord = await Student.findOne({
        classId: team.classId,
        $or: [
          { userId: req.user._id },
          { email: req.user.email?.toLowerCase() }
        ]
      });
      if (!studentRecord || studentRecord.teamId?.toString() !== team._id.toString()) {
        return errorResponse(res, 'You do not have permission to update this team', 403);
      }
      if (team.leaderId?.toString() !== studentRecord._id.toString()) {
        return errorResponse(res, 'Only the team leader can update team information', 403);
      }
    }

    if (teamName !== undefined) {
      const teamNameValidation = validateName(teamName, 'Team name');
      if (teamNameValidation.error) return errorResponse(res, teamNameValidation.error, 400);
      team.teamName = teamNameValidation.value;
    }
    if (groupName !== undefined) {
      const groupValidation = validateName(groupName, 'Group name');
      if (groupValidation.error) return errorResponse(res, groupValidation.error, 400);
      const conflict = await Team.findOne({
        _id: { $ne: team._id },
        classId: team.classId,
        groupName: groupValidation.value,
        status: { $ne: 'REJECTED' }
      });
      if (conflict) return errorResponse(res, 'Group name is already taken in this class', 400);
      team.groupName = groupValidation.value;
    }
    if (projectName !== undefined) {
      const projectValidation = validateName(projectName, 'Project name');
      if (projectValidation.error) return errorResponse(res, projectValidation.error, 400);
      team.projectName = projectValidation.value;
    }
    if (description !== undefined) {
      const descriptionValidation = validateDescription(description);
      if (descriptionValidation.error) return errorResponse(res, descriptionValidation.error, 400);
      team.description = descriptionValidation.value;
    }
    
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

    // Also add mentor to Class.mentorIds if not already there
    await Class.findByIdAndUpdate(team.classId, {
      $addToSet: { mentorIds: mentorId }
    });

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
