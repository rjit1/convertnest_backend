# Digital Ocean Droplet Deployment Guide

## 🚀 Complete Step-by-Step Deployment

### Prerequisites
- ✅ Digital Ocean Droplet created (Ubuntu 22.04 LTS recommended)
- ✅ Droplet IP address noted
- ✅ SSH access configured
- ✅ Domain name (optional, for HTTPS)

---

## Step 1: Connect to Your Droplet

```bash
# Replace YOUR_DROPLET_IP with your actual IP
ssh root@YOUR_DROPLET_IP
```

---

## Step 2: Initial Server Setup

### Update System Packages
```bash
apt update && apt upgrade -y
```

### Install Node.js 20.x (Required)
```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x or higher
```

### Install Essential Tools
```bash
apt install -y git nginx certbot python3-certbot-nginx
```

---

## Step 3: Create Application User (Security Best Practice)

```bash
# Create a dedicated user for the app
adduser --disabled-password --gecos "" convertnest

# Add to sudo group (optional, for administrative tasks)
usermod -aG sudo convertnest

# Switch to the new user
su - convertnest
```

---

## Step 4: Clone and Setup Backend

### Clone Repository
```bash
# Clone your backend repository
git clone https://github.com/rjit1/convertnest_backend.git
cd convertnest_backend
```

### Install Dependencies
```bash
npm install --production
```

### Create Production Environment File
```bash
nano .env
```

**Paste this configuration** (modify as needed):
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration (IMPORTANT: Update with your actual domain)
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

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

### Create Required Directories
```bash
mkdir -p uploads logs
chmod 755 uploads logs
```

---

## Step 5: Setup PM2 Process Manager

### Install PM2 Globally
```bash
sudo npm install -g pm2
```

### Start Application with PM2
```bash
pm2 start src/server.js --name convertnest-backend

# Enable auto-start on system reboot
pm2 startup systemd
# Copy and run the command that PM2 outputs

pm2 save
```

### Useful PM2 Commands
```bash
pm2 status              # Check application status
pm2 logs convertnest-backend  # View logs
pm2 restart convertnest-backend  # Restart app
pm2 stop convertnest-backend     # Stop app
pm2 monit              # Real-time monitoring
```

---

## Step 6: Configure Nginx Reverse Proxy

### Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/convertnest-backend
```

**Paste this configuration:**
```nginx
server {
    listen 80;
    server_name api.convertnest.tech;  # Replace with your subdomain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Increase upload size limit
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
        
        # Timeout settings for long-running requests
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

### Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/convertnest-backend /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 7: Setup SSL Certificate (HTTPS)

### Install SSL Certificate with Certbot
```bash
sudo certbot --nginx -d api.convertnest.tech  # Replace with your subdomain
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose to redirect HTTP to HTTPS (option 2)

### Auto-Renewal Test
```bash
sudo certbot renew --dry-run
```

---

## Step 8: Configure Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 9: Update Frontend to Use Production API

### Update .env.local in Frontend
```bash
# On your local machine:
# Edit E:\tool\convertnest\.env.local

NEXT_PUBLIC_API_URL=https://api.convertnest.tech  # Your backend URL
```

### Rebuild and Redeploy Frontend
```bash
cd E:\tool\convertnest
npm run build
# Deploy to Vercel or your hosting platform
```

---

## Step 10: Test Deployment

### Test Backend API
```bash
# From your local machine:
curl https://api.convertnest.tech/

# Should return JSON with API info
```

### Test Image to PDF
1. Go to https://www.convertnest.tech/tools/image-to-pdf
2. Upload images
3. Apply crops
4. Convert to PDF
5. Download should work! ✅

---

## 🔧 Maintenance Commands

### Update Backend Code
```bash
cd ~/convertnest_backend
git pull origin main
npm install --production
pm2 restart convertnest-backend
```

### View Logs
```bash
# PM2 logs
pm2 logs convertnest-backend

# Application logs
tail -f ~/convertnest_backend/logs/combined.log
tail -f ~/convertnest_backend/logs/error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Monitor Resources
```bash
pm2 monit              # Real-time PM2 monitoring
htop                   # System resource usage
df -h                  # Disk usage
free -h                # Memory usage
```

### Clear Uploads Directory
```bash
cd ~/convertnest_backend
pm2 stop convertnest-backend
rm -rf uploads/*
pm2 start convertnest-backend
```

---

## 🔒 Security Best Practices

### 1. Regular Updates
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Setup Fail2Ban (Optional)
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Change SSH Port (Optional)
```bash
sudo nano /etc/ssh/sshd_config
# Change Port 22 to Port 2222 (or any other)
sudo systemctl restart ssh
```

### 4. Disable Root Login
```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh
```

---

## 🐛 Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs convertnest-backend --lines 100

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart application
pm2 restart convertnest-backend
```

### Nginx Errors
```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx SSL configuration
sudo nano /etc/nginx/sites-available/convertnest-backend
```

### Out of Disk Space
```bash
# Check disk usage
df -h

# Clean up old logs
pm2 flush

# Clean uploads directory
cd ~/convertnest_backend
rm -rf uploads/*

# Clear APT cache
sudo apt clean
sudo apt autoremove
```

---

## 📊 Monitoring and Alerts

### Setup Uptime Monitoring (Recommended)
- Use [UptimeRobot](https://uptimerobot.com) (Free)
- Add monitor: `https://api.convertnest.tech/`
- Get email alerts if down

### Digital Ocean Monitoring
- Enable in Digital Ocean dashboard
- Setup CPU/Memory/Disk alerts
- Monitor bandwidth usage

---

## ✅ Deployment Checklist

- [ ] Droplet created and SSH access configured
- [ ] Node.js 20.x installed
- [ ] Backend cloned and dependencies installed
- [ ] .env file configured with production settings
- [ ] PM2 process manager configured
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Firewall configured
- [ ] Frontend .env.local updated with production API URL
- [ ] Frontend rebuilt and deployed
- [ ] API tested successfully
- [ ] Image to PDF tool tested end-to-end
- [ ] Monitoring setup (UptimeRobot)
- [ ] Auto-deployment script configured (optional)

---

## 🚀 Quick Reference

```bash
# Start backend
pm2 start convertnest-backend

# Stop backend
pm2 stop convertnest-backend

# Restart backend
pm2 restart convertnest-backend

# View logs
pm2 logs convertnest-backend

# Update backend
cd ~/convertnest_backend && git pull && npm install --production && pm2 restart convertnest-backend

# Restart Nginx
sudo systemctl restart nginx

# Renew SSL
sudo certbot renew
```

---

## 📞 Support

- GitHub Issues: https://github.com/rjit1/convertnest_backend/issues
- Documentation: https://github.com/rjit1/convertnest_backend/blob/main/README.md

**Your backend is now production-ready! 🎉**
