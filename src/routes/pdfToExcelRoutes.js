const express = require('express');
const router = express.Router();
const axios = require('axios');
const upload = require('../middleware/upload'); // Uses PDF file filter
const controller = require('../controllers/pdfToExcelController');

/**
 * PDF to Excel Routes
 * Production-ready multi-page PDF to Excel conversion with PARALLEL processing
 * 
 * Features:
 * - Max 25 pages per PDF
 * - PARALLEL Gemini API calls (10x faster!)
 * - Multi-sheet Excel output (1 sheet per page)
 * - Daily quota tracking (100 conversions/day)
 * - Rate limiting compliant (Tier 1: 250 RPM, 1M TPM)
 */

// Health check endpoint
router.get('/pdf-to-excel/health', controller.healthCheck.bind(controller));

// Get quota information
router.get('/pdf-quota', async (req, res) => {
  try {
    // Forward to Python service
    const response = await require('axios').get(`${process.env.PYTHON_TATR_SERVICE_URL || 'http://localhost:5000'}/api/pdf-quota`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch quota information',
      quota: { used: 0, limit: 100, remaining: 100 }
    });
  }
});

// Get PDF info (page count validation)
router.post('/pdf-to-excel/info',
  upload.single('pdf'),
  controller.getPdfInfo.bind(controller)
);

// Convert PDF to Excel (main endpoint) - Updated to match frontend expectations
router.post('/pdf-to-excel',
  upload.single('file'), // Changed from 'pdf' to 'file' to match frontend
  controller.convertPdfToExcel.bind(controller)
);

// Legacy route for backward compatibility
router.post('/pdf-to-excel/convert',
  upload.single('file'),
  controller.convertPdfToExcel.bind(controller)
);

module.exports = router;