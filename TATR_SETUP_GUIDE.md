# TATR Service Setup and Testing Guide

## 🚀 Quick Start

### Step 1: Setup Python Environment

```powershell
cd convertnest-backend/python-service
.\setup.ps1
```

This will:
- Create Python virtual environment
- Install PyTorch, Transformers, and TATR models
- Install Tesseract OCR integration
- Download pre-trained models (~220 MB)

### Step 2: Start Python TATR Service

```powershell
# Activate virtual environment
cd convertnest-backend/python-service
.\.venv\Scripts\Activate.ps1

# Start service
python app.py
```

Service will run on: **http://localhost:5000**

### Step 3: Start Node.js Backend

```powershell
cd convertnest-backend
npm start
```

Backend will run on: **http://localhost:3000**

### Step 4: Test the Integration

```powershell
# Test Python service directly
curl -X POST http://localhost:5000/api/extract-table `
  -F "file=@test-image.jpg" `
  -o output.xlsx

# Test through Node.js backend
curl -X POST http://localhost:3000/api/image-to-excel/convert `
  -F "file=@test-image.jpg" `
  -o output.xlsx
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│                   http://localhost:3001                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                Node.js Backend (Express)                 │
│                   http://localhost:3000                  │
│                                                           │
│  USE_TATR_SERVICE=true →────────┐                       │
│  USE_TATR_SERVICE=false ────┐   │                       │
└──────────────────────────────┼───┼───────────────────────┘
                               │   │
                               │   └──────────────────┐
                               │                      │
                               ▼                      ▼
        ┌──────────────────────────┐   ┌─────────────────────────┐
        │  Google Document AI      │   │  Python TATR Service    │
        │  (Form Parser)           │   │  http://localhost:5000  │
        │  ❌ 70-75% accuracy      │   │  ✅ 97% accuracy        │
        │  ❌ Wrong for tables     │   │                         │
        └──────────────────────────┘   │  Microsoft TATR Models  │
                                       │  + Tesseract OCR        │
                                       └─────────────────────────┘
```

---

## ⚙️ Configuration

### Enable/Disable TATR

Edit `convertnest-backend/.env`:

```bash
# Use Microsoft TATR (Recommended - 97% accuracy)
USE_TATR_SERVICE=true
PYTHON_TATR_SERVICE_URL=http://localhost:5000

# Use Google Document AI (Legacy - 70-75% accuracy)
USE_TATR_SERVICE=false
```

### TATR Service Configuration

Edit `python-service/.env`:

```bash
PORT=5000
DEBUG=False
TESSERACT_CMD=tesseract  # Or full path: C:\\Program Files\\Tesseract-OCR\\tesseract.exe
DETECTION_THRESHOLD=0.7
STRUCTURE_THRESHOLD=0.5
```

---

## 🧪 Testing

### Test 1: Python Service Health

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "TATR Table Extraction Service",
  "version": "1.0.0"
}
```

### Test 2: Extract Table (Python Direct)

```bash
curl -X POST http://localhost:5000/api/extract-table \
  -F "file=@table-image.jpg" \
  -F "min_confidence=50" \
  -F "detect_rotation=true" \
  -o output.xlsx
```

### Test 3: Extract Table (Through Node.js)

```bash
curl -X POST http://localhost:3000/api/image-to-excel/convert \
  -F "file=@table-image.jpg" \
  -o output.xlsx
```

### Test 4: Get JSON Response (Debug)

```bash
curl -X POST http://localhost:5000/api/extract-table-json \
  -F "file=@table-image.jpg" \
  | jq .
```

---

## 📈 Performance Comparison

| Method | Accuracy | Speed | Borderless | Merged Cells | Cost |
|--------|----------|-------|------------|--------------|------|
| **TATR** | 97% | 2-4s (GPU) / 8-15s (CPU) | ✅ Excellent | ✅ Yes | Free |
| **Google Form Parser** | 70-75% | 6-12s | ❌ Poor | ⚠️ Sometimes | $1.50/1K |
| **Google OCR** | 92-95% | 6-12s | ⚠️ Medium | ⚠️ Sometimes | $1.50/1K |

---

## 🐛 Troubleshooting

### Python service won't start

```powershell
# Check Python version
python --version  # Should be 3.8+

