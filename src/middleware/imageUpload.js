const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cleanFilename } = require('../utils/helpers');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-cleanname.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanName = cleanFilename(path.parse(file.originalname).name);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img-${uniqueSuffix}-${cleanName}${ext}`);
  }
});

// File filter for images only
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/x-ms-bmp',
    'image/tiff',
    'image/tiff-fx',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/svg+xml'
  ];
  
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, SVG) are allowed'), false);
  }
};

// Configure multer for image uploads
const imageUpload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB default
    files: 50 // Maximum 50 images at once
  },
  fileFilter: imageFileFilter
});

module.exports = imageUpload;
