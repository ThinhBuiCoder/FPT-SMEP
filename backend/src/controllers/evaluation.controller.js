// src/controllers/evaluation.controller.js
const Evaluation = require('../models/Evaluation');
const EvaluationHistory = require('../models/EvaluationHistory');
const StartupIdea = require('../models/StartupIdea');
const Team = require('../models/Team');
const Class = require('../models/Class');
const workspacePerm = require('../utils/workspacePermission');
const workspaceAccess = require('../services/workspaceAccess.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { getCheckpointConfig } = require('../config/checkpointConfig');
const { normalizeRubricScores, assertValidRubric } = require('../services/evaluationScoring.service');
const {
  formatEvaluationsByRole,
  formatHistoryByRole,
  getPerformanceLevel,
} = require('../services/evaluationVisibility.service');

const buildRole = (role) => {
  const normalized = (role || '').toString().toUpperCase();
  if (normalized === 'MENTOR') return 'MENTOR';
  if (normalized === 'ADMIN') return 'ADMIN';
  return 'LECTURER';
};

const buildSnapshot = (evaluation) => {
  const doc = evaluation.toObject ? evaluation.toObject() : { ...evaluation };
  delete doc.__v;
  return doc;
};

const recordHistory = async ({ evaluation, action, changedBy, note = '' }) => {
  const nextVersion = (evaluation.historyVersion || 0) + 1;
  evaluation.historyVersion = nextVersion;

  await EvaluationHistory.create({
    evaluationId: evaluation._id,
    teamId: evaluation.teamId,
    classId: evaluation.classId,
    proposalId: evaluation.proposalId,
    checkpointNumber: evaluation.checkpointNumber,
    action,
    version: nextVersion,
    changedBy: changedBy._id,
    changedByRole: buildRole(changedBy.role),
    snapshot: buildSnapshot(evaluation),
    note,
  });
};

const ensureEditable = (evaluation, user) => {
  if (evaluation.status === 'SUBMITTED' && user.role !== 'ADMIN') {
    const error = new Error('Submitted evaluations cannot be edited directly.');
    error.statusCode = 409;
    throw error;
  }
};

const normalizeEvaluationPayload = (checkpointNumber, payload) => {
  const checkpointConfig = getCheckpointConfig(checkpointNumber);
  if (!checkpointConfig) {
    const error = new Error('Invalid checkpoint number.');
    error.statusCode = 400;
    throw error;
  }

  const { rubricScores = [] } = payload;
  assertValidRubric(checkpointNumber, rubricScores);
  const normalized = normalizeRubricScores(checkpointNumber, rubricScores);

  return {
    checkpointConfig,
    rubricScores: normalized.rubricScores,
    totalWeight: normalized.totalWeight,
    checkpointTotal: normalized.checkpointTotal,
  };
};

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
    const checkpointNumber = req.params.checkpointNumber || req.query.checkpointNumber;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const query = { teamId };
    if (checkpointNumber) {
      query.checkpointNumber = parseInt(checkpointNumber, 10);
    }

    // Students only see SUBMITTED or PUBLISHED
    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      query.status = { $in: ['SUBMITTED', 'PUBLISHED'] };
    }

    const evaluations = await Evaluation.find(query)
      .populate('lecturerId', 'name email avatar role')
      .sort({ createdAt: -1 });

    // Apply role-based visibility — Mentor receives sanitized (score-free) data
    const formattedEvaluations = formatEvaluationsByRole(evaluations, req.user.role);

    return successResponse(res, { evaluations: formattedEvaluations });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, "Server error: " + err.message);
  }
};