# Reinstall dependencies
cd python-service
pip install -r requirements.txt
```

### "Tesseract not found" error

**Windows:**
1. Download from: https://github.com/UB-Mannheim/tesseract/wiki
2. Install to: `C:\Program Files\Tesseract-OCR`
3. Add to PATH or set in `.env`:
   ```
   TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe
   ```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

### "TATR service is not running" error

Check if Python service is running:
```powershell
curl http://localhost:5000/health
```

If not, start it:
```powershell
cd python-service
.\.venv\Scripts\Activate.ps1
python app.py
```

### "No tables detected" error

**Possible causes:**
1. Image quality too low
2. No clear table structure
3. Table borders not visible

**Solutions:**
- Use higher resolution image
- Ensure table has visible borders
- Try adjusting detection threshold in `.env`

### Models downloading slow

First run downloads ~220 MB of TATR models from Hugging Face.
- This is normal and happens once
- Models are cached in `~/.cache/huggingface/`
- Subsequent runs use cached models

---

## 📦 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start Python service
cd python-service
pm2 start app.py --name tatr-service --interpreter python3

# Start Node.js backend
cd ../
pm2 start src/server.js --name convertnest-backend

# Save PM2 process list
pm2 save

# Setup PM2 startup
pm2 startup
```

### Using Gunicorn (Python)

```bash
cd python-service
gunicorn -w 4 -b 0.0.0.0:5000 app:app --timeout 120
```

---

## 🎯 Feature Highlights

### What TATR Can Do:

✅ **Detect Tables**: 99.5% precision in finding tables
✅ **Recognize Structure**: 97% accuracy on rows/columns/cells
✅ **Handle Merged Cells**: Properly identifies spanning cells
✅ **Borderless Tables**: Works without visible borders
✅ **Auto-Rotation**: Detects and corrects skewed images
✅ **Professional Excel**: Headers, formatting, confidence coloring
✅ **Summary Sheet**: Extraction metadata and statistics
✅ **Cell Comments**: Low-confidence cells marked for review
✅ **Number Detection**: Auto-format numbers, currencies, percentages
✅ **Zebra Striping**: Alternating row colors for readability

### Excel Output Features:

- **Headers**: Blue background, white bold text, frozen row
- **Numbers**: Right-aligned, comma separators (#,##0.00)
- **Confidence Colors**: Red (<70%), Yellow (70-85%), White (≥85%)
- **Auto Column Width**: Based on content (min 10, max 60)
- **Merged Cells**: Preserves original table structure
- **Summary Sheet**: Extraction details and table index

---

## 📚 API Reference

### POST /api/extract-table

Extract table from image and return Excel file.

**Request:**
```
Content-Type: multipart/form-data

file: Image file (required)
min_confidence: OCR confidence threshold 0-100 (optional, default: 50)
detect_rotation: Auto-detect rotation true/false (optional, default: true)
```

**Response:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

Excel file (.xlsx)
```

### POST /api/extract-table-json

Extract table and return JSON (for debugging).

**Response:**
```json
{
  "success": true,
  "tables": [...],
  "num_tables": 1,
  "rotation_corrected": 0.0,
  "image_size": [800, 600]
}
```

---

## 🔧 Development

### Run in Debug Mode

```bash
# Python service
cd python-service
DEBUG=true python app.py

# Node.js backend
cd ../
NODE_ENV=development npm run dev
```

### View Logs

```bash
# PM2 logs
pm2 logs tatr-service
pm2 logs convertnest-backend

# Or tail manually
tail -f python-service/logs/app.log
```

---

## 📝 Notes

- First run downloads TATR models (~220 MB) - this is normal
- Models are cached and reused on subsequent runs
- GPU acceleration automatic if CUDA available (2-4s processing)
- CPU fallback available (8-15s processing)
- Recommended RAM: 4GB minimum, 8GB for better performance

---

## 🎉 Success Indicators

When everything is working:

1. ✅ Python service: http://localhost:5000/health returns 200 OK
2. ✅ Node.js backend: http://localhost:3000/api/image-to-excel/health returns 200 OK
3. ✅ Upload test image → receives Excel file
4. ✅ Excel file opens without errors
5. ✅ Tables have proper formatting, headers, and structure

---

## 📞 Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review logs: `pm2 logs` or check console output
3. Verify all services are running: `pm2 status`
4. Test each component individually (Python → Node.js → Frontend)

**Common Issues:**
- "Tesseract not found" → Install Tesseract OCR
- "CUDA out of memory" → Automatic CPU fallback
- "No tables detected" → Check image quality
- "Service not running" → Start Python service first
