# ConvertNest Backend - Manual Step-by-Step Deployment
# Copy and paste these commands one by one into your PowerShell terminal

$DROPLET_IP = "64.227.133.82"
$PASSWORD = "First523@#`$SH"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ConvertNest Backend Deployment Guide" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Server: $DROPLET_IP" -ForegroundColor Yellow
Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Green
Write-Host "1. Open a new PowerShell terminal" -ForegroundColor White
Write-Host "2. Copy the commands below ONE AT A TIME" -ForegroundColor White
Write-Host "3. Paste into PowerShell and press Enter" -ForegroundColor White
Write-Host "4. When prompted for password, enter: $PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMMANDS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "# Step 1: Connect to your droplet" -ForegroundColor Yellow
Write-Host "ssh root@$DROPLET_IP" -ForegroundColor White
Write-Host ""

Write-Host "# Step 2: Update system (run on droplet)" -ForegroundColor Yellow
Write-Host @"
apt update && apt upgrade -y
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 3: Install Node.js 20.x (run on droplet)" -ForegroundColor Yellow
Write-Host @"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs git nginx certbot python3-certbot-nginx build-essential
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 4: Install PM2 (run on droplet)" -ForegroundColor Yellow
Write-Host @"
npm install -g pm2
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 5: Verify installations (run on droplet)" -ForegroundColor Yellow
Write-Host @"
node --version && npm --version && pm2 --version
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 6: Create app user (run on droplet)" -ForegroundColor Yellow
Write-Host @"
adduser --disabled-password --gecos "" convertnest
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 7: Switch to app user (run on droplet)" -ForegroundColor Yellow
Write-Host @"
su - convertnest
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 8: Clone repository (run as convertnest user)" -ForegroundColor Yellow
Write-Host @"
git clone https://github.com/rjit1/convertnest_backend.git
cd convertnest_backend
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 9: Create .env file (run as convertnest user)" -ForegroundColor Yellow
Write-Host @'
cat > .env << 'EOL'
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://www.convertnest.tech,https://convertnest.tech,http://64.227.133.82:3000
MAX_FILE_SIZE=104857600
CLEANUP_INTERVAL_HOURS=1
FILE_RETENTION_HOURS=24
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EXCHANGERATE_API_KEY=761b4a8979e49eaf282165b2
EOL
'@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 10: Install dependencies and setup (run as convertnest user)" -ForegroundColor Yellow
Write-Host @"
npm install --production && mkdir -p uploads logs && chmod 755 uploads logs
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 11: Start with PM2 (run as convertnest user)" -ForegroundColor Yellow
Write-Host @"
pm2 start src/server.js --name convertnest-backend && pm2 save
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 12: Exit to root user (run as convertnest user)" -ForegroundColor Yellow
Write-Host @"
exit
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 13: Setup PM2 auto-start (run as root)" -ForegroundColor Yellow
Write-Host @"
env PATH=`$PATH:/usr/bin pm2 startup systemd -u convertnest --hp /home/convertnest
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 14: Configure Nginx (run as root)" -ForegroundColor Yellow
Write-Host @'
cat > /etc/nginx/sites-available/convertnest-backend << 'EOL'
server {
    listen 80;
    server_name 64.227.133.82;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
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
        
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
EOL
'@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 15: Enable Nginx site (run as root)" -ForegroundColor Yellow
Write-Host @"
ln -sf /etc/nginx/sites-available/convertnest-backend /etc/nginx/sites-enabled/ && nginx -t && systemctl restart nginx
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 16: Configure firewall (run as root)" -ForegroundColor Yellow
Write-Host @"
ufw allow OpenSSH && ufw allow 'Nginx Full' && echo 'y' | ufw enable && ufw status
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 17: Verify deployment (run as root)" -ForegroundColor Yellow
Write-Host @"
su - convertnest -c 'pm2 status'
"@ -ForegroundColor White
Write-Host ""

Write-Host "# Step 18: Exit from droplet" -ForegroundColor Yellow
Write-Host @"
exit
"@ -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "After deployment, update your frontend:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Edit: E:\tool\convertnest\.env.local" -ForegroundColor White
Write-Host "Set: NEXT_PUBLIC_API_URL=http://64.227.133.82" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then test: http://64.227.133.82" -ForegroundColor White
Write-Host ""
