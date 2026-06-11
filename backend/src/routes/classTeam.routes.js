// src/routes/classTeam.routes.js
// Routes scoped under /api/classes/:classId/teams
const express = require('express');
const ctrl    = require('../controllers/team.controller');
const { protect }   = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router({ mergeParams: true }); // mergeParams gives access to :classId
router.use(protect);

// POST /api/classes/:classId/teams/generate
router.post('/generate', authorize('ADMIN', 'LECTURER'), ctrl.generateTeam);

// POST /api/classes/:classId/teams/student-proposal
router.post('/student-proposal', authorize('STUDENT'), ctrl.createStudentProposal);

// GET  /api/classes/:classId/teams
router.get('/',          ctrl.getTeamsByClass);

module.exports = router;
