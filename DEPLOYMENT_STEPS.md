# 🚀 PRODUCTION DEPLOYMENT GUIDE - ConvertNest Backend with Image-to-Excel

## 📋 Pre-Deployment Checklist

### ✅ Completed Locally:
- [x] Python Gemini service API key updated: `AIzaSyBUh0SBKjsm2c530wUxMrIIljiTyF9a-kA`
- [x] NODE_ENV set to production
- [x] USE_TATR_SERVICE=true (Gemini enabled)
- [x] PM2 ecosystem config created
- [x] All routes registered in server.js
- [x] Image-to-Excel controller tested

---

## 🌐 Server Credentials

**Digital Ocean Droplet:**
- IP: `64.227.133.82`
- User: `convertnest-api`
- Password: `First523@#$SH`
- SSH: `ssh convertnest-api@64.227.133.82`

**GitHub Repository:**
- Repo: `https://github.com/rjit1/multitool_website`
- Branch: `main`
- Backend path: `/convertnest-backend`

---

## 📦 STEP 1: Push Backend to GitHub

```powershell
# Navigate to backend directory
cd E:\tool\convertnest-backend

# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Add Image-to-Excel Gemini service and production configs"

# Push to GitHub
git push origin main
```

---

## 🖥️ STEP 2: SSH into Digital Ocean

```powershell
# Connect to server
ssh convertnest-api@64.227.133.82
# Password: First523@#$SH
```

---

## 🔄 STEP 3: Update Backend Code on Server

```bash
# Navigate to backend directory
cd /var/www/convertnest-backend

# Pull latest changes
git pull origin main

# Check what changed
git log -1 --stat

# Verify new files are present
ls -la python-service/
ls -la ecosystem.config.js
```

---

## 🐍 STEP 4: Setup Python Gemini Service

### Install Python 3.10+ (if not installed)

```bash
# Check Python version
python3 --version

# If Python < 3.10, install Python 3.10
sudo apt update
sudo apt install python3.10 python3.10-venv python3-pip -y
```

### Setup Python Virtual Environment

```bash
# Navigate to Python service directory
cd /var/www/convertnest-backend/python-service

# Create virtual environment
python3.10 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# This installs:
# - google-generativeai (Gemini AI SDK)
# - openpyxl (Excel generation)
# - Flask (web framework)
# - Flask-CORS (CORS support)
# - Pillow (image processing)
# - python-dotenv (environment variables)
```

### Verify Python Service .env

```bash
# Check .env file has correct API key
cat .env

# Should show:
# GEMINI_API_KEY=AIzaSyBUh0SBKjsm2c530wUxMrIIljiTyF9a-kA
```

### Test Python Service Locally

```bash
# Run Python service (test only)
python app.py

# Should see:
# * Running on http://0.0.0.0:5000
# Press Ctrl+C to stop

# In another terminal, test health endpoint:
curl http://localhost:5000/health

# Expected response:
# {"status":"healthy","service":"Gemini Image-to-Excel Service",...}
```

Press `Ctrl+C` to stop the test server.

---

## 📦 STEP 5: Install Node.js Dependencies

```bash
# Go back to backend root
cd /var/www/convertnest-backend

# Install/update Node.js dependencies
npm install --production

# Verify critical packages installed
npm list | grep -E "express|@google/genai|exceljs|sharp"
```

---

## 🔧 STEP 6: Update Production .env File

```bash
# Edit .env file
nano .env

# Verify these critical settings:
NODE_ENV=production
USE_TATR_SERVICE=true
PYTHON_TATR_SERVICE_URL=http://localhost:5000
GEMINI_API_KEY_1=AIzaSyBUh0SBKjsm2c530wUxMrIIljiTyF9a-kA
GEMINI_API_KEY_2=AIzaSyBUh0SBKjsm2c530wUxMrIIljiTyF9a-kA

# Save: Ctrl+O, Enter
# Exit: Ctrl+X
```

---

## 🚀 STEP 7: Deploy with PM2

### Stop Existing Services

```bash
# Stop all PM2 processes
pm2 stop all
pm2 delete all
```

### Start Services with Ecosystem Config

```bash
# Start both services using ecosystem config
cd /var/www/convertnest-backend
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system reboot
pm2 startup
# Copy and run the command it outputs
```

