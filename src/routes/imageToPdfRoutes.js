const express = require('express');
const router = express.Router();
const imageUpload = require('../middleware/imageUpload');
const { imageToPdf } = require('../controllers/imageToPdfController');

/**
 * @route   POST /api/image-to-pdf
 * @desc    Convert multiple images to a single PDF document
 * @access  Public
 * @body    {
 *   images: File[],              // Array of image files (JPG, PNG, WEBP, GIF)
 *   pageSize: string,            // 'a4', 'letter', 'legal' (default: 'a4')
 *   orientation: string,         // 'portrait', 'landscape' (default: 'portrait')
 *   fitMode: string,             // 'fit', 'fill', 'actual' (default: 'fit')
 *   margin: number,              // Margin in points (default: 20)
 *   quality: number              // Quality 0-100 (default: 90)
 * }
 */
router.post('/image-to-pdf', imageUpload.array('images', 50), imageToPdf);

module.exports = router;
