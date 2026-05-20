// src/routes/class.routes.js — Module 2 Class Management
const express = require('express');
const ctrl    = require('../controllers/class.controller');
const teamCtrl = require('../controllers/team.controller');
const { protect }   = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

// ─── Class CRUD ─────────────────────────────────────────────────────────────
// Bulk-create multiple classes at once (Admin only)
router.post('/bulk-create',  authorize('ADMIN'), ctrl.bulkCreateClasses);
// List classes (Admin = all, Lecturer = assigned + 3-semester window)
router.get('/',              ctrl.getClasses);
// Student specific endpoints (must be above dynamic parameter routes)
router.get('/my-classes', ctrl.getMyClasses);
router.get('/my-team', ctrl.getMyTeam);
router.get('/my-class-detail/:classId', ctrl.getMyClassDetail);

// Get single class with students & teams
router.get('/:id',           ctrl.getClassById);
// Update class metadata
router.put('/:id',           authorize('ADMIN', 'LECTURER'), ctrl.updateClass);
// Soft-delete (disable) class
router.delete('/:id',        authorize('ADMIN'), ctrl.deleteClass);

// ─── Lecturer Assignment ─────────────────────────────────────────────────────
router.put('/:id/assign-lecture', authorize('ADMIN'), ctrl.assignLecture);
router.put('/:id/assign-mentors', authorize('ADMIN'), ctrl.assignMentors);
router.post('/:id/backfill-chats', authorize('ADMIN', 'LECTURER'), teamCtrl.backfillChatGroups);

// ─── Student Import ──────────────────────────────────────────────────────────
// multer middleware applied per-route (not globally) to keep JSON routes clean
router.post(
  '/:classId/import-students',
  authorize('ADMIN', 'LECTURER'),
  ctrl.uploadMiddleware,
  ctrl.importStudents
);
router.get('/:classId/students', ctrl.getStudents);

module.exports = router;
