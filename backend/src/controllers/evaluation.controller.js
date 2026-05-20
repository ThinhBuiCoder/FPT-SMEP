// src/controllers/evaluation.controller.js
const Evaluation = require('../models/Evaluation');
const StartupIdea = require('../models/StartupIdea');
const Team = require('../models/Team');
const Class = require('../models/Class');
const workspacePerm = require('../utils/workspacePermission');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 (LEGACY) APIs
// ─────────────────────────────────────────────────────────────────────────────
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

    let evaluation = await Evaluation.findOne({ startupIdeaId, lecturerId: req.user._id });
    if (evaluation) {
      Object.assign(evaluation, { innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore, comment });
    } else {
      evaluation = new Evaluation({ startupIdeaId, lecturerId: req.user._id,
        innovationScore, feasibilityScore, marketScore, technicalScore, presentationScore, comment });
    }
    await evaluation.save(); 

    idea.status = 'REVIEWED';
    await idea.save();

    await evaluation.populate('lecturerId', 'name email avatar');
    return successResponse(res, { evaluation }, 'Đánh giá thành công!', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

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

const getEvaluationsByLecturer = async (req, res) => {
  try {
    const evaluations = await Evaluation.find({ lecturerId: req.params.lecturerId, startupIdeaId: { $exists: true } })
      .populate({ path: 'startupIdeaId', select: 'startupName status teamId',
        populate: { path: 'teamId', select: 'name classId', populate: { path: 'classId', select: 'name' } } })
      .sort({ createdAt: -1 });
    return successResponse(res, { evaluations });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

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

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 (EVALUATION & MENTORING) APIs
// ─────────────────────────────────────────────────────────────────────────────

const getTeamEvaluations = async (req, res) => {
  try {
    const { teamId } = req.params;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const query = { teamId };
    
    // Students only see SUBMITTED or PUBLISHED
    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      query.status = { $in: ['SUBMITTED', 'PUBLISHED'] };
    }

    const evaluations = await Evaluation.find(query)
      .populate('lecturerId', 'name email avatar role')
      .sort({ createdAt: -1 });

    return successResponse(res, { evaluations });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, "Server error: " + err.message);
  }
};

const createTeamEvaluation = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { proposalId, pitchDeckId, rubricScores, overallFeedback, strengths, weaknesses, suggestions, status } = req.body;

    // Must be evaluator (Lecturer/Mentor/Admin assigned to team/class)
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);
    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      return errorResponse(res, "Students cannot create evaluations.", 403);
    }

    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, "Team not found", 404);

    // Prevent duplicate evaluation from same evaluator
    const existing = await Evaluation.findOne({ teamId, lecturerId: req.user._id });
    if (existing) {
      return errorResponse(res, "You have already created an evaluation for this team. Please update it instead.", 409);
    }

    const evaluation = new Evaluation({
      teamId,
      classId: team.classId,
      proposalId,
      pitchDeckId,
      lecturerId: req.user._id,
      evaluatorRole: req.user.role === 'ADMIN' ? 'ADMIN' : (req.user.role === 'MENTOR' ? 'MENTOR' : 'LECTURER'),
      rubricScores: rubricScores || [],
      overallFeedback: overallFeedback || '',
      strengths: strengths || '',
      weaknesses: weaknesses || '',
      suggestions: suggestions || '',
      status: status || 'DRAFT'
    });

    await evaluation.save();
    await evaluation.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { evaluation }, "Evaluation created successfully.");
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, "Server error: " + err.message);
  }
};

const updateTeamEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const ev = await Evaluation.findById(id);
    if (!ev) return errorResponse(res, "Evaluation not found.", 404);

    // Only owner or admin can update
    if (ev.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return errorResponse(res, "You do not have permission to update this evaluation.", 403);
    }

    const { proposalId, pitchDeckId, rubricScores, overallFeedback, strengths, weaknesses, suggestions, status } = req.body;
    
    if (proposalId) ev.proposalId = proposalId;
    if (pitchDeckId) ev.pitchDeckId = pitchDeckId;
    if (rubricScores) ev.rubricScores = rubricScores;
    if (overallFeedback !== undefined) ev.overallFeedback = overallFeedback;
    if (strengths !== undefined) ev.strengths = strengths;
    if (weaknesses !== undefined) ev.weaknesses = weaknesses;
    if (suggestions !== undefined) ev.suggestions = suggestions;
    if (status && (status === 'DRAFT' || status === 'SUBMITTED' || status === 'PUBLISHED')) {
      ev.status = status;
    }

    await ev.save();
    await ev.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { evaluation: ev }, "Evaluation updated successfully.");
  } catch (err) {
    return errorResponse(res, "Server error: " + err.message);
  }
};

const submitTeamEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const ev = await Evaluation.findById(id);
    if (!ev) return errorResponse(res, "Evaluation not found.", 404);

    if (ev.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return errorResponse(res, "You do not have permission to submit this evaluation.", 403);
    }

    ev.status = 'SUBMITTED';
    await ev.save();
    await ev.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { evaluation: ev }, "Evaluation submitted successfully.");
  } catch (err) {
    return errorResponse(res, "Server error: " + err.message);
  }
};

module.exports = {
  // Legacy
  createEvaluation, 
  getEvaluationsByStartup, 
  getEvaluationsByLecturer, 
  updateEvaluation,
  
  // Module 4
  getTeamEvaluations,
  createTeamEvaluation,
  updateTeamEvaluation,
  submitTeamEvaluation
};
