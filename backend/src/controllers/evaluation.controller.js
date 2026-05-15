// src/controllers/evaluation.controller.js
const Evaluation = require('../models/Evaluation');
const StartupIdea = require('../models/StartupIdea');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/evaluations
const createEvaluation = async (req, res) => {
  const { startupIdeaId, innovationScore, feasibilityScore,
          marketScore, technicalScore, presentationScore, comment } = req.body;
  if (!startupIdeaId) return errorResponse(res, 'Thiếu startupIdeaId.', 400);

  const scores = [innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore];
  if (scores.some(s => s == null || s < 0 || s > 10))
    return errorResponse(res, 'Mỗi điểm phải từ 0 đến 10.', 400);

  try {
    const idea = await StartupIdea.findById(startupIdeaId);
    if (!idea) return errorResponse(res, 'Không tìm thấy idea.', 404);

    // Check existing evaluation from this lecturer
    let evaluation = await Evaluation.findOne({ startupIdeaId, lecturerId: req.user._id });
    if (evaluation) {
      // Update existing
      Object.assign(evaluation, { innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore, comment });
    } else {
      evaluation = new Evaluation({ startupIdeaId, lecturerId: req.user._id,
        innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore, comment });
    }
    await evaluation.save(); // pre-save calculates totalScore

    // Update idea status
    idea.status = 'REVIEWED';
    await idea.save();

    await evaluation.populate('lecturerId', 'name email avatar');
    return successResponse(res, { evaluation }, 'Đánh giá thành công!', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/evaluations/startup/:startupIdeaId
const getEvaluationsByStartup = async (req, res) => {
  try {
    const evaluations = await Evaluation.find({ startupIdeaId: req.params.startupIdeaId })
      .populate('lecturerId', 'name email avatar')
      .sort({ createdAt: -1 });
    return successResponse(res, { evaluations });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/evaluations/lecturer/:lecturerId
const getEvaluationsByLecturer = async (req, res) => {
  try {
    const evaluations = await Evaluation.find({ lecturerId: req.params.lecturerId })
      .populate({ path: 'startupIdeaId', select: 'startupName status teamId',
        populate: { path: 'teamId', select: 'name classId', populate: { path: 'classId', select: 'name' } } })
      .sort({ createdAt: -1 });
    return successResponse(res, { evaluations });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/evaluations/:id
const updateEvaluation = async (req, res) => {
  const { innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore, comment } = req.body;
  try {
    const ev = await Evaluation.findById(req.params.id);
    if (!ev) return errorResponse(res, 'Không tìm thấy đánh giá.', 404);
    if (ev.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN')
      return errorResponse(res, 'Không có quyền chỉnh sửa.', 403);

    Object.assign(ev, { innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore, comment });
    await ev.save();
    await ev.populate('lecturerId', 'name email');
    return successResponse(res, { evaluation: ev }, 'Cập nhật đánh giá thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { createEvaluation, getEvaluationsByStartup, getEvaluationsByLecturer, updateEvaluation };
