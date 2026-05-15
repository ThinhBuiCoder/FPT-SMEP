// src/controllers/dashboard.controller.js
const { getAdminDashboard, getLecturerDashboard, getStudentDashboard } = require('../services/dashboard.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// GET /api/dashboard/admin
const adminDashboard = async (req, res) => {
  try {
    const data = await getAdminDashboard();
    return successResponse(res, data);
  } catch (error) {
    console.error('AdminDashboard error:', error);
    return errorResponse(res, 'Lỗi khi lấy admin dashboard.', 500);
  }
};

// GET /api/dashboard/lecturer
const lecturerDashboard = async (req, res) => {
  try {
    const data = await getLecturerDashboard(req.user.id);
    return successResponse(res, data);
  } catch (error) {
    console.error('LecturerDashboard error:', error);
    return errorResponse(res, 'Lỗi khi lấy lecturer dashboard.', 500);
  }
};

// GET /api/dashboard/student
const studentDashboard = async (req, res) => {
  try {
    const data = await getStudentDashboard(req.user.id);
    return successResponse(res, data);
  } catch (error) {
    console.error('StudentDashboard error:', error);
    return errorResponse(res, 'Lỗi khi lấy student dashboard.', 500);
  }
};

module.exports = { adminDashboard, lecturerDashboard, studentDashboard };
