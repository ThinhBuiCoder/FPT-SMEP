// src/controllers/comment.controller.js — THREADED COMMENTS MANAGEMENT
const Comment = require('../models/Comment');
const Evaluation = require('../models/Evaluation');
const Proposal = require('../models/Proposal');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const workspacePerm = require('../utils/workspacePermission');

/**
 * Create a new comment on a proposal/evaluation
 * POST /api/comments
 */
const createComment = async (req, res) => {
  try {
    const { proposalId, evaluationId, text, section, checkpointNumber, teamId } = req.body;

    // Must have at least proposalId
    if (!proposalId) {
      return errorResponse(res, 'proposalId is required.', 400);
    }

    // Validate text
    if (!text || !text.trim()) {
      return errorResponse(res, 'Comment text is required.', 400);
    }

    // Permission check: user must be able to access this team/workspace
    if (teamId) {
      await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);
    }

    // Create comment
    const comment = new Comment({
      proposalId,
      evaluationId: evaluationId || null,
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      text: text.trim(),
      section: section || 'OVERALL',
      checkpointNumber: checkpointNumber || null,
      teamId: teamId || null,
      classId: req.user.classId || null,
    });

    await comment.save();
    await comment.populate('authorId', 'name email avatar role');

    return successResponse(
      res,
      { comment },
      'Comment created successfully.',
      201
    );
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Get all comments for a proposal
 * GET /api/comments/proposal/:proposalId
 */
const getProposalComments = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { section, resolved } = req.query;

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, 'Proposal not found.', 404);
    }

    // Permission check
    if (proposal.teamId && req.user.role === 'STUDENT') {
      await workspacePerm.assertCanAccessTeamWorkspace(req.user, proposal.teamId);
    }

    const query = { proposalId };

    if (section) {
      query.section = section;
    }

    if (resolved !== undefined) {
      query.resolved = resolved === 'true';
    }

    const comments = await Comment.find(query)
      .populate('authorId', 'name email avatar role')
      .populate('resolvedBy', 'name email avatar')
      .sort({ createdAt: -1 });

    return successResponse(res, { comments });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Get all comments for an evaluation
 * GET /api/comments/evaluation/:evaluationId
 */
const getEvaluationComments = async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { section, resolved } = req.query;

    const evaluation = await Evaluation.findById(evaluationId);
    if (!evaluation) {
      return errorResponse(res, 'Evaluation not found.', 404);
    }

    // Permission check
    if (evaluation.teamId) {
      await workspacePerm.assertCanAccessTeamWorkspace(req.user, evaluation.teamId);
    }

    const query = { evaluationId };

    if (section) {
      query.section = section;
    }

    if (resolved !== undefined) {
      query.resolved = resolved === 'true';
    }

    const comments = await Comment.find(query)
      .populate('authorId', 'name email avatar role')
      .populate('resolvedBy', 'name email avatar')
      .sort({ createdAt: -1 });

    return successResponse(res, { comments });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Get a single comment with all replies
 * GET /api/comments/:commentId
 */
const getComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId)
      .populate('authorId', 'name email avatar role')
      .populate('resolvedBy', 'name email avatar')
      .populate('replies.authorId', 'name email avatar role');

    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    return successResponse(res, { comment });
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Update a comment text
 * PUT /api/comments/:commentId
 */
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return errorResponse(res, 'Comment text is required.', 400);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    // Only author or admin can edit
    if (
      comment.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(res, 'You do not have permission to edit this comment.', 403);
    }

    comment.text = text.trim();
    comment.updatedAt = new Date();
    await comment.save();
    await comment.populate('authorId', 'name email avatar role');

    return successResponse(res, { comment }, 'Comment updated successfully.');
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Delete a comment
 * DELETE /api/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    // Only author or admin can delete
    if (
      comment.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(res, 'You do not have permission to delete this comment.', 403);
    }

    await Comment.deleteOne({ _id: commentId });

    return successResponse(res, {}, 'Comment deleted successfully.');
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Add a reply to a comment (threaded)
 * POST /api/comments/:commentId/replies
 */
const addReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return errorResponse(res, 'Reply text is required.', 400);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    // Create reply object
    const reply = {
      _id: new require('mongoose').Types.ObjectId(),
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      text: text.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    comment.replies.push(reply);
    await comment.save();
    await comment.populate('authorId', 'name email avatar role');

    return successResponse(
      res,
      { comment },
      'Reply added successfully.',
      201
    );
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Update a reply in a comment
 * PUT /api/comments/:commentId/replies/:replyId
 */
const updateReply = async (req, res) => {
  try {
    const { commentId, replyId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return errorResponse(res, 'Reply text is required.', 400);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return errorResponse(res, 'Reply not found.', 404);
    }

    // Only author or admin can edit
    if (
      reply.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(res, 'You do not have permission to edit this reply.', 403);
    }

    reply.text = text.trim();
    reply.updatedAt = new Date();
    await comment.save();
    await comment.populate('authorId', 'name email avatar role');

    return successResponse(res, { comment }, 'Reply updated successfully.');
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Delete a reply from a comment
 * DELETE /api/comments/:commentId/replies/:replyId
 */
const deleteReply = async (req, res) => {
  try {
    const { commentId, replyId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return errorResponse(res, 'Reply not found.', 404);
    }

    // Only author or admin can delete
    if (
      reply.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== 'ADMIN'
    ) {
      return errorResponse(res, 'You do not have permission to delete this reply.', 403);
    }

    comment.replies.pull(replyId);
    await comment.save();
    await comment.populate('authorId', 'name email avatar role');

    return successResponse(res, { comment }, 'Reply deleted successfully.');
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Resolve a comment (mark as resolved/unresolved)
 * PATCH /api/comments/:commentId/resolve
 */
const resolveComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { resolved } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return errorResponse(res, 'Comment not found.', 404);
    }

    // Only lecturer/mentor/admin can resolve
    if (!['LECTURER', 'MENTOR', 'ADMIN'].includes(req.user.role)) {
      return errorResponse(
        res,
        'Only lecturers, mentors, and admins can resolve comments.',
        403
      );
    }

    comment.resolved = resolved === true;
    comment.resolvedBy = resolved === true ? req.user._id : null;
    comment.resolvedAt = resolved === true ? new Date() : null;
    await comment.save();
    await comment.populate('authorId', 'name email avatar role');
    await comment.populate('resolvedBy', 'name email avatar');

    return successResponse(
      res,
      { comment },
      `Comment ${resolved ? 'resolved' : 'unresolved'} successfully.`
    );
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

/**
 * Get feedback summary for a proposal
 * GET /api/comments/proposal/:proposalId/summary
 */
const getCommentSummary = async (req, res) => {
  try {
    const { proposalId } = req.params;

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return errorResponse(res, 'Proposal not found.', 404);
    }

    const allComments = await Comment.find({ proposalId });
    const unresolved = allComments.filter((c) => !c.resolved);
    const resolved = allComments.filter((c) => c.resolved);

    const bySection = {};
    allComments.forEach((comment) => {
      if (!bySection[comment.section]) {
        bySection[comment.section] = {
          total: 0,
          unresolved: 0,
          resolved: 0,
        };
      }
      bySection[comment.section].total++;
      if (comment.resolved) {
        bySection[comment.section].resolved++;
      } else {
        bySection[comment.section].unresolved++;
      }
    });

    return successResponse(res, {
      summary: {
        totalComments: allComments.length,
        unresolvedCount: unresolved.length,
        resolvedCount: resolved.length,
        bySection,
      },
    });
  } catch (err) {
    return errorResponse(res, 'Server error: ' + err.message);
  }
};

module.exports = {
  createComment,
  getProposalComments,
  getEvaluationComments,
  getComment,
  updateComment,
  deleteComment,
  addReply,
  updateReply,
  deleteReply,
  resolveComment,
  getCommentSummary,
};
