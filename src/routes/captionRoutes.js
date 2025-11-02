const express = require('express');
const router = express.Router();
const mediaUpload = require('../middleware/videoUpload');
const captionController = require('../controllers/captionGeneratorController');

// Health check
router.get('/caption-generator/health', captionController.healthCheck);

// Generate caption (single file)
router.post('/caption-generator', 
  mediaUpload.single('media'),
  captionController.generateCaption
);

// Generate caption (multiple files) - for future expansion
router.post('/caption-generator/batch',
  mediaUpload.array('media', 10),
  captionController.generateCaption
);

module.exports = router;
