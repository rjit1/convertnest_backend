const logger = require('./logger');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error response formatter
 */
const formatErrorResponse = (err, req) => {
  const response = {
    success: false,
    error: {
      message: err.message || 'Internal server error',
      timestamp: err.timestamp || new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  return response;
};

/**
 * Success response formatter
 */
const formatSuccessResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

/**
 * Validate file type
 */
const isValidFileType = (file, allowedTypes) => {
  if (!file || !file.mimetype) return false;
  return allowedTypes.includes(file.mimetype);
};

/**
 * Format file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Clean filename - remove special characters
 */
const cleanFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

module.exports = {
  AppError,
  asyncHandler,
  formatErrorResponse,
  formatSuccessResponse,
  isValidFileType,
  formatFileSize,
  cleanFilename
};
