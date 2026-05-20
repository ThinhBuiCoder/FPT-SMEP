// src/controllers/notification.controller.js
const notificationService = require('../services/notification.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// GET /api/notifications
const getUserNotifications = async (req, res) => {
  try {
    const data = await notificationService.getUserNotifications(req.user.id);
    return successResponse(res, data);
  } catch (error) {
    console.error('getUserNotifications error:', error);
    return errorResponse(res, 'Lỗi khi lấy danh sách thông báo.', 500);
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return successResponse(res, { count });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return errorResponse(res, 'Lỗi khi lấy số lượng thông báo chưa đọc.', 500);
  }
};

// PUT /api/notifications/:notificationId/read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const data = await notificationService.markAsRead(notificationId, req.user.id);
    if (!data) {
      return errorResponse(res, 'Thông báo không tồn tại hoặc không thuộc quyền sở hữu của bạn.', 404);
    }
    return successResponse(res, data);
  } catch (error) {
    console.error('markAsRead error:', error);
    return errorResponse(res, 'Lỗi khi đánh dấu thông báo đã đọc.', 500);
  }
};

// PUT /api/notifications/mark-all-read
const markAllAsRead = async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    return successResponse(res, { success: true, message: 'Đã đánh dấu toàn bộ thông báo đã đọc.' });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    return errorResponse(res, 'Lỗi khi đánh dấu tất cả đã đọc.', 500);
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
