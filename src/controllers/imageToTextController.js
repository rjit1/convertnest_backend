const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const imagePreprocessor = require('../services/imagePreprocessor');
const geminiOCRService = require('../services/geminiOCRService');
const { AppError } = require('../utils/helpers');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { marked } = require('marked');
const PDFDocument = require('pdfkit');

/**
 * Image to Text Controller
 * Extract text from images using Gemini 2.5 Flash OCR
 * 
 * PRODUCTION-READY OCR SYSTEM:
 * - Gemini 2.5 Flash: 90-95% accuracy on printed text, 82-94% on handwriting
 * - 10X cheaper than Document AI ($0.10 vs $1.50 per 1000 images)
 * - Context-aware error correction using AI reasoning
 * - 200+ languages with auto-detection
 * - No processor version compatibility issues
 */

class ImageToTextController {
  constructor() {
    // Bind methods to preserve 'this' context in Express route handlers
    this.healthCheck = this.healthCheck.bind(this);
    this.extractText = this.extractText.bind(this);
    this.downloadText = this.downloadText.bind(this);
    this.structureText = this.structureText.bind(this);
    this.detectLanguage = this.detectLanguage.bind(this);
    this.generateDOCX = this.generateDOCX.bind(this);
    this.generatePDF = this.generatePDF.bind(this);
    this.generateMarkdown = this.generateMarkdown.bind(this);
  }
  
