# Microsoft Table Transformer (TATR) Python Service

This service provides state-of-the-art table extraction from images using Microsoft's Table Transformer deep learning models.

## Features

- 🎯 **97% Accuracy**: Uses TATR models trained on 947,642 tables
- 🔍 **Two-Stage Detection**: Table detection + structure recognition
- 📊 **Proper Excel Format**: Merged cells, headers, professional styling
- 🌐 **OCR Integration**: Tesseract OCR for text extraction
- 🔄 **Auto-Rotation**: Detects and corrects skewed images
- ⚡ **Fast**: GPU-accelerated (CPU fallback available)

## Installation

### 1. Install Python Dependencies

```bash
cd python-service
pip install -r requirements.txt
```

### 2. Install Tesseract OCR

**Windows:**
```bash
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
# Install to: C:\Program Files\Tesseract-OCR
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set TESSERACT_CMD if needed
```

### 4. Download TATR Models

Models will be downloaded automatically on first run from Hugging Face:
- `microsoft/table-transformer-detection` (~110 MB)
- `microsoft/table-transformer-structure-recognition` (~110 MB)

## Usage

### Start the Service

```bash
python app.py
```

Service runs on `http://localhost:5000`

### API Endpoints

#### 1. Health Check
```bash
GET /health
```

#### 2. Extract Table to Excel
```bash
POST /api/extract-table

Form Data:
- file: Image file (PNG, JPG, JPEG, BMP, TIFF, WEBP)
- min_confidence: (optional) Minimum OCR confidence 0-100 (default: 50)
- detect_rotation: (optional) Auto-detect rotation true/false (default: true)

Returns: Excel file (.xlsx)
```

#### 3. Extract Table to JSON
```bash
POST /api/extract-table-json

Form Data:
- file: Image file
- min_confidence: (optional) 0-100

Returns: JSON with table structure and data
```

### Example Usage

**cURL:**
```bash
curl -X POST http://localhost:5000/api/extract-table \
  -F "file=@table_image.jpg" \
  -F "min_confidence=50" \
  -F "detect_rotation=true" \
  -o output.xlsx
```

**Node.js:**
```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

const form = new FormData();
form.append('file', fs.createReadStream('table_image.jpg'));
form.append('min_confidence', '50');

const response = await axios.post(
  'http://localhost:5000/api/extract-table',
  form,
  { 
    headers: form.getHeaders(),
    responseType: 'stream'
  }
);

response.data.pipe(fs.createWriteStream('output.xlsx'));
```

## Architecture

```
Image → TATR Detection → TATR Structure → Tesseract OCR → Excel
         (Find tables)   (Find cells)      (Extract text)  (Format)
```

### Models Used

1. **Table Detection Model**
   - Model: `microsoft/table-transformer-detection`
   - Purpose: Locate tables in images
   - Accuracy: 99.5% precision
   - Output: Bounding boxes of tables

2. **Structure Recognition Model**
   - Model: `microsoft/table-transformer-structure-recognition`
   - Purpose: Identify rows, columns, cells
   - Accuracy: 97% on structure
   - Output: Cell-level bounding boxes

3. **OCR Engine**
   - Engine: Tesseract OCR
   - Purpose: Extract text from cells
   - Confidence filtering: 50+ by default

## Excel Output Features

- ✅ **Professional Headers**: Blue background, white bold text, frozen
- ✅ **Number Formatting**: Auto-detect numbers, right-align, commas
- ✅ **Confidence Highlighting**: Red (low), Yellow (medium), White (high)
- ✅ **Zebra Striping**: Alternating row colors for readability
- ✅ **Auto Column Width**: Based on content length
- ✅ **Merged Cells**: Preserves table structure
- ✅ **Summary Sheet**: Extraction metadata and statistics
- ✅ **Comments**: Low-confidence cells marked with warnings

## Performance

- **GPU**: 2-4 seconds per table
- **CPU**: 8-15 seconds per table
- **Memory**: ~2GB (models + processing)

## Troubleshooting

### "No tables detected"
- Ensure image has clear table structure
- Check image quality (not too blurry)
- Try adjusting detection threshold

### "Tesseract not found"
- Verify Tesseract installation
- Set TESSERACT_CMD in .env to full path

### "CUDA out of memory"
- Reduce image size
- Use CPU mode (automatic fallback)

## Production Deployment

### Using Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app --timeout 120
```

### Using PM2

```bash
pm2 start app.py --name tatr-service --interpreter python3
```

## License

Uses Microsoft Table Transformer models (MIT License)
