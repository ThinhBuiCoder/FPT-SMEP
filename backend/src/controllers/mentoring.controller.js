// src/controllers/mentoring.controller.js
const MentoringSession = require('../models/MentoringSession');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/mentoring-sessions
const createSession = async (req, res) => {
  const { teamId, title, meetingDate, notes, actionItems } = req.body;
  if (!teamId || !title || !meetingDate) return errorResponse(res, 'Thiếu: teamId, title, meetingDate.', 400);
  try {
    const session = await MentoringSession.create({
      teamId, lecturerId: req.user._id, title,
      meetingDate: new Date(meetingDate), notes: notes || '',
      actionItems: actionItems || [],
    });
    await session.populate([
      { path: 'lecturerId', select: 'name email avatar' },
      { path: 'teamId', select: 'name' },
    ]);
    return successResponse(res, { session }, 'Tạo mentoring session thành công!', 201);
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/mentoring-sessions/team/:teamId
const getSessionsByTeam = async (req, res) => {
  try {
    const sessions = await MentoringSession.find({ teamId: req.params.teamId })
      .populate('lecturerId', 'name email avatar')
      .sort({ meetingDate: -1 });
    return successResponse(res, { sessions });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/mentoring-sessions/lecturer (sessions của tôi)
const getMyLecturerSessions = async (req, res) => {
  try {
    const sessions = await MentoringSession.find({ lecturerId: req.user._id })
      .populate('teamId', 'name classId')
      .sort({ meetingDate: -1 });
    return successResponse(res, { sessions });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/mentoring-sessions/:id
const updateSession = async (req, res) => {
  const { title, meetingDate, notes, actionItems } = req.body;
  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Không tìm thấy session.', 404);
    if (session.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN')
      return errorResponse(res, 'Không có quyền chỉnh sửa.', 403);

    Object.assign(session, {
      title, meetingDate: meetingDate ? new Date(meetingDate) : session.meetingDate,
      notes, actionItems,
    });
    await session.save();
    return successResponse(res, { session }, 'Cập nhật session thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

const getAllSessions = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'LECTURER' || req.user.role === 'LECTURE') {
      query.lecturerId = req.user._id;
    } else if (req.user.role === 'MENTOR') {
      const Team = require('../models/Team');
      const Class = require('../models/Class');
      const mentoredClasses = await Class.find({ mentorIds: req.user._id });
      const classIds = mentoredClasses.map(c => c._id);
      const mentoredTeams = await Team.find({ classId: { $in: classIds } });
      const teamIds = mentoredTeams.map(t => t._id);
      query.teamId = { $in: teamIds };
    }
    const sessions = await MentoringSession.find(query)
      .populate('lecturerId', 'name email avatar')
      .populate('teamId', 'teamName teamCode')
      .sort({ meetingDate: -1 });

    return successResponse(res, { sessions });
  } catch (err) {
    console.error('getAllSessions error:', err);
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

const deleteSession = async (req, res) => {
  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Không tìm thấy session.', 404);
    if (session.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN')
      return errorResponse(res, 'Không có quyền xóa.', 403);

    await MentoringSession.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Xóa mentoring session thành công!');
  } catch (err) {
    console.error('deleteSession error:', err);
    return errorResponse(res, 'Lỗi server.', 500);
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