const getCheckpointEvaluationSummary = async (req, res) => {
  try {
    const { teamId, checkpointNumber } = req.params;
    const cpNum = parseInt(checkpointNumber, 10);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const checkpointConfig = getCheckpointConfig(cpNum);
    if (!checkpointConfig) return errorResponse(res, 'Invalid checkpoint number.', 400);

    const evaluationQuery = { teamId, checkpointNumber: cpNum };
    const historyQuery = { teamId, checkpointNumber: cpNum };

    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      evaluationQuery.status = { $in: ['SUBMITTED', 'PUBLISHED'] };
      historyQuery['snapshot.status'] = { $in: ['SUBMITTED', 'PUBLISHED'] };
    }

    const evaluations = await Evaluation.find(evaluationQuery)
      .populate('lecturerId', 'name email avatar role')
      .sort({ updatedAt: -1 });

    const history = await EvaluationHistory.find(historyQuery)
      .populate('changedBy', 'name email avatar role')
      .sort({ createdAt: -1 });

    const published = evaluations.filter((ev) => ev.status === 'SUBMITTED' || ev.status === 'PUBLISHED');
    const hasPublished = published.length > 0;
    const average = hasPublished
      ? Number((published.reduce((sum, ev) => sum + (ev.checkpointTotal || ev.weightedScore || 0), 0) / published.length).toFixed(2))
      : null;

    const overallPerformance = hasPublished ? getPerformanceLevel(average) : null;

    // Apply role-based visibility to evaluations and history
    const isMentorOrStudent = ['MENTOR', 'STUDENT'].includes((req.user.role || '').toUpperCase());
    const formattedEvaluations = formatEvaluationsByRole(evaluations, req.user.role);
    const formattedHistory = formatHistoryByRole(history, req.user.role);

    // For Mentor/Student: replace averageScore with overall performance level, omit numeric
    const summaryBase = {
      checkpointNumber: cpNum,
      evaluationCount: evaluations.length,
      submittedCount: published.length,
    };

    const summary = isMentorOrStudent
      ? {
          ...summaryBase,
          overallPerformance,
          // averageScore intentionally omitted
        }
      : {
          ...summaryBase,
          averageScore: average,
          overallPerformance,
        };

    return successResponse(res, {
      checkpoint: checkpointConfig,
      evaluations: formattedEvaluations,
      history: formattedHistory,
      summary,
    });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

const createTeamEvaluation = async (req, res) => {
  try {
    const { teamId } = req.params;
    const checkpointNumber = req.params.checkpointNumber || req.body.checkpointNumber;
    const cpNum = parseInt(checkpointNumber, 10);
    const { proposalId, pitchDeckId, rubricScores, overallFeedback, strengths, weaknesses, suggestions, status } = req.body;

    // Must be evaluator (Lecturer/Mentor/Admin assigned to team/class)
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, teamId);
    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      return errorResponse(res, "Students cannot create evaluations.", 403);
    }

    const checkpointConfig = getCheckpointConfig(cpNum);
    if (!checkpointConfig) return errorResponse(res, 'Invalid checkpoint number.', 400);

    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, "Team not found", 404);

    const existing = await Evaluation.findOne({ teamId, checkpointNumber: cpNum, lecturerId: req.user._id });
    if (existing) {
      return errorResponse(res, "You have already created an evaluation for this team. Please update it instead.", 409);
    }

    const normalized = normalizeEvaluationPayload(cpNum, { rubricScores: rubricScores || [] });

    const evaluation = new Evaluation({
      teamId,
      classId: team.classId,
      proposalId,
      pitchDeckId,
      checkpointNumber: cpNum,
      checkpointTitle: checkpointConfig.title,
      lecturerId: req.user._id,
      evaluatorRole: buildRole(req.user.role),
      rubricScores: normalized.rubricScores,
      totalWeight: normalized.totalWeight,
      checkpointTotal: normalized.checkpointTotal,
      weightedScore: normalized.checkpointTotal,
      overallFeedback: overallFeedback || '',
      strengths: strengths || '',
      weaknesses: weaknesses || '',
      suggestions: suggestions || '',
      status: status || 'DRAFT'
    });

    await evaluation.save();
    await recordHistory({ evaluation, action: 'CREATED', changedBy: req.user, note: 'Initial evaluation created.' });
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
    await workspaceAccess.assertCanMutateWorkspace(req.user, ev.teamId);

    // Only owner or admin can update, and submitted evaluations are locked.
    if (ev.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return errorResponse(res, "You do not have permission to update this evaluation.", 403);
    }
    ensureEditable(ev, req.user);

    const { proposalId, pitchDeckId, rubricScores, overallFeedback, strengths, weaknesses, suggestions, status } = req.body;
    
    if (proposalId) ev.proposalId = proposalId;
    if (pitchDeckId) ev.pitchDeckId = pitchDeckId;
    if (rubricScores) {
      const normalized = normalizeEvaluationPayload(ev.checkpointNumber, { rubricScores });
      ev.rubricScores = normalized.rubricScores;
      ev.totalWeight = normalized.totalWeight;
      ev.checkpointTotal = normalized.checkpointTotal;
      ev.weightedScore = normalized.checkpointTotal;
    }
    if (overallFeedback !== undefined) ev.overallFeedback = overallFeedback;
    if (strengths !== undefined) ev.strengths = strengths;
    if (weaknesses !== undefined) ev.weaknesses = weaknesses;
    if (suggestions !== undefined) ev.suggestions = suggestions;
    if (status && (status === 'DRAFT' || status === 'SUBMITTED' || status === 'PUBLISHED')) {
      ev.status = status;
    }

    await ev.save();
    await recordHistory({ evaluation: ev, action: 'UPDATED', changedBy: req.user, note: 'Evaluation updated.' });
    await ev.save();
    await ev.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { evaluation: ev }, "Evaluation updated successfully.");
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    if (err.statusCode === 400 || err.statusCode === 409) return errorResponse(res, err.message, err.statusCode);
    return errorResponse(res, "Server error: " + err.message);
  }
};

const submitTeamEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const ev = await Evaluation.findById(id);
    if (!ev) return errorResponse(res, "Evaluation not found.", 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, ev.teamId);

    if (ev.lecturerId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return errorResponse(res, "You do not have permission to submit this evaluation.", 403);
    }

    ensureEditable(ev, req.user);
    ev.status = 'SUBMITTED';
    ev.submittedAt = ev.submittedAt || new Date();
    ev.lockedAt = new Date();
    await ev.save();
    await recordHistory({ evaluation: ev, action: 'SUBMITTED', changedBy: req.user, note: 'Evaluation submitted officially.' });
    await ev.save();
    await ev.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { evaluation: ev }, "Evaluation submitted successfully.");
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    if (err.statusCode === 400 || err.statusCode === 409) return errorResponse(res, err.message, err.statusCode);
    return errorResponse(res, "Server error: " + err.message);
  }
};

const getTeamEvaluationHistory = async (req, res) => {
  try {
    const { teamId, checkpointNumber } = req.params;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const query = { teamId };
    if (checkpointNumber) query.checkpointNumber = parseInt(checkpointNumber, 10);

    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      query['snapshot.status'] = { $in: ['SUBMITTED', 'PUBLISHED'] };
    }

    const history = await EvaluationHistory.find(query)
      .populate('changedBy', 'name email avatar role')
      .sort({ createdAt: -1 });

    // Apply role-based visibility — Mentor sees history without numeric scores
    const formattedHistory = formatHistoryByRole(history, req.user.role);

    return successResponse(res, { history: formattedHistory });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error: ' + err.message);
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
  submitTeamEvaluation,
  getCheckpointEvaluationSummary,
  getTeamEvaluationHistory,
};
