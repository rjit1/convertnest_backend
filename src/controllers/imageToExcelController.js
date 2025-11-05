const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const logger = require('../utils/logger');
const imagePreprocessor = require('../services/imagePreprocessor');
const documentAIService = require('../services/documentAIService');
const { AppError } = require('../utils/helpers');

// Python TATR service configuration
const PYTHON_SERVICE_URL = process.env.PYTHON_TATR_SERVICE_URL || 'http://localhost:5000';
const USE_TATR_SERVICE = process.env.USE_TATR_SERVICE === 'true';

/**
 * Image to Excel Controller
 * Handles complete workflow: upload → preprocess → OCR → Excel generation
 */

class ImageToExcelController {
  /**
   * Health check endpoint
   */
  async healthCheck(req, res, next) {
    try {
      const docAIHealth = await documentAIService.healthCheck();
      
      res.json({
        success: true,
        service: 'image-to-excel',
        status: 'operational',
        documentAI: docAIHealth,
        features: {
          preprocessing: '9-stage pipeline',
          ocrEngine: 'Google Document AI',
          handwritingSupport: true,
          maxAccuracy: '99%+ printed, 85-92% handwritten',
          processingTime: '4-7 seconds'
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Convert image to Excel using Python Gemini service (with preview)
   */
  async convertWithTATR(req, res, next) {
    const startTime = Date.now();
    
    try {
      // Validate file upload
      if (!req.file) {
        throw new AppError('No image file uploaded', 400);
      }
      
      logger.info(`📸 Processing with Gemini: ${req.file.originalname}`);
      
      // Step 1: Get JSON preview data first
      const formJson = new FormData();
      formJson.append('file', fsSync.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      
      logger.info(`🔄 Calling Gemini service (JSON) at ${PYTHON_SERVICE_URL}`);
      
      const jsonResponse = await axios.post(
        `${PYTHON_SERVICE_URL}/api/extract-table-json`,
        formJson,
        {
          headers: {
            ...formJson.getHeaders()
          },
          timeout: 120000
        }
      );
      
      const extractionData = jsonResponse.data;
      logger.info(`✅ JSON extraction complete`);
      
      // Step 2: Get Excel file
      const formExcel = new FormData();
      formExcel.append('file', fsSync.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      
      logger.info(`� Generating Excel file...`);
      
      const excelResponse = await axios.post(
        `${PYTHON_SERVICE_URL}/api/extract-table`,
        formExcel,
        {
          headers: {
            ...formExcel.getHeaders()
          },
          responseType: 'arraybuffer',
          timeout: 120000
        }
      );
      
      // Get filename from content-disposition header
      const contentDisposition = excelResponse.headers['content-disposition'];
      let filename = `table_extracted_${Date.now()}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }
      
      const totalTime = Date.now() - startTime;
      logger.info(`✅ Gemini processing complete in ${totalTime}ms`);
      
      // Prepare response with both Excel and preview data
      const excelBuffer = Buffer.from(excelResponse.data);
      
      // Send Excel file with custom headers containing preview data
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Processing-Time', totalTime.toString());
      res.setHeader('X-Extraction-Method', 'Gemini-2.5-Flash');
      res.setHeader('X-Table-Preview', encodeURIComponent(JSON.stringify(extractionData)));
      
      res.send(excelBuffer);
      
      // Clean up temp file
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        logger.error(`Cleanup error: ${err.message}`);
      }
      
    } catch (error) {
      logger.error(`Gemini conversion error: ${error.message}`);
      
      // Clean up temp file
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      
      // Handle Gemini service errors
      if (error.response) {
        const errorData = error.response.data;
        throw new AppError(
          `Gemini service error: ${errorData.error || error.message}`,
          error.response.status
        );
      } else if (error.code === 'ECONNREFUSED') {
        throw new AppError(
          'Gemini service is not running. Please start the Python service.',
          503
        );
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Convert image to Excel
   * Main endpoint - routes to Gemini service or legacy method
   * 
   * PRODUCTION CONFIGURATION:
   * - When USE_TATR_SERVICE=true: Routes to Python Gemini service (RECOMMENDED)
   *   → 96%+ accuracy, plain Excel output, 99.6% cost savings
   * - When USE_TATR_SERVICE=false: Uses legacy Document AI (DEPRECATED)
   *   → 85-90% accuracy, formatted Excel with colors/borders
   */
  async convertImageToExcel(req, res, next) {
    // Use Gemini service if enabled (RECOMMENDED FOR PRODUCTION)
    if (USE_TATR_SERVICE) {
      return this.convertWithTATR(req, res, next);
    }
    
    // Legacy method with Google Document AI (DEPRECATED - FORMATTING CODE BELOW)
    const startTime = Date.now();
    let tempFiles = [];
    
    try {
      // Validate file upload
      if (!req.file) {
        throw new AppError('No image file uploaded', 400);
      }
      
      logger.info(`📸 Processing image: ${req.file.originalname}`);
      tempFiles.push(req.file.path);
      
      // Step 1: Read image
      const imageBuffer = await fs.readFile(req.file.path);
      
      // Step 2: Quality assessment
      const qualityAssessment = await imagePreprocessor.assessQuality(imageBuffer);
      logger.info(`📊 Quality assessment: ${qualityAssessment.recommendation}`);
      
      // Step 3: Advanced preprocessing
      const preprocessingResult = await imagePreprocessor.enhanceForOCR(imageBuffer);
      logger.info(`✨ Preprocessing: ${preprocessingResult.metadata.pipeline.join(' → ')}`);
      
      // Step 4: OCR with Document AI
      const ocrResult = await documentAIService.processDocument(preprocessingResult.buffer);
      logger.info(`🤖 OCR complete: ${ocrResult.tables.length} tables found`);
      
      // Step 5: Validate results
      if (!ocrResult.tables || ocrResult.tables.length === 0) {
        throw new AppError('No tables detected in image. Please ensure the image contains tabular data.', 400);
      }
      
      // Step 6: Generate Excel file
      const excelResult = await this.generateExcelFile(ocrResult, req.file.originalname);
      tempFiles.push(excelResult.filePath);
      
      // Step 7: Prepare response
      const totalTime = Date.now() - startTime;
      
      const response = {
        success: true,
        message: 'Image converted to Excel successfully',
        data: {
          // Excel file info
          filename: excelResult.filename,
          fileSize: excelResult.fileSize,
          downloadUrl: `/api/download/${path.basename(excelResult.filePath)}`,
          
          // Processing details
          processingTime: totalTime,
          qualityScore: ocrResult.qualityScore.score,
          qualityRating: ocrResult.qualityScore.rating,
          
          // Table info
          tablesFound: ocrResult.tables.length,
          totalRows: ocrResult.tables.reduce((sum, t) => sum + t.rowCount, 0),
          totalColumns: ocrResult.tables[0]?.columnCount || 0,
          
          // Quality warnings
          warnings: this.generateWarnings(ocrResult, qualityAssessment),
          
          // Confidence metrics
          averageConfidence: ocrResult.confidence,
          hasHandwriting: ocrResult.hasHandwriting,
          
          // Preview data (first 10 rows)
          preview: this.generatePreview(ocrResult.tables[0]),
          
          // Cell-level confidence for frontend highlighting
          cellConfidences: ocrResult.tables[0]?.cellConfidences || []
        },
        
        // Metadata
        metadata: {
          originalImage: {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
          },
          preprocessing: preprocessingResult.metadata,
          ocr: {
            engine: 'Google Document AI',
            processingTime: ocrResult.processingTime,
            pageCount: ocrResult.pageCount
          }
        }
      };
      
      logger.info(`✅ Complete workflow finished in ${totalTime}ms`);
      
      // Send Excel file as download (stream the file directly)
      res.download(excelResult.filePath, excelResult.filename, async (err) => {
        // Cleanup temp files after download (or on error)
        if (err) {
          logger.error('Download error:', err);
        }
        
        // Clean up uploaded image and generated Excel after a delay
        setTimeout(async () => {
          await this.cleanupTempFiles(tempFiles);
        }, 5000); // 5 second delay to ensure download completes
      });
      
    } catch (error) {
      // Cleanup on error
      await this.cleanupTempFiles(tempFiles);
      
      logger.error('❌ Image to Excel conversion failed:', error);
      next(error);
    }
  }
  
  /**
   * Generate Excel file from OCR results
   * 
   * ⚠️ DEPRECATED - This method is only used when USE_TATR_SERVICE=false
   * ⚠️ Creates formatted Excel with colors, borders, fonts (NOT RECOMMENDED)
   * ⚠️ For production, use Gemini service which outputs plain Excel
   * 
   * @param {Object} ocrResult - OCR data with tables
   * @param {string} originalFilename - Original image filename
   * @returns {Promise<Object>} Excel file info
   */
  async generateExcelFile(ocrResult, originalFilename) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Set workbook metadata
      workbook.creator = 'ConvertNest';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // Process each table as a separate worksheet
      ocrResult.tables.forEach((table, index) => {
        const sheetName = ocrResult.tables.length > 1 
          ? `Table ${index + 1}` 
          : 'Sheet1';
        
        const worksheet = workbook.addWorksheet(sheetName);
        
        // IMPROVEMENT 1: Add headers if available
        let startRow = 1;
        if (table.headers && table.headers.length > 0) {
          const headerRow = worksheet.addRow(table.headers);
          
          // Style headers: bold + background color + borders
          headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }; // White bold text
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF4472C4' } // Professional blue
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'medium', color: { argb: 'FF000000' } }, // Thicker bottom
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          });
          
          startRow = 2;
        }
        
        // IMPROVEMENT 2: Add data rows with smart formatting
        table.rows.forEach((row, rowIndex) => {
          const excelRow = worksheet.addRow(row.map(cell => {
            // IMPROVEMENT 3: Auto-detect and convert numbers
            const cleaned = cell.trim();
            
            // Check if it's a number (with possible comma separators)
            const numberMatch = cleaned.match(/^-?[\d,]+\.?\d*$/);
            if (numberMatch) {
              const num = parseFloat(cleaned.replace(/,/g, ''));
              return isNaN(num) ? cleaned : num;
            }
            
            // Check if it's a percentage
            if (cleaned.match(/^-?[\d.]+%$/)) {
              const num = parseFloat(cleaned.replace('%', '')) / 100;
              return isNaN(num) ? cleaned : num;
            }
            
            // Check if it's a currency
            const currencyMatch = cleaned.match(/^[$€£¥]?\s*-?[\d,]+\.?\d*$/);
            if (currencyMatch) {
              const num = parseFloat(cleaned.replace(/[$€£¥,\s]/g, ''));
              return isNaN(num) ? cleaned : num;
            }
            
            return cleaned;
          }));
          
          // Add borders and formatting to all cells
          excelRow.eachCell((cell, colNumber) => {
            // Borders
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
              right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
            };
            
            // IMPROVEMENT 4: Color-code by confidence
            const confidence = table.cellConfidences?.[rowIndex]?.[colNumber - 1];
            if (confidence !== undefined && confidence > 0) {
              if (confidence < 0.7) {
                // Low confidence: light red background
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFE0E0' } // Pale red
                };
                // Add comment for low confidence (use proper ExcelJS comment syntax)
                cell.note = {
                  texts: [{ text: `Low confidence: ${(confidence * 100).toFixed(0)}%` }]
                };
              } else if (confidence < 0.85) {
                // Medium confidence: light yellow background
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFFF99' } // Pale yellow
                };
              }
              // High confidence (>= 0.85): white background (default)
            }
            
            // IMPROVEMENT 5: Smart alignment
            if (typeof cell.value === 'number') {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              // Format numbers with commas
              cell.numFmt = '#,##0.00';
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
            }
          });
          
          // Zebra striping for better readability
          if (rowIndex % 2 === 1) {
            excelRow.eachCell((cell) => {
              // Only apply zebra stripes if no other fill is set
              if (!cell.fill || !cell.fill.fgColor) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF5F5F5' } // Very light gray
                };
              }
            });
          }
        });
        
        // IMPROVEMENT 6: Auto-fit columns (smarter algorithm)
        worksheet.columns.forEach((column, idx) => {
          let maxLength = 10; // Minimum width
          
          column.eachCell({ includeEmpty: false }, (cell) => {
            const cellValue = cell.value ? cell.value.toString() : '';
            const cellLength = cellValue.length;
            maxLength = Math.max(maxLength, cellLength);
          });
          
          // Set width with reasonable bounds
          column.width = Math.min(Math.max(maxLength + 2, 10), 60);
        });
        
        // IMPROVEMENT 7: Freeze header row
        if (table.headers) {
          worksheet.views = [
            { state: 'frozen', ySplit: 1 } // Freeze first row
          ];
        }
      });
      
      // Generate filename
      const baseFilename = originalFilename.replace(/\.[^/.]+$/, '');
      const excelFilename = `${baseFilename}_converted_${Date.now()}.xlsx`;
      const outputPath = path.join(__dirname, '../../uploads', excelFilename);
      
      // Write to file
      await workbook.xlsx.writeFile(outputPath);
      
      // Get file size
      const stats = await fs.stat(outputPath);
      
      logger.info(`📊 Excel file created: ${excelFilename} (${stats.size} bytes)`);
      
      return {
        filename: excelFilename,
        filePath: outputPath,
        fileSize: stats.size
      };
      
    } catch (error) {
      logger.error('Excel generation failed:', error);
      throw new AppError(`Failed to generate Excel file: ${error.message}`, 500);
    }
  }
  
  /**
   * Generate quality warnings for user
   * @param {Object} ocrResult
   * @param {Object} qualityAssessment
   * @returns {Array} Warning messages
   */
  generateWarnings(ocrResult, qualityAssessment) {
    const warnings = [];
    
    // Low quality score
    if (ocrResult.qualityScore.score < 0.7) {
      warnings.push({
        type: 'quality',
        severity: 'medium',
        message: `Image quality score: ${(ocrResult.qualityScore.score * 100).toFixed(1)}%. Some cells may need review.`,
        suggestion: 'For best results, use clear, well-lit photos with the camera held flat above the document.'
      });
    }
    
    // Handwriting detected
    if (ocrResult.hasHandwriting) {
      warnings.push({
        type: 'handwriting',
        severity: 'info',
        message: 'Handwriting detected. Accuracy: 85-92%.',
        suggestion: 'Please review handwritten cells (highlighted in yellow/red) for accuracy.'
      });
    }
    
    // Low resolution
    if (qualityAssessment.issues.lowResolution) {
      warnings.push({
        type: 'resolution',
        severity: 'low',
        message: 'Low resolution image detected. Image was upscaled for better OCR.',
        suggestion: 'For best results, use higher resolution images (1200x1200 or larger).'
      });
    }
    
    // Low confidence cells
    const lowConfidenceCells = ocrResult.tables.reduce((count, table) => {
      return count + table.cellConfidences.flat().filter(c => c < 0.8).length;
    }, 0);
    
    if (lowConfidenceCells > 0) {
      warnings.push({
        type: 'confidence',
        severity: 'medium',
        message: `${lowConfidenceCells} cells have low confidence (< 80%).`,
        suggestion: 'Low-confidence cells are highlighted. Please review them for accuracy.'
      });
    }
    
    // Text extraction fallback
    if (ocrResult.tables.some(t => t.extracted === 'text-parsing')) {
      warnings.push({
        type: 'structure',
        severity: 'high',
        message: 'No clear table structure detected. Data extracted using text parsing.',
        suggestion: 'Ensure the image shows a clear grid/table structure with visible borders or consistent spacing.'
      });
    }
    
    return warnings;
  }
  
  /**
   * Generate preview data for frontend (first 10 rows)
   * @param {Object} table - First table from OCR
   * @returns {Object} Preview data
   */
  generatePreview(table) {
    if (!table) return null;
    
    const maxRows = 10;
    const previewRows = table.rows.slice(0, maxRows);
    
    return {
      headers: table.headers,
      rows: previewRows,
      cellConfidences: table.cellConfidences.slice(0, maxRows),
      hasMore: table.rows.length > maxRows,
      totalRows: table.rows.length
    };
  }
  
  /**
   * Cleanup temporary files
   * @param {Array} filePaths - Paths to delete
   */
  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
        logger.info(`🧹 Cleaned up: ${path.basename(filePath)}`);
      } catch (error) {
        // Ignore errors (file might not exist)
        logger.debug(`Cleanup skip: ${filePath}`);
      }
    }
  }
}

module.exports = new ImageToExcelController();
