const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');
const { AppError } = require('../utils/helpers');

// Configure Cloudinary (lazy initialization)
let configured = false;

function ensureConfigured() {
  if (!configured && process.env.CLOUDINARY_URL) {
    // Cloudinary URL format: cloudinary://api_key:api_secret@cloud_name
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL
    });
    configured = true;
    logger.info('Cloudinary configured successfully');
  } else if (!configured) {
    logger.warn('CLOUDINARY_URL not set - Cloudinary features will be disabled');
  }
  return configured;
}

/**
 * Check if Cloudinary is configured
 */
function isConfigured() {
  if (!configured) {
    ensureConfigured();
  }
  return configured;
}

/**
 * Upload video to Cloudinary
 */
async function uploadVideo(filePath, options = {}) {
  if (!isConfigured()) {
    logger.debug('Cloudinary not configured, skipping upload');
    return null;
  }

  try {
    const startTime = Date.now();
    
    // Cloudinary free tier limit is ~100 MB for videos
    const fs = require('fs');
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / 1024 / 1024;
    
    if (fileSizeMB > 100) {
      logger.warn(`Video file too large for Cloudinary free tier: ${fileSizeMB.toFixed(2)} MB (max 100 MB). Skipping Cloudinary upload.`);
      return null;
    }
    
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      folder: 'captions-temp',
      public_id: options.publicId || `video-${Date.now()}`,
      overwrite: true,
      ...options
    });

    const duration = Date.now() - startTime;
    logger.info(`Video uploaded to Cloudinary in ${duration}ms: ${result.public_id}`);
    logger.debug('Cloudinary upload result:', {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      bytes: result.bytes,
      duration: result.duration
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes,
      duration: result.duration
    };
  } catch (error) {
    logger.error('Cloudinary upload failed:', error);
    throw new AppError('Failed to upload video to storage', 500);
  }
}

/**
 * Upload image to Cloudinary
 */
async function uploadImage(filePath, options = {}) {
  if (!isConfigured()) {
    logger.debug('Cloudinary not configured, skipping upload');
    return null;
  }

  try {
    const startTime = Date.now();
    
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'image',
      folder: 'captions-temp',
      public_id: options.publicId || `image-${Date.now()}`,
      overwrite: true,
      ...options
    });

    const duration = Date.now() - startTime;
    logger.info(`Image uploaded to Cloudinary in ${duration}ms: ${result.public_id}`);

    return {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    logger.error('Cloudinary upload failed:', error);
    throw new AppError('Failed to upload image to storage', 500);
  }
}

/**
 * Delete media from Cloudinary
 */
async function deleteMedia(publicId, resourceType = 'video') {
  if (!isConfigured()) {
    logger.debug('Cloudinary not configured, skipping delete');
    return null;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });

    logger.info(`Cloudinary media deleted: ${publicId} (result: ${result.result})`);
    return result;
  } catch (error) {
    logger.error(`Failed to delete Cloudinary media ${publicId}:`, error);
    // Don't throw error - cleanup failure shouldn't fail the request
    return null;
  }
}

/**
 * Delete multiple media files
 */
async function deleteMultiple(publicIds, resourceType = 'video') {
  if (!isConfigured() || !publicIds || publicIds.length === 0) {
    return;
  }

  try {
    const results = await Promise.allSettled(
      publicIds.map(id => deleteMedia(id, resourceType))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    logger.info(`Deleted ${successful}/${publicIds.length} Cloudinary files`);
  } catch (error) {
    logger.error('Batch delete failed:', error);
  }
}

/**
 * Get video information
 */
async function getVideoInfo(publicId) {
  if (!isConfigured()) {
    return null;
  }

  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'video'
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes,
      duration: result.duration,
      width: result.width,
      height: result.height,
      createdAt: result.created_at
    };
  } catch (error) {
    logger.error('Failed to get video info:', error);
    return null;
  }
}

module.exports = {
  isConfigured,
  uploadVideo,
  uploadImage,
  deleteMedia,
  deleteMultiple,
  getVideoInfo
};
