// src/routes/sprintTask.routes.js
const express = require('express');
const {
  getTeamTasks, createTask, getTask,
  updateTask, updateTaskStatus, deleteTask,
  getTeamProgress,
} = require('../controllers/sprintTask.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

// Team-scoped
router.get('/team/:teamId', getTeamTasks);
router.post('/team/:teamId', createTask);
router.get('/team/:teamId/progress', getTeamProgress);

// Task-specific
router.get('/:taskId', getTask);
router.put('/:taskId', updateTask);
router.put('/:taskId/status', updateTaskStatus);
router.delete('/:taskId', deleteTask);

module.exports = router;
