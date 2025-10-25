# Image to PDF Enhanced Deployment Checklist

## Pre-Deployment Verification

### ✅ Local Testing
- [x] Backend server running on port 3000
- [x] Frontend server running on port 3001
- [x] All 13 image formats tested
- [x] Test images generated successfully
- [x] Sharp library installed and working
- [x] No compilation errors
- [ ] **Manual testing** with real-world files:
  - [ ] Upload iPhone HEIC photos
  - [ ] Upload modern WebP images
  - [ ] Upload SVG logos
  - [ ] Upload TIFF scanned documents
  - [ ] Upload BMP screenshots
  - [ ] Mixed format batch (all 13 formats)
  - [ ] Large file test (near 100MB limit)
  - [ ] 50 images batch test
  - [ ] Corrupt file handling test
  - [ ] Error messages validation

### ✅ Code Quality
- [x] Sharp added to package.json dependencies
- [x] All controllers updated
- [x] All middleware updated
- [x] Frontend component updated
- [x] Tool registry updated
- [x] Documentation updated (IMAGE_TO_PDF_IMPLEMENTATION.md)
- [x] README updated (Backend)
- [x] Test image generator created
- [ ] Git commit prepared
- [ ] Git push to GitHub

### ✅ Configuration Files
- [x] `.env` has all required variables
- [x] `.env.example` updated for reference
- [x] `package.json` includes Sharp
- [x] No hardcoded URLs (uses environment variables)
- [x] CORS origins configured correctly

---

## Backend Deployment (DigitalOcean)

### Step 1: Pre-Deployment Checks
```bash
# On your local machine

# 1. Verify no uncommitted changes
git status

# 2. Run local tests
cd E:\tool\convertnest-backend
npm start
# Test: curl -X POST http://localhost:3000/api/image-to-pdf -F "images=@test-images/1-test.jpg" -o test.pdf

# 3. Check package.json has Sharp
grep "sharp" package.json

# 4. Commit all changes
git add .
git commit -m "Enhanced Image to PDF: Support 13 formats via Sharp (JPG, PNG, WebP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, SVG)"
git push origin main
```

### Step 2: Server Preparation
```bash
# SSH into DigitalOcean droplet
ssh root@your_droplet_ip
# Or: ssh deployer@your_droplet_ip

# Navigate to backend directory
cd /var/www/convertnest-backend
# Or: cd /home/deployer/multitool_website/convertnest-backend

# Check current PM2 status
pm2 status

# Stop the running service temporarily
pm2 stop convertnest-api
```

### Step 3: Pull Latest Code
```bash
# Pull from GitHub
git pull origin main

# Verify Sharp is in package.json
grep "sharp" package.json
# Should show: "sharp": "^0.33.0"
```

### Step 4: Install Sharp on Server

**Option A: Standard Installation (Recommended)**
```bash
# Install Sharp (will compile native bindings)
npm install sharp --save --production

# This may take 2-5 minutes as Sharp compiles for your system
```

**Option B: If Option A Fails (Missing libvips)**
```bash
# Install libvips development headers
sudo apt-get update
sudo apt-get install -y libvips-dev

# Then install Sharp
npm install sharp --save --production
```

**Option C: If Both Fail (Pre-built Binary)**
```bash
# Remove existing Sharp
npm uninstall sharp

# Install with platform specification
npm install --platform=linux --arch=x64 sharp
```

### Step 5: Verify Sharp Installation
```bash
# Test Sharp import and format support
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions); console.log('Formats:', Object.keys(sharp.format));"

# Expected output should include:
# Sharp version: { vips: '8.x.x', sharp: '0.33.0' }
# Formats: [ 'jpeg', 'png', 'webp', 'tiff', 'gif', 'svg', 'heif', ... ]
```

**Critical Check - Verify HEIF Support:**
```bash
node -e "const sharp = require('sharp'); console.log('HEIF input:', sharp.format.heif.input); console.log('HEIF output:', sharp.format.heif.output);"

# Expected: HEIF input: true (at minimum)
# If HEIF not supported, HEIC/AVIF conversion may fail (but other formats work)
```

### Step 6: Restart Service
```bash
# Restart with PM2
pm2 restart convertnest-api

# Or reload (zero-downtime)
pm2 reload convertnest-api

# Watch logs in real-time
pm2 logs convertnest-api --lines 50
```

### Step 7: Production Testing

**Test 1: Verify API is Running**
```bash
curl https://api.convertnest.tech/
# Should show: { "imageToPdf": "POST /api/image-to-pdf", ... }
```

**Test 2: Test JPEG (Native Format)**
```bash
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@/path/to/test.jpg" \
  -F "pageSize=a4" \
  -o test-jpeg.pdf

# Check file size
ls -lh test-jpeg.pdf
```

