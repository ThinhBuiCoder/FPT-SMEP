// src/routes/dashboard.routes.js
const express = require('express');
const { adminDashboard, lecturerDashboard, studentDashboard } = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

router.get('/admin', authorize('ADMIN'), adminDashboard);
router.get('/lecturer', authorize('LECTURER', 'ADMIN'), lecturerDashboard);
router.get('/student', authorize('STUDENT', 'ADMIN'), studentDashboard);

module.exports = router;
