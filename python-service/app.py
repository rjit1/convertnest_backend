"""
Flask API for Image-to-Excel Conversion using Gemini 2.5 Flash
Production-ready service for handwritten table extraction
"""
import os
import sys
import logging
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import traceback
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Lazy import flag - import libraries only when needed
_modules_loaded = False
GeminiTableExtractor = None
ExcelGenerator = None

def _load_modules():
    """Lazy load Gemini modules only when first needed"""
    global _modules_loaded, GeminiTableExtractor, ExcelGenerator
    if not _modules_loaded:
        logger.info("Loading Gemini Table Extractor...")
        from gemini_table_extractor import GeminiTableExtractor as GTE
        from excel_generator import ExcelGenerator as EG
        GeminiTableExtractor = GTE
        ExcelGenerator = EG
        _modules_loaded = True
        logger.info("✓ Gemini modules loaded successfully")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
OUTPUT_FOLDER = os.path.join(os.path.dirname(__file__), 'outputs')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Create directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Initialize services (lazy loading to speed up startup)
table_extractor = None
excel_generator = None

def get_table_extractor():
    """Lazy initialization of Gemini table extractor"""
    global table_extractor
    if table_extractor is None:
        _load_modules()  # Load modules if not already loaded
        logger.info("Initializing Gemini Table Extractor...")
        table_extractor = GeminiTableExtractor()
        logger.info("✓ Gemini Table Extractor initialized")
    return table_extractor

def get_excel_generator():
    """Lazy initialization of excel generator"""
    global excel_generator
    if excel_generator is None:
        _load_modules()  # Load modules if not already loaded
        logger.info("Initializing Excel Generator...")
        excel_generator = ExcelGenerator()
        logger.info("✓ Excel Generator initialized")
    return excel_generator

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Gemini Image-to-Excel Service',
        'version': '2.0.0',
        'extraction_method': 'gemini-2.5-flash',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/extract-table', methods=['POST'])
def extract_table():
    """
    Main endpoint for table extraction using Gemini
    
    Expects:
    - file: Image file containing table
    
    Returns:
    - Excel file with extracted table
    """
    try:
        # Validate request
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file type. Allowed: {ALLOWED_EXTENSIONS}'}), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        input_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(input_path)
        
        logger.info(f"Processing file: {unique_filename}")
        
        # Extract table using Gemini
        extractor = get_table_extractor()
        extraction_result = extractor.extract_tables(
            image_path=input_path
        )
        
        if not extraction_result or not extraction_result.get('tables'):
            logger.warning(f"No tables detected in {unique_filename}")
            # Clean up
            if os.path.exists(input_path):
                os.remove(input_path)
            return jsonify({
                'error': 'No tables detected in image',
                'suggestion': 'Please ensure the image contains a clear table with visible structure'
            }), 404
        
        logger.info(f"Detected {len(extraction_result['tables'])} table(s)")
        
        # Generate Excel file
        generator = get_excel_generator()
        output_filename = f"{timestamp}_table_extracted.xlsx"
        output_path = os.path.join(OUTPUT_FOLDER, output_filename)
        
        excel_result = generator.create_excel(
            tables=extraction_result['tables'],
            output_dir=OUTPUT_FOLDER,
            filename=output_filename
        )
        
        if not excel_result.get('success'):
            raise Exception(excel_result.get('error', 'Failed to create Excel file'))
        
        logger.info(f"Excel file created: {output_filename} ({excel_result['file_size']} bytes)")
        
        # Clean up input file
        if os.path.exists(input_path):
            os.remove(input_path)
        
        # Send Excel file
        return send_file(
            excel_result['excel_path'],
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f"table_extracted_{filename.rsplit('.', 1)[0]}.xlsx"
        )
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Clean up files on error
        if 'input_path' in locals() and os.path.exists(input_path):
            os.remove(input_path)
        if 'output_path' in locals() and os.path.exists(output_path):
            os.remove(output_path)
        
        return jsonify({
            'error': 'Internal server error',
            'message': str(e),
            'type': type(e).__name__
        }), 500

@app.route('/api/extract-table-json', methods=['POST'])
def extract_table_json():
    """
    Extract table and return JSON representation instead of Excel
    
    Useful for debugging and custom processing
    """
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file'}), 400
        
        # Save file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        input_path = os.path.join(UPLOAD_FOLDER, f"{timestamp}_{filename}")
        file.save(input_path)
        
        # Extract tables
        extractor = get_table_extractor()
        result = extractor.extract_tables(image_path=input_path)
        
        # Clean up
        if os.path.exists(input_path):
            os.remove(input_path)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in JSON extraction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return jsonify({
        'error': 'File too large',
        'max_size': f'{MAX_FILE_SIZE / (1024 * 1024)}MB'
    }), 413

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Gemini Image-to-Excel Service on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    # Security: Only listen on localhost in production
    # Nginx will reverse proxy external requests
    app.run(
        host='127.0.0.1',  # Changed from 0.0.0.0 for security
        port=port,
        debug=debug
    )
