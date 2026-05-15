// src/controllers/startupIdea.controller.js
const StartupIdea = require('../models/StartupIdea');
const Team = require('../models/Team');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/startup-ideas
const createStartupIdea = async (req, res) => {
  const { teamId, startupName, problem, targetCustomer, solution,
          businessModel, technology, marketAnalysis, competitors, stage } = req.body;
  if (!teamId || !startupName || !problem || !solution)
    return errorResponse(res, 'Thiếu: teamId, startupName, problem, solution.', 400);
  try {
    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, 'Không tìm thấy team.', 404);
    if (req.user.role === 'STUDENT' && !team.members.some(m => m.userId.toString() === req.user._id.toString()))
      return errorResponse(res, 'Bạn không thuộc team này.', 403);

    const idea = await StartupIdea.create({
      teamId, startupName, problem, targetCustomer, solution,
      businessModel, technology, marketAnalysis, competitors, stage,
    });
    await idea.populate('teamId', 'name classId');
    return successResponse(res, { startupIdea: idea }, 'Tạo startup idea thành công!', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/startup-ideas
const getStartupIdeas = async (req, res) => {
  try {
    const { teamId, status, search } = req.query;
    const query = {};
    if (teamId) query.teamId = teamId;
    if (status) query.status = status;
    if (search) query.$or = [
      { startupName: { $regex: search, $options: 'i' } },
      { problem: { $regex: search, $options: 'i' } },
    ];

    // Student: chỉ xem idea của team mình
    if (req.user.role === 'STUDENT') {
      const myTeams = await Team.find({ 'members.userId': req.user._id }, '_id');
      query.teamId = { $in: myTeams.map(t => t._id) };
    }
    // Lecturer: chỉ xem idea trong lớp mình
    if (req.user.role === 'LECTURER') {
      const Class = require('../models/Class');
      const myClasses = await Class.find({ lecturerId: req.user._id }, '_id');
      const classTeams = await Team.find({ classId: { $in: myClasses.map(c => c._id) } }, '_id');
      const allowedTeams = teamId
        ? classTeams.filter(t => t._id.toString() === teamId).map(t => t._id)
        : classTeams.map(t => t._id);
      query.teamId = { $in: allowedTeams };
    }

    const ideas = await StartupIdea.find(query)
      .populate({ path: 'teamId', select: 'name', populate: { path: 'classId', select: 'name code' } })
      .sort({ createdAt: -1 });

    return successResponse(res, { startupIdeas: ideas });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/startup-ideas/:id
const getStartupIdeaById = async (req, res) => {
  try {
    const idea = await StartupIdea.findById(req.params.id)
      .populate({ path: 'teamId', select: 'name members classId', populate: [
        { path: 'members.userId', select: 'name email avatar studentId' },
        { path: 'classId', select: 'name code semester lecturerId' },
      ]});
    if (!idea) return errorResponse(res, 'Không tìm thấy startup idea.', 404);
    return successResponse(res, { startupIdea: idea });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/startup-ideas/:id
const updateStartupIdea = async (req, res) => {
  const { startupName, problem, targetCustomer, solution, businessModel,
          technology, marketAnalysis, competitors, stage, status } = req.body;
  try {
    const idea = await StartupIdea.findById(req.params.id).populate('teamId');
    if (!idea) return errorResponse(res, 'Không tìm thấy idea.', 404);
    if (req.user.role === 'STUDENT' && !idea.teamId.members.some(m => m.userId.toString() === req.user._id.toString()))
      return errorResponse(res, 'Không có quyền chỉnh sửa.', 403);

    Object.assign(idea, { startupName, problem, targetCustomer, solution, businessModel,
      technology, marketAnalysis, competitors, stage, ...(status && { status }) });
    await idea.save();
    return successResponse(res, { startupIdea: idea }, 'Cập nhật thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// DELETE /api/startup-ideas/:id
const deleteStartupIdea = async (req, res) => {
  try {
    const idea = await StartupIdea.findByIdAndDelete(req.params.id);
    if (!idea) return errorResponse(res, 'Không tìm thấy idea.', 404);
    return successResponse(res, null, 'Xóa thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// POST /api/startup-ideas/:id/submit
const submitForReview = async (req, res) => {
  try {
    const idea = await StartupIdea.findById(req.params.id);
    if (!idea) return errorResponse(res, 'Không tìm thấy idea.', 404);
    if (!['DRAFT', 'IMPROVING'].includes(idea.status))
      return errorResponse(res, 'Chỉ submit được khi DRAFT hoặc IMPROVING.', 400);
    idea.status = 'SUBMITTED';
    idea.submittedAt = new Date();
    await idea.save();
    return successResponse(res, { startupIdea: idea }, 'Đã submit để review!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { createStartupIdea, getStartupIdeas, getStartupIdeaById, updateStartupIdea, deleteStartupIdea, submitForReview };
