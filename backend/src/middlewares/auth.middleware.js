// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer '))
      token = req.headers.authorization.split(' ')[1];

    if (!token) return errorResponse(res, 'Chưa đăng nhập.', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id); // toJSON() strips password
    if (!user) return errorResponse(res, 'Người dùng không tồn tại.', 401);

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return errorResponse(res, 'Token không hợp lệ.', 401);
    if (err.name === 'TokenExpiredError') return errorResponse(res, 'Token hết hạn.', 401);
    return errorResponse(res, 'Lỗi xác thực.', 500);
  }
};

module.exports = { protect };
