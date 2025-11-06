const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { AppError } = require('../utils/helpers');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(err => {
  logger.error('Failed to create uploads directory:', err);
});

// Configure storage
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 50);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `media-${uniqueSuffix}-${cleanName}${ext}`);
  }
});

// File filter for images and videos
const mediaFileFilter = (req, file, cb) => {
  const allowedImageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/avif',
    'image/heic',
    'image/heif'
  ];

  const allowedVideoMimes = [
    'video/mp4',
    'video/quicktime', // .mov
    'video/webm',
    'video/x-msvideo', // .avi
    'video/x-matroska' // .mkv
  ];

  const allowedMimes = [...allowedImageMimes, ...allowedVideoMimes];

  // Check MIME type first
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  // If MIME type is application/octet-stream, check file extension
  // This handles cases where browsers/curl don't send correct MIME type
  if (file.mimetype === 'application/octet-stream') {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif', '.heic', '.heif',
      // Videos
      '.mp4', '.mov', '.webm', '.avi', '.mkv'
    ];
    
    if (allowedExtensions.includes(ext)) {
      logger.debug(`Accepting file with octet-stream MIME type based on extension: ${ext}`);
      cb(null, true);
      return;
    }
  }

  // Reject file
  cb(new AppError(
    `Invalid file type: ${file.mimetype}. Supported formats: JPG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC, MP4, MOV, WebM`,
    400
  ), false);
};

// Create multer instance with large file support
const mediaUpload = multer({
  storage: storage,
  limits: {
    fileSize: 524288000, // 500 MB
    files: 10 // Max 10 files per request
  },
  fileFilter: mediaFileFilter
});

module.exports = mediaUpload;
