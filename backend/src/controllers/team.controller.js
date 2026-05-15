// src/controllers/team.controller.js
const Team = require('../models/Team');
const Class = require('../models/Class');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/teams
const createTeam = async (req, res) => {
  const { classId, name, description } = req.body;
  if (!classId || !name) return errorResponse(res, 'Thiếu: classId, name.', 400);
  try {
    const cls = await Class.findById(classId);
    if (!cls) return errorResponse(res, 'Không tìm thấy lớp.', 404);

    // Student phải thuộc lớp
    if (req.user.role === 'STUDENT' && !cls.members.some(m => m.toString() === req.user._id.toString()))
      return errorResponse(res, 'Bạn không thuộc lớp này.', 403);

    const members = req.user.role === 'STUDENT'
      ? [{ userId: req.user._id, roleInTeam: 'CEO' }]
      : [];

    const team = await Team.create({ classId, name, description, members });
    await team.populate([
      { path: 'classId', select: 'name code semester' },
      { path: 'members.userId', select: 'name email avatar studentId' },
    ]);
    return successResponse(res, { team }, 'Tạo team thành công!', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Lỗi khi tạo team.', 500);
  }
};

// GET /api/teams?classId=
const getTeams = async (req, res) => {
  try {
    const { classId } = req.query;
    const query = {};
    if (classId) query.classId = classId;
    if (req.user.role === 'STUDENT') query['members.userId'] = req.user._id;

    const teams = await Team.find(query)
      .populate('classId', 'name code semester')
      .populate('members.userId', 'name email avatar studentId')
      .sort({ createdAt: -1 });

    return successResponse(res, { teams });
  } catch (err) {
    return errorResponse(res, 'Lỗi khi lấy teams.', 500);
  }
};

// GET /api/teams/:id
const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('classId', 'name code semester lecturerId')
      .populate('members.userId', 'name email avatar studentId bio');
    if (!team) return errorResponse(res, 'Không tìm thấy team.', 404);
    return successResponse(res, { team });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/teams/:id
const updateTeam = async (req, res) => {
  const { name, description } = req.body;
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, { name, description }, { new: true })
      .populate('members.userId', 'name email avatar');
    if (!team) return errorResponse(res, 'Không tìm thấy team.', 404);
    return successResponse(res, { team }, 'Cập nhật team thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// POST /api/teams/:id/members
const addMember = async (req, res) => {
  const { userId, roleInTeam = 'Member' } = req.body;
  if (!userId) return errorResponse(res, 'Thiếu userId.', 400);
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return errorResponse(res, 'Không tìm thấy team.', 404);

    // Prevent duplicate
    if (team.members.some(m => m.userId.toString() === userId)) {
      // Update role instead
      team.members = team.members.map(m =>
        m.userId.toString() === userId ? { userId: m.userId, roleInTeam } : m
      );
    } else {
      team.members.push({ userId, roleInTeam });
    }
    await team.save();
    await team.populate('members.userId', 'name email avatar studentId');
    return successResponse(res, { team }, 'Đã thêm thành viên!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// DELETE /api/teams/:id/members/:userId
const removeMember = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return errorResponse(res, 'Không tìm thấy team.', 404);
    team.members = team.members.filter(m => m.userId.toString() !== req.params.userId);
    await team.save();
    return successResponse(res, null, 'Đã xóa thành viên!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { createTeam, getTeams, getTeamById, updateTeam, addMember, removeMember };
