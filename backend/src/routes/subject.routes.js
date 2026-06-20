// src/routes/subject.routes.js
const express = require('express');
const ctrl = require('../controllers/subject.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Public-within-app routes (requires login, but open to all roles to view subjects)
router.get('/', ctrl.getSubjects);
router.get('/active', ctrl.getActiveSubjects);
router.get('/current-semester', ctrl.getCurrentSemester);

// Admin-only write routes
router.post('/', authorize('ADMIN'), ctrl.createSubject);
router.post('/current-semester', authorize('ADMIN'), ctrl.updateCurrentSemester);
router.put('/:id', authorize('ADMIN'), ctrl.updateSubject);
router.delete('/:id', authorize('ADMIN'), ctrl.deleteSubject);

module.exports = router;
