# ConvertNest Backend API

Production-ready Node.js/Express backend for ConvertNest PDF tools with auto-cleanup, rate limiting, and comprehensive error handling.

## 🚀 Features

- **PDF to Word Conversion** - Extract text from PDFs and convert to editable Word documents
- **Merge PDFs** - Combine multiple PDF files into a single document
- **Split PDFs** - Separate PDF into individual page files
- **Reorder PDF Pages** - Rearrange pages in any order
- **Image to PDF** - Convert 13 image formats (JPG, PNG, WEBP, GIF, BMP, TIFF, AVIF, HEIC, HEIF, SVG) to PDF with customizable settings
- **Auto-Cleanup** - Automatically delete files older than 24 hours
- **Rate Limiting** - Prevent abuse with configurable rate limits
- **Comprehensive Logging** - Winston logger with file rotation
- **Error Handling** - Production-grade error handling and validation
- **CORS Support** - Configured for frontend integration
- **File Size Limits** - Up to 100MB per file

## 📋 Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- Ubuntu 22.04 LTS (for DigitalOcean deployment)
- **Sharp** image processing library (for Image to PDF multi-format support)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
```bash
cd E:\tool\convertnest-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Start development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### DigitalOcean Deployment

#### Step 1: Create Droplet

1. Log in to DigitalOcean
2. Create new Droplet:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic 2 GB / 2 vCPUs ($18/month)
   - **Datacenter:** Choose closest to your users
   - **Authentication:** SSH keys recommended

#### Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@your_droplet_ip
```

Update system:
```bash
apt update && apt upgrade -y
```

Install Node.js 20 LTS:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify installation:
```bash
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x or higher
```

Install PM2 (process manager):
```bash
npm install -g pm2
```

#### Step 3: Deploy Application

Create application directory:
```bash
mkdir -p /var/www/convertnest-backend
cd /var/www/convertnest-backend
```

Upload your code (use scp, git, or any method):
```bash
# From your local machine:
scp -r E:\tool\convertnest-backend/* root@your_droplet_ip:/var/www/convertnest-backend/
```

Or clone from Git:
```bash
git clone https://github.com/rjit1/multitool_website.git
cd multitool_website/convertnest-backend
```

Install dependencies:
```bash
npm install --production
```

Create .env file:
```bash
nano .env
```

Add production configuration:
```env
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://www.convertnest.tech
MAX_FILE_SIZE=104857600
CLEANUP_INTERVAL_HOURS=1
FILE_RETENTION_HOURS=24
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Step 4: Start with PM2

Start the application:
```bash
pm2 start src/server.js --name convertnest-api
```

Configure PM2 to start on system boot:
```bash
pm2 startup
pm2 save
```

Check status:
```bash
pm2 status
pm2 logs convertnest-api
pm2 monit
```

#### Step 5: Setup Nginx Reverse Proxy

Install Nginx:
```bash
apt install -y nginx
```

Create Nginx configuration:
```bash
nano /etc/nginx/sites-available/api.convertnest.tech
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name api.convertnest.tech;

    # Client body size limit (100MB)
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for large file uploads
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/api.convertnest.tech /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### Step 6: Setup SSL with Let's Encrypt

Install Certbot:
```bash
apt install -y certbot python3-certbot-nginx
```

Get SSL certificate:
```bash
certbot --nginx -d api.convertnest.tech
```

Follow the prompts and select option 2 to redirect HTTP to HTTPS.

Test auto-renewal:
```bash
certbot renew --dry-run
```

#### Step 7: Configure Firewall

Setup UFW:
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

#### Step 8: DNS Configuration

Add DNS A record in your domain registrar:
```
Type: A
Name: api
Value: your_droplet_ip
TTL: 3600
```

Wait for DNS propagation (5-30 minutes).

## 📡 API Endpoints

### Base URL
- **Development:** `http://localhost:3000`
- **Production:** `https://api.convertnest.tech`

### Endpoints

#### 1. PDF to Word Conversion
```http
POST /api/pdf-to-word
Content-Type: multipart/form-data

Field: pdf (file)
```

**Response:** Downloads .docx file

**Example (cURL):**
```bash
curl -X POST https://api.convertnest.tech/api/pdf-to-word \
  -F "pdf=@document.pdf" \
  -o converted.docx
```

---

#### 2. Merge PDFs
```http
POST /api/merge-pdfs
Content-Type: multipart/form-data

Field: pdfs (files, up to 10)
```

**Response:** Downloads merged PDF file

**Example (cURL):**
```bash
curl -X POST https://api.convertnest.tech/api/merge-pdfs \
  -F "pdfs=@file1.pdf" \
  -F "pdfs=@file2.pdf" \
  -F "pdfs=@file3.pdf" \
  -o merged.pdf
```

---

#### 3. Split PDF
```http
POST /api/split-pdf
Content-Type: multipart/form-data

Field: pdf (file)
```

**Response:** JSON with base64-encoded individual pages

---

#### 4. Reorder PDF Pages
```http
POST /api/reorder-pdf
Content-Type: multipart/form-data

Field: pdf (file)
Field: pageOrder (JSON array, e.g., [3,1,2])
```

**Response:** Downloads reordered PDF

---

#### 5. Image to PDF Conversion
```http
POST /api/image-to-pdf
Content-Type: multipart/form-data

Fields:
  - images: File[] (required, up to 50 images)
  - pageSize: string (optional, default: 'a4') - 'a4', 'letter', 'legal'
  - orientation: string (optional, default: 'portrait') - 'portrait', 'landscape'
  - fitMode: string (optional, default: 'fit') - 'fit', 'fill', 'actual'
  - margin: number (optional, default: 20) - Margin in points (0-100)
  - quality: number (optional, default: 90) - Quality 0-100
```

