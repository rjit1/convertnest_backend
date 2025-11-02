const { AppError, asyncHandler } = require('../utils/helpers');
const logger = require('../utils/logger');
const geminiService = require('../services/geminiService');
const cloudinaryService = require('../services/cloudinaryService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Validate video duration (if metadata available)
 */
async function validateVideoDuration(filePath, maxDuration = 80) {
  // This is a basic check - for production, consider using ffprobe
  // For now, we'll trust client-side validation and file size limits
  logger.debug(`Video validation: ${filePath} (max duration: ${maxDuration}s)`);
  return true;
}

/**
 * Generate social media captions
 */
const generateCaption = asyncHandler(async (req, res, next) => {
  const startTime = Date.now();
  let uploadedFiles = [];
  let cloudinaryIds = [];

  try {
    // Validate request
    if (!req.file && !req.files) {
      throw new AppError('No media file uploaded', 400);
    }

    // Get uploaded file(s)
    const files = req.files || [req.file];
    uploadedFiles = files;

    if (files.length === 0) {
      throw new AppError('No media file uploaded', 400);
    }

    // For now, use first file (multi-file support can be added later)
    const mediaFile = files[0];
    
    logger.info(`Processing caption request for ${mediaFile.mimetype} file: ${mediaFile.filename}`);
    logger.debug(`File size: ${(mediaFile.size / 1024 / 1024).toFixed(2)} MB`);

    // Parse request body
    const {
      userContext = '',
      platform = 'instagram',
      tone = 'casual',
      length = 'medium',
      hashtags = 5,
      emoji = true
    } = req.body;

    // Validate settings
    const validPlatforms = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'general'];
    const validTones = ['professional', 'casual', 'playful', 'inspirational', 'educational'];
    const validLengths = ['short', 'medium', 'long'];

    if (!validPlatforms.includes(platform)) {
      throw new AppError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`, 400);
    }

    if (!validTones.includes(tone)) {
      throw new AppError(`Invalid tone. Must be one of: ${validTones.join(', ')}`, 400);
    }

    if (!validLengths.includes(length)) {
      throw new AppError(`Invalid length. Must be one of: ${validLengths.join(', ')}`, 400);
    }

    const hashtagCount = parseInt(hashtags);
    if (isNaN(hashtagCount) || hashtagCount < 0 || hashtagCount > 30) {
      throw new AppError('Hashtags must be between 0 and 30', 400);
    }

    // Additional validation for videos
    if (mediaFile.mimetype.startsWith('video/')) {
      const maxVideoSize = parseInt(process.env.MAX_VIDEO_FILE_SIZE) || 524288000; // 500 MB
      if (mediaFile.size > maxVideoSize) {
        throw new AppError(`Video file too large. Maximum size: ${(maxVideoSize / 1024 / 1024).toFixed(0)} MB`, 400);
      }

      // Validate duration (basic check)
      const maxDuration = parseInt(process.env.MAX_VIDEO_DURATION) || 80;
      await validateVideoDuration(mediaFile.path, maxDuration);
    }

    // Optional: Upload to Cloudinary for backup/CDN
    let cloudinaryResult = null;
    if (cloudinaryService.isConfigured()) {
      try {
        if (mediaFile.mimetype.startsWith('video/')) {
          cloudinaryResult = await cloudinaryService.uploadVideo(mediaFile.path);
        } else {
          cloudinaryResult = await cloudinaryService.uploadImage(mediaFile.path);
        }
        
        if (cloudinaryResult) {
          cloudinaryIds.push(cloudinaryResult.publicId);
        }
      } catch (error) {
        logger.warn('Cloudinary upload failed, continuing without it:', error.message);
      }
    }

    // Generate captions using Gemini
    const settings = {
      platform,
      tone,
      length,
      hashtags: hashtagCount,
      emoji: emoji === 'true' || emoji === true
    };

    logger.info('Generating captions with settings:', settings);
    const result = await geminiService.generateCaption(mediaFile, userContext, settings);

    // Clean up Cloudinary uploads (if configured for auto-delete)
    if (cloudinaryIds.length > 0 && process.env.AUTO_DELETE_CLOUDINARY === 'true') {
      const resourceType = mediaFile.mimetype.startsWith('video/') ? 'video' : 'image';
      cloudinaryService.deleteMultiple(cloudinaryIds, resourceType)
        .catch(err => logger.error('Background Cloudinary cleanup failed:', err));
    }

    // Send response
    const totalDuration = Date.now() - startTime;
    logger.info(`Caption generation completed in ${totalDuration}ms`);

    res.json({
      success: true,
      data: {
        ...result.data,
        settings: {
          platform,
          tone,
          length,
          hashtags: hashtagCount,
          emoji: settings.emoji
        },
        cloudinary: cloudinaryResult ? {
          url: cloudinaryResult.url,
          publicId: cloudinaryResult.publicId
        } : null
      },
      metadata: {
        ...result.metadata,
        totalDuration,
        cloudinaryEnabled: cloudinaryService.isConfigured()
      }
    });

    // Clean up local files after response is sent
    setTimeout(async () => {
      try {
        await Promise.all(uploadedFiles.map(f => fs.unlink(f.path).catch(err => {
          logger.error(`Failed to delete file ${f.path}:`, err);
        })));
        logger.debug(`Cleaned up ${uploadedFiles.length} temporary file(s)`);
      } catch (error) {
        logger.error('Cleanup failed:', error);
      }
    }, 1000);

  } catch (error) {
    // Clean up on error
    logger.error('Caption generation error:', error);

    // Delete uploaded files
    if (uploadedFiles.length > 0) {
      await Promise.allSettled(uploadedFiles.map(f => 
        fs.unlink(f.path).catch(err => logger.error(`Failed to delete ${f.path}:`, err))
      ));
    }

    // Delete Cloudinary uploads
    if (cloudinaryIds.length > 0) {
      cloudinaryService.deleteMultiple(cloudinaryIds)
        .catch(err => logger.error('Cleanup Cloudinary failed:', err));
    }

    throw error;
  }
});

/**
 * Health check endpoint
 */
const healthCheck = asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      gemini: !!process.env.GEMINI_API_KEY_1 || !!process.env.GEMINI_API_KEY_2,
      cloudinary: cloudinaryService.isConfigured()
    }
  };

  res.json(health);
});

module.exports = {
  generateCaption,
  healthCheck
};
