const express = require('express');
const router = express.Router();
const mediaUpload = require('../middleware/videoUpload'); // Supports images too
const controller = require('../controllers/imageToExcelController');

// Health check
router.get('/image-to-excel/health', controller.healthCheck.bind(controller));

// Convert image to Excel (single file)
router.post('/image-to-excel/convert',
  mediaUpload.single('image'),
  controller.convertImageToExcel.bind(controller)
);

module.exports = router;
