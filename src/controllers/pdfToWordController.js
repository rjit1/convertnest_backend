const fs = require('fs').promises;
const path = require('path');
const { PDFParse } = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const logger = require('../utils/logger');
const { AppError, asyncHandler, formatSuccessResponse, formatFileSize } = require('../utils/helpers');

/**
 * Convert PDF to Word Document
 * POST /api/pdf-to-word
 */
const pdfToWord = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No PDF file uploaded', 400);
  }

  const startTime = Date.now();
  const inputFile = req.file;
  
  logger.info(`Processing PDF to Word conversion: ${inputFile.filename} (${formatFileSize(inputFile.size)})`);

  try {
    // Read the PDF file
    const pdfBuffer = await fs.readFile(inputFile.path);

    // Parse PDF to extract text
    logger.debug('Extracting text from PDF...');
    const parser = new PDFParse({ data: pdfBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();

    logger.debug(`Extracted ${pdfData.text.length} characters from ${pdfData.numpages} pages`);

    // Create Word document with better formatting
    const doc = new Document({
      sections: [{
        properties: {},
        children: createParagraphsFromText(pdfData.text)
      }]
    });

    // Generate Word file
    const wordBuffer = await Packer.toBuffer(doc);

    // Generate output filename
    const originalName = path.parse(inputFile.originalname).name;
    const outputFilename = `${originalName}-converted.docx`;
    const outputPath = path.join(path.dirname(inputFile.path), `word-${Date.now()}.docx`);

    // Save Word file temporarily
    await fs.writeFile(outputPath, wordBuffer);

    const processingTime = Date.now() - startTime;
    logger.info(`PDF to Word conversion completed in ${processingTime}ms`);

    // Send the file
    res.download(outputPath, outputFilename, async (err) => {
      // Cleanup: Delete both input and output files after download
      try {
        await fs.unlink(inputFile.path);
        await fs.unlink(outputPath);
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
    // Cleanup input file on error
    try {
      await fs.unlink(inputFile.path);
    } catch (cleanupError) {
      logger.error('Error cleaning up input file:', cleanupError);
    }

    logger.error('PDF to Word conversion error:', error);
    throw new AppError(`PDF conversion failed: ${error.message}`, 500);
  }
});

/**
 * Helper function to create paragraphs from extracted text
 * Preserves line breaks and attempts to identify headings
 */
function createParagraphsFromText(text) {
  const paragraphs = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;

    // Detect potential headings (short lines, all caps, or ending with colon)
    const isHeading = (
      line.length < 60 && 
      (line === line.toUpperCase() || line.endsWith(':') || /^[0-9]+\./.test(line))
    );

    if (isHeading) {
      paragraphs.push(
        new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 240,
            after: 120
          }
        })
      );
    } else {
      // Regular paragraph
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 24 // 12pt font
            })
          ],
          spacing: {
            before: 100,
            after: 100
          }
        })
      );
    }
  }

  // If no content, add a message
  if (paragraphs.length === 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No text content could be extracted from the PDF. The PDF might contain only images or scanned content.',
            italics: true
          })
        ]
      })
    );
  }

  return paragraphs;
}

/**
 * Get PDF info (metadata, page count)
 * POST /api/pdf-info
 */
const getPdfInfo = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No PDF file uploaded', 400);
  }

  const inputFile = req.file;

  try {
    const pdfBuffer = await fs.readFile(inputFile.path);
    
    // Parse PDF to get info
    const parser = new PDFParse({ data: pdfBuffer });
    const pdfInfo = await parser.getInfo({ parsePageInfo: true });
    await parser.destroy();

    // Cleanup
    await fs.unlink(inputFile.path);

    res.json(formatSuccessResponse({
      filename: inputFile.originalname,
      fileSize: formatFileSize(inputFile.size),
      pageCount: pdfInfo.total,
      info: {
        title: pdfInfo.info?.Title || 'N/A',
        author: pdfInfo.info?.Author || 'N/A',
        creator: pdfInfo.info?.Creator || 'N/A',
        producer: pdfInfo.info?.Producer || 'N/A'
      },
      dates: pdfInfo.getDateNode ? pdfInfo.getDateNode() : {}
    }, 'PDF information extracted successfully'));

  } catch (error) {
    // Cleanup
    try {
      await fs.unlink(inputFile.path);
    } catch (cleanupError) {
      logger.error('Error cleaning up file:', cleanupError);
    }

    logger.error('PDF info extraction error:', error);
    throw new AppError(`PDF info extraction failed: ${error.message}`, 500);
  }
});

module.exports = {
  pdfToWord,
  getPdfInfo
};
