// src/controllers/milestone.controller.js
const Milestone = require('../models/Milestone');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/milestones
const createMilestone = async (req, res) => {
  const { teamId, title, description, dueDate } = req.body;
  if (!teamId || !title || !dueDate) return errorResponse(res, 'Thiếu: teamId, title, dueDate.', 400);
  try {
    const milestone = await Milestone.create({ teamId, title, description, dueDate: new Date(dueDate) });
    return successResponse(res, { milestone }, 'Tạo milestone thành công!', 201);
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/milestones/team/:teamId
const getMilestonesByTeam = async (req, res) => {
  try {
    const now = new Date();
    const milestones = await Milestone.find({ teamId: req.params.teamId }).sort({ dueDate: 1 });

    // Auto-mark overdue in response (không save vào DB để tránh race condition)
    const result = milestones.map(m => {
      const obj = m.toObject();
      if (obj.status !== 'DONE' && new Date(obj.dueDate) < now) obj.status = 'OVERDUE';
      return obj;
    });

    return successResponse(res, { milestones: result });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/milestones/:id
const updateMilestone = async (req, res) => {
  const { title, description, dueDate, status } = req.body;
  try {
    const m = await Milestone.findByIdAndUpdate(
      req.params.id,
      { title, description, dueDate: dueDate ? new Date(dueDate) : undefined, status },
      { new: true, omitUndefined: true }
    );
    if (!m) return errorResponse(res, 'Không tìm thấy milestone.', 404);
    return successResponse(res, { milestone: m }, 'Cập nhật milestone thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// DELETE /api/milestones/:id
const deleteMilestone = async (req, res) => {
  try {
    const m = await Milestone.findByIdAndDelete(req.params.id);
    if (!m) return errorResponse(res, 'Không tìm thấy milestone.', 404);
    return successResponse(res, null, 'Xóa milestone thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { createMilestone, getMilestonesByTeam, updateMilestone, deleteMilestone };
