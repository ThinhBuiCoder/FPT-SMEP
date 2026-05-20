// src/routes/milestone.routes.js
const express = require('express');
const { createMilestone, getMilestonesByTeam, updateMilestone, deleteMilestone } = require('../controllers/milestone.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

// Team-scoped routes
router.get('/team/:teamId', getMilestonesByTeam);
router.post('/team/:teamId', createMilestone);

// Milestone-specific routes
router.put('/:id', updateMilestone);
router.delete('/:id', deleteMilestone);

module.exports = router;
