// src/routes/milestone.routes.js
const express = require('express');
const { createMilestone, getMilestonesByTeam, updateMilestone, deleteMilestone } = require('../controllers/milestone.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.post('/', createMilestone);
router.get('/team/:teamId', getMilestonesByTeam);
router.put('/:id', updateMilestone);
router.delete('/:id', deleteMilestone);

module.exports = router;
