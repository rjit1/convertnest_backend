#  PRODUCTION DEPLOYMENT GUIDE - ConvertNest Backend

## Complete Step-by-Step Guide to Deploy Your Backend on DigitalOcean

---

##  Table of Contents

1. [Prerequisites](#prerequisites)
2. [DigitalOcean Droplet Setup](#digitalocean-droplet-setup)
3. [Server Initial Configuration](#server-initial-configuration)
4. [Install Required Software](#install-required-software)
5. [Deploy Backend Application](#deploy-backend-application)
6. [Configure PM2 Process Manager](#configure-pm2-process-manager)
7. [Setup Nginx Reverse Proxy](#setup-nginx-reverse-proxy)
8. [Configure DNS](#configure-dns)
9. [SSL Certificate (HTTPS)](#ssl-certificate-https)
10. [Firewall Configuration](#firewall-configuration)
11. [Testing & Verification](#testing--verification)
12. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### What You Need Before Starting:

 **DigitalOcean Account**
   - Sign up at https://www.digitalocean.com
   - Add payment method
   - Have $18/month ready for 2GB droplet

 **Domain Name**
   - Purchase from Namecheap, GoDaddy, or any registrar
   - You'll need to point `api.convertnest.tech` to your droplet

 **Your Backend Code**
   - Located at: `E:\tool\convertnest-backend`
   - All files ready to upload

 **GitHub Account** (Recommended)
   - Push your backend code to a private repository
   - Makes deployment and updates easier

---

## 1. DigitalOcean Droplet Setup

### Step 1.1: Create a Droplet

1. **Log in to DigitalOcean**
   - Go to https://cloud.digitalocean.com/

2. **Click "Create"  "Droplets"**

3. **Choose Configuration:**

   **Region:** Choose closest to your users
   - New York (NYC1, NYC2, NYC3) - For North America
   - London (LON1) - For Europe
   - San Francisco (SFO3) - For West Coast
   - Bangalore (BLR1) - For Asia

   **Image:** Ubuntu 22.04 LTS x64

   **Droplet Size:** Basic
   - Regular: 2 GB RAM / 2 vCPUs
   - 60 GB SSD
   - 3 TB bandwidth
   - **$18/month**

   **Authentication:** SSH Key (RECOMMENDED)
   - Click "New SSH Key"
   - Follow instructions to generate and add your SSH key
   - OR use password (less secure)

   **Hostname:** `convertnest-api` (or your choice)

4. **Click "Create Droplet"**
   - Wait 55 seconds for droplet to be created
   - **Copy the IP address** (e.g., 167.99.241.55)

---

## 2. Server Initial Configuration

### Step 2.1: Connect to Your Server

**Windows (PowerShell):**
```powershell
ssh root@YOUR_DROPLET_IP
# Example: ssh root@167.99.241.55
```

Accept the fingerprint by typing `yes`

### Step 2.2: Create a New User (Security Best Practice)

```bash
# Create new user (replace 'deployer' with your username)
adduser deployer

# Grant sudo privileges
usermod -aG sudo deployer

# Switch to new user
su - deployer
```

### Step 2.3: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

---

## 3. Install Required Software

### Step 3.1: Install Node.js 20 LTS

```bash
# Install Node.js from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v   # Should show v10.x.x
```

### Step 3.2: Install Git

```bash
sudo apt install -y git
git --version
```

### Step 3.3: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 -v
```

### Step 3.4: Install Nginx

```bash
sudo apt install -y nginx
nginx -v
```

---

## 4. Deploy Backend Application

### Step 4.1: Clone Your Backend from GitHub

**Your backend is already on GitHub at:** `https://github.com/rjit1/multitool_website`

```bash
# Navigate to home directory
cd /home/deployer

# Clone the repository
git clone https://github.com/rjit1/multitool_website.git

# Navigate to backend directory
cd multitool_website/convertnest-backend

# Verify files are present
ls -la
```

**Expected output:**
```
.env.example
package.json
README.md
src/
uploads/
logs/
...
```

**Note:** If the repository is private, you'll need to authenticate:

**Option 1: Personal Access Token (Recommended)**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it "DigitalOcean Backend Deployment"
4. Select scope: `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)
7. When cloning, use:
   ```bash
   git clone https://YOUR_TOKEN@github.com/rjit1/multitool_website.git
   ```

**Option 2: SSH Key (Advanced)**
```bash
# Generate SSH key on server
ssh-keygen -t ed25519 -C "your_email@example.com"

# Display public key
cat ~/.ssh/id_ed25519.pub

# Copy the output and add to GitHub → Settings → SSH and GPG keys → New SSH key

# Clone using SSH
git clone git@github.com:rjit1/multitool_website.git
```

### Step 4.2: Install Dependencies

```bash
# Make sure you're in the backend directory
cd /home/deployer/multitool_website/convertnest-backend

# Install all production dependencies
npm install --production
```

**Expected output:**
```
added 150 packages, and audited 151 packages in 15s

23 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

**This will install all required packages:**
- express (4.21.2)
- axios (1.7.9) - For Currency API
- pdf-parse (2.4.5) - For PDF to Word
- pdf-lib (1.17.1) - For Merge PDFs
- docx (9.5.1) - For Word document creation
- multer (1.4.5-lts.1) - File uploads
- winston (3.17.0) - Logging
- helmet (8.0.0) - Security
- cors (2.8.5) - CORS handling
- express-rate-limit (7.5.0) - Rate limiting
- node-cron (3.0.3) - Cleanup scheduling
- compression (1.7.5) - Response compression

### Step 4.3: Create Production Environment File

```bash
nano .env
```

**Copy this configuration** (press `Ctrl+Shift+V` to paste):

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=https://www.convertnest.tech,https://convertnest.tech

# File Upload Configuration
MAX_FILE_SIZE=104857600

# Cleanup Configuration
CLEANUP_INTERVAL_HOURS=1
FILE_RETENTION_HOURS=24

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ExchangeRate API Configuration
EXCHANGERATE_API_KEY=761b4a8979e49eaf282165b2
```

Press `Ctrl+X`, then `Y`, then `Enter` to save

### Step 4.4: Create Required Directories

```bash
# Make sure you're in the backend directory
cd /home/deployer/multitool_website/convertnest-backend

# Create directories (they might already exist from Git)
mkdir -p uploads logs

# Set proper permissions
chmod 755 uploads logs

# Verify directories exist
ls -la | grep -E "uploads|logs"
```

**Expected output:**
```
drwxr-xr-x  2 deployer deployer  4096 Oct 24 10:30 logs
drwxr-xr-x  2 deployer deployer  4096 Oct 24 10:30 uploads
```

### Step 4.5: Test the Application

```bash
npm start
```

**You should see:**
```
 ConvertNest Backend API started successfully
 Server running on port 3000
 Environment: production
```

Press `Ctrl+C` to stop (we'll use PM2 next)

---

## 5. Configure PM2 Process Manager

### Step 5.1: Start Application with PM2

```bash
# Navigate to backend directory
cd /home/deployer/multitool_website/convertnest-backend

# Start the application with PM2
pm2 start src/server.js --name convertnest-backend

# You can also use npm start script
# pm2 start npm --name convertnest-backend -- start
```

**Expected output:**
```
[PM2] Starting /home/deployer/multitool_website/convertnest-backend/src/server.js in fork_mode (1 instance)
[PM2] Done.
┌─────┬────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name                   │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ convertnest-backend    │ default     │ 1.0.0   │ fork    │ 12345    │ 0s     │ 0    │ online    │ 0%       │ 50.0mb   │ deployer │ disabled │
└─────┴────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

**Verify it's running:**
```bash
pm2 status
pm2 logs convertnest-backend --lines 20
```

**You should see in logs:**
```
🚀 ConvertNest Backend API started successfully
📍 Server running on port 3000
🌍 Environment: production
```

### Step 5.2: Configure Auto-Restart on Reboot

```bash
pm2 startup systemd
```

Copy the command it outputs and run it (will look like):
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u deployer --hp /home/deployer
```

Then save the PM2 process list:
```bash
pm2 save
```

### Step 5.3: Useful PM2 Commands

```bash
# View logs
pm2 logs convertnest-backend

# Monitor performance
pm2 monit

# Restart application
pm2 restart convertnest-backend

# Stop application
pm2 stop convertnest-backend

# View all processes
pm2 list
```

---

## 6. Setup Nginx Reverse Proxy

### Step 6.1: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/api.convertnest.tech
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name api.convertnest.tech;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/api.convertnest.tech.access.log;
    error_log /var/log/nginx/api.convertnest.tech.error.log;

    # Proxy settings
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
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }

    # Max upload size
    client_max_body_size 100M;
}
```

Save: `Ctrl+X`, `Y`, `Enter`

### Step 6.2: Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/api.convertnest.tech /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 7. Configure DNS

### Step 7.1: Add DNS Record

Go to your domain registrar (Namecheap, GoDaddy, etc.):

1. **Add A Record:**
   - Type: `A`
   - Host: `api` (or `@` for root domain)
   - Value: `YOUR_DROPLET_IP` (e.g., 167.99.241.55)
   - TTL: `Automatic` or `300` (5 minutes)

2. **Wait for DNS Propagation** (5-30 minutes)

### Step 7.2: Test DNS

```bash
# From your local machine
ping api.convertnest.tech
# Should show your droplet IP
```

---

## 8. SSL Certificate (HTTPS)

### Step 8.1: Install Certbot

```bash
# Install snapd (if not installed)
sudo snap install core
sudo snap refresh core

# Remove old certbot
sudo apt remove certbot

# Install certbot
sudo snap install --classic certbot

# Link certbot command
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

### Step 8.2: Obtain SSL Certificate

```bash
sudo certbot --nginx -d api.convertnest.tech
```

**Follow the prompts:**
1. Enter your email address
2. Agree to terms of service (Y)
3. Optionally share email with EFF (Y or N)
4. Certbot will auto-configure Nginx for HTTPS

**You should see:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/api.convertnest.tech/fullchain.pem
```

### Step 8.3: Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

**Certificates auto-renew every 90 days!**

---

## 9. Firewall Configuration

### Step 9.1: Configure UFW Firewall

```bash
# Allow OpenSSH
sudo ufw allow OpenSSH

# Allow Nginx Full (HTTP + HTTPS)
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Output should show:**
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
```

---

## 10. Testing & Verification

### Step 10.1: Test Backend API

```bash
# Test health endpoint
curl https://api.convertnest.tech/api/health

# Expected output:
# {"success":true,"data":{"status":"ok","timestamp":"..."}}
```

### Step 10.2: Test Currency Converter

```bash
curl https://api.convertnest.tech/api/currency/supported | jq
```

### Step 10.3: Test PDF to Word

```bash
# Upload a test PDF
curl -X POST https://api.convertnest.tech/api/pdf-to-word \
  -F "pdf=@test.pdf" \
  -o converted.docx
```

### Step 10.4: Update Frontend API URL

**On your local machine:**

Edit `E:\tool\convertnest\.env.local`:

```env
NEXT_PUBLIC_GA_TRACKING_ID=G-39QHHGSKYM
NEXT_PUBLIC_API_URL=https://api.convertnest.tech
```

**Deploy to Vercel:**
1. Push changes to GitHub
2. Vercel will auto-deploy
3. Or manually add environment variable in Vercel dashboard

---

## 11. Monitoring & Maintenance

### Daily Monitoring

```bash
# Check PM2 status
pm2 list

# View logs
pm2 logs convertnest-backend --lines 100

# Monitor CPU/Memory
pm2 monit

# Check Nginx logs
sudo tail -f /var/log/nginx/api.convertnest.tech.access.log
sudo tail -f /var/log/nginx/api.convertnest.tech.error.log
```

### Weekly Maintenance

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart PM2 if needed
pm2 restart convertnest-backend

# Check disk usage
df -h

# Check uploads directory size
du -sh /home/deployer/convertnest-backend/uploads/
```

### Monthly Checks

```bash
# Check SSL certificate expiry
sudo certbot certificates

# Review logs for errors
pm2 logs convertnest-backend --err --lines 500

# Monitor API usage (ExchangeRate-API limit: 1,500/month)
# Check your dashboard at: https://app.exchangerate-api.com/
```

---

## 12. Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs convertnest-backend --err

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart PM2
pm2 restart convertnest-backend
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
pm2 list

# Check Nginx error logs
sudo tail -f /var/log/nginx/api.convertnest.tech.error.log

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

### File Upload Errors

```bash
# Check uploads directory permissions
ls -la /home/deployer/convertnest-backend/uploads/

# Fix permissions
chmod 755 /home/deployer/convertnest-backend/uploads/

# Check disk space
df -h
```

---

## 13. Updating Your Application

### When You Make Code Changes:

**On your local machine (Windows):**

```powershell
# Navigate to backend directory
cd E:\tool\convertnest-backend

# Make your changes, then commit and push
git add .
git commit -m "Description of changes"
git push origin main
```

**On your server (DigitalOcean droplet):**

```bash
# SSH into server
ssh deployer@YOUR_DROPLET_IP

# Navigate to app directory
cd /home/deployer/multitool_website/convertnest-backend

# Pull latest changes from GitHub
git pull origin main

# Install new dependencies (if package.json changed)
npm install --production

# Restart application with zero downtime
pm2 reload convertnest-backend

# Or hard restart if needed
# pm2 restart convertnest-backend

# Monitor logs to ensure everything works
pm2 logs convertnest-backend --lines 50
```

**Expected output after pull:**
```
Updating abc1234..def5678
Fast-forward
 src/controllers/newController.js | 45 +++++++++++++++++++++
 1 file changed, 45 insertions(+)
```

**Pro tip:** You can automate this with a deployment script:

```bash
# Create deployment script
nano ~/deploy.sh
```

Add this content:
```bash
#!/bin/bash
cd /home/deployer/multitool_website/convertnest-backend
echo "📥 Pulling latest changes..."
git pull origin main
echo "📦 Installing dependencies..."
npm install --production
echo "🔄 Restarting application..."
pm2 reload convertnest-backend
echo "✅ Deployment complete!"
pm2 status
```

Make it executable and use:
```bash
chmod +x ~/deploy.sh
~/deploy.sh
```

---

##  Quick Reference Commands

```bash
# Start backend
pm2 start src/server.js --name convertnest-backend

# Restart backend
pm2 restart convertnest-backend

# Stop backend
pm2 stop convertnest-backend

# View logs
pm2 logs convertnest-backend

# Monitor performance
pm2 monit

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Check SSL status
sudo certbot certificates

# Renew SSL
sudo certbot renew

# Check firewall
sudo ufw status
```

---

##  Expected Costs

| Item | Monthly Cost |
|------|--------------|
| 2GB DigitalOcean Droplet | $18.00 |
| Domain (varies by registrar) | $10-15/year |
| SSL Certificate (Let's Encrypt) | FREE |
| **Total** | **~$18-20/month** |

---

## ✅ Deployment Checklist

### Pre-Deployment (On Your Computer)
- [x] Backend code pushed to GitHub (https://github.com/rjit1/multitool_website)
- [x] All dependencies listed in package.json
- [x] .env.example file created
- [ ] DigitalOcean account created
- [ ] Domain name purchased (or using existing)

### Droplet Setup (Steps 1-3)
- [ ] DigitalOcean droplet created (2GB RAM, 2 vCPUs, Ubuntu 22.04)
- [ ] SSH access configured
- [ ] Droplet IP address noted: ________________
- [ ] Non-root user created (deployer)
- [ ] System updated (apt update && upgrade)

### Software Installation (Step 3)
- [ ] Node.js 20 LTS installed (`node -v` shows v20.x.x)
- [ ] npm installed (`npm -v` shows v10.x.x)
- [ ] Git installed (`git --version` works)
- [ ] PM2 installed globally (`pm2 -v` works)
- [ ] Nginx installed (`nginx -v` works)

### Backend Deployment (Step 4)
- [ ] Repository cloned: `/home/deployer/multitool_website/convertnest-backend`
- [ ] Dependencies installed (`npm install --production`)
- [ ] Production .env file created
- [ ] ExchangeRate API key added to .env
- [ ] ALLOWED_ORIGINS set to production domain
- [ ] NODE_ENV=production in .env
- [ ] uploads/ and logs/ directories created
- [ ] Test run successful (`npm start` works)

### PM2 Configuration (Step 5)
- [ ] PM2 process started (`pm2 start src/server.js --name convertnest-backend`)
- [ ] PM2 startup configured (`pm2 startup systemd`)
- [ ] PM2 process list saved (`pm2 save`)
- [ ] Application visible in `pm2 list`
- [ ] Logs show "Server running on port 3000"

### Nginx Setup (Step 6)
- [ ] Nginx config created: `/etc/nginx/sites-available/api.convertnest.tech`
- [ ] Proxy settings configured (localhost:3000)
- [ ] Security headers added
- [ ] Upload size set to 100M
- [ ] Site enabled (symlink to sites-enabled)
- [ ] Nginx config test passed (`sudo nginx -t`)
- [ ] Nginx reloaded

### DNS Configuration (Step 7)
- [ ] A record created: api.convertnest.tech → Droplet IP
- [ ] TTL set to 300 seconds (5 minutes)
- [ ] DNS propagation complete (15-30 min wait)
- [ ] `ping api.convertnest.tech` shows correct IP

### SSL Certificate (Step 8)
- [ ] Certbot installed via snap
- [ ] SSL certificate obtained (`sudo certbot --nginx -d api.convertnest.tech`)
- [ ] Certificate files created in /etc/letsencrypt/live/
- [ ] Nginx auto-configured for HTTPS
- [ ] Auto-renewal test passed (`sudo certbot renew --dry-run`)

### Firewall Security (Step 9)
- [ ] OpenSSH allowed (`sudo ufw allow OpenSSH`)
- [ ] Nginx Full allowed (`sudo ufw allow 'Nginx Full'`)
- [ ] UFW enabled (`sudo ufw enable`)
- [ ] Status verified (`sudo ufw status`)

### Testing & Verification (Step 10)
- [ ] Health check works: `curl https://api.convertnest.tech/api/health`
- [ ] Currency API works: `curl https://api.convertnest.tech/api/currency/supported`
- [ ] PDF to Word endpoint accessible
- [ ] Merge PDFs endpoint accessible
- [ ] No errors in PM2 logs
- [ ] No errors in Nginx logs

### Frontend Integration (Step 10.4)
- [ ] Frontend .env.local updated: `NEXT_PUBLIC_API_URL=https://api.convertnest.tech`
- [ ] Environment variable added to Vercel dashboard
- [ ] Frontend redeployed to Vercel
- [ ] CORS working between frontend and backend
- [ ] All 20 tools tested from production frontend
- [ ] PDF to Word tool working
- [ ] Merge PDFs tool working
- [ ] Currency Converter tool working

### Post-Deployment
- [ ] PM2 monitoring setup (`pm2 monit`)
- [ ] Log rotation configured
- [ ] Deployment script created (~/deploy.sh)
- [ ] Documentation updated
- [ ] Team notified of deployment
- [ ] API endpoint documentation shared
- [ ] Monitoring alerts configured (optional)

### Final Verification
- [ ] Backend: https://api.convertnest.tech/api/health returns success
- [ ] Frontend: https://www.convertnest.tech loads correctly
- [ ] All 20 tools functional on production
- [ ] File uploads working
- [ ] Currency conversion real-time updates working
- [ ] Auto-cleanup service running (check after 24 hours)
- [ ] SSL certificate valid (check in browser)
- [ ] No mixed content warnings
- [ ] Mobile responsive working

---

## 📋 Deployment Information Sheet

**Fill this out as you deploy:**

```
Deployment Date: _____________________
Deployed By: _____________________

DROPLET INFORMATION:
- IP Address: _____________________
- Hostname: convertnest-api
- Region: _____________________
- Size: 2GB RAM / 2 vCPUs
- Cost: $18/month

DOMAIN CONFIGURATION:
- Backend Domain: api.convertnest.tech
- Frontend Domain: www.convertnest.tech
- DNS Provider: _____________________
- A Record IP: _____________________

ACCESS INFORMATION:
- SSH User: deployer
- SSH Command: ssh deployer@_____________________
- GitHub Repo: https://github.com/rjit1/multitool_website
- Backend Path: /home/deployer/multitool_website/convertnest-backend

API KEYS:
- ExchangeRate API Key: 761b4a8979e49eaf282165b2
- API Limit: 1,500 requests/month
- Google Analytics: G-39QHHGSKYM

SSL CERTIFICATE:
- Provider: Let's Encrypt
- Expiry: _____________________ (90 days from installation)
- Auto-renewal: Enabled
- Next renewal check: _____________________

PM2 PROCESS:
- Name: convertnest-backend
- Port: 3000 (internal)
- Status: Check with `pm2 status`
- Logs: Check with `pm2 logs convertnest-backend`

MONITORING:
- PM2 Dashboard: pm2 monit
- Nginx Logs: /var/log/nginx/api.convertnest.tech.access.log
- Backend Logs: /home/deployer/multitool_website/convertnest-backend/logs/
- Uptime Monitor: _____________________ (optional service)

BACKUP STRATEGY:
- Code: GitHub (automatic)
- Database: N/A (stateless API)
- Uploads: Auto-deleted after 24 hours
- Logs: Rotated by Winston

NOTES:
_____________________
_____________________
_____________________
```

---

##  Success!

Your ConvertNest backend is now live at: **https://api.convertnest.tech**

**Available Endpoints:**
- `GET /api/health` - Health check
- `POST /api/pdf-to-word` - PDF to Word conversion
- `POST /api/merge-pdfs` - Merge multiple PDFs
- `GET /api/currency/supported` - Get supported currencies
- `POST /api/currency/convert` - Convert currency

**All 20 tools are now production-ready! **

---

##  Need Help?

**DigitalOcean Support:**
- Community: https://www.digitalocean.com/community
- Tickets: https://cloud.digitalocean.com/support/tickets

**Common Issues:**
- DNS not propagating: Wait 5-30 minutes
- SSL not working: Check DNS first, then run certbot again
- Backend errors: Check `pm2 logs convertnest-backend`
- Nginx errors: Check `/var/log/nginx/error.log`

---

**Last Updated:** October 24, 2025  
**Version:** 1.0  
**Status:** Production Ready 
