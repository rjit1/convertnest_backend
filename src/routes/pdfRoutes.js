const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { pdfToWord, getPdfInfo } = require('../controllers/pdfToWordController');

/**
 * @route   POST /api/pdf-to-word
 * @desc    Convert PDF to Word document
 * @access  Public
 */
router.post('/pdf-to-word', upload.single('pdf'), pdfToWord);

/**
 * @route   POST /api/pdf-info
 * @desc    Get PDF metadata and information
 * @access  Public
 */
router.post('/pdf-info', upload.single('pdf'), getPdfInfo);

module.exports = router;
