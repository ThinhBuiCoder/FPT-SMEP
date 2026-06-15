// src/routes/team.routes.js — Module 2 Team Management
const express = require('express');
const ctrl    = require('../controllers/team.controller');
const { protect }   = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const shortcutCtrl = require('../controllers/shortcut.controller');
const {
  requireAuth,
  canAccessTeamWorkspace,
  canManageShortcut,
} = require('../middlewares/shortcutPermission.middleware');

const router = express.Router();
router.use(protect);

// ─── Team CRUD ───────────────────────────────────────────────────────────────
// Legacy list endpoint (still functional)
router.get('/',              ctrl.getTeams);
router.get('/:id',           ctrl.getTeamById);
// Update team name/description
router.put('/:teamId',       authorize('ADMIN', 'LECTURER', 'STUDENT'), ctrl.updateTeam);
// Review team proposal
router.put('/:teamId/review', authorize('ADMIN', 'LECTURER'), ctrl.reviewTeamProposal);
// Delete team (also removes chat group + unassigns students)
router.delete('/:teamId',    authorize('ADMIN', 'LECTURER'), ctrl.deleteTeam);
// Assign mentor to a team
router.put('/:teamId/assign-mentor', authorize('ADMIN', 'LECTURER'), ctrl.assignMentor);
// Update team members (add/remove students) — Lecturer or Admin
router.put('/:teamId/members', authorize('ADMIN', 'LECTURER'), ctrl.updateTeamMembers);
// View chat group for a team
router.get('/:teamId/chat-group', ctrl.getChatGroup);

// ─── Quick Shortcuts ──────────────────────────────────────────────────────────
router.route('/:teamId/shortcuts')
  .get(requireAuth, canAccessTeamWorkspace, shortcutCtrl.getShortcuts)
  .post(requireAuth, canAccessTeamWorkspace, shortcutCtrl.createShortcut);

router.route('/:teamId/shortcuts/:shortcutId')
  .put(requireAuth, canManageShortcut, shortcutCtrl.updateShortcut)
  .delete(requireAuth, canManageShortcut, shortcutCtrl.deleteShortcut);

// ─── NOTE: Team generation is under /api/classes/:classId/teams/generate ─────
// See class.routes.js + team.routes (below for class-scoped)

module.exports = router;