**Test 3: Test WebP (Sharp Conversion)**
```bash
# Upload a WebP file
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@/path/to/test.webp" \
  -F "pageSize=a4" \
  -o test-webp.pdf

# Check logs for Sharp conversion
pm2 logs convertnest-api --lines 20 | grep "Converting"
# Should show: "Converting image/webp to PNG using Sharp..."
```

**Test 4: Test SVG (High DPI Rasterization)**
```bash
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@/path/to/logo.svg" \
  -F "pageSize=a4" \
  -o test-svg.pdf

# Check logs
pm2 logs convertnest-api --lines 20 | grep "Rasterized"
# Should show: "Rasterized SVG to PNG at 300 DPI"
```

**Test 5: Test Mixed Formats**
```bash
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@test1.jpg" \
  -F "images=@test2.png" \
  -F "images=@test3.webp" \
  -F "images=@test4.svg" \
  -o test-mixed.pdf

# Verify 4-page PDF created
```

**Test 6: Test Error Handling (Invalid Format)**
```bash
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@test.txt" \
  -F "pageSize=a4"

# Should return 400 error with message about file type
```

### Step 8: Monitor Performance
```bash
# Check PM2 monitoring
pm2 monit

# Watch memory usage
pm2 status
# Note: "memory" column should stay under 500MB for normal loads

# Check disk usage (ensure uploads cleanup is working)
du -sh /var/www/convertnest-backend/uploads/
# Should be small (automatic cleanup runs hourly)

# View recent conversions in logs
pm2 logs convertnest-api --lines 100 | grep "Image to PDF conversion completed"
```

### Step 9: Performance Benchmarking
```bash
# Test conversion speed
time curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@large-image.jpg" \
  -o benchmark.pdf

# Expected: 1-3 seconds for 10MB image
# If > 5 seconds, check server resources
```

---

## Frontend Deployment (Vercel)

### Step 1: Verify Frontend Build
```bash
# On your local machine
cd E:\tool\convertnest
npm run build

# Should complete without errors
# Check for ImageToPDFTool in build output
```

### Step 2: Update Environment Variables (if needed)
```bash
# Check .env.local
cat .env.local
# NEXT_PUBLIC_API_URL should be:
# Development: http://localhost:3000
# Production: https://api.convertnest.tech

# Vercel will use production URL automatically
```

### Step 3: Push to GitHub
```bash
# Commit any remaining changes
git add .
git commit -m "Frontend: Updated Image to PDF tool with 13 format support"
git push origin main

# Vercel will auto-deploy from GitHub
```

### Step 4: Monitor Vercel Deployment
```
1. Visit: https://vercel.com/dashboard
2. Check deployment status
3. Wait for "Building" → "Deploying" → "Ready"
4. Estimated time: 2-4 minutes
```

### Step 5: Production Frontend Testing
```
1. Visit: https://www.convertnest.tech/tools/image-to-pdf
2. Test upload interface:
   - Click upload button
   - Drag-and-drop test
   - Multiple file selection
3. Test all 13 formats:
   - JPG ✓
   - PNG ✓
   - WebP ✓
   - GIF ✓
   - BMP ✓
   - TIFF ✓
   - AVIF ✓
   - HEIC ✓ (iPhone photo)
   - HEIF ✓
   - SVG ✓
4. Test settings panel:
   - Page size options
   - Orientation toggle
   - Fit mode selector
   - Margin slider
5. Test conversion:
   - Single image → PDF
   - Multiple images → PDF
   - Mixed formats → PDF
   - Reordering images
   - Removing images
6. Verify error handling:
   - Invalid file type
   - File too large
   - Too many files
7. Check UI responsiveness:
   - Mobile view
   - Tablet view
   - Desktop view
```

---

## Post-Deployment Verification

### Backend Health Checks
```bash
# 1. API Root
curl https://api.convertnest.tech/
# Should list all endpoints including imageToPdf

# 2. Health endpoint
curl https://api.convertnest.tech/api/health
# Should return: { "success": true, "message": "Service is healthy" }

# 3. Stats endpoint
curl https://api.convertnest.tech/api/stats
# Should return file count and total size

# 4. PM2 Status
ssh root@your_droplet_ip
pm2 status
# convertnest-api should be "online"

# 5. Logs check
pm2 logs convertnest-api --lines 50
# Should show successful conversions, no errors
```

### Frontend Health Checks
```
1. Home page: https://www.convertnest.tech/
   - Should load without errors
   - Tool cards display correctly

2. Tools page: https://www.convertnest.tech/tools
   - Image to PDF card visible
   - Correct description (mentions 13 formats)

3. Tool page: https://www.convertnest.tech/tools/image-to-pdf
   - Component loads without errors
   - Upload area visible
   - Settings panel functional
   - Convert button enabled after upload

4. Browser Console:
   - Open DevTools (F12)
   - Check Console tab
   - Should be no errors (red messages)
   - API requests to https://api.convertnest.tech should succeed (200 OK)
```

