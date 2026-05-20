// src/routes/mentoring.routes.js
const express = require('express');
const { createSession, getSessionsByTeam, getMyLecturerSessions, updateSession, getAllSessions, deleteSession } = require('../controllers/mentoring.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

router.post('/', authorize('LECTURER', 'MENTOR', 'ADMIN'), createSession);
router.get('/', getAllSessions);
router.get('/lecturer', authorize('LECTURER', 'MENTOR', 'ADMIN'), getMyLecturerSessions);
router.get('/team/:teamId', getSessionsByTeam);
router.put('/:id', authorize('LECTURER', 'MENTOR', 'ADMIN'), updateSession);
router.delete('/:id', authorize('LECTURER', 'MENTOR', 'ADMIN'), deleteSession);

module.exports = router;
