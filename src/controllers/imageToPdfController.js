const fs = require('fs').promises;
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { AppError, asyncHandler, formatSuccessResponse, formatFileSize } = require('../utils/helpers');

/**
 * Page size configurations in points (1 inch = 72 points)
 */
const PAGE_SIZES = {
  a4: { width: 595, height: 842 },        // 210mm × 297mm
  letter: { width: 612, height: 792 },    // 8.5" × 11"
  legal: { width: 612, height: 1008 },    // 8.5" × 14"
};

/**
 * Supported image formats
 * All formats will be converted to PNG or JPEG for PDF embedding
 */
const SUPPORTED_IMAGE_TYPES = {
  'image/jpeg': { native: true, converter: 'jpeg' },
  'image/jpg': { native: true, converter: 'jpeg' },
  'image/png': { native: true, converter: 'png' },
  'image/webp': { native: false, converter: 'png' },
  'image/gif': { native: false, converter: 'png' },
  'image/bmp': { native: false, converter: 'png' },
  'image/x-ms-bmp': { native: false, converter: 'png' },
  'image/tiff': { native: false, converter: 'png' },
  'image/tiff-fx': { native: false, converter: 'png' },
  'image/avif': { native: false, converter: 'png' },
  'image/heic': { native: false, converter: 'png' },
  'image/heif': { native: false, converter: 'png' },
  'image/svg+xml': { native: false, converter: 'png' }
};

/**
 * Convert multiple images to a single PDF document
 * POST /api/image-to-pdf
 */