### Verify Both Services Running

```bash
# Check PM2 status
pm2 status

# Expected output:
# ┌─────┬──────────────────────────┬─────────┬─────────┐
# │ id  │ name                     │ status  │ restart │
# ├─────┼──────────────────────────┼─────────┼─────────┤
# │ 0   │ convertnest-api          │ online  │ 0       │
# │ 1   │ python-gemini-service    │ online  │ 0       │
# └─────┴──────────────────────────┴─────────┴─────────┘
```

---

## 🧪 STEP 8: Test Services

### Test Python Service Health

```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "Gemini Image-to-Excel Service",
  "version": "2.0.0",
  "extraction_method": "gemini-2.5-flash"
}
```

### Test Node.js Backend

```bash
curl http://localhost:3000/
```

**Expected Response:**
```json
{
  "success": true,
  "message": "ConvertNest Backend API",
  "version": "1.0.0",
  "endpoints": {
    "imageToExcel": "POST /api/image-to-excel/convert",
    ...
  }
}
```

### Test Image-to-Excel Endpoint

```bash
# Check if endpoint is registered
curl http://localhost:3000/api/image-to-excel/health
```

---

## 📊 STEP 9: Monitor Logs

### View All Logs

```bash
# Real-time logs for both services
pm2 logs

# View last 50 lines
pm2 logs --lines 50

# View only Node.js API logs
pm2 logs convertnest-api

# View only Python service logs
pm2 logs python-gemini-service

# View errors only
pm2 logs --err
```

### Check for Errors

```bash
# Check if Python service is loading correctly
pm2 logs python-gemini-service | grep -i "error\|exception\|failed"

# Should see:
# "✓ Gemini modules loaded successfully"
# "Starting Gemini Image-to-Excel Service on port 5000"
```

---

## 🌐 STEP 10: Test from Frontend

### Update Frontend API URL (if needed)

Your frontend is already configured to use:
- Production: `https://api.convertnest.tech`

### Test Image-to-Excel Flow

1. **Visit Frontend:**
   ```
   https://www.convertnest.tech/tools/image-to-excel
   ```

2. **Upload Test Image:**
   - Upload a receipt or table screenshot
   - Should see "Processing with AI..."

3. **Verify Success:**
   - Excel file downloads automatically
   - Open Excel - data should be extracted correctly

4. **Check Backend Logs:**
   ```bash
   pm2 logs --lines 100
   ```
   
   Should see:
   ```
   📸 Processing with Gemini: receipt.jpg
   🔄 Calling Gemini service (JSON) at http://localhost:5000
   ✅ JSON extraction complete
   📊 Generating Excel file...
   Excel file created successfully
   ```

---

## 🔍 STEP 11: Verify All Tools Still Work

Test each endpoint to ensure nothing broke:

```bash
# Test PDF to Word
curl -X POST http://localhost:3000/api/pdf-to-word -F "pdf=@test.pdf"

# Test Merge PDFs
curl http://localhost:3000/api/merge-pdfs

# Test Currency Converter
curl http://localhost:3000/api/currency/supported

# Test Image to PDF
curl -X POST http://localhost:3000/api/image-to-pdf -F "images=@test.jpg"

# Test Caption Generator
curl -X POST http://localhost:3000/api/caption-generator -F "image=@test.jpg"

# NEW: Test Image to Excel
curl -X POST http://localhost:3000/api/image-to-excel/convert -F "image=@receipt.jpg" -o output.xlsx
```

---

## 📈 STEP 12: Monitor System Resources

```bash
# Check memory usage
free -h

# Check disk space
df -h

# Check PM2 resource usage
pm2 monit

# Check individual process
pm2 show convertnest-api
pm2 show python-gemini-service
```

### Expected Resource Usage:
- **Node.js Backend:** 150-300 MB RAM
- **Python Service:** 200-400 MB RAM
- **Total:** ~500-700 MB RAM (fits in 2GB droplet)

---

## 🚨 TROUBLESHOOTING

### Issue: Python Service Won't Start

