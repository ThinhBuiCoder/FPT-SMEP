// src/controllers/workshop.controller.js
const Workshop = require('../models/Workshop');
const WorkshopAttendance = require('../models/WorkshopAttendance');
const Class = require('../models/Class');
const Team = require('../models/Team');
const Student = require('../models/Student');
const notificationService = require('../services/notification.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Derive format from onlineClassIds / offlineClassIds.
 */
function deriveFormat(onlineClassIds, offlineClassIds) {
  const hasOnline = Array.isArray(onlineClassIds) && onlineClassIds.length > 0;
  const hasOffline = Array.isArray(offlineClassIds) && offlineClassIds.length > 0;
  if (hasOnline && hasOffline) return 'HYBRID';
  if (hasOnline) return 'ONLINE';
  return 'OFFLINE';
}

// GET /api/workshops
const getWorkshops = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    let query = {};

    if (role === 'ADMIN') {
      query = {};
    } else if (role === 'LECTURER') {
      const myClasses = await Class.find({ lectureId: userId });
      const classIds = myClasses.map(c => c._id);
      query = {
        $or: [
          { createdBy: userId },
          { onlineClassIds: { $in: classIds } },
          { offlineClassIds: { $in: classIds } }
        ]
      };
    } else if (role === 'MENTOR') {
      const myClasses = await Class.find({ mentorIds: userId });
      const classIds = myClasses.map(c => c._id);
      const myTeams = await Team.find({ mentorId: userId });
      const teamIds = myTeams.map(t => t._id);

      query = {
        $or: [
          { createdBy: userId },
          { targetAudience: 'MENTOR' },
          { onlineClassIds: { $in: classIds } },
          { offlineClassIds: { $in: classIds } },
          { teamIds: { $in: teamIds } },
          { mentors: userId }
        ]
      };
    } else if (role === 'STUDENT') {
      const student = await Student.findOne({ userId });
      if (!student) {
        query = { status: 'PUBLISHED', targetAudience: 'ALL_STUDENTS' };
      } else {
        const studentOrs = [{ targetAudience: 'ALL_STUDENTS' }];
        if (student.classId) {
          studentOrs.push({ targetAudience: 'CLASS', onlineClassIds: student.classId });
          studentOrs.push({ targetAudience: 'CLASS', offlineClassIds: student.classId });
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

    let workshops = await Workshop.find(query)
      .populate('onlineClassIds', 'classCode subjectCode')
      .populate('offlineClassIds', 'classCode subjectCode')
      .populate('teamIds', 'teamName teamCode')
      .populate('createdBy', 'name email avatar')
      .populate('mentors', 'name email avatar')
      .sort({ startDate: 1, startTime: 1 })
      .lean();

    if (role === 'STUDENT') {
      const attendances = await WorkshopAttendance.find({
        studentId: userId,
        workshopId: { $in: workshops.map(w => w._id) }
      });
      const attMap = {};
      attendances.forEach(a => {
        attMap[a.workshopId.toString()] = a;
      });

      const student = await Student.findOne({ userId });
      workshops.forEach(w => {
        w.myAttendance = attMap[w._id.toString()] || null;
        // Determine student's mode for this workshop
        if (student && student.classId) {
          const cId = student.classId.toString();
          if (w.onlineClassIds?.some(c => (c._id || c).toString() === cId)) {
            w.myMode = 'ONLINE';
          } else if (w.offlineClassIds?.some(c => (c._id || c).toString() === cId)) {
            w.myMode = 'OFFLINE';
          }
        }
      });
    }

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
      onlineClassIds,
      offlineClassIds,
      teamIds,
      targetAudience,
      bannerUrl,
      attachments,
      checkInDeadline,
      mentors,
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (start < today) {
      return errorResponse(res, 'Ngày bắt đầu không được ở trong quá khứ.', 400);
    }
    if (end < today) {
      return errorResponse(res, 'Ngày kết thúc không được ở trong quá khứ.', 400);
    }
    if (start > end) {
      return errorResponse(res, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', 400);
    }

    if (startDate === endDate && startTime >= endTime) {
      return errorResponse(res, 'Giờ bắt đầu phải trước giờ kết thúc khi diễn ra trong cùng một ngày.', 400);
    }

    if (checkInDeadline) {
      const deadline = new Date(checkInDeadline);
      const now = new Date();
      if (deadline < now) {
        return errorResponse(res, 'Hạn chót check-in không được ở trong quá khứ.', 400);
      }
      const workshopEnd = new Date(`${endDate}T${endTime}`);
      if (deadline > workshopEnd) {
        return errorResponse(res, 'Hạn chót check-in không được sau giờ kết thúc của buổi hội thảo.', 400);
      }
    }

    const onIds = onlineClassIds || [];
    const offIds = offlineClassIds || [];

    // Validate no overlap
    const overlap = onIds.filter(id => offIds.includes(id));
    if (overlap.length > 0) {
      return errorResponse(res, 'Một lớp không được xuất hiện trong cả Online và Offline.', 400);
    }

    // Validate at least one class
    if (targetAudience === 'CLASS' && onIds.length === 0 && offIds.length === 0) {
      return errorResponse(res, 'Phải chọn ít nhất 1 lớp online hoặc offline.', 400);
    }

    if (targetAudience === 'TEAM' && (!teamIds || teamIds.length === 0)) {
      return errorResponse(res, 'Vui lòng chọn ít nhất một nhóm.', 400);
    }

    // Validate required fields based on class groups
    if (onIds.length > 0 && !meetingLink) {
      return errorResponse(res, 'Meeting URL là bắt buộc khi có lớp Online.', 400);
    }
    if (meetingLink) {
      const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
      if (!urlPattern.test(meetingLink)) {
        return errorResponse(res, 'Vui lòng nhập URL hợp lệ cho Meeting Link (bắt đầu bằng http:// hoặc https://).', 400);
      }
    }
    if (offIds.length > 0 && !location) {
      return errorResponse(res, 'Địa điểm là bắt buộc khi có lớp Offline.', 400);
    }

    const format = deriveFormat(onIds, offIds);

    const workshop = await Workshop.create({
      title,
      description: description || '',
      type: type || 'WORKSHOP',
      onlineClassIds: onIds,
      offlineClassIds: offIds,
      teamIds: teamIds || [],
      targetAudience: targetAudience || 'CLASS',
      format,
      bannerUrl: bannerUrl || '',
      attachments: attachments || [],
      checkInDeadline: checkInDeadline ? new Date(checkInDeadline) : null,
      mentors: mentors || [],
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
      notificationService.notifyWorkshopCreated(workshop._id).catch(err => {
        console.error('[WorkshopCtrl] Error dispatching notifications:', err);
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

    if (role !== 'ADMIN' && ws.createdBy.toString() !== userId) {
      return errorResponse(res, 'Bạn không có quyền sửa buổi hội thảo này.', 403);
    }

    const oldStatus = ws.status;

    const {
      title,
      description,
      type,
      onlineClassIds,
      offlineClassIds,
      teamIds,
      targetAudience,
      bannerUrl,
      attachments,
      checkInDeadline,
      mentors,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      meetingLink,
      status,
    } = req.body;

    // Validate no overlap if both are provided
    if (onlineClassIds !== undefined && offlineClassIds !== undefined) {
      const onIds = onlineClassIds || [];
      const offIds = offlineClassIds || [];
      const overlap = onIds.filter(id => offIds.includes(id));
      if (overlap.length > 0) {
        return errorResponse(res, 'Một lớp không được xuất hiện trong cả Online và Offline.', 400);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newStart = startDate ? new Date(startDate) : new Date(ws.startDate);
    newStart.setHours(0, 0, 0, 0);

    const newEnd = endDate ? new Date(endDate) : new Date(ws.endDate);
    newEnd.setHours(0, 0, 0, 0);

    const oldStart = new Date(ws.startDate);
    oldStart.setHours(0, 0, 0, 0);

    const oldEnd = new Date(ws.endDate);
    oldEnd.setHours(0, 0, 0, 0);

    // Only validate that start date is not in the past if it has been changed
    if (startDate && newStart.getTime() !== oldStart.getTime() && newStart < today) {
      return errorResponse(res, 'Ngày bắt đầu không được ở trong quá khứ.', 400);
    }
    // Only validate that end date is not in the past if it has been changed
    if (endDate && newEnd.getTime() !== oldEnd.getTime() && newEnd < today) {
      return errorResponse(res, 'Ngày kết thúc không được ở trong quá khứ.', 400);
    }

    if (newStart > newEnd) {
      return errorResponse(res, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', 400);
    }

    const finalStartDateStr = startDate || ws.startDate.toISOString().split('T')[0];
    const finalEndDateStr = endDate || ws.endDate.toISOString().split('T')[0];
    const finalStartTime = startTime || ws.startTime;
    const finalEndTime = endTime || ws.endTime;

    if (finalStartDateStr === finalEndDateStr && finalStartTime >= finalEndTime) {
      return errorResponse(res, 'Giờ bắt đầu phải trước giờ kết thúc khi diễn ra trong cùng một ngày.', 400);
    }

    if (checkInDeadline !== undefined) {
      if (checkInDeadline) {
        const deadline = new Date(checkInDeadline);
        const now = new Date();
        const oldDeadline = ws.checkInDeadline ? new Date(ws.checkInDeadline) : null;

        // Only validate that deadline is not in the past if it was changed
        const isDeadlineChanged = !oldDeadline || deadline.getTime() !== oldDeadline.getTime();
        if (isDeadlineChanged && deadline < now) {
          return errorResponse(res, 'Hạn chót check-in không được ở trong quá khứ.', 400);
        }

        const workshopEnd = new Date(`${finalEndDateStr}T${finalEndTime}`);
        if (deadline > workshopEnd) {
          return errorResponse(res, 'Hạn chót check-in không được sau giờ kết thúc của buổi hội thảo.', 400);
        }
      }
    } else if (ws.checkInDeadline) {
      const deadline = new Date(ws.checkInDeadline);
      const workshopEnd = new Date(`${finalEndDateStr}T${finalEndTime}`);
      if (deadline > workshopEnd) {
        return errorResponse(res, 'Hạn chót check-in không được sau giờ kết thúc của buổi hội thảo.', 400);
      }
    }

    const finalAudience = targetAudience || ws.targetAudience;
    const finalTeamIds = teamIds !== undefined ? teamIds : ws.teamIds;
    if (finalAudience === 'TEAM' && (!finalTeamIds || finalTeamIds.length === 0)) {
      return errorResponse(res, 'Vui lòng chọn ít nhất một nhóm.', 400);
    }

    const finalMeetingLink = meetingLink !== undefined ? meetingLink : ws.meetingLink;
    if (finalMeetingLink) {
      const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
      if (!urlPattern.test(finalMeetingLink)) {
        return errorResponse(res, 'Vui lòng nhập URL hợp lệ cho Meeting Link (bắt đầu bằng http:// hoặc https://).', 400);
      }
    }

    if (title) ws.title = title;
    if (description !== undefined) ws.description = description;
    if (type) ws.type = type;
    if (onlineClassIds !== undefined) ws.onlineClassIds = onlineClassIds || [];
    if (offlineClassIds !== undefined) ws.offlineClassIds = offlineClassIds || [];
    if (teamIds !== undefined) ws.teamIds = teamIds || [];
    if (targetAudience) ws.targetAudience = targetAudience;
    if (bannerUrl !== undefined) ws.bannerUrl = bannerUrl;
    if (attachments !== undefined) ws.attachments = attachments || [];
    if (checkInDeadline !== undefined) ws.checkInDeadline = checkInDeadline ? new Date(checkInDeadline) : null;
    if (mentors !== undefined) ws.mentors = mentors || [];
    if (startDate) ws.startDate = new Date(startDate);
    if (endDate) ws.endDate = new Date(endDate);
    if (startTime) ws.startTime = startTime;
    if (endTime) ws.endTime = endTime;
    if (location !== undefined) ws.location = location;
    if (meetingLink !== undefined) ws.meetingLink = meetingLink;
    if (status) ws.status = status;

    // Re-derive format
    ws.format = deriveFormat(ws.onlineClassIds, ws.offlineClassIds);

    await ws.save();

    if (oldStatus === 'DRAFT' && ws.status === 'PUBLISHED') {
      notificationService.notifyWorkshopCreated(ws._id).catch(err => {
        console.error('[WorkshopCtrl] Error dispatching notifications:', err);
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

// POST /api/workshops/:id/check-in
const checkInWorkshop = async (req, res) => {
  try {
    const { id: workshopId } = req.params;
    const { evidenceUrl, classId } = req.body;
    const studentId = req.user.id;

    if (!evidenceUrl) {
      return errorResponse(res, 'Vui lòng cung cấp ảnh minh chứng.', 400);
    }

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return errorResponse(res, 'Buổi hội thảo không tồn tại.', 404);
    }

    // Determine mode from student's classId
    let studentClassId = classId;
    if (!studentClassId) {
      const student = await Student.findOne({ userId: studentId });
      if (student) {
        studentClassId = student.classId;
      }
    }

    let mode = null;
    if (studentClassId) {
      const cStr = studentClassId.toString();
      if (workshop.onlineClassIds.map(c => c.toString()).includes(cStr)) {
        mode = 'ONLINE';
      } else if (workshop.offlineClassIds.map(c => c.toString()).includes(cStr)) {
        mode = 'OFFLINE';
      }
    }

    let attendance = await WorkshopAttendance.findOne({ workshopId, studentId });
    if (attendance) {
      attendance.evidenceUrl = evidenceUrl;
      attendance.checkInTime = new Date();
      attendance.status = 'CHECKED_IN';
      attendance.classId = studentClassId || attendance.classId;
      attendance.mode = mode || attendance.mode;
      attendance.rejectReason = '';
      await attendance.save();
    } else {
      attendance = await WorkshopAttendance.create({
        workshopId,
        studentId,
        classId: studentClassId || null,
        mode,
        evidenceUrl,
        status: 'CHECKED_IN',
        checkInTime: new Date(),
      });
    }

    return successResponse(res, attendance, 'Check-in thành công.');
  } catch (error) {
    console.error('checkInWorkshop error:', error);
    return errorResponse(res, 'Lỗi khi check-in.', 500);
  }
};

// GET /api/workshops/:id/attendance?classId=xxx
const getWorkshopAttendance = async (req, res) => {
  try {
    const { id: workshopId } = req.params;
    const { classId } = req.query;

    if (!classId) {
      return errorResponse(res, 'Vui lòng cung cấp classId.', 400);
    }

    // Determine mode for this class in the workshop
    const workshop = await Workshop.findById(workshopId);
    let classMode = null;
    if (workshop) {
      const cStr = classId.toString();
      if (workshop.onlineClassIds.map(c => c.toString()).includes(cStr)) {
        classMode = 'ONLINE';
      } else if (workshop.offlineClassIds.map(c => c.toString()).includes(cStr)) {
        classMode = 'OFFLINE';
      }
    }

    const students = await Student.find({ classId }).populate('userId', 'name email avatar');
    const records = await WorkshopAttendance.find({ workshopId });
    const recordMap = {};
    for (const r of records) {
      recordMap[r.studentId.toString()] = r;
    }

    const results = students.map(s => {
      const uId = s.userId ? s.userId._id.toString() : null;
      const rec = uId ? recordMap[uId] : null;

      return {
        _id: rec ? rec._id : null,
        studentId: uId,
        studentName: s.fullName || s.userId?.name,
        rollNumber: s.rollNumber,
        email: s.email,
        major: s.major,
        programGroup: s.programGroup,
        status: rec ? rec.status : 'NOT_PARTICIPATED',
        checkInTime: rec ? rec.checkInTime : null,
        evidenceUrl: rec ? rec.evidenceUrl : null,
        rejectReason: rec ? rec.rejectReason : '',
        mode: rec ? rec.mode : classMode,
      };
    });

    return successResponse(res, results);
  } catch (error) {
    console.error('getWorkshopAttendance error:', error);
    return errorResponse(res, 'Lỗi khi lấy danh sách điểm danh.', 500);
  }
};

// PUT /api/workshops/:id/attendance/:studentId/verify
const verifyWorkshopAttendance = async (req, res) => {
  try {
    const { id: workshopId, studentId } = req.params;
    const { status, rejectReason } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return errorResponse(res, 'Status không hợp lệ.', 400);
    }

    const attendance = await WorkshopAttendance.findOne({ workshopId, studentId });
    if (!attendance) {
      return errorResponse(res, 'Không tìm thấy thông tin check-in.', 404);
    }

    attendance.status = status;
    attendance.verifiedBy = req.user.id;
    if (status === 'REJECTED' && rejectReason) {
      attendance.rejectReason = rejectReason;
    } else {
      attendance.rejectReason = '';
    }
    await attendance.save();

    return successResponse(res, attendance, 'Cập nhật trạng thái thành công.');
  } catch (error) {
    console.error('verifyWorkshopAttendance error:', error);
    return errorResponse(res, 'Lỗi khi cập nhật trạng thái.', 500);
  }
};

// PUT /api/workshops/:id/attendance/verify-all
const verifyAllWorkshopAttendance = async (req, res) => {
  try {
    const { id: workshopId } = req.params;
    const { classId } = req.body;

    let query = { workshopId, status: 'CHECKED_IN' };
    if (classId) {
      query.classId = classId;
    }

    const result = await WorkshopAttendance.updateMany(
      query,
      {
        $set: {
          status: 'VERIFIED',
          verifiedBy: req.user.id,
          rejectReason: ''
        }
      }
    );

    return successResponse(res, { count: result.modifiedCount }, `Đã duyệt thành công ${result.modifiedCount} sinh viên.`);
  } catch (error) {
    console.error('verifyAllWorkshopAttendance error:', error);
    return errorResponse(res, 'Lỗi khi duyệt hàng loạt.', 500);
  }
};

module.exports = {
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  checkInWorkshop,
  getWorkshopAttendance,
  verifyWorkshopAttendance,
  verifyAllWorkshopAttendance,
};