**Supported Image Formats** (13 formats):
- **Native**: JPG, JPEG, PNG
- **Modern Web**: WebP, AVIF  
- **Mobile**: HEIC, HEIF (iPhone photos)
- **Professional**: TIFF, BMP
- **Animation**: GIF (first frame)
- **Vector**: SVG (rasterized at 300 DPI)

**Response:** Downloads PDF file with images as pages

**Example (cURL):**
```bash
# Single image
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@photo.jpg" \
  -F "pageSize=a4" \
  -o output.pdf

# Multiple images with settings
curl -X POST https://api.convertnest.tech/api/image-to-pdf \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.png" \
  -F "images=@iphone_photo.heic" \
  -F "images=@modern_image.webp" \
  -F "images=@logo.svg" \
  -F "pageSize=letter" \
  -F "orientation=landscape" \
  -F "fitMode=fit" \
  -F "margin=20" \
  -o combined.pdf
```

---

#### 6. Get PDF Info
```http
POST /api/pdf-info
Content-Type: multipart/form-data

Field: pdf (file)
```

**Response:** JSON with metadata

---

#### 7. Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "OK",
    "uptime": 3600,
    "timestamp": "2025-10-24T12:00:00.000Z"
  }
}
```

---

#### 8. Upload Statistics
```http
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileCount": 5,
    "totalSize": "25.5 MB"
  }
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment (development/production) |
| `ALLOWED_ORIGINS` | http://localhost:3000 | CORS allowed origins (comma-separated) |
| `MAX_FILE_SIZE` | 104857600 | Max file size in bytes (100MB) |
| `CLEANUP_INTERVAL_HOURS` | 1 | How often cleanup runs |
| `FILE_RETENTION_HOURS` | 24 | How long files are kept |
| `RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |

### File Limits

- **Max file size:** 100MB per file
- **Max files (merge):** 10 files at once
- **Supported formats:** PDF only
- **Retention:** 24 hours (auto-deleted)

## 📊 Monitoring

### PM2 Commands

```bash
# View logs
pm2 logs convertnest-api

# Real-time monitoring
pm2 monit

# Status
pm2 status

# Restart
pm2 restart convertnest-api

# Stop
pm2 stop convertnest-api

# Delete
pm2 delete convertnest-api
```

### Log Files

Located in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Unhandled exceptions
- `rejections.log` - Unhandled promise rejections

## 🛡️ Security Features

- **Helmet.js** - Sets security HTTP headers
- **CORS** - Configurable origin whitelist
- **Rate Limiting** - Prevents abuse
- **File Validation** - Only PDF files accepted
- **Size Limits** - Prevents memory exhaustion
- **Auto-Cleanup** - Prevents disk space issues
- **Input Sanitization** - File name cleaning

## 🧪 Testing

### Test PDF to Word
```bash
curl -X POST http://localhost:3000/api/pdf-to-word \
  -F "pdf=@test.pdf" \
  -o output.docx
```

### Test Merge PDFs
```bash
curl -X POST http://localhost:3000/api/merge-pdfs \
  -F "pdfs=@file1.pdf" \
  -F "pdfs=@file2.pdf" \
  -o merged.pdf
```

### Test Health
```bash
curl http://localhost:3000/api/health
```

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :3000

# Check PM2 logs
pm2 logs convertnest-api
```

### File upload fails
- Check file size (max 100MB)
- Verify file is a valid PDF
- Check disk space: `df -h`
- Review error logs

### High memory usage
- Monitor with: `pm2 monit`
- Check upload stats: `curl http://localhost:3000/api/stats`
- Manually trigger cleanup: `curl -X POST http://localhost:3000/api/cleanup`

### CORS errors
- Verify `ALLOWED_ORIGINS` in `.env`
- Check Nginx proxy headers
- Test with: `curl -H "Origin: https://www.convertnest.tech" http://localhost:3000/api/health`

## 📦 Project Structure

```
convertnest-backend/
├── src/
│   ├── controllers/        # Request handlers
│   │   ├── pdfToWordController.js
│   │   └── mergePdfController.js
│   ├── middleware/         # Express middleware
│   │   ├── errorHandler.js
│   │   ├── upload.js
│   │   └── requestLogger.js
│   ├── routes/            # API routes
│   │   ├── pdfRoutes.js
│   │   ├── mergeRoutes.js
│   │   └── utilityRoutes.js
│   ├── services/          # Business logic
│   │   └── cleanupService.js
│   ├── utils/             # Helper functions
│   │   ├── logger.js
│   │   └── helpers.js
│   └── server.js          # Main app entry point
├── uploads/               # Temporary file storage
├── logs/                  # Application logs
├── .env                   # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Performance

### Expected Performance (2 GB / 2 vCPUs Droplet)

| Operation | File Size | Time | Concurrent |
|-----------|-----------|------|------------|
| PDF to Word | 10 MB | 10-15s | 2 |
| PDF to Word | 50 MB | 30-45s | 1 |
| Merge PDFs (5 files) | 10 MB each | 5-7s | 3 |

### Optimization Tips

1. **Upgrade to 4 GB** if handling >50K conversions/month
2. **Use CPU-Optimized** for 2-3x faster processing
3. **Enable compression** in Nginx for API responses
4. **Monitor disk usage** - cleanup runs every hour
5. **Scale horizontally** with load balancer for high availability

## 📄 License

MIT

## 👨‍💻 Author

ConvertNest Team

## 🔗 Links

- **Frontend:** https://www.convertnest.tech
- **GitHub:** https://github.com/rjit1/multitool_website
- **API Docs:** https://api.convertnest.tech
