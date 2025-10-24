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
    cb(null, `${uniqueSuffix}-${cleanName}${ext}`);
  }
});

// File filter for PDFs only
const pdfFileFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB default
    files: 10 // Maximum 10 files at once for merge
  },
  fileFilter: pdfFileFilter
});

module.exports = upload;
