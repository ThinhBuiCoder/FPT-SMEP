// src/middlewares/role.middleware.js
// Role-Based Access Control Middleware

const { errorResponse } = require('../utils/apiResponse');

/**
 * Restrict access to specific roles
 * Usage: authorize('ADMIN', 'LECTURER')
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Chưa xác thực.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Bạn không có quyền truy cập. Yêu cầu role: ${roles.join(' hoặc ')}.`,
        403
      );
    }

    next();
  };
};

module.exports = { authorize };
