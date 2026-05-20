// src/controllers/workshop.controller.js
const Workshop = require('../models/Workshop');
const Class = require('../models/Class');
const Team = require('../models/Team');
const Student = require('../models/Student');
const notificationService = require('../services/notification.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// GET /api/workshops
const getWorkshops = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    let query = {};

    if (role === 'ADMIN') {
      // Admin sees everything
      query = {};
    } else if (role === 'LECTURER') {
      // Lecturer sees created by them or for their classes
      const myClasses = await Class.find({ lectureId: userId });
      const classIds = myClasses.map(c => c._id);
      query = {
        $or: [
          { createdBy: userId },
          { classId: { $in: classIds } }
        ]
      };
    } else if (role === 'MENTOR') {
      // Mentor sees created by them, or targetAudience MENTOR, or their classes/teams
      const myClasses = await Class.find({ mentorIds: userId });
      const classIds = myClasses.map(c => c._id);
      const myTeams = await Team.find({ mentorId: userId });
      const teamIds = myTeams.map(t => t._id);

      query = {
        $or: [
          { createdBy: userId },
          { targetAudience: 'MENTOR' },
          { classId: { $in: classIds } },
          { teamIds: { $in: teamIds } }
        ]
      };
    } else if (role === 'STUDENT') {
      // Student sees published workshops matching their class/team
      const student = await Student.findOne({ userId });
      if (!student) {
        query = { status: 'PUBLISHED', targetAudience: 'ALL_STUDENTS' };
      } else {
        const studentOrs = [{ targetAudience: 'ALL_STUDENTS' }];
        if (student.classId) {
          studentOrs.push({ targetAudience: 'CLASS', classId: student.classId });
        }
        if (student.teamId) {
          studentOrs.push({ targetAudience: 'TEAM', teamIds: student.teamId });
        }
        query = {
          status: 'PUBLISHED',
          $or: studentOrs
        };
      }
    }

    const workshops = await Workshop.find(query)
      .populate('classId', 'classCode subjectCode')
      .populate('teamIds', 'teamName teamCode')
      .populate('createdBy', 'name email avatar')
      .sort({ startDate: 1, startTime: 1 });

    return successResponse(res, workshops);
  } catch (error) {
    console.error('getWorkshops error:', error);
    return errorResponse(res, 'Lỗi khi lấy danh sách buổi hội thảo.', 500);
  }
};

// POST /api/workshops
const createWorkshop = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'ADMIN' && role !== 'LECTURER') {
      return errorResponse(res, 'Bạn không có quyền tạo buổi hội thảo.', 403);
    }

    const {
      title,
      description,
      type,
      classId,
      teamIds,
      targetAudience,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      meetingLink,
      status,
    } = req.body;

    if (!title || !startDate || !endDate || !startTime || !endTime) {
      return errorResponse(res, 'Vui lòng cung cấp các trường bắt buộc (Tiêu đề, ngày, giờ).', 400);
    }

    const workshop = await Workshop.create({
      title,
      description: description || '',
      type: type || 'WORKSHOP',
      classId: classId || null,
      teamIds: teamIds || [],
      targetAudience: targetAudience || 'CLASS',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      startTime,
      endTime,
      location: location || '',
      meetingLink: meetingLink || '',
      createdBy: req.user.id,
      status: status || 'PUBLISHED',
    });

    if (workshop.status === 'PUBLISHED') {
      // Trigger notifications async
      notificationService.notifyWorkshopCreated(workshop._id).catch(err => {
        console.error('Error dispatching notifications:', err);
      });
    }

    return successResponse(res, workshop, 'Tạo buổi hội thảo thành công.', 201);
  } catch (error) {
    console.error('createWorkshop error:', error);
    return errorResponse(res, 'Lỗi khi tạo buổi hội thảo.', 500);
  }
};

// PUT /api/workshops/:id
const updateWorkshop = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const ws = await Workshop.findById(req.params.id);
    if (!ws) {
      return errorResponse(res, 'Buổi hội thảo không tồn tại.', 404);
    }

    // Authorization check
    if (role !== 'ADMIN' && ws.createdBy.toString() !== userId) {
      return errorResponse(res, 'Bạn không có quyền sửa buổi hội thảo này.', 403);
    }

    const oldStatus = ws.status;

    const {
      title,
      description,
      type,
      classId,
      teamIds,
      targetAudience,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      meetingLink,
      status,
    } = req.body;

    if (title) ws.title = title;
    if (description !== undefined) ws.description = description;
    if (type) ws.type = type;
    if (classId !== undefined) ws.classId = classId || null;
    if (teamIds !== undefined) ws.teamIds = teamIds || [];
    if (targetAudience) ws.targetAudience = targetAudience;
    if (startDate) ws.startDate = new Date(startDate);
    if (endDate) ws.endDate = new Date(endDate);
    if (startTime) ws.startTime = startTime;
    if (endTime) ws.endTime = endTime;
    if (location !== undefined) ws.location = location;
    if (meetingLink !== undefined) ws.meetingLink = meetingLink;
    if (status) ws.status = status;

    await ws.save();

    // Trigger notifications if changing from DRAFT -> PUBLISHED
    if (oldStatus === 'DRAFT' && ws.status === 'PUBLISHED') {
      notificationService.notifyWorkshopCreated(ws._id).catch(err => {
        console.error('Error dispatching notifications:', err);
      });
    }

    return successResponse(res, ws, 'Cập nhật buổi hội thảo thành công.');
  } catch (error) {
    console.error('updateWorkshop error:', error);
    return errorResponse(res, 'Lỗi khi cập nhật buổi hội thảo.', 500);
  }
};

// DELETE /api/workshops/:id
const deleteWorkshop = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const ws = await Workshop.findById(req.params.id);
    if (!ws) {
      return errorResponse(res, 'Buổi hội thảo không tồn tại.', 404);
    }

    if (role !== 'ADMIN' && ws.createdBy.toString() !== userId) {
      return errorResponse(res, 'Bạn không có quyền xóa buổi hội thảo này.', 403);
    }

    await ws.deleteOne();
    return successResponse(res, null, 'Xóa buổi hội thảo thành công.');
  } catch (error) {
    console.error('deleteWorkshop error:', error);
    return errorResponse(res, 'Lỗi khi xóa buổi hội thảo.', 500);
  }
};

module.exports = {
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
};
