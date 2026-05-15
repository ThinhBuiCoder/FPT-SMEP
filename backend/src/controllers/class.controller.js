// src/controllers/class.controller.js
const Class = require('../models/Class');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/classes
const createClass = async (req, res) => {
  const { name, code, semester, description, lecturerId } = req.body;
  if (!name || !code || !semester) return errorResponse(res, 'Thiếu: name, code, semester.', 400);
  try {
    if (await Class.findOne({ code: code.toUpperCase() }))
      return errorResponse(res, 'Mã lớp đã tồn tại.', 409);

    const assignedLecturer = (req.user.role === 'ADMIN' && lecturerId) ? lecturerId : req.user._id;
    const cls = await Class.create({ name, code, semester, description, lecturerId: assignedLecturer });
    await cls.populate('lecturerId', 'name email avatar');
    return successResponse(res, { class: cls }, 'Tạo lớp học thành công!', 201);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Lỗi khi tạo lớp.', 500);
  }
};

// GET /api/classes
const getClasses = async (req, res) => {
  try {
    const { semester, search } = req.query;
    const query = {};

    if (req.user.role === 'LECTURER') query.lecturerId = req.user._id;
    if (req.user.role === 'STUDENT') query.members = req.user._id;
    if (semester) query.semester = semester;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];

    const classes = await Class.find(query)
      .populate('lecturerId', 'name email avatar')
      .populate('members', 'name email studentId avatar')
      .sort({ createdAt: -1 });

    return successResponse(res, { classes });
  } catch (err) {
    return errorResponse(res, 'Lỗi khi lấy danh sách lớp.', 500);
  }
};

// GET /api/classes/:id
const getClassById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('lecturerId', 'name email avatar bio')
      .populate('members', 'name email studentId avatar role');

    if (!cls) return errorResponse(res, 'Không tìm thấy lớp học.', 404);

    // Check access
    if (req.user.role === 'LECTURER' && cls.lecturerId._id.toString() !== req.user._id.toString())
      return errorResponse(res, 'Không có quyền xem lớp này.', 403);
    if (req.user.role === 'STUDENT' && !cls.members.some(m => m._id.toString() === req.user._id.toString()))
      return errorResponse(res, 'Bạn không thuộc lớp này.', 403);

    return successResponse(res, { class: cls });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/classes/:id
const updateClass = async (req, res) => {
  const { name, semester, description, isActive } = req.body;
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Không tìm thấy lớp.', 404);
    if (req.user.role === 'LECTURER' && cls.lecturerId.toString() !== req.user._id.toString())
      return errorResponse(res, 'Không có quyền chỉnh sửa.', 403);

    const updated = await Class.findByIdAndUpdate(
      req.params.id, { name, semester, description, isActive }, { new: true }
    ).populate('lecturerId', 'name email');

    return successResponse(res, { class: updated }, 'Cập nhật lớp thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// DELETE /api/classes/:id
const deleteClass = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Không tìm thấy lớp.', 404);
    if (req.user.role === 'LECTURER' && cls.lecturerId.toString() !== req.user._id.toString())
      return errorResponse(res, 'Không có quyền xóa.', 403);
    await Class.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Xóa lớp thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// POST /api/classes/:id/members — Thêm nhiều sinh viên
const addMembers = async (req, res) => {
  const { userIds } = req.body;
  if (!userIds?.length) return errorResponse(res, 'Cần cung cấp userIds.', 400);
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Không tìm thấy lớp.', 404);
    if (req.user.role === 'LECTURER' && cls.lecturerId.toString() !== req.user._id.toString())
      return errorResponse(res, 'Không có quyền.', 403);

    // Add unique members
    const existing = cls.members.map(m => m.toString());
    const toAdd = userIds.filter(id => !existing.includes(id));
    cls.members.push(...toAdd);
    await cls.save();
    await cls.populate('members', 'name email studentId avatar');
    return successResponse(res, { class: cls }, `Đã thêm ${toAdd.length} thành viên!`);
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// DELETE /api/classes/:id/members/:userId
const removeMember = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return errorResponse(res, 'Không tìm thấy lớp.', 404);
    cls.members = cls.members.filter(m => m.toString() !== req.params.userId);
    await cls.save();
    return successResponse(res, null, 'Đã xóa thành viên!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { createClass, getClasses, getClassById, updateClass, deleteClass, addMembers, removeMember };