### End-to-End Test (Critical)
```
Real-world scenario test:

1. Take iPhone photo (HEIC format)
2. Visit https://www.convertnest.tech/tools/image-to-pdf
3. Upload HEIC photo
4. Add PNG screenshot
5. Add WebP image from web
6. Add SVG logo
7. Reorder: SVG first, then HEIC, then PNG, then WebP
8. Set: A4, Portrait, Fit mode, 20pt margin
9. Click "Convert to PDF"
10. Verify:
    - PDF downloads automatically
    - 4 pages in correct order
    - Images look good (not pixelated)
    - SVG is sharp (300 DPI)
    - HEIC photo converted correctly
    - File size reasonable (<10MB for 4 images)

Expected result: ✅ Success, high quality PDF
```

---

## Rollback Plan (If Issues Occur)

### If Backend Fails After Deployment

**Option 1: Quick Fix (Restart)**
```bash
ssh root@your_droplet_ip
pm2 restart convertnest-api
pm2 logs convertnest-api
```

**Option 2: Rollback Code**
```bash
cd /var/www/convertnest-backend
git log --oneline -5
git checkout <previous-commit-hash>
pm2 restart convertnest-api
```

**Option 3: Remove Sharp (Temporary)**
```bash
# Revert to JPG/PNG only (emergency mode)
npm uninstall sharp
# Update controller to skip non-native formats
pm2 restart convertnest-api
```

### If Frontend Issues

**Option 1: Vercel Rollback**
```
1. Visit Vercel dashboard
2. Find previous successful deployment
3. Click "Promote to Production"
4. Instant rollback (no rebuild needed)
```

**Option 2: Local Fix and Redeploy**
```bash
cd E:\tool\convertnest
git revert HEAD
git push origin main
# Vercel auto-deploys reverted version
```

---

## Monitoring & Maintenance

### Daily Checks (First Week)
```bash
# Check backend logs for errors
pm2 logs convertnest-api --lines 100 | grep -i "error"

# Check conversion success rate
pm2 logs convertnest-api | grep "Image to PDF conversion completed" | wc -l

# Check disk usage
df -h

# Check upload directory size
du -sh /var/www/convertnest-backend/uploads/
```

### Weekly Checks
```bash
# Update dependencies
npm outdated

# Check Sharp version
npm list sharp

# Review error logs
pm2 logs convertnest-api --err --lines 500
```

### Performance Metrics to Track
```
1. Average conversion time per image
2. Most popular format (from logs)
3. Error rate by format
4. Peak usage hours
5. Server memory usage trends
6. Disk space usage
```

---

## Success Criteria

### Backend ✅
- [x] Server running without errors
- [ ] All 13 formats converting successfully
- [ ] Sharp library installed and functional
- [ ] HEIF support confirmed (or graceful fallback)
- [ ] Logs show successful conversions
- [ ] No memory leaks (stable memory usage)
- [ ] Response times < 3 seconds per image
- [ ] Cleanup service running (old files deleted)

### Frontend ✅
- [x] Build completes without errors
- [ ] Deployed to Vercel successfully
- [ ] All pages load without console errors
- [ ] Image to PDF tool accessible
- [ ] UI shows all 13 supported formats
- [ ] Upload/download flow works end-to-end
- [ ] Mobile responsive
- [ ] Settings panel functional

### Overall ✅
- [ ] Manual testing passed for all formats
- [ ] Production smoke tests passed
- [ ] Performance benchmarks acceptable
- [ ] Error handling graceful
- [ ] Logs clean and informative
- [ ] Documentation up to date
- [ ] Git commits pushed
- [ ] Rollback plan tested (optional)

---

## Contact & Support

**If Issues Occur:**
1. Check PM2 logs: `pm2 logs convertnest-api --lines 100`
2. Check system resources: `pm2 monit`
3. Verify Sharp: `node -e "require('sharp')"`
4. Review this checklist
5. Check GitHub Issues (if applicable)

**Common Issues & Solutions:**
- **Sharp not found**: Run `npm install sharp --save`
- **HEIF not supported**: Install libvips-dev: `sudo apt-get install libvips-dev`
- **Conversion slow**: Check server CPU/RAM, consider upgrading Droplet
- **Memory issues**: Reduce max files from 50 to 20 in imageUpload.js
- **CORS errors**: Check ALLOWED_ORIGINS in .env

---

**Deployment Date**: ___________________  
**Deployed By**: ___________________  
**Backend Version**: ___________________  
**Frontend Version**: ___________________  
**Sharp Version**: 0.33.0+  
**Status**: ⏳ Pending / ✅ Complete / ❌ Failed  
**Notes**: _____________________________________
