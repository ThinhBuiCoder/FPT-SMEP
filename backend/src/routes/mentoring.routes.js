// src/routes/mentoring.routes.js
const express = require('express');
const { 
  createSession, 
  getSessionsByTeam, 
  getMyLecturerSessions, 
  updateSession, 
  getAllSessions, 
  cancelSession,
  deleteSession,
  getPastSessions,
  addSessionNote,
  addActionItem,
  updateActionItem
} = require('../controllers/mentoring.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

// CREATE
router.post('/', authorize('LECTURER', 'MENTOR', 'ADMIN'), createSession);

// READ - phải đặt trước /:id để tránh conflict
router.get('/past', getPastSessions);
router.get('/lecturer', authorize('LECTURER', 'MENTOR', 'ADMIN'), getMyLecturerSessions);
router.get('/team/:teamId', getSessionsByTeam);
router.get('/', getAllSessions);

// UPDATE
router.put('/:id', authorize('LECTURER', 'MENTOR', 'ADMIN'), updateSession);
router.patch('/:id/cancel', authorize('LECTURER', 'MENTOR', 'ADMIN'), cancelSession);

// NOTES
router.post('/:id/notes', authorize('LECTURER', 'MENTOR', 'ADMIN'), addSessionNote);

// ACTION ITEMS
router.post('/:id/action-items', authorize('LECTURER', 'MENTOR', 'ADMIN'), addActionItem);
router.patch('/:id/action-items/:itemId', authorize('LECTURER', 'MENTOR', 'ADMIN'), updateActionItem);

// DELETE (admin only)
router.delete('/:id', authorize('ADMIN'), deleteSession);

module.exports = router;
