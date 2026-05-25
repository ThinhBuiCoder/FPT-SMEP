// src/controllers/user.controller.js
const User = require('../models/User');
const Student = require('../models/Student');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { isValidProgramMajor } = require('../constants/majors');

// GET /api/users
const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return successResponse(res, {
      users,
      pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / +limit) },
    });
  } catch (err) {
    return errorResponse(res, 'Lỗi khi lấy users.', 500);
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'Không tìm thấy user.', 404);
    return successResponse(res, { user });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// POST /api/users (Admin tạo user)
const createUser = async (req, res) => {
  const { name, email, password, role, studentId, phone, bio, programGroup, major } = req.body;
  if (!name || !email || !password) return errorResponse(res, 'Thiếu: name, email, password.', 400);
  
  if (role === 'STUDENT' && (programGroup || major)) {
    if (!isValidProgramMajor(programGroup, major)) {
      return errorResponse(res, 'Invalid major for selected program group.', 400);
    }
  }

  try {
    if (await User.findOne({ email })) return errorResponse(res, 'Email đã tồn tại.', 409);
    const user = await User.create({ name, email, password, role, studentId, phone, bio, programGroup, major });
    return successResponse(res, { user }, 'Tạo user thành công!', 201);
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
    const { name, email, role, status, bio, phone, studentId, programGroup, major } = req.body;
  try {
    if (email) {
      const dup = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (dup) return errorResponse(res, 'Email đã sử dụng.', 409);
    }

    if (role === 'STUDENT' && (programGroup || major)) {
      if (!isValidProgramMajor(programGroup, major)) {
        return errorResponse(res, 'Invalid major for selected program group.', 400);
      }
    }

    const updateData = { name, email, role, bio, phone, studentId };
    if (status) updateData.status = status;
    if (role === 'STUDENT' && programGroup && major) {
      updateData.programGroup = programGroup;
      updateData.major = major;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!user) return errorResponse(res, 'Không tìm thấy user.', 404);

    if (role === 'STUDENT' && programGroup && major && email) {
      await Student.updateMany(
        { email: user.email },
        { $set: { programGroup, major, userId: user._id } }
      );
    }

    return successResponse(res, { user }, 'Cập nhật user thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return errorResponse(res, 'Không thể xóa chính mình.', 400);
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return errorResponse(res, 'Không tìm thấy user.', 404);
    return successResponse(res, null, 'Xóa user thành công!');
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser };
