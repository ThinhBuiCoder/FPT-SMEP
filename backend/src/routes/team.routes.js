// src/routes/team.routes.js — Module 2 Team Management
const express = require('express');
const ctrl    = require('../controllers/team.controller');
const { protect }   = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

// ─── Team CRUD ───────────────────────────────────────────────────────────────
// Legacy list endpoint (still functional)
router.get('/',              ctrl.getTeams);
router.get('/:id',           ctrl.getTeamById);
// Update team name/description
router.put('/:teamId',       authorize('ADMIN', 'LECTURER'), ctrl.updateTeam);
// Delete team (also removes chat group + unassigns students)
router.delete('/:teamId',    authorize('ADMIN', 'LECTURER'), ctrl.deleteTeam);
// Assign mentor to a team
router.put('/:teamId/assign-mentor', authorize('ADMIN', 'LECTURER'), ctrl.assignMentor);
// View chat group for a team
router.get('/:teamId/chat-group', ctrl.getChatGroup);

// ─── NOTE: Team generation is under /api/classes/:classId/teams/generate ─────
// See class.routes.js + team.routes (below for class-scoped)

module.exports = router;