```bash
# Check logs
pm2 logs python-gemini-service --err --lines 50

# Common causes:
# 1. Virtual environment not created
cd /var/www/convertnest-backend/python-service
ls -la .venv/  # Should exist

# 2. Dependencies not installed
source .venv/bin/activate
pip list | grep google-generativeai  # Should show version

# 3. Wrong Python path in ecosystem.config.js
which python3.10  # Should show /usr/bin/python3.10

# Fix: Update ecosystem.config.js script path
```

### Issue: "No tables detected" Error

```bash
# Check Gemini API key is correct
cat /var/www/convertnest-backend/python-service/.env | grep GEMINI_API_KEY

# Test Gemini API manually
cd /var/www/convertnest-backend/python-service
source .venv/bin/activate
python -c "import google.generativeai as genai; genai.configure(api_key='AIzaSyBUh0SBKjsm2c530wUxMrIIljiTyF9a-kA'); print('API key valid')"
```

### Issue: Node.js Can't Connect to Python Service

```bash
# 1. Check Python service is running
pm2 status python-gemini-service
# Should show: online

# 2. Test Python health endpoint
curl http://localhost:5000/health

# 3. Check Node.js .env
cat /var/www/convertnest-backend/.env | grep PYTHON_TATR_SERVICE_URL
# Should show: http://localhost:5000

# 4. Check firewall (should NOT block localhost)
sudo ufw status
# Port 5000 should NOT be listed (only internal)
```

### Issue: Out of Memory

```bash
# Check current usage
free -h

# If available < 200MB:
# 1. Restart services
pm2 restart all

# 2. Clear old uploads
find /var/www/convertnest-backend/uploads -type f -mtime +1 -delete
find /var/www/convertnest-backend/python-service/uploads -type f -mtime +1 -delete

# 3. Consider upgrading droplet to 4GB RAM
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Both PM2 services show "online" status
- [ ] Node.js backend responds to health check
- [ ] Python service responds to health check
- [ ] Image-to-Excel endpoint registered
- [ ] Frontend can upload images successfully
- [ ] Excel files download correctly
- [ ] Extracted data matches source image
- [ ] All existing tools still functional
- [ ] Logs show no errors
- [ ] Memory usage < 1.5GB total
- [ ] PM2 configured for auto-restart on reboot

---

## 📞 QUICK REFERENCE COMMANDS

```bash
# SSH to server
ssh convertnest-api@64.227.133.82

# Service management
pm2 status                    # Check all services
pm2 restart all               # Restart all services
pm2 logs                      # View all logs
pm2 monit                     # Resource monitor

# Specific service control
pm2 restart convertnest-api
pm2 restart python-gemini-service
pm2 logs convertnest-api
pm2 logs python-gemini-service

# Update code
cd /var/www/convertnest-backend
git pull origin main
npm install --production
pm2 restart all

# Health checks
curl http://localhost:3000/
curl http://localhost:5000/health
curl http://localhost:3000/api/image-to-excel/health

# System resources
free -h                       # Memory usage
df -h                         # Disk space
pm2 monit                     # PM2 dashboard
```

---

## 🎉 SUCCESS CRITERIA

**Deployment is successful when:**

1. ✅ SSH access works with provided credentials
2. ✅ Code pulled from GitHub successfully
3. ✅ Python virtual environment created
4. ✅ All dependencies installed (Node + Python)
5. ✅ Both PM2 services running (online status)
6. ✅ Health endpoints respond correctly
7. ✅ Image upload from frontend works
8. ✅ Excel file downloads successfully
9. ✅ Extracted data is accurate
10. ✅ All existing tools still functional
11. ✅ No errors in PM2 logs
12. ✅ System resources healthy (< 80% RAM)

---

## 📅 Deployment Date

**Date:** November 5, 2025  
**Backend Version:** 1.0.0 with Image-to-Excel  
**Python Service:** 2.0.0 (Gemini 2.5 Flash)  
**Deployed By:** ConvertNest Team

---

## 🔗 Important URLs

- **Frontend:** https://www.convertnest.tech
- **Backend API:** https://api.convertnest.tech
- **Image-to-Excel Tool:** https://www.convertnest.tech/tools/image-to-excel
- **GitHub Repo:** https://github.com/rjit1/multitool_website

---

**Ready to deploy! Follow steps 1-12 above. 🚀**
