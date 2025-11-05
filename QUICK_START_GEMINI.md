# Quick Start Guide - Gemini Image-to-Excel

## 🚀 Start Services

### 1. Python Service (Flask API)
```powershell
cd e:\tool\convertnest-backend\python-service
.\.venv\Scripts\Activate.ps1
python app.py
```
**Service runs on:** http://localhost:5000

### 2. Node.js Backend
```powershell
cd e:\tool\convertnest-backend
npm start
```
**Service runs on:** http://localhost:3000

---

## 🧪 Test Commands

### Health Check
```powershell
curl http://localhost:5000/health
```

Expected output:
```json
{
  "status": "healthy",
  "service": "Gemini Image-to-Excel Service",
  "version": "2.0.0",
  "extraction_method": "gemini-2.5-flash"
}
```

### Test with Image (PowerShell)
```powershell
$file = "E:\tool\IMG20251104124758.jpg"
$uri = "http://localhost:5000/api/extract-table"

$form = @{
    file = Get-Item -Path $file
}

Invoke-RestMethod -Uri $uri -Method Post -Form $form -OutFile "output.xlsx"
```

### Production Test Script
```powershell
cd e:\tool
..\tool\convertnest-backend\python-service\.venv\Scripts\python.exe test_production_gemini.py
```

---

## 📂 File Structure

```
convertnest-backend/
├── python-service/
│   ├── .env                          # ✅ GEMINI_API_KEY configured
│   ├── app.py                        # ✅ Updated for Gemini
│   ├── gemini_table_extractor.py    # ✅ NEW - Main extraction logic
│   ├── excel_generator.py           # ✅ Simplified (no formatting)
│   ├── requirements.txt             # ✅ Cleaned (Gemini-only)
│   ├── outputs/                     # Generated Excel files
│   ├── uploads/                     # Temporary image uploads
│   └── archive/                     # Old files (TATR, Vision API tests)
│       ├── table_extractor.py       # 614 lines - REPLACED
│       ├── test_vision_only.py
│       ├── test_gemini_flash.py
│       └── test_gemini_flash_v2.py
├── src/
│   └── controllers/
│       └── imageToExcelController.js  # ✅ NO CHANGES (abstracted)
└── GEMINI_INTEGRATION_COMPLETE.md     # ✅ Full documentation
```

---

## ⚙️ Configuration

### Python Service (.env)
```env
# Required
GEMINI_API_KEY=AIzaSyAe6-YcUO_JbNvPKudWRJe2X78dNpJhjFI
PORT=5000
DEBUG=False

# Optional
MAX_FILE_SIZE_MB=10
LOG_LEVEL=INFO
```

### Node.js Backend (.env)
```env
# Keep these as-is
USE_TATR_SERVICE=true
PYTHON_TATR_SERVICE_URL=http://localhost:5000
```

*(Note: `USE_TATR_SERVICE` now refers to Python service using Gemini)*

---

## 📊 Performance Expectations

| Metric | Value |
|--------|-------|
| **Extraction time** | ~3 seconds |
| **Accuracy (handwriting)** | 96%+ |
| **Cost per table** | $0.0014 |
| **Excel file size** | ~5-10 KB (plain data) |
| **Max image size** | 10 MB |
| **Supported formats** | PNG, JPG, JPEG, BMP, TIFF, WEBP |

---

## 🔧 Troubleshooting

### Issue: "No module named 'google.generativeai'"
**Solution:**
```powershell
cd e:\tool\convertnest-backend\python-service
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Issue: "GEMINI_API_KEY environment variable is required"
**Solution:** Check `.env` file in `python-service/` directory

### Issue: Python service won't start
**Solution:** Ensure virtual environment is activated:
```powershell
.\.venv\Scripts\Activate.ps1
python app.py
```

### Issue: Port 5000 already in use
**Solution:** Change port in `.env`:
```env
PORT=5001
```

And update Node.js backend:
```env
PYTHON_TATR_SERVICE_URL=http://localhost:5001
```

---

## 📈 Monitoring

### Check API Usage
Visit Gemini API console: https://aistudio.google.com/apikey

### Cost Tracking
- **Expected:** $1.40 per 1,000 tables
- **Annual (12K tables):** ~$16.86
- Set billing alerts at $5/month for safety

---

## ✅ Pre-Deployment Checklist

- [ ] `.env` configured with `GEMINI_API_KEY`
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Python service starts without errors
- [ ] Health endpoint responds correctly
- [ ] Test extraction works
- [ ] Excel output is plain (no formatting)
- [ ] Node.js backend can reach Python service
- [ ] Production `.env` updated on server

---

## 🚀 Production Deployment

1. **Copy files to production server**
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Set environment variables:**
   ```bash
   export GEMINI_API_KEY=AIzaSyAe6-YcUO_JbNvPKudWRJe2X78dNpJhjFI
   export PORT=5000
   export DEBUG=False
   ```
4. **Start with gunicorn:**
   ```bash
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```
5. **Set up supervisor/systemd for auto-restart**

---

## 📞 Support

For issues or questions:
1. Check `GEMINI_INTEGRATION_COMPLETE.md` for detailed documentation
2. Review logs in Python service terminal
3. Test with `test_production_gemini.py`
4. Verify API key is valid

---

**Last Updated:** November 5, 2025  
**Version:** 2.0.0 (Gemini)
