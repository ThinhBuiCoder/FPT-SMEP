// src/routes/weeklyTask.routes.js
const express = require('express');
const {
  getWeeklyTasks,
  createWeeklyTask,
  updateWeeklyTask,
  deleteWeeklyTask,
  updateWeeklyTaskStatus,
  getTeamTaskBoard,
} = require('../controllers/weeklyTask.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// All weekly task planner features require JWT authentication
router.use(protect);

router.get('/team/:teamId/board', getTeamTaskBoard);
router.get('/', getWeeklyTasks);
router.post('/', createWeeklyTask);
router.put('/:id', updateWeeklyTask);
router.delete('/:id', deleteWeeklyTask);
router.patch('/:id/status', updateWeeklyTaskStatus);

module.exports = router;
