// src/controllers/mentoring.controller.js
const MentoringSession = require('../models/MentoringSession');
const Team = require('../models/Team');
const workspacePerm = require('../utils/workspacePermission');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/mentoring-sessions
const createSession = async (req, res) => {
  const { teamId, title, description, meetingDate, startTime, endTime, location, meetingLink, notes, actionItems, status, attendance } = req.body;
  
  if (!teamId || !title || !meetingDate) {
    return errorResponse(res, 'Missing required fields: teamId, title, meetingDate.', 400);
  }

  if (startTime && endTime) {
    if (startTime >= endTime) {
      return errorResponse(res, 'Start time must be before end time.', 400);
    }
  }

  try {
    // Permission check: Must have access to team
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);
    
    // Role check: Student/User cannot create sessions
    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      return errorResponse(res, 'Students cannot create mentoring sessions.', 403);
    }

    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, 'Team not found.', 404);

    const session = await MentoringSession.create({
      teamId,
      classId: team.classId,
      lecturerId: req.user._id,
      createdBy: req.user._id,
      title,
      description: description || '',
      meetingDate: new Date(meetingDate),
      startTime: startTime || '',
      endTime: endTime || '',
      location: location || '',
      meetingLink: meetingLink || '',
      notes: notes || '',
      actionItems: actionItems || [],
      status: status || 'SCHEDULED',
      attendance: attendance || []
    });

    await session.populate([
      { path: 'lecturerId', select: 'name email avatar role' },
      { path: 'teamId', select: 'teamName teamCode' },
    ]);
    return successResponse(res, { session }, 'Mentoring session created successfully!', 201);
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// GET /api/mentoring-sessions/team/:teamId
const getSessionsByTeam = async (req, res) => {
  try {
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, req.params.teamId);

    const sessions = await MentoringSession.find({ teamId: req.params.teamId })
      .populate('lecturerId', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .sort({ meetingDate: -1, startTime: -1 });

    return successResponse(res, { sessions });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// GET /api/mentoring-sessions/lecturer (sessions của tôi)
const getMyLecturerSessions = async (req, res) => {
  try {
    const sessions = await MentoringSession.find({ lecturerId: req.user._id })
      .populate('teamId', 'teamName teamCode classId')
      .sort({ meetingDate: -1, startTime: -1 });
    return successResponse(res, { sessions });
  } catch (err) {
    return errorResponse(res, 'Server error.', 500);
  }
};

// PUT /api/mentoring-sessions/:id
const updateSession = async (req, res) => {
  const { title, description, meetingDate, startTime, endTime, location, meetingLink, notes, actionItems, status, attendance } = req.body;
  try {
    if (startTime && endTime) {
      if (startTime >= endTime) {
        return errorResponse(res, 'Start time must be before end time.', 400);
      }
    }

    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);

    // Permission check
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, session.teamId);

    // Only creator, assigned lecturer/mentor, or admin can update
    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());
    
    if (!isOwner && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'You do not have permission to update this session.', 403);
    }

    Object.assign(session, {
      title,
      description: description !== undefined ? description : session.description,
      meetingDate: meetingDate ? new Date(meetingDate) : session.meetingDate,
      startTime: startTime !== undefined ? startTime : session.startTime,
      endTime: endTime !== undefined ? endTime : session.endTime,
      location: location !== undefined ? location : session.location,
      meetingLink: meetingLink !== undefined ? meetingLink : session.meetingLink,
      notes: notes !== undefined ? notes : session.notes,
      actionItems: actionItems !== undefined ? actionItems : session.actionItems,
      status: status !== undefined ? status : session.status,
      attendance: attendance !== undefined ? attendance : session.attendance
    });

    await session.save();
    await session.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { session }, 'Session updated successfully!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

const getAllSessions = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'LECTURER' || req.user.role === 'LECTURE') {
      query.lecturerId = req.user._id;
    } else if (req.user.role === 'MENTOR') {
      const Class = require('../models/Class');
      const mentoredClasses = await Class.find({ mentorIds: req.user._id });
      const classIds = mentoredClasses.map(c => c._id);
      const mentoredTeams = await Team.find({ classId: { $in: classIds } });
      const teamIds = mentoredTeams.map(t => t._id);
      
      // MENTOR can see sessions they created or are assigned to their teams
      query.$or = [
        { lecturerId: req.user._id },
        { teamId: { $in: teamIds } }
      ];
    }
    const sessions = await MentoringSession.find(query)
      .populate('lecturerId', 'name email avatar role')
      .populate('teamId', 'teamName teamCode')
      .sort({ meetingDate: -1, startTime: -1 });

    return successResponse(res, { sessions });
  } catch (err) {
    console.error('getAllSessions error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

const deleteSession = async (req, res) => {
  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, session.teamId);

    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());

    if (!isOwner && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'You do not have permission to delete this session.', 403);
    }

    await MentoringSession.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Session deleted successfully!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

module.exports = {
  createSession,
  getSessionsByTeam,
  getMyLecturerSessions,
  updateSession,
  getAllSessions,
  deleteSession
};
