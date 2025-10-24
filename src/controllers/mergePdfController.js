const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { AppError, asyncHandler, formatSuccessResponse, formatFileSize } = require('../utils/helpers');

/**
 * Merge multiple PDF files into one
 * POST /api/merge-pdfs
 */
const mergePdfs = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No PDF files uploaded', 400);
  }

  if (req.files.length < 2) {
    throw new AppError('At least 2 PDF files are required for merging', 400);
  }

  const startTime = Date.now();
  const uploadedFiles = req.files;
  
  logger.info(`Merging ${uploadedFiles.length} PDF files`);
  
  // Log file details
  uploadedFiles.forEach((file, index) => {
    logger.debug(`File ${index + 1}: ${file.originalname} (${formatFileSize(file.size)})`);
  });

  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Track total pages
    let totalPages = 0;

    // Process each PDF file
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      logger.debug(`Processing file ${i + 1}/${uploadedFiles.length}: ${file.originalname}`);

      try {
        // Read PDF file
        const pdfBytes = await fs.readFile(file.path);
        
        // Load PDF
        const pdf = await PDFDocument.load(pdfBytes);
        const pageCount = pdf.getPageCount();
        totalPages += pageCount;

        logger.debug(`File has ${pageCount} pages`);

        // Copy all pages to merged document
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });

        logger.debug(`Successfully merged ${pageCount} pages from ${file.originalname}`);

      } catch (pdfError) {
        throw new AppError(`Error processing ${file.originalname}: ${pdfError.message}`, 400);
      }
    }

    // Save merged PDF
    logger.debug('Generating merged PDF...');
    const mergedPdfBytes = await mergedPdf.save();

    // Generate output filename
    const timestamp = Date.now();
    const outputFilename = `merged-document-${timestamp}.pdf`;
    const outputPath = path.join(path.dirname(uploadedFiles[0].path), `merged-${timestamp}.pdf`);

    // Write merged PDF to disk
    await fs.writeFile(outputPath, mergedPdfBytes);

    const outputSize = mergedPdfBytes.length;
    const processingTime = Date.now() - startTime;

    logger.info(`PDF merge completed: ${uploadedFiles.length} files, ${totalPages} pages, ${formatFileSize(outputSize)}, ${processingTime}ms`);

    // Send the merged file
    res.download(outputPath, outputFilename, async (err) => {
      // Cleanup: Delete all input files and output file after download
      try {
        // Delete input files
        for (const file of uploadedFiles) {
          await fs.unlink(file.path);
        }
        // Delete output file
        await fs.unlink(outputPath);
        logger.debug('Cleaned up temporary files');
      } catch (cleanupError) {
        logger.error('Error cleaning up files:', cleanupError);
      }

      if (err) {
        logger.error('Error sending merged file:', err);
        next(err);
      }
    });

  } catch (error) {
    // Cleanup all uploaded files on error
    try {
      for (const file of uploadedFiles) {
        await fs.unlink(file.path);
      }
    } catch (cleanupError) {
      logger.error('Error cleaning up uploaded files:', cleanupError);
    }

    logger.error('PDF merge error:', error);
    throw new AppError(`PDF merge failed: ${error.message}`, 500);
  }
});

/**
 * Split PDF into separate pages
 * POST /api/split-pdf
 */
const splitPdf = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No PDF file uploaded', 400);
  }

  const inputFile = req.file;
  logger.info(`Splitting PDF: ${inputFile.filename} (${formatFileSize(inputFile.size)})`);

  try {
    // Read PDF file
    const pdfBytes = await fs.readFile(inputFile.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pageCount = pdf.getPageCount();

    logger.debug(`PDF has ${pageCount} pages`);

    if (pageCount < 2) {
      throw new AppError('PDF must have at least 2 pages to split', 400);
    }

    // Create individual PDFs for each page
    const splitFiles = [];

    for (let i = 0; i < pageCount; i++) {
      const singlePagePdf = await PDFDocument.create();
      const [copiedPage] = await singlePagePdf.copyPages(pdf, [i]);
      singlePagePdf.addPage(copiedPage);

      const pdfBytes = await singlePagePdf.save();
      const filename = `page-${i + 1}.pdf`;
      
      splitFiles.push({
        page: i + 1,
        filename,
        size: formatFileSize(pdfBytes.length),
        data: Buffer.from(pdfBytes).toString('base64')
      });
    }

    // Cleanup input file
    await fs.unlink(inputFile.path);

    logger.info(`Successfully split PDF into ${pageCount} separate pages`);

    res.json(formatSuccessResponse({
      originalFile: inputFile.originalname,
      pageCount,
      splitFiles
    }, 'PDF split successfully'));

  } catch (error) {
    // Cleanup
    try {
      await fs.unlink(inputFile.path);
    } catch (cleanupError) {
      logger.error('Error cleaning up file:', cleanupError);
    }

    logger.error('PDF split error:', error);
    throw new AppError(`PDF split failed: ${error.message}`, 500);
  }
});

/**
 * Reorder PDF pages
 * POST /api/reorder-pdf
 * Body: { pageOrder: [3, 1, 2] } - new order of pages (1-indexed)
 */
const reorderPdf = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No PDF file uploaded', 400);
  }

  const { pageOrder } = req.body;

  if (!pageOrder || !Array.isArray(pageOrder)) {
    throw new AppError('pageOrder must be an array of page numbers', 400);
  }

  const inputFile = req.file;
  logger.info(`Reordering PDF pages: ${inputFile.filename}`);

  try {
    // Read and load PDF
    const pdfBytes = await fs.readFile(inputFile.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pageCount = pdf.getPageCount();

    // Validate page order
    if (pageOrder.length !== pageCount) {
      throw new AppError(`Page order array must have ${pageCount} elements`, 400);
    }

    // Convert to 0-indexed and validate
    const pageIndices = pageOrder.map(p => {
      const index = p - 1;
      if (index < 0 || index >= pageCount) {
        throw new AppError(`Invalid page number: ${p}. Must be between 1 and ${pageCount}`, 400);
      }
      return index;
    });

    // Create new PDF with reordered pages
    const reorderedPdf = await PDFDocument.create();
    const copiedPages = await reorderedPdf.copyPages(pdf, pageIndices);
    
    copiedPages.forEach((page) => {
      reorderedPdf.addPage(page);
    });

    // Save reordered PDF
    const reorderedBytes = await reorderedPdf.save();
    const outputFilename = `reordered-${inputFile.originalname}`;
    const outputPath = path.join(path.dirname(inputFile.path), `reordered-${Date.now()}.pdf`);

    await fs.writeFile(outputPath, reorderedBytes);

    logger.info('PDF pages reordered successfully');

    // Send file
    res.download(outputPath, outputFilename, async (err) => {
      try {
        await fs.unlink(inputFile.path);
        await fs.unlink(outputPath);
      } catch (cleanupError) {
        logger.error('Error cleaning up files:', cleanupError);
      }

      if (err) {
        logger.error('Error sending file:', err);
        next(err);
      }
    });

  } catch (error) {
    // Cleanup
    try {
      await fs.unlink(inputFile.path);
    } catch (cleanupError) {
      logger.error('Error cleaning up file:', cleanupError);
    }

    logger.error('PDF reorder error:', error);
    throw new AppError(`PDF reorder failed: ${error.message}`, 500);
  }
});

module.exports = {
  mergePdfs,
  splitPdf,
  reorderPdf
};
