// src/controllers/comment.controller.js
const ProposalComment = require('../models/ProposalComment');
const Proposal = require('../models/Proposal');
const Team = require('../models/Team');
const workspacePerm = require('../utils/workspacePermission');

const successResponse = (res, data, message = "") => res.status(200).json({ success: true, data, message });
const errorResponse = (res, message, status = 500) => res.status(status).json({ success: false, error: message });

exports.getProposalComments = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return errorResponse(res, "Proposal not found.", 404);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, proposal.teamId);

    const comments = await ProposalComment.find({ proposalId })
      .populate('createdBy', 'name email avatar role')
      .populate('resolvedBy', 'name email avatar role')
      .sort({ createdAt: 1 });

    return successResponse(res, comments);
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, "Server error: " + err.message);
  }
};

exports.createProposalComment = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { sectionKey, selectedText, content, parentCommentId } = req.body;

    if (!sectionKey || !content) return errorResponse(res, "Missing sectionKey or content", 400);

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return errorResponse(res, "Proposal not found.", 404);

    const team = await Team.findById(proposal.teamId);

    // Lecturers, Mentors, Admins can comment. Students could potentially reply.
    // For MVP, we will let anyone who can access the workspace add a comment.
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, proposal.teamId);
    
    // In strict mode, only reviewers can add top level comments.
    const isStudent = req.user.role === 'STUDENT' || req.user.role === 'USER';
    if (isStudent && !parentCommentId) {
      return errorResponse(res, "Students can only reply to existing comments.", 403);
    }

    const comment = new ProposalComment({
      teamId: proposal.teamId,
      classId: team.classId,
      proposalId,
      sectionKey,
      selectedText: selectedText || '',
      content,
      createdBy: req.user._id,
      createdByRole: req.user.role,
      parentCommentId: parentCommentId || null
    });

    const saved = await comment.save();
    await saved.populate('createdBy', 'name email avatar role');

    return successResponse(res, saved, "Comment added.");
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, "Server error: " + err.message);
  }
};

exports.resolveComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const comment = await ProposalComment.findById(commentId);
    if (!comment) return errorResponse(res, "Comment not found.", 404);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, comment.teamId);

    // Only creator or Reviewers can resolve
    const isStudent = req.user.role === 'STUDENT' || req.user.role === 'USER';
    const isCreator = comment.createdBy.toString() === req.user._id.toString();

    if (isStudent && !isCreator) {
      return errorResponse(res, "You do not have permission to resolve this comment.", 403);
    }

    comment.resolved = true;
    comment.resolvedBy = req.user._id;
    comment.resolvedAt = new Date();

    await comment.save();
    await comment.populate('resolvedBy', 'name email avatar role');

    return successResponse(res, comment, "Comment resolved.");
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, "Server error: " + err.message);
  }
};
