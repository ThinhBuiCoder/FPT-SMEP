// src/routes/class.routes.js — Module 2 Class Management
const express = require('express');
const ctrl    = require('../controllers/class.controller');
const teamCtrl = require('../controllers/team.controller');
const { protect }   = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

// ─── Class CRUD ─────────────────────────────────────────────────────────────
// Bulk-create multiple classes at once (Admin and Lecturer)
router.post('/bulk-create',  authorize('ADMIN', 'LECTURER'), ctrl.bulkCreateClasses);
// List classes (Admin = all, Lecturer = assigned + 3-semester window)
router.get('/',              ctrl.getClasses);
// Student specific endpoints (must be above dynamic parameter routes)
router.get('/my-classes', ctrl.getMyClasses);
router.get('/my-team', ctrl.getMyTeam);
router.get('/my-class-detail/:classId', ctrl.getMyClassDetail);

// Export Class to Excel
router.get('/:classId/export-excel', authorize('ADMIN', 'LECTURER', 'MENTOR'), ctrl.exportClassExcel);

// Get single class with students & teams
router.get('/:id',           ctrl.getClassById);
// Update class metadata
router.put('/:id',           authorize('ADMIN', 'LECTURER'), ctrl.updateClass);
// Rename class code (Admin or assigned Lecturer)
router.put('/:id/rename',    authorize('ADMIN', 'LECTURER'), ctrl.renameClass);
// Soft-delete (disable) class
router.delete('/:id',        authorize('ADMIN'), ctrl.deleteClass);

// ─── Lecturer Assignment & Schedule ──────────────────────────────────────────
router.put('/:id/assign-lecture', authorize('ADMIN'), ctrl.assignLecture);
router.put('/:id/assign-mentors', authorize('ADMIN'), ctrl.assignMentors);
router.put('/:classId/schedule', authorize('ADMIN', 'LECTURER'), ctrl.updateSchedule);
router.put('/:classId/teaching-assignment', authorize('ADMIN'), ctrl.updateTeachingAssignment);
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

// ─── Major Verification ───────────────────────────────────────────────────────
// Lecturer uploads their own Excel file to cross-check student majors
router.post(
  '/:classId/verify-majors',
  authorize('ADMIN', 'LECTURER'),
  ctrl.uploadMiddleware,
  ctrl.verifyMajors
);
// Lecturer manually corrects a single student's major
router.patch(
  '/:classId/students/:studentId/major',
  authorize('ADMIN', 'LECTURER'),
  ctrl.updateStudentMajor
);
// Lecturer locks/unlocks major updates for students in the class
router.patch(
  '/:classId/toggle-major-lock',
  authorize('ADMIN', 'LECTURER'),
  ctrl.toggleMajorLock
);
// Remove a student from a class
router.delete(
  '/:classId/students/:studentId',
  authorize('ADMIN', 'LECTURER'),
  ctrl.removeStudent
);
// Add a single student manually
router.post(
  '/:classId/students',
  authorize('ADMIN', 'LECTURER'),
  ctrl.addStudent
);

module.exports = router;
