const express = require('express');
const router = express.Router();
const { formatSuccessResponse } = require('../utils/helpers');
const { getUploadStats, cleanupOldFiles } = require('../services/cleanupService');

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json(formatSuccessResponse({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  }, 'Service is healthy'));
});

/**
 * @route   GET /api/stats
 * @desc    Get upload directory statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  const stats = await getUploadStats();
  res.json(formatSuccessResponse(stats, 'Statistics retrieved successfully'));
});

/**
 * @route   POST /api/cleanup
 * @desc    Manually trigger cleanup (for testing)
 * @access  Public (should be protected in production)
 */
router.post('/cleanup', async (req, res) => {
  const retentionHours = parseInt(req.body.retentionHours) || 24;
  const result = await cleanupOldFiles(retentionHours);
  res.json(formatSuccessResponse(result, 'Cleanup completed'));
});

module.exports = router;
