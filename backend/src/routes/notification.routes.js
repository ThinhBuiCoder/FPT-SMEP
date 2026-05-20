// src/routes/notification.routes.js
const express = require('express');
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notification.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:notificationId/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);

module.exports = router;
