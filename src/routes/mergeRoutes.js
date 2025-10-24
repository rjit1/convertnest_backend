const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { mergePdfs, splitPdf, reorderPdf } = require('../controllers/mergePdfController');

/**
 * @route   POST /api/merge-pdfs
 * @desc    Merge multiple PDF files into one
 * @access  Public
 */
router.post('/merge-pdfs', upload.array('pdfs', 10), mergePdfs);

/**
 * @route   POST /api/split-pdf
 * @desc    Split PDF into separate page files
 * @access  Public
 */
router.post('/split-pdf', upload.single('pdf'), splitPdf);

/**
 * @route   POST /api/reorder-pdf
 * @desc    Reorder pages in a PDF
 * @access  Public
 */
router.post('/reorder-pdf', upload.single('pdf'), reorderPdf);

module.exports = router;
