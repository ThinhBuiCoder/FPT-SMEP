// src/routes/comment.routes.js — COMMENT ENDPOINTS
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/comment.controller');
const { protect } = require('../middlewares/auth.middleware');

// Protect all comment routes
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

// Create a new comment
router.post('/', ctrl.createComment);

// Get single comment with replies
router.get('/:commentId', ctrl.getComment);

// Update comment text
router.put('/:commentId', ctrl.updateComment);

// Delete comment
router.delete('/:commentId', ctrl.deleteComment);

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

// Get all comments for a proposal
router.get('/proposal/:proposalId', ctrl.getProposalComments);

// Get comment summary for a proposal
router.get('/proposal/:proposalId/summary', ctrl.getCommentSummary);

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

// Get all comments for an evaluation
router.get('/evaluation/:evaluationId', ctrl.getEvaluationComments);

// ─────────────────────────────────────────────────────────────────────────────
// THREADED REPLIES
// ─────────────────────────────────────────────────────────────────────────────

// Add reply to comment
router.post('/:commentId/replies', ctrl.addReply);

// Update reply
router.put('/:commentId/replies/:replyId', ctrl.updateReply);

// Delete reply
router.delete('/:commentId/replies/:replyId', ctrl.deleteReply);

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

// Resolve/Unresolve comment
router.patch('/:commentId/resolve', ctrl.resolveComment);

module.exports = router;
