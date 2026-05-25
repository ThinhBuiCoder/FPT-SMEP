// src/routes/checkpoint.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/checkpoint.controller');
const { protect } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(protect);

// ── Static config (no team needed) ───────────────────────────────────────────
// GET /api/workspace/checkpoints/config
router.get('/config', ctrl.getConfig);

// ── Team-scoped data ─────────────────────────────────────────────────────────
// GET /api/workspace/checkpoints/teams/:teamId
router.get('/teams/:teamId', ctrl.getCheckpointData);

// ── File management ──────────────────────────────────────────────────────────
// POST   /api/workspace/checkpoints/teams/:teamId/checkpoints/:checkpointNumber/upload
router.post(
  '/teams/:teamId/checkpoints/:checkpointNumber/upload',
  ctrl.uploadCheckpointFile
);

// DELETE /api/workspace/checkpoints/teams/:teamId/checkpoints/:checkpointNumber/files/:fileId
router.delete(
  '/teams/:teamId/checkpoints/:checkpointNumber/files/:fileId',
  ctrl.deleteCheckpointFile
);

// GET    /api/workspace/checkpoints/teams/:teamId/checkpoints/:checkpointNumber/files/:fileId/download
router.get(
  '/teams/:teamId/checkpoints/:checkpointNumber/files/:fileId/download',
  ctrl.downloadCheckpointFile
);

// ── Feedback / replies ───────────────────────────────────────────────────────
// POST /api/workspace/checkpoints/teams/:teamId/checkpoints/:checkpointNumber/feedback
router.post(
  '/teams/:teamId/checkpoints/:checkpointNumber/feedback',
  ctrl.addFeedback
);

module.exports = router;
