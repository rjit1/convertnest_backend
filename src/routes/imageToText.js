const express = require('express');
const router = express.Router();
const imageToTextController = require('../controllers/imageToTextController');
const mediaUpload = require('../middleware/videoUpload');

/**
 * Image to Text Routes
 * OCR-based text extraction from images
 */

// Health check
router.get('/health', imageToTextController.healthCheck);

// Extract text (returns JSON)
router.post(
  '/extract',
  mediaUpload.single('image'),
  imageToTextController.extractText
);

// Download text in various formats
router.post(
  '/download',
  mediaUpload.single('image'),
  imageToTextController.downloadText
);

module.exports = router;
