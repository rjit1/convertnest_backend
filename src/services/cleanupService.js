const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { formatFileSize } = require('../utils/helpers');

const uploadsDir = path.join(__dirname, '../../uploads');

/**
 * Delete files older than specified hours
 */
async function cleanupOldFiles(retentionHours = 24) {
  try {
    logger.info(`Starting cleanup service - deleting files older than ${retentionHours} hours`);

    const files = await fs.readdir(uploadsDir);
    const now = Date.now();
    const retentionMs = retentionHours * 60 * 60 * 1000;

    let deletedCount = 0;
    let deletedSize = 0;
    let errorCount = 0;

    for (const file of files) {
      // Skip .gitkeep file
      if (file === '.gitkeep') continue;

      const filePath = path.join(uploadsDir, file);

      try {
        const stats = await fs.stat(filePath);

        // Check if file is older than retention period
        if (now - stats.mtimeMs > retentionMs) {
          const fileSize = stats.size;
          await fs.unlink(filePath);
          deletedCount++;
          deletedSize += fileSize;
          logger.debug(`Deleted old file: ${file} (${formatFileSize(fileSize)})`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Error processing file ${file}:`, error);
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleanup completed: deleted ${deletedCount} files (${formatFileSize(deletedSize)} total)`);
    } else {
      logger.info('Cleanup completed: no files to delete');
    }

    if (errorCount > 0) {
      logger.warn(`Cleanup had ${errorCount} errors`);
    }

    return {
      deletedCount,
      deletedSize: formatFileSize(deletedSize),
      errorCount
    };
  } catch (error) {
    logger.error('Cleanup service error:', error);
    throw error;
  }
}

/**
 * Get current upload directory statistics
 */
async function getUploadStats() {
  try {
    const files = await fs.readdir(uploadsDir);
    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      if (file === '.gitkeep') continue;

      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
      fileCount++;
    }

    return {
      fileCount,
      totalSize: formatFileSize(totalSize),
      totalSizeBytes: totalSize
    };
  } catch (error) {
    logger.error('Error getting upload stats:', error);
    return {
      fileCount: 0,
      totalSize: '0 Bytes',
      totalSizeBytes: 0
    };
  }
}

/**
 * Initialize cleanup cron job
 */
function initializeCleanupService() {
  const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 1;
  const retentionHours = parseInt(process.env.FILE_RETENTION_HOURS) || 24;

  // Run every hour (0 minutes of every hour)
  // Format: minute hour day month weekday
  const cronExpression = `0 */${intervalHours} * * *`;

  logger.info(`Initializing cleanup service: runs every ${intervalHours} hour(s), deletes files older than ${retentionHours} hours`);

  // Schedule cron job
  cron.schedule(cronExpression, async () => {
    await cleanupOldFiles(retentionHours);
  });

  // Run cleanup immediately on startup
  cleanupOldFiles(retentionHours);

  logger.info('Cleanup service initialized successfully');
}

module.exports = {
  cleanupOldFiles,
  getUploadStats,
  initializeCleanupService
};