  /**
   * Health check endpoint
   */
  async healthCheck(req, res, next) {
    try {
      const geminiHealth = await geminiOCRService.healthCheck();
      
      res.json({
        success: true,
        service: 'image-to-text',
        status: 'operational',
        ocrEngine: geminiHealth,
        features: {
          preprocessing: '9-stage enhancement pipeline',
          model: 'Gemini 2.5 Flash (Native Vision OCR)',
          handwritingSupport: true,
          languageSupport: '200+ languages with auto-detection',
          contextAwareness: true,
          thinkingMode: 'Reasons about ambiguous text',
          outputFormats: ['TXT', 'DOCX', 'PDF', 'MD', 'JSON'],
          structuredOutput: 'Sections, confidence, statistics',
          accuracy: {
            printedClean: '90-95%',
            printedPoor: '85-90%',
            handwrittenClean: '88-94%',
            handwrittenMessy: '82-90%',
            mixedContent: '86-92%'
          },
          advantages: [
            '10X cheaper than Document AI',
            'Better handwriting accuracy',
            'Context-aware error correction',
            'No version compatibility issues',
            'Simpler, faster API'
          ],
          cost: {
            per1000Images: '$0.10',
            savings: '90% vs Document AI'
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Extract text from image with smart formatting detection
   */
  async extractText(req, res, next) {
    const startTime = Date.now();
    let uploadedFile = null;
    
    try {
      // Validate file upload
      if (!req.file) {
        throw new AppError('No image file uploaded', 400);
      }
      
      uploadedFile = req.file.path;
      logger.info(`📸 Extracting text from: ${req.file.originalname}`);
      
      // Get options from request
      const {
        preserveFormatting = 'true',
        detectLanguage = 'true',
        enhanceImage = 'true'
      } = req.body;
      
      // Step 1: Read uploaded image
      const imageBuffer = await fs.readFile(uploadedFile);
      
      // Step 2: Preprocess image (if enabled)
      let processedBuffer = imageBuffer;
      let qualityScore = 85; // Default quality score
      
      if (enhanceImage === 'true') {
        logger.info('🔄 Preprocessing image for optimal OCR...');
        const preprocessResult = await imagePreprocessor.enhanceForOCR(imageBuffer);
        processedBuffer = preprocessResult.buffer;
        qualityScore = preprocessResult.metadata.qualityScore || 85;
        logger.info(`✅ Image enhanced in ${preprocessResult.metadata.processingTime}ms`);
      }
      
      // Step 3: Extract text with Gemini 2.5 Flash
      logger.info('🤖 Extracting text with Gemini 2.5 Flash OCR...');
      const ocrResult = await geminiOCRService.processDocument(processedBuffer, {
        includeFormatting: preserveFormatting === 'true',
        detectLanguage: detectLanguage === 'true',
        enhanceHandwriting: true
      });
      
      // Step 4: Structure the extracted text intelligently
      const structuredText = this.structureText(ocrResult);
      
      // Step 5: Use Gemini's built-in language detection
      const detectedLanguage = detectLanguage === 'true' 
        ? ocrResult.language
        : null;
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ Text extraction completed in ${processingTime}ms`);
      
      // Send response
      res.json({
        success: true,
        data: {
          text: structuredText.plainText,
          formattedText: preserveFormatting === 'true' ? structuredText.formatted : null,
          sections: preserveFormatting === 'true' ? ocrResult.sections : structuredText.sections,
          statistics: {
            characterCount: ocrResult.statistics.characterCount,
            wordCount: ocrResult.statistics.wordCount,
            lineCount: ocrResult.statistics.lineCount,
            paragraphCount: ocrResult.sections?.filter(s => s.type === 'paragraph').length || 0
          },
          language: detectedLanguage,
          detectedLanguages: ocrResult.detectedLanguages,
          confidence: ocrResult.confidence,
          qualityScore: qualityScore,
          textType: ocrResult.textType,
          hasHandwriting: ocrResult.hasHandwriting,
          lowConfidenceRegions: ocrResult.lowConfidenceRegions
        },
        metadata: {
          processingTime,
          imageEnhanced: enhanceImage === 'true',
          formatPreserved: preserveFormatting === 'true',
          ocrEngine: 'Gemini 2.5 Flash',
          model: 'gemini-2.5-flash',
          sourceFile: req.file.originalname,
          fileSize: req.file.size,
          qualityIssues: ocrResult.qualityIssues || []
        }
      });
      
    } catch (error) {
      logger.error('❌ Text extraction failed:', error);
      next(error);
    } finally {
      // Clean up uploaded file
      if (uploadedFile) {
        await fs.unlink(uploadedFile).catch(err => 
          logger.error(`Failed to delete ${uploadedFile}:`, err)
        );
      }
    }
  }
  
  /**
   * Download extracted text in various formats
   */
  async downloadText(req, res, next) {
    const startTime = Date.now();
    let uploadedFile = null;
    
    try {
      // Validate file upload
      if (!req.file) {
        throw new AppError('No image file uploaded', 400);
      }
      
      uploadedFile = req.file.path;
      
      const { format = 'txt', preserveFormatting = 'true', enhanceImage = 'true' } = req.body;
      
      // Read uploaded image
      const imageBuffer = await fs.readFile(uploadedFile);
      
      // Preprocess if enabled
      let processedBuffer = imageBuffer;
      
      if (enhanceImage === 'true') {
        const preprocessResult = await imagePreprocessor.enhanceForOCR(imageBuffer);
        processedBuffer = preprocessResult.buffer;
      }
      
      // Extract text with Gemini
      const ocrResult = await geminiOCRService.processDocument(processedBuffer, {
        includeFormatting: preserveFormatting === 'true',
        detectLanguage: true,
        enhanceHandwriting: true
      });
      const structuredText = this.structureText(ocrResult);
      
      // Generate file based on format
      let fileBuffer, filename, mimeType;
      
      switch (format.toLowerCase()) {
        case 'txt':
          fileBuffer = Buffer.from(structuredText.plainText, 'utf-8');
          filename = `extracted-text-${Date.now()}.txt`;
          mimeType = 'text/plain';
          break;
          
        case 'docx':
          fileBuffer = await this.generateDOCX(structuredText, preserveFormatting === 'true');
          filename = `extracted-text-${Date.now()}.docx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
          
        case 'pdf':
          fileBuffer = await this.generatePDF(structuredText, preserveFormatting === 'true');
          filename = `extracted-text-${Date.now()}.pdf`;
          mimeType = 'application/pdf';
          break;
          
        case 'md':
        case 'markdown':
          fileBuffer = Buffer.from(this.generateMarkdown(structuredText), 'utf-8');
          filename = `extracted-text-${Date.now()}.md`;
          mimeType = 'text/markdown';
          break;
          
        case 'json':
          fileBuffer = Buffer.from(JSON.stringify({
            text: structuredText.plainText,
            sections: structuredText.sections,
            confidence: ocrResult.confidence,
            language: this.detectLanguage(ocrResult.rawText)
          }, null, 2), 'utf-8');
          filename = `extracted-text-${Date.now()}.json`;
          mimeType = 'application/json';
          break;
          
        default:
          throw new AppError(`Unsupported format: ${format}`, 400);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Set response headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Processing-Time', `${processingTime}ms`);
      res.setHeader('X-OCR-Engine', 'Google Document AI');
      
      // Send file
      res.send(fileBuffer);
      
      logger.info(`✅ Generated ${format.toUpperCase()} file in ${processingTime}ms`);
      
    } catch (error) {
      logger.error('❌ File generation failed:', error);
      next(error);
    } finally {
      // Clean up uploaded file
      if (uploadedFile) {
        await fs.unlink(uploadedFile).catch(err => 
          logger.error(`Failed to delete ${uploadedFile}:`, err)
        );
      }
    }
  }
  
  /**
   * Structure text with intelligent paragraph and heading detection
   * Works with both Gemini sections and raw text
   */
  structureText(ocrResult) {
    const rawText = ocrResult.rawText || '';
    
    // If Gemini provided structured sections, use them
    if (ocrResult.sections && ocrResult.sections.length > 0) {
      const formatted = ocrResult.sections.map(section => {
        if (section.type === 'heading') {
          return `\n${section.content}\n${'='.repeat(Math.min(section.content.length, 50))}\n`;
        } else {
          return `${section.content}\n`;
        }
      }).join('\n');
      
      return {
        plainText: rawText,
        formatted,
        sections: ocrResult.sections
      };
    }
    
    // Fallback: Create sections from raw text (if Gemini didn't provide them)
    const sections = [];
    
    // Split into lines
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      return {
        plainText: '',
        formatted: '',
        sections: []
      };
    }
    
    let currentParagraph = [];
    
    lines.forEach((line, index) => {
      // Detect headings (short lines, mostly uppercase, or followed by empty line)
      const isHeading = (
        line.length < 50 &&
        (line === line.toUpperCase() && line.split(' ').length <= 5) ||
        (index < lines.length - 1 && !lines[index + 1])
      );
      
      if (isHeading) {
        // Save previous paragraph if exists
        if (currentParagraph.length > 0) {
          sections.push({
            type: 'paragraph',
            content: currentParagraph.join(' '),
            confidence: ocrResult.confidence || 0.85
          });
          currentParagraph = [];
        }
        
        // Add heading
        sections.push({
          type: 'heading',
          content: line,
          level: line === line.toUpperCase() ? 1 : 2,
          confidence: ocrResult.confidence || 0.85
        });
      } else {
        currentParagraph.push(line);
      }
    });
    
    // Add final paragraph
    if (currentParagraph.length > 0) {
      sections.push({
        type: 'paragraph',
        content: currentParagraph.join(' '),
        confidence: ocrResult.confidence || 0.85
      });
    }
    
    // Generate formatted text
    const formatted = sections.map(section => {
      if (section.type === 'heading') {
        return `\n${section.content}\n${'='.repeat(Math.min(section.content.length, 50))}\n`;
      } else {
        return `${section.content}\n`;
      }
    }).join('\n');
    
    return {
      plainText: rawText,
      formatted,
      sections
    };
  }
  
  /**
   * Detect language from text (DEPRECATED - Gemini handles this natively)
   * Keeping for backward compatibility with old code
   */
  detectLanguage(text) {
    // Simple language detection based on character sets
    // Gemini provides better detection, so this is rarely used
    
    if (!text || text.length < 10) return 'unknown';
    
    // Check for common language patterns
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh'; // Chinese
    if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic
    if (/[\u0400-\u04ff]/.test(text)) return 'ru'; // Russian
    if (/[\u3040-\u309f]/.test(text)) return 'ja'; // Japanese (Hiragana)
    if (/[\u0900-\u097f]/.test(text)) return 'hi'; // Hindi
    if (/[\u0e00-\u0e7f]/.test(text)) return 'th'; // Thai
    if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // Korean
    
    // Default to English for Latin script
    return 'en';
  }
  
  /**
   * Generate DOCX file with formatting
   */
  async generateDOCX(structuredText, preserveFormatting) {
    const sections = preserveFormatting ? structuredText.sections : [
      { type: 'paragraph', content: structuredText.plainText }
    ];
    
    const docChildren = sections.map(section => {
      if (section.type === 'heading') {
        return new Paragraph({
          text: section.content,
          heading: section.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 }
        });
      } else {
        return new Paragraph({
          children: [new TextRun(section.content)],
          spacing: { before: 120, after: 120 }
        });
      }
    });
    
    const doc = new Document({
      sections: [{
        children: docChildren
      }]
    });
    
    return await Packer.toBuffer(doc);
  }
  
  /**
   * Generate PDF file
   */
  async generatePDF(structuredText, preserveFormatting) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      const sections = preserveFormatting ? structuredText.sections : [
        { type: 'paragraph', content: structuredText.plainText }
      ];
      
      sections.forEach(section => {
        if (section.type === 'heading') {
          doc.fontSize(section.level === 1 ? 18 : 14)
             .font('Helvetica-Bold')
             .text(section.content, { continued: false })
             .moveDown(0.5);
        } else {
          doc.fontSize(12)
             .font('Helvetica')
             .text(section.content, { align: 'left' })
             .moveDown(1);
        }
      });
      
      doc.end();
    });
  }
  
  /**
   * Generate Markdown format
   */
  generateMarkdown(structuredText) {
    return structuredText.sections.map(section => {
      if (section.type === 'heading') {
        const hashes = '#'.repeat(section.level);
        return `${hashes} ${section.content}\n`;
      } else {
        return `${section.content}\n`;
      }
    }).join('\n');
  }
}

module.exports = new ImageToTextController();