const imageToPdf = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No image files uploaded', 400);
  }

  const startTime = Date.now();
  const uploadedFiles = req.files;
  
  // Parse options from request body
  const options = {
    pageSize: req.body.pageSize || 'a4',
    orientation: req.body.orientation || 'portrait',
    fitMode: req.body.fitMode || 'fit',
    margin: parseInt(req.body.margin) || 20,
    quality: parseInt(req.body.quality) || 90,
  };

  logger.info(`Converting ${uploadedFiles.length} images to PDF with options:`, options);
  
  // Log file details
  uploadedFiles.forEach((file, index) => {
    logger.debug(`Image ${index + 1}: ${file.originalname} (${formatFileSize(file.size)})`);
  });

  // Validate page size
  if (!PAGE_SIZES[options.pageSize.toLowerCase()]) {
    throw new AppError(`Invalid page size. Supported: ${Object.keys(PAGE_SIZES).join(', ')}`, 400);
  }

  // Validate orientation
  if (!['portrait', 'landscape'].includes(options.orientation.toLowerCase())) {
    throw new AppError('Invalid orientation. Use "portrait" or "landscape"', 400);
  }

  // Validate fit mode
  if (!['fit', 'fill', 'actual'].includes(options.fitMode.toLowerCase())) {
    throw new AppError('Invalid fit mode. Use "fit", "fill", or "actual"', 400);
  }

  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Get page dimensions based on size and orientation
    let pageDimensions = { ...PAGE_SIZES[options.pageSize.toLowerCase()] };
    if (options.orientation.toLowerCase() === 'landscape') {
      [pageDimensions.width, pageDimensions.height] = [pageDimensions.height, pageDimensions.width];
    }

    // Track statistics
    let totalPages = 0;
    let processedImages = 0;

    // Process each image file
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      logger.debug(`Processing image ${i + 1}/${uploadedFiles.length}: ${file.originalname}`);

      try {
        // Read image file
        let imageBytes = await fs.readFile(file.path);
        
        // Get original image metadata for validation
        const originalMetadata = await sharp(imageBytes).metadata();
        logger.debug(`Original image ${i + 1} dimensions: ${originalMetadata.width}x${originalMetadata.height}`);
        
        // Check if this image has crop data
        const cropDataKey = `cropData_${i}`;
        if (req.body[cropDataKey]) {
          try {
            const cropData = JSON.parse(req.body[cropDataKey]);
            logger.debug(`Applying crop to image ${i + 1}:`, cropData);
            
            // Validate crop area against image dimensions
            if (cropData.x < 0 || cropData.y < 0 || 
                cropData.x + cropData.width > originalMetadata.width ||
                cropData.y + cropData.height > originalMetadata.height) {
              logger.warn(`Invalid crop area for ${file.originalname}: crop would be outside image bounds`);
              logger.warn(`Image: ${originalMetadata.width}x${originalMetadata.height}, Crop: x=${cropData.x}, y=${cropData.y}, w=${cropData.width}, h=${cropData.height}`);
              throw new Error('Crop area outside image bounds');
            }
            
            // Apply crop using Sharp's extract method
            imageBytes = await sharp(imageBytes)
              .extract({
                left: Math.round(cropData.x),
                top: Math.round(cropData.y),
                width: Math.round(cropData.width),
                height: Math.round(cropData.height)
              })
              .toBuffer();
            
            logger.debug(`Crop applied successfully to image ${i + 1}`);
          } catch (cropError) {
            logger.error(`Error applying crop to ${file.originalname}:`, cropError.message);
            logger.warn(`Continuing without crop for ${file.originalname}`);
          }
        }
        
        // Determine image type and process accordingly
        let image;
        const mimeType = file.mimetype.toLowerCase();
        const formatInfo = SUPPORTED_IMAGE_TYPES[mimeType];

        if (!formatInfo) {
          logger.warn(`Unsupported image type: ${mimeType}. Skipping ${file.originalname}`);
          continue;
        }

        // Convert non-native formats to PNG or JPEG using Sharp
        if (!formatInfo.native) {
          logger.debug(`Converting ${mimeType} to ${formatInfo.converter.toUpperCase()} using Sharp...`);
          
          try {
            // Special handling for SVG - rasterize at high DPI
            if (mimeType === 'image/svg+xml') {
              imageBytes = await sharp(imageBytes, { density: 300 })
                .png()
                .toBuffer();
              logger.debug('Rasterized SVG to PNG at 300 DPI');
            } else {
              // Convert other formats to PNG (preserves transparency)
              imageBytes = await sharp(imageBytes)
                .png()
                .toBuffer();
              logger.debug(`Converted ${mimeType} to PNG`);
            }
            
            // Embed the converted PNG
            image = await pdfDoc.embedPng(imageBytes);
            logger.debug('Embedded converted PNG image');
          } catch (conversionError) {
            logger.error(`Error converting ${file.originalname}:`, conversionError);
            logger.warn(`Skipping ${file.originalname} due to conversion error`);
            continue;
          }
        } else {
          // Native format - embed directly
          if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            image = await pdfDoc.embedJpg(imageBytes);
            logger.debug('Embedded JPG image');
          } else if (mimeType === 'image/png') {
            image = await pdfDoc.embedPng(imageBytes);
            logger.debug('Embedded PNG image');
          }
        }

        // Get image dimensions
        const imgWidth = image.width;
        const imgHeight = image.height;
        const imgAspectRatio = imgWidth / imgHeight;

        logger.debug(`Image dimensions: ${imgWidth}x${imgHeight} (aspect ratio: ${imgAspectRatio.toFixed(2)})`);

        // Calculate drawable area (page minus margins)
        const drawableWidth = pageDimensions.width - (2 * options.margin);
        const drawableHeight = pageDimensions.height - (2 * options.margin);

        // Calculate scaled dimensions based on fit mode
        let scaledWidth, scaledHeight, x, y;

        switch (options.fitMode.toLowerCase()) {
          case 'fit':
            // Scale image to fit within page while maintaining aspect ratio
            const scale = Math.min(
              drawableWidth / imgWidth,
              drawableHeight / imgHeight
            );
            scaledWidth = imgWidth * scale;
            scaledHeight = imgHeight * scale;
            
            // Center the image
            x = (pageDimensions.width - scaledWidth) / 2;
            y = (pageDimensions.height - scaledHeight) / 2;
            break;

          case 'fill':
            // Scale image to fill page (may crop) while maintaining aspect ratio
            const fillScale = Math.max(
              drawableWidth / imgWidth,
              drawableHeight / imgHeight
            );
            scaledWidth = imgWidth * fillScale;
            scaledHeight = imgHeight * fillScale;
            
            // Center the image
            x = (pageDimensions.width - scaledWidth) / 2;
            y = (pageDimensions.height - scaledHeight) / 2;
            break;

          case 'actual':
            // Use actual image size (may exceed page boundaries)
            scaledWidth = imgWidth;
            scaledHeight = imgHeight;
            
            // Center the image
            x = (pageDimensions.width - scaledWidth) / 2;
            y = (pageDimensions.height - scaledHeight) / 2;
            break;

          default:
            throw new AppError('Invalid fit mode', 400);
        }

        // Create new page with specified dimensions
        const page = pdfDoc.addPage([pageDimensions.width, pageDimensions.height]);
        
        // Draw white background (useful for transparent PNGs)
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageDimensions.width,
          height: pageDimensions.height,
          color: rgb(1, 1, 1),
        });

        // Draw image on page
        page.drawImage(image, {
          x: x,
          y: y,
          width: scaledWidth,
          height: scaledHeight,
        });

        totalPages++;
        processedImages++;
        logger.debug(`Added page ${totalPages} with scaled dimensions: ${scaledWidth.toFixed(2)}x${scaledHeight.toFixed(2)}`);

      } catch (imageError) {
        logger.error(`Error processing ${file.originalname}:`, imageError);
        // Continue processing other images instead of failing completely
        logger.warn(`Skipping ${file.originalname} due to error`);
      }
    }

    // Check if at least one image was processed
    if (processedImages === 0) {
      throw new AppError('No valid images could be processed. Supported formats: JPG, PNG', 400);
    }

    // Set PDF metadata
    pdfDoc.setTitle('Converted Images');
    pdfDoc.setSubject('Images converted to PDF by ConvertNest');
    pdfDoc.setCreator('ConvertNest');
    pdfDoc.setProducer('ConvertNest Image to PDF Tool');
    pdfDoc.setCreationDate(new Date());

    // Save PDF
    logger.debug('Generating PDF document...');
    const pdfBytes = await pdfDoc.save();

    // Generate output filename
    const timestamp = Date.now();
    const outputFilename = `images-to-pdf-${timestamp}.pdf`;
    const outputPath = path.join(path.dirname(uploadedFiles[0].path), `converted-${timestamp}.pdf`);

    // Write PDF to disk
    await fs.writeFile(outputPath, pdfBytes);

    const outputSize = pdfBytes.length;
    const processingTime = Date.now() - startTime;

    logger.info(`Image to PDF conversion completed in ${processingTime}ms`);
    logger.info(`Created ${totalPages} pages, output size: ${formatFileSize(outputSize)}`);

    // Send the file
    res.download(outputPath, outputFilename, async (err) => {
      // Cleanup: Delete all uploaded files and output file after download
      try {
        await Promise.all([
          ...uploadedFiles.map(f => fs.unlink(f.path)),
          fs.unlink(outputPath)
        ]);
        logger.debug('Cleaned up temporary files');
      } catch (cleanupError) {
        logger.error('Error cleaning up files:', cleanupError);
      }

      if (err) {
        logger.error('Error sending file:', err);
        next(err);
      }
    });

  } catch (error) {
    // Cleanup uploaded files on error
    try {
      await Promise.all(uploadedFiles.map(f => fs.unlink(f.path)));
    } catch (cleanupError) {
      logger.error('Error cleaning up files:', cleanupError);
    }

    logger.error('Image to PDF conversion error:', error);
    throw error;
  }
});

module.exports = {
  imageToPdf,
};
