// src/routes/tracking.routes.js
const express = require('express');
const { getAuthStats, getOnlineUsers } = require('../controllers/tracking.controller');
const { protect }    = require('../middlewares/auth.middleware');
const { authorize }  = require('../middlewares/role.middleware');

const router = express.Router();

// Tất cả tracking routes yêu cầu đăng nhập và quyền ADMIN
router.use(protect);

/**
 * GET /api/tracking/auth-stats
 * Thống kê đăng ký, đăng nhập, login thất bại theo ngày.
 * ?days=7 (mặc định) hoặc ?days=30
 */
router.get('/auth-stats', authorize('ADMIN'), getAuthStats);

/**
 * GET /api/tracking/online-users
 * Danh sách user đang online, recently active, tổng online count.
 */
router.get('/online-users', authorize('ADMIN'), getOnlineUsers);

module.exports = router;
