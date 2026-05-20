// src/routes/mentoring.routes.js
const express = require('express');
const { createSession, getSessionsByTeam, getMyLecturerSessions, updateSession, getAllSessions, deleteSession } = require('../controllers/mentoring.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

router.post('/', authorize('LECTURER', 'ADMIN'), createSession);
router.get('/', getAllSessions);
router.get('/lecturer', authorize('LECTURER', 'ADMIN'), getMyLecturerSessions);
router.get('/team/:teamId', getSessionsByTeam);
router.put('/:id', authorize('LECTURER', 'ADMIN'), updateSession);
router.delete('/:id', authorize('LECTURER', 'ADMIN'), deleteSession);

module.exports = router;
