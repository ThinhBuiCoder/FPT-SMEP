// src/middlewares/error.middleware.js
// Global Error Handler Middleware

const { errorResponse } = require('../utils/apiResponse');

/**
 * Global error handling middleware
 * Must be added LAST in middleware chain
 */
const globalErrorHandler = (err, req, res, next) => {
  console.error('🔥 Unhandled Error:', err);

  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    return errorResponse(res, `Dữ liệu không hợp lệ.`, 400);
  }

  // Mongoose Duplicate Key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Trường dữ liệu';
    return errorResponse(res, `${field} đã tồn tại trong hệ thống.`, 409);
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return errorResponse(res, messages.join('. '), 400);
  }

  // Default
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Lỗi hệ thống. Vui lòng thử lại.';
  return errorResponse(res, message, statusCode);
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res) => {
  return errorResponse(res, `Route ${req.originalUrl} không tồn tại.`, 404);
};

module.exports = { globalErrorHandler, notFound };
