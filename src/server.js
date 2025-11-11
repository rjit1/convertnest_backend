require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { initializeCleanupService } = require('./services/cleanupService');

// Import routes
const pdfRoutes = require('./routes/pdfRoutes');
const mergeRoutes = require('./routes/mergeRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const imageToPdfRoutes = require('./routes/imageToPdfRoutes');
const utilityRoutes = require('./routes/utilityRoutes');
const captionRoutes = require('./routes/captionRoutes');
const imageToExcelRoutes = require('./routes/imageToExcel');
const imageToTextRoutes = require('./routes/imageToText');
const pdfToExcelRoutes = require('./routes/pdfToExcelRoutes');
const textToSpeechRoutes = require('./routes/textToSpeechRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for rate limiting and CORS behind Nginx)
app.set('trust proxy', 1);

// CORS configuration (MUST be before helmet)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: [
    'X-Processing-Time', 
    'X-Extraction-Method', 
    'X-Table-Preview', 
    'Content-Disposition',
    'X-Total-Pages',
    'X-Successful-Pages',
    'X-Failed-Pages',
    'X-Daily-Quota-Used',
    'X-Daily-Quota-Limit',
    'X-Daily-Quota-Remaining'
  ]
}));

// Security middleware (MUST be after CORS)
app.use(helmet({
  crossOriginResourcePolicy: false, // Don't block CORS
}));

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all /api routes
app.use('/api/', limiter);

// Routes
app.use('/api', pdfRoutes);
app.use('/api', mergeRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api', imageToPdfRoutes);
app.use('/api', captionRoutes);
app.use('/api', imageToExcelRoutes);
app.use('/api/image-to-text', imageToTextRoutes);
app.use('/api', pdfToExcelRoutes);
app.use('/api', textToSpeechRoutes);
app.use('/api', utilityRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ConvertNest Backend API',
    version: '1.0.0',
    endpoints: {
      pdfToWord: 'POST /api/pdf-to-word',
      pdfInfo: 'POST /api/pdf-info',
      pdfToExcel: 'POST /api/pdf-to-excel/convert',
      pdfToExcelInfo: 'POST /api/pdf-to-excel/info',
      mergePdfs: 'POST /api/merge-pdfs',
      splitPdf: 'POST /api/split-pdf',
      reorderPdf: 'POST /api/reorder-pdf',
      imageToPdf: 'POST /api/image-to-pdf',
      imageToExcel: 'POST /api/image-to-excel/convert',
      captionGenerator: 'POST /api/caption-generator',
      textToSpeech: 'POST /api/text-to-speech/generate',
      textToSpeechDialog: 'POST /api/text-to-speech/generate-dialog',
      ttsVoices: 'GET /api/text-to-speech/voices',
      ttsLanguages: 'GET /api/text-to-speech/languages',
      health: 'GET /api/health',
      stats: 'GET /api/stats'
    },
    documentation: 'https://github.com/rjit1/multitool_website'
  });
});

// 404 handler - Must be after all routes
app.use(notFoundHandler);

// Error handler - Must be last
app.use(errorHandler);

// Initialize cleanup service
initializeCleanupService();

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 ConvertNest Backend API started successfully`);
  logger.info(`📍 Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}`);
  logger.info(`📁 Upload directory: ${require('path').join(__dirname, '../uploads')}`);
  logger.info(`🧹 Cleanup service: Every ${process.env.CLEANUP_INTERVAL_HOURS || 1} hour(s)`);
  logger.info(`⏱️  File retention: ${process.env.FILE_RETENTION_HOURS || 24} hours`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Don't exit immediately - log and continue
  // process.exit(1);
});

module.exports = app;
