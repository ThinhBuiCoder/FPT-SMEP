// src/routes/evaluation.routes.js
const express = require('express');
const {
  createEvaluation, getEvaluationsByStartup,
  getEvaluationsByLecturer, updateEvaluation,
  getTeamEvaluations, createTeamEvaluation,
  updateTeamEvaluation, submitTeamEvaluation,
  getCheckpointEvaluationSummary, getTeamEvaluationHistory
} = require('../controllers/evaluation.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 (LEGACY) APIs
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authorize('LECTURER', 'ADMIN'), createEvaluation);
router.get('/startup/:startupIdeaId', getEvaluationsByStartup);
router.get('/lecturer/:lecturerId', authorize('LECTURER', 'ADMIN'), getEvaluationsByLecturer);
router.put('/:id', authorize('LECTURER', 'ADMIN'), updateEvaluation);

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 (EVALUATION & MENTORING) APIs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team/:teamId', getTeamEvaluations);
router.get('/team/:teamId/checkpoints/:checkpointNumber', getTeamEvaluations);
router.get('/team/:teamId/checkpoints/:checkpointNumber/summary', getCheckpointEvaluationSummary);
router.get('/team/:teamId/checkpoints/:checkpointNumber/history', getTeamEvaluationHistory);
router.post('/team/:teamId', authorize('LECTURER', 'MENTOR', 'ADMIN'), createTeamEvaluation);
router.post('/team/:teamId/checkpoints/:checkpointNumber', authorize('LECTURER', 'MENTOR', 'ADMIN'), createTeamEvaluation);
router.put('/team/:id', authorize('LECTURER', 'MENTOR', 'ADMIN'), updateTeamEvaluation);
router.put('/team/:id/submit', authorize('LECTURER', 'MENTOR', 'ADMIN'), submitTeamEvaluation);

module.exports = router;
