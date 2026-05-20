// src/controllers/ranking.controller.js
const rankingService = require('../services/ranking.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// GET /api/rankings
const getGlobalRankings = async (req, res) => {
  try {
    const data = await rankingService.getGlobalRankings();
    return successResponse(res, data);
  } catch (error) {
    console.error('getGlobalRankings error:', error);
    return errorResponse(res, 'Lỗi khi lấy bảng xếp hạng hệ thống.', 500);
  }
};

// GET /api/rankings/class/:classId
const getClassRankings = async (req, res) => {
  try {
    const { classId } = req.params;
    const data = await rankingService.getClassRankings(classId);
    return successResponse(res, data);
  } catch (error) {
    console.error('getClassRankings error:', error);
    return errorResponse(res, 'Lỗi khi lấy bảng xếp hạng lớp học.', 500);
  }
};

// GET /api/rankings/my-class
const getMyClassRankings = async (req, res) => {
  try {
    const data = await rankingService.getStudentClassRankings(req.user.id);
    return successResponse(res, data);
  } catch (error) {
    console.error('getMyClassRankings error:', error);
    return errorResponse(res, 'Lỗi khi lấy bảng xếp hạng lớp của tôi.', 500);
  }
};

// GET /api/rankings/my-teams
const getMyTeamRankings = async (req, res) => {
  try {
    const data = await rankingService.getLecturerOrMentorRankings(req.user.id);
    return successResponse(res, data);
  } catch (error) {
    console.error('getMyTeamRankings error:', error);
    return errorResponse(res, 'Lỗi khi lấy bảng xếp hạng các nhóm được giao.', 500);
  }
};

module.exports = {
  getGlobalRankings,
  getClassRankings,
  getMyClassRankings,
  getMyTeamRankings,
};
