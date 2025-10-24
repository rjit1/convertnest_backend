const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/helpers');

/**
 * Global error handling middleware
 * Must be placed after all routes
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Set status code
  const statusCode = err.statusCode || 500;

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: {
        message: 'File size exceeds the maximum limit of 100MB',
        code: 'FILE_TOO_LARGE',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Multer unexpected field error
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Unexpected field in file upload',
        code: 'INVALID_FIELD',
        timestamp: new Date().toISOString()
      }
    });
  }

  // PDF parsing errors
  if (err.message && err.message.includes('Invalid PDF')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid PDF file provided',
        code: 'INVALID_PDF',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Send error response
  res.status(statusCode).json(formatErrorResponse(err, req));
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFoundHandler
};
